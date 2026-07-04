import { supabase, db } from '../../supabase'
import type { EventsAdapter } from '../interface'
import type { RoadEvent, CreateEventPayload, VoteValue } from '../../../types/event'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface EventRow {
  id: string; author_id: string; type: string; lat: number; lng: number
  description: string | null; positive_votes: number; negative_votes: number
  expires_at: string; created_at: string
}

function toEvent(row: EventRow): RoadEvent {
  return {
    id: row.id, authorId: row.author_id, type: row.type as RoadEvent['type'],
    lat: row.lat, lng: row.lng, description: row.description,
    positiveVotes: row.positive_votes, negativeVotes: row.negative_votes,
    expiresAt: row.expires_at, createdAt: row.created_at,
  }
}

async function loadActiveEvents(): Promise<RoadEvent[]> {
  const { data } = await db.from('road_events').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(200)
  return ((data ?? []) as EventRow[]).map(toEvent)
}

export const supabaseEventsAdapter: EventsAdapter = {
  async getEventsInBounds(minLat, maxLat, minLng, maxLng): Promise<RoadEvent[]> {
    const { data, error } = await db.from('road_events').select('*')
      .gte('lat', minLat).lte('lat', maxLat).gte('lng', minLng).lte('lng', maxLng)
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(200)
    if (error) throw new Error(String(error.message))
    return ((data ?? []) as EventRow[]).map(toEvent)
  },
  async createEvent(payload: CreateEventPayload): Promise<RoadEvent> {
    const { data, error } = await db.rpc('create_road_event', {
      p_type: payload.type, p_lat: payload.lat, p_lng: payload.lng, p_description: payload.description ?? null,
    })
    if (error || !data) throw new Error(String(error?.message ?? 'Create event failed'))
    return toEvent(data as EventRow)
  },
  async voteOnEvent(eventId: string, vote: VoteValue): Promise<void> {
    const { error } = await db.rpc('vote_on_event', { p_event_id: eventId, p_vote: vote === 'yes' })
    if (error) throw new Error(String(error.message))
  },
  subscribeToEvents(onUpdate: (events: RoadEvent[]) => void): () => void {
    void loadActiveEvents().then(onUpdate)
    const channel: RealtimeChannel = supabase.channel('public:road_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'road_events' }, () => void loadActiveEvents().then(onUpdate))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  },
}
