import { COLORS, FONT, SPACING, RADIUS } from '../ui/tokens'
import { EVENT_TYPE_CONFIG, type EventType } from '../../types/event'
import type { Coords } from '../../types/geo'

interface Props {
  coords: Coords | null
  onCreate: (type: EventType, coords: Coords, description?: string) => Promise<void>
  onClose: () => void
  creating: boolean
}

const EVENT_TYPES = Object.values(EVENT_TYPE_CONFIG)

export function AddEventSheet({ coords, onCreate, onClose, creating }: Props) {
  if (!coords) return null

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{
        width: '100%', backgroundColor: COLORS.bgCard, borderRadius: `${RADIUS.xl}px ${RADIUS.xl}px 0 0`,
        padding: SPACING.md, paddingBottom: `calc(${SPACING.lg}px + env(safe-area-inset-bottom, 0px))`,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, margin: '0 auto 16px' }} />
        <p style={{ color: COLORS.textPrimary, fontSize: FONT.md, fontWeight: 600, marginBottom: SPACING.xs }}>Добавить событие</p>
        <p style={{ color: COLORS.textSecond, fontSize: FONT.xs, marginBottom: SPACING.md }}>
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: SPACING.xs, marginBottom: SPACING.md }}>
          {EVENT_TYPES.map((cfg) => (
            <button key={cfg.type} disabled={creating} onClick={() => void onCreate(cfg.type, coords)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: `${SPACING.sm}px ${SPACING.xs}px`, backgroundColor: COLORS.bgElevated,
              border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.6 : 1, WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ fontSize: 24 }}>{cfg.icon}</span>
              <span style={{ fontSize: FONT.xs, color: COLORS.textSecond, textAlign: 'center', lineHeight: 1.2 }}>{cfg.label}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{
          width: '100%', padding: '12px', backgroundColor: COLORS.bgElevated, color: COLORS.textSecond,
          border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, fontSize: FONT.sm, cursor: 'pointer',
        }}>Отмена</button>
      </div>
    </div>
  )
}
