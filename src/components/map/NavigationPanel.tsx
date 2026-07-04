import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { COLORS, FONT, SPACING, RADIUS } from '../ui/tokens'
import type { Route } from '../../hooks/useRoute'
import { haversineMetres } from '../../engines/haversine'
import type { GPSPosition } from '../../types/geo'
import { useDraggable } from '../../hooks/useDraggable'

interface Props {
  route: Route
  position: GPSPosition | null
  onClear: () => void
}

function maneuverIcon(maneuver: string): string {
  if (maneuver.includes('sharp-left'))   return '↰'
  if (maneuver.includes('sharp-right'))  return '↱'
  if (maneuver.includes('slight-left'))  return '↖'
  if (maneuver.includes('slight-right')) return '↗'
  if (maneuver.includes('left'))         return '←'
  if (maneuver.includes('right'))        return '→'
  if (maneuver === 'uturn')              return '↩'
  if (maneuver === 'roundabout')         return '🔄'
  if (maneuver === 'arrive')             return '🏁'
  return '↑'
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} м`
  return `${(m / 1000).toFixed(1)} км`
}

function formatEta(durationS: number): string {
  const d = new Date(Date.now() + durationS * 1000)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatTotal(m: number): string {
  if (m < 1000) return `${Math.round(m)} м`
  return `${(m / 1000).toFixed(1)} км`
}

export function NavigationPanel({ route, position, onClear }: Props) {
  const { pos, onPointerDown, onPointerMove, onPointerUp, wasTap } = useDraggable({ x: 0, y: 0 })
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [distToStep, setDistToStep] = useState(0)
  const [remainingDist, setRemainingDist] = useState(route.distanceM)
  const [remainingTime, setRemainingTime] = useState(route.durationS)
  const spokenRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!position) return
    const step = route.steps[currentStepIdx]
    if (!step) return

    const dist = haversineMetres(position.lat, position.lng, step.lat, step.lng)
    setDistToStep(dist)

    // Найти ближайший шаг
    let closest = currentStepIdx
    let minDist = Infinity
    const lookAhead = Math.min(currentStepIdx + 6, route.steps.length)
    for (let i = currentStepIdx; i < lookAhead; i++) {
      const s = route.steps[i]!
      const d = haversineMetres(position.lat, position.lng, s.lat, s.lng)
      if (d < minDist) { minDist = d; closest = i }
    }
    if (closest > currentStepIdx) setCurrentStepIdx(closest)

    // Оставшееся расстояние
    let remaining = dist
    for (let i = currentStepIdx + 1; i < route.steps.length; i++) {
      remaining += route.steps[i]!.distanceM
    }
    setRemainingDist(remaining)

    const speed = Math.max(position.speed, 8) // мин 8 м/с (~30 км/ч) для расчёта
    setRemainingTime(Math.round(remaining / speed))

    // Голосовая подсказка за 200м
    const next = route.steps[currentStepIdx + 1]
    if (next && dist < 200 && !spokenRef.current.has(currentStepIdx)) {
      spokenRef.current.add(currentStepIdx)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utt = new SpeechSynthesisUtterance(
          `Через ${formatDist(dist)} — ${next.instruction}`
        )
        utt.lang = 'ru-RU'; utt.rate = 1.05
        window.speechSynthesis.speak(utt)
      }
    }
  }, [position?.lat, position?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextStep = route.steps[currentStepIdx + 1]
  const afterStep = route.steps[currentStepIdx + 2]

  const panelStyle: CSSProperties = {
    position: 'absolute',
    top: 12 + pos.y,
    left: 12 + pos.x,
    zIndex: 460,
    minWidth: 210,
    maxWidth: 270,
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
  }

  return (
    <div
      style={panelStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => { onPointerUp() }}
    >
      {/* Основная карточка */}
      <div style={{
        backgroundColor: 'rgba(15,15,15,0.95)',
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
      }}>
        {/* Манёвр */}
        <div style={{
          padding: `${SPACING.sm}px ${SPACING.md}px`,
          display: 'flex', alignItems: 'center', gap: SPACING.sm,
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{
            width: 48, height: 48, flexShrink: 0,
            backgroundColor: COLORS.accent + '22',
            border: `2px solid ${COLORS.accent}`,
            borderRadius: RADIUS.md,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: COLORS.accent,
          }}>
            {nextStep ? maneuverIcon(nextStep.maneuver) : '🏁'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 24, fontWeight: 800, color: COLORS.textPrimary,
              lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {formatDist(distToStep)}
            </div>
            <div style={{
              fontSize: FONT.xs, color: COLORS.textSecond, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {nextStep?.instruction ?? 'Прибытие'}
            </div>
          </div>

          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClear}
            style={{
              background: 'none', border: 'none',
              color: COLORS.textDisabled, fontSize: 18,
              cursor: 'pointer', padding: 4, flexShrink: 0,
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* ETA + расстояние */}
        <div style={{
          padding: `${SPACING.xs}px ${SPACING.md}px`,
          display: 'flex', gap: SPACING.md, alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: FONT.base, fontWeight: 700, color: COLORS.textPrimary }}>
              {formatEta(remainingTime)}
            </span>
            <span style={{ fontSize: FONT.xs, color: COLORS.textDisabled, marginLeft: 4 }}>
              прибытие
            </span>
          </div>
          <span style={{ color: COLORS.border }}>·</span>
          <span style={{ fontSize: FONT.sm, color: COLORS.textSecond }}>
            {formatTotal(remainingDist)}
          </span>
        </div>
      </div>

      {/* Следующий-следующий манёвр */}
      {afterStep && (
        <div style={{
          marginTop: 4,
          backgroundColor: 'rgba(15,15,15,0.8)',
          borderRadius: RADIUS.md,
          border: `1px solid ${COLORS.border}`,
          padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: FONT.xs, color: COLORS.textSecond,
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 14 }}>{maneuverIcon(afterStep.maneuver)}</span>
          <span>затем {afterStep.instruction.toLowerCase()}</span>
        </div>
      )}
    </div>
  )
}
