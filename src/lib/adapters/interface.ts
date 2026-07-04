
import type { UserProfile } from '../../types/user'
import type { RoadEvent, CreateEventPayload, VoteValue } from '../../types/event'

export interface AuthAdapter {
  signInAnonymous(): Promise<UserProfile>
  getCurrentUser(): Promise<UserProfile | null>
  signOut(): Promise<void>
  updateProfile(data: Partial<Pick<UserProfile, 'displayName' | 'phone'>>): Promise<UserProfile>
}

export interface EventsAdapter {
  getEventsInBounds(minLat: number, maxLat: number, minLng: number, maxLng: number): Promise<RoadEvent[]>
  createEvent(payload: CreateEventPayload): Promise<RoadEvent>
  voteOnEvent(eventId: string, vote: VoteValue): Promise<void>
  subscribeToEvents(onUpdate: (events: RoadEvent[]) => void): () => void
}

export interface AppAdapters { auth: AuthAdapter; events: EventsAdapter }
