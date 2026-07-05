
export type EventType = "camera" | "police" | "accident" | "repair" | "danger" | "speed_zone"

export interface RoadEvent {
  id: string
  authorId: string
  type: EventType
  lat: number
  lng: number
  description: string | null
  positiveVotes: number
  negativeVotes: number
  expiresAt: string
  createdAt: string
  // Опциональное направление автора события (0-360, undefined = направление неизвестно → алерт всем)
  heading?: number
  // Поля зоны средней скорости (только для type === "speed_zone")
  endLat?: number
  endLng?: number
  zoneLimitKmh?: number
}

export interface EventTypeConfig {
  type: EventType
  ttlMins: number
  icon: string
  label: string
  color: string
}

export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  camera:     { type: "camera",     ttlMins: 180,  icon: "📷", label: "Камера",                       color: "#3B82F6" },
  police:     { type: "police",     ttlMins: 60,   icon: "🚔", label: "Полиция",                      color: "#8B5CF6" },
  accident:   { type: "accident",   ttlMins: 90,   icon: "💥", label: "ДТП",                          color: "#EF4444" },
  repair:     { type: "repair",     ttlMins: 480,  icon: "🚧", label: "Ремонт",                       color: "#F59E0B" },
  danger:     { type: "danger",     ttlMins: 45,   icon: "⚠️", label: "Опасность",                    color: "#F97316" },
  speed_zone: { type: "speed_zone", ttlMins: 1440, icon: "📏", label: "Контроль средней скорости",    color: "#EC4899" },
}

export interface CreateEventPayload {
  type: EventType
  lat: number
  lng: number
  description?: string
  // Опциональные поля (ТЗ №2)
  heading?: number
  endLat?: number
  endLng?: number
  zoneLimitKmh?: number
}

export type VoteValue = "yes" | "no"
