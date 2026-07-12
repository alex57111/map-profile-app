
import { db, supabase } from "../../supabase"
import { Sentry } from "../../sentry"
import type { EventsAdapter } from "../interface"
import type { RoadEvent, CreateEventPayload, VoteValue } from "../../../types/event"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(row: any): RoadEvent {
  return {
    id: row.id, authorId: row.author_id, type: row.type,
    lat: row.lat, lng: row.lng, description: row.description,
    positiveVotes: row.positive_votes, negativeVotes: row.negative_votes,
    expiresAt: row.expires_at, createdAt: row.created_at,
    // Блок 6: updated_at из БД (обновляется при создании и подтверждении
    // актуальности, не при голосовании — см. supabase/schema.sql).
    ...(row.updated_at !== null && row.updated_at !== undefined && { updatedAt: row.updated_at }),
    // Расхождение Блока 2 (см. AGENT_LOG.md) — теперь мапится из строки БД
    ...(row.heading !== null && row.heading !== undefined && { heading: row.heading }),
    ...(row.end_lat !== null && row.end_lat !== undefined && { endLat: row.end_lat }),
    ...(row.end_lng !== null && row.end_lng !== undefined && { endLng: row.end_lng }),
    ...(row.zone_limit_kmh !== null && row.zone_limit_kmh !== undefined && { zoneLimitKmh: row.zone_limit_kmh }),
  }
}

// Блок 6: expires_at теперь nullable (NULL = не истекает, camera). Простой
// .gt("expires_at", now) молча исключает NULL-строки (NULL > x → NULL →
// false в WHERE) — нужен явный .or() с обеими ветками во всех местах,
// где раньше был .gt().
function notExpiredOrClause(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`
}

export const supabaseEventsAdapter: EventsAdapter = {
  async getEventsInBounds(minLat, maxLat, minLng, maxLng): Promise<RoadEvent[]> {
    const { data } = await db.from("road_events").select("*")
      .gte("lat", minLat).lte("lat", maxLat).gte("lng", minLng).lte("lng", maxLng)
      .or(notExpiredOrClause()).order("created_at", { ascending: false }).limit(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data ?? []) as any[]).map(toEvent)
  },
  async createEvent(payload: CreateEventPayload): Promise<RoadEvent> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("create_road_event", {
      p_type: payload.type, p_lat: payload.lat, p_lng: payload.lng, p_description: payload.description ?? null,
      p_heading: payload.heading ?? null, p_end_lat: payload.endLat ?? null,
      p_end_lng: payload.endLng ?? null, p_zone_limit_kmh: payload.zoneLimitKmh ?? null,
    })
    if (error || !data) throw new Error(String(error?.message ?? "Create event failed"))
    return toEvent(data)
  },
  async voteOnEvent(eventId: string, vote: VoteValue): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).rpc("vote_on_event", { p_event_id: eventId, p_vote: vote === "yes" })
    if (error) throw new Error(String(error.message))
  },
  async confirmEventRelevant(eventId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).rpc("confirm_event_relevant", { p_event_id: eventId })
    if (error) throw new Error(String(error.message))
  },
  subscribeToEvents(onUpdate: (events: RoadEvent[]) => void): () => void {
    void db.from("road_events").select("*").or(notExpiredOrClause())
      .then(({ data, error }) => {
        if (error) {
          Sentry.captureException(new Error(error.message), {
            tags: { op: 'subscribeToEvents.initialFetch' },
          })
        }
        onUpdate(((data ?? []) as any[]).map(toEvent))
      })
    const channel = supabase.channel("public:road_events")
      .on("postgres_changes", { event: "*", schema: "public", table: "road_events" },
        () => void db.from("road_events").select("*").or(notExpiredOrClause())
          .then(({ data, error }) => {
            if (error) {
              Sentry.captureException(new Error(error.message), {
                tags: { op: 'subscribeToEvents.realtimeRefetch' },
              })
            }
            onUpdate(((data ?? []) as any[]).map(toEvent))
          }))
      .subscribe((status, err) => {
        // Ошибки самого realtime-канала (CHANNEL_ERROR/TIMED_OUT) не ловятся
        // обычным try/catch вокруг подписки — нужен колбэк .subscribe() (см. ТЗ,
        // аналогичная логика понадобится для usePresence, когда там появится
        // реальный Supabase-канал вместо текущего мока).
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          Sentry.captureException(err ?? new Error(`road_events channel status: ${status}`), {
            tags: { op: 'subscribeToEvents.channel', status },
          })
        }
      })
    return () => { void supabase.removeChannel(channel) }
  },
}
