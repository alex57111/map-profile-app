export type EventType = 'camera' | 'police' | 'accident' | 'repair' | 'danger'
export interface RoadEvent {
  id: string; authorId: string; type: EventType; lat: number; lng: number
  description: string | null; positiveVotes: number; negativeVotes: number
  expiresAt: string; createdAt: string
}
export interface EventTypeConfig {
  type: EventType; ttlMins: number; icon: string; label: string; color: string
}
export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  camera:   { type: 'camera',   ttlMins: 180, icon: '📷', label: 'Камера',     color: '#3B82F6' },
  police:   { type: 'police',   ttlMins: 60,  icon: '🚔', label: 'Полиция',    color: '#8B5CF6' },
  accident: { type: 'accident', ttlMins: 90,  icon: '💥', label: 'ДТП',        color: '#EF4444' },
  repair:   { type: 'repair',   ttlMins: 480, icon: '🚧', label: 'Ремонт',     color: '#F59E0B' },
  danger:   { type: 'danger',   ttlMins: 45,  icon: '⚠️', label: 'Опасность',  color: '#F97316' },
}
export interface CreateEventPayload { type: EventType; lat: number; lng: number; description?: string }
export type VoteValue = 'yes' | 'no'
