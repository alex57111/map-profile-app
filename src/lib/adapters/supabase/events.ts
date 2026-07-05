
import { db, supabase } from "../../supabase"
import type { EventsAdapter } from "../interface"
import type { RoadEvent, CreateEventPayload, VoteValue } from "../../../types/event"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(row: any): RoadEvent {
  return {
    id: row.id, authorId: row.author_id, type: row.type,
    lat: row.lat, lng: row.lng, description: row.description,
    positiveVotes: row.positive_votes, negativeVotes: row.negative_votes,
    expiresAt: row.expires_at, createdAt: row.created_at,
  }
}

export const supabaseEventsAdapter: EventsAdapter = {
  async getEventsInBounds(minLat, maxLat, minLng, maxLng): Promise<RoadEvent[]> {
    const { data } = await db.from("road_events").select("*")
      .gte("lat", minLat).lte("lat", maxLat).gte("lng", minLng).lte("lng", maxLng)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data ?? []) as any[]).map(toEvent)
  },
  async createEvent(payload: CreateEventPayload): Promise<RoadEvent> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("create_road_event", {
      p_type: payload.type, p_lat: payload.lat, p_lng: payload.lng, p_description: payload.description ?? null,
    })
    if (error || !data) throw new Error(String(error?.message ?? "Create event failed"))
    return toEvent(data)
  },
  async voteOnEvent(eventId: string, vote: VoteValue): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).rpc("vote_on_event", { p_event_id: eventId, p_vote: vote === "yes" })
    if (error) throw new Error(String(error.message))
  },
  subscribeToEvents(onUpdate: (events: RoadEvent[]) => void): () => void {
    void db.from("road_events").select("*").gt("expires_at", new Date().toISOString())
      .then(({ data }) => onUpdate(((data ?? []) as any[]).map(toEvent)))
    const channel = supabase.channel("public:road_events")
      .on("postgres_changes", { event: "*", schema: "public", table: "road_events" },
        () => void db.from("road_events").select("*").gt("expires_at", new Date().toISOString())
          .then(({ data }) => onUpdate(((data ?? []) as any[]).map(toEvent))))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  },
}
