
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
  // Блок 6: null = событие не истекает (camera — стационарная камера).
  expiresAt: string | null
  createdAt: string
  // Блок 6: когда событие последний раз обновлялось (создание или
  // подтверждение актуальности через confirmEventRelevant). Опционально —
  // синтетические события (OSM-зоны, useOsmSpeedZones) его не заполняют.
  updatedAt?: string
  // Опциональное направление автора события (0-360, undefined = направление неизвестно → алерт всем)
  heading?: number
  // Поля зоны средней скорости (только для type === "speed_zone")
  endLat?: number
  endLng?: number
  zoneLimitKmh?: number
}

export interface EventTypeConfig {
  type: EventType
  // Блок 6: null = событие не истекает (сейчас только camera).
  ttlMins: number | null
  icon: string
  label: string
  color: string
}

// TTL заменены на новые значения из ТЗ Блока 6 (2026-07-11, по прямому
// указанию Alex — "заменить текущие на новые"). camera переиспользован как
// camera_stationary из ТЗ (новый отдельный тип не заводили — см.
// AGENT_LOG.md, заход 16): ttlMins: null, никогда не истекает.
// accident/repair/police — явные значения из ТЗ. danger/speed_zone —
// "остальные типы" из ТЗ, 6 часов по умолчанию.
export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  camera:     { type: "camera",     ttlMins: null, icon: "📷", label: "Камера",                       color: "#3B82F6" },
  police:     { type: "police",     ttlMins: 120,  icon: "🚔", label: "Полиция",                      color: "#8B5CF6" },
  accident:   { type: "accident",   ttlMins: 180,  icon: "💥", label: "ДТП",                          color: "#EF4444" },
  repair:     { type: "repair",     ttlMins: 1440, icon: "🚧", label: "Ремонт",                       color: "#F59E0B" },
  danger:     { type: "danger",     ttlMins: 360,  icon: "⚠️", label: "Опасность",                    color: "#F97316" },
  speed_zone: { type: "speed_zone", ttlMins: 360,  icon: "📏", label: "Контроль средней скорости",    color: "#EC4899" },
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
