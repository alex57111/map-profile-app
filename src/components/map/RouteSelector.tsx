import type { CSSProperties } from 'react'
import { COLORS, FONT, SPACING, RADIUS } from '../ui/tokens'
import type { Route } from '../../hooks/useRoute'

interface Props {
  routes: Route[]
  onSelect: (route: Route) => void
  onCancel: () => void
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} м`
  return `${(m / 1000).toFixed(1)} км`
}

const ROUTE_ICONS: Record<number, string> = { 0: '⚡', 1: '🛣️', 2: '🔀' }
const ROUTE_COLORS: Record<number, string> = {
  0: COLORS.accent,
  1: COLORS.success,
  2: COLORS.info,
}

export function RouteSelector({ routes, onSelect, onCancel }: Props) {
  const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 600,
    display: 'flex', alignItems: 'flex-end',
  }

  const sheetStyle: CSSProperties = {
    width: '100%',
    backgroundColor: COLORS.bgCard,
    borderRadius: `${RADIUS.xl}px ${RADIUS.xl}px 0 0`,
    padding: SPACING.md,
    paddingBottom: `calc(${SPACING.lg}px + env(safe-area-inset-bottom, 0px))`,
  }

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Ручка */}
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, margin: '0 auto 16px' }} />

        <p style={{ fontSize: FONT.md, fontWeight: 700, color: COLORS.textPrimary, marginBottom: SPACING.md, textAlign: 'center' }}>
          Выберите маршрут
        </p>

        {/* Карточки вариантов */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginBottom: SPACING.md }}>
          {routes.map((route, idx) => (
            <button
              key={route.id}
              onClick={() => onSelect(route)}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACING.md,
                padding: SPACING.md,
                backgroundColor: COLORS.bgElevated,
                border: `2px solid ${idx === 0 ? ROUTE_COLORS[0]! : COLORS.border}`,
                borderRadius: RADIUS.lg,
                cursor: 'pointer',
                textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Иконка */}
              <div style={{
                width: 44, height: 44, flexShrink: 0,
                backgroundColor: (ROUTE_COLORS[idx] ?? COLORS.info) + '20',
                border: `2px solid ${ROUTE_COLORS[idx] ?? COLORS.info}`,
                borderRadius: RADIUS.md,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {ROUTE_ICONS[idx] ?? '🗺️'}
              </div>

              {/* Инфо */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FONT.base, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 2 }}>
                  {route.label}
                  {idx === 0 && (
                    <span style={{ marginLeft: 8, fontSize: FONT.xs, color: ROUTE_COLORS[0], fontWeight: 600 }}>
                      РЕКОМЕНДОВАН
                    </span>
                  )}
                </div>
                <div style={{ fontSize: FONT.sm, color: COLORS.textSecond }}>
                  {formatDist(route.distanceM)} · {formatDuration(route.durationS)}
                </div>
              </div>

              {/* Время */}
              <div style={{ fontSize: FONT.lg, fontWeight: 800, color: ROUTE_COLORS[idx] ?? COLORS.info, flexShrink: 0 }}>
                {formatDuration(route.durationS)}
              </div>
            </button>
          ))}
        </div>

        {/* Отмена */}
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '12px',
            backgroundColor: 'transparent',
            color: COLORS.textSecond, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md, fontSize: FONT.sm, cursor: 'pointer',
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
