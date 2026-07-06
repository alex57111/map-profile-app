
import { useState } from "react"
import { COLORS, FONT, SPACING, RADIUS } from "../ui/tokens"
import { EVENT_TYPE_CONFIG, type EventType } from "../../types/event"
import type { Coords } from "../../types/geo"

interface Props {
  coords: Coords | null
  userHeading?: number  // GPS heading для направленных событий
  onCreate: (type: EventType, coords: Coords, options?: { description?: string; heading?: number; endLat?: number; endLng?: number; zoneLimitKmh?: number }) => Promise<void>
  onClose: () => void
  creating: boolean
}

// Все типы кроме speed_zone — обычные точки
const NORMAL_TYPES = Object.values(EVENT_TYPE_CONFIG).filter((c) => c.type !== "speed_zone")

// Вычислить точку в distM метрах по направлению heading от lat/lng
function pointAtDistance(lat: number, lng: number, heading: number, distM: number): Coords {
  const R = 6_371_000
  const rad = (heading * Math.PI) / 180
  const dLat = (distM * Math.cos(rad)) / R
  const dLng = (distM * Math.sin(rad)) / (R * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + (dLat * 180) / Math.PI, lng: lng + (dLng * 180) / Math.PI }
}

export function AddEventSheet({ coords, userHeading, onCreate, onClose, creating }: Props) {
  const [speedLimit, setSpeedLimit] = useState(60)

  if (!coords) return null

  const handleNormal = async (type: EventType) => {
    await onCreate(type, coords, {
      heading: userHeading, // сохраняем направление водителя
    })
    onClose()
  }

  const handleSpeedZone = async () => {
    // TODO: UI выбора двух точек — пока фиксированная длина 2км по направлению движения
    const heading = userHeading ?? 0
    const endPoint = pointAtDistance(coords.lat, coords.lng, heading, 2000)
    await onCreate("speed_zone", coords, {
      endLat: endPoint.lat,
      endLng: endPoint.lng,
      zoneLimitKmh: speedLimit,
      description: `Зона ${speedLimit} км/ч`,
    })
    onClose()
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", backgroundColor: COLORS.bgCard, borderRadius: `${RADIUS.xl}px ${RADIUS.xl}px 0 0`, padding: SPACING.md, paddingBottom: `calc(${SPACING.lg}px + env(safe-area-inset-bottom, 0px))` }} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, margin: "0 auto 16px" }} />
        <p style={{ color: COLORS.textPrimary, fontSize: FONT.md, fontWeight: 600, marginBottom: SPACING.xs }}>Добавить событие</p>
        <p style={{ color: COLORS.textSecond, fontSize: FONT.xs, marginBottom: SPACING.md }}>
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {userHeading !== undefined && <span style={{ marginLeft: 8, color: COLORS.accent }}>→ {Math.round(userHeading)}°</span>}
        </p>

        {/* Обычные типы событий */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: SPACING.xs, marginBottom: SPACING.md }}>
          {NORMAL_TYPES.map((cfg) => (
            <button key={cfg.type} disabled={creating} onClick={() => void handleNormal(cfg.type)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: `${SPACING.sm}px ${SPACING.xs}px`,
              backgroundColor: COLORS.bgElevated,
              border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md,
              cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1,
              WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontSize: 24 }}>{cfg.icon}</span>
              <span style={{ fontSize: FONT.xs, color: COLORS.textSecond, textAlign: "center", lineHeight: 1.2 }}>{cfg.label}</span>
            </button>
          ))}
        </div>

        {/* Зона контроля средней скорости */}
        <div style={{ backgroundColor: COLORS.bgElevated, border: `1px solid #EC4899`, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.xs }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>📏</span>
              <div>
                <div style={{ fontSize: FONT.sm, fontWeight: 600, color: COLORS.textPrimary }}>Зона контроля скорости</div>
                <div style={{ fontSize: FONT.xs, color: COLORS.textSecond }}>2 км по направлению движения</div>
              </div>
            </div>
          </div>
          {/* Выбор лимита */}
          <div style={{ display: "flex", gap: SPACING.xs, marginBottom: SPACING.xs }}>
            {[40, 60, 80, 90, 110].map((limit) => (
              <button key={limit} onClick={() => setSpeedLimit(limit)} style={{
                flex: 1, padding: "6px 2px", fontSize: FONT.xs, fontWeight: 600,
                backgroundColor: speedLimit === limit ? "#EC4899" + "33" : COLORS.bgCard,
                border: `1px solid ${speedLimit === limit ? "#EC4899" : COLORS.border}`,
                borderRadius: RADIUS.sm, color: speedLimit === limit ? "#EC4899" : COLORS.textSecond,
                cursor: "pointer",
              }}>{limit}</button>
            ))}
          </div>
          <button disabled={creating} onClick={() => void handleSpeedZone()} style={{
            width: "100%", padding: "10px", backgroundColor: "#EC4899",
            color: "#fff", border: "none", borderRadius: RADIUS.md,
            fontSize: FONT.sm, fontWeight: 700, cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.6 : 1,
          }}>
            📏 Создать зону {speedLimit} км/ч
          </button>
        </div>

        <button onClick={onClose} style={{ width: "100%", padding: "12px", backgroundColor: COLORS.bgElevated, color: COLORS.textSecond, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, fontSize: FONT.sm, cursor: "pointer" }}>
          Отмена
        </button>
      </div>
    </div>
  )
}
