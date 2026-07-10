
import type { EventsAdapter } from "../interface"
import type { RoadEvent, CreateEventPayload, VoteValue } from "../../../types/event"
import { EVENT_TYPE_CONFIG } from "../../../types/event"

const eventsStore: RoadEvent[] = [
  {
    id: "mock-ev-1", authorId: "mock-user-3", type: "camera",
    lat: 55.762, lng: 37.625, description: null,
    positiveVotes: 4, negativeVotes: 1,
    expiresAt: new Date(Date.now() + 7200_000).toISOString(),
    createdAt: new Date().toISOString(),
    // Без heading — алерт всем (обратная совместимость)
  },
  {
    id: "mock-ev-2", authorId: "mock-user-4", type: "police",
    lat: 55.748, lng: 37.612, description: "Пост ДПС",
    positiveVotes: 2, negativeVotes: 0,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    createdAt: new Date().toISOString(),
    heading: 90, // направленное — только для едущих на восток ±45°
  },
  {
    id: "mock-ev-3", authorId: "mock-user-5", type: "speed_zone",
    lat: 55.755, lng: 37.620, description: "Средняя скорость 2 км",
    positiveVotes: 0, negativeVotes: 0,
    expiresAt: new Date(Date.now() + 1440 * 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    // TODO: endLat/endLng = точка в ~2км по направлению 90°
    endLat: 55.755, endLng: 37.648,
    zoneLimitKmh: 60,
  },
]

const votesStore = new Map<string, Map<string, VoteValue>>()
const subscribers: Array<(events: RoadEvent[]) => void> = []

function activeEvents(): RoadEvent[] {
  const now = Date.now()
  return eventsStore.filter((e) => new Date(e.expiresAt).getTime() > now)
}

function notifySubscribers(): void {
  subscribers.forEach((fn) => fn(activeEvents()))
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

export const mockEventsAdapter: EventsAdapter = {
  async getEventsInBounds(minLat, maxLat, minLng, maxLng): Promise<RoadEvent[]> {
    await delay(150)
    return activeEvents().filter(
      (e) => e.lat >= minLat && e.lat <= maxLat && e.lng >= minLng && e.lng <= maxLng
    )
  },

  async createEvent(payload: CreateEventPayload): Promise<RoadEvent> {
    await delay(250)
    const cfg = EVENT_TYPE_CONFIG[payload.type]
    const stored = localStorage.getItem("mock_user_profile")
    const user = stored ? JSON.parse(stored) : { id: "anon" }

    const event: RoadEvent = {
      id: `ev_${Date.now()}`,
      authorId: user.id,
      type: payload.type,
      lat: payload.lat,
      lng: payload.lng,
      description: payload.description ?? null,
      positiveVotes: 0,
      negativeVotes: 0,
      expiresAt: new Date(Date.now() + cfg.ttlMins * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
      // Опциональные поля из ТЗ №2
      ...(payload.heading !== undefined && { heading: payload.heading }),
      ...(payload.endLat !== undefined && { endLat: payload.endLat }),
      ...(payload.endLng !== undefined && { endLng: payload.endLng }),
      ...(payload.zoneLimitKmh !== undefined && { zoneLimitKmh: payload.zoneLimitKmh }),
    }

    eventsStore.push(event)
    notifySubscribers()
    return event
  },

  async voteOnEvent(eventId: string, vote: VoteValue): Promise<void> {
    await delay(150)
    const stored = localStorage.getItem("mock_user_profile")
    const userId = stored ? JSON.parse(stored).id : "anon"

    if (!votesStore.has(userId)) votesStore.set(userId, new Map())
    const userVotes = votesStore.get(userId)!
    if (userVotes.has(eventId)) return

    userVotes.set(eventId, vote)
    const ev = eventsStore.find((e) => e.id === eventId)
    if (!ev) return

    if (vote === "yes") ev.positiveVotes++
    else ev.negativeVotes++

    // Порог синхронизирован с боевой SQL-функцией vote_on_event — там -1
    // (применено вручную в Supabase, см. AGENT_LOG.md).
    if (ev.positiveVotes - ev.negativeVotes <= -1) {
      const idx = eventsStore.findIndex((e) => e.id === eventId)
      if (idx !== -1) eventsStore.splice(idx, 1)
    }

    notifySubscribers()
  },

  subscribeToEvents(onUpdate: (events: RoadEvent[]) => void): () => void {
    subscribers.push(onUpdate)
    onUpdate(activeEvents())
    return () => {
      const idx = subscribers.indexOf(onUpdate)
      if (idx !== -1) subscribers.splice(idx, 1)
    }
  },
}
