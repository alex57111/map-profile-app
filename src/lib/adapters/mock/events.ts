import type { EventsAdapter } from '../interface'
import type { RoadEvent, CreateEventPayload, VoteValue } from '../../../types/event'
import { EVENT_TYPE_CONFIG } from '../../../types/event'

const eventsStore: RoadEvent[] = [
  {
    id: 'mock-ev-1', authorId: 'mock-user-3', type: 'camera',
    lat: 55.762, lng: 37.625, description: null,
    positiveVotes: 4, negativeVotes: 1,
    expiresAt: new Date(Date.now() + 7200_000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-ev-2', authorId: 'mock-user-4', type: 'police',
    lat: 55.748, lng: 37.612, description: 'Пост ДПС',
    positiveVotes: 2, negativeVotes: 0,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    createdAt: new Date().toISOString(),
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
    const stored = localStorage.getItem('mock_user_profile')
    const user = stored ? JSON.parse(stored) : { id: 'anon' }
    const event: RoadEvent = {
      id: `ev_${Date.now()}`, authorId: user.id,
      type: payload.type, lat: payload.lat, lng: payload.lng,
      description: payload.description ?? null,
      positiveVotes: 0, negativeVotes: 0,
      expiresAt: new Date(Date.now() + cfg.ttlMins * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    }
    eventsStore.push(event)
    notifySubscribers()
    return event
  },

  async voteOnEvent(eventId: string, vote: VoteValue): Promise<void> {
    await delay(150)
    const stored = localStorage.getItem('mock_user_profile')
    const userId = stored ? JSON.parse(stored).id : 'anon'

    if (!votesStore.has(userId)) votesStore.set(userId, new Map())
    const userVotes = votesStore.get(userId)!
    if (userVotes.has(eventId)) return // уже голосовал

    userVotes.set(eventId, vote)
    const ev = eventsStore.find((e) => e.id === eventId)
    if (!ev) return

    if (vote === 'yes') ev.positiveVotes++
    else ev.negativeVotes++

    // Удаляем если score ≤ -3 (как в rideshare — защита от спама)
    // Один "хейтер" не удалит событие без поддержки других
    if (ev.positiveVotes - ev.negativeVotes <= -3) {
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
