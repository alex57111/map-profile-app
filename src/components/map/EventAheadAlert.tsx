import { useEffect, useState } from 'react'
import { COLORS, FONT, SPACING, RADIUS } from '../ui/tokens'
import { EVENT_TYPE_CONFIG } from '../../types/event'
import type { EventAlert } from '../../hooks/useEventsAhead'

interface Props {
  alerts: EventAlert[]
  onVote: (eventId: string, vote: 'yes' | 'no') => Promise<void>
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 8_000

export function EventAheadAlert({ alerts, onVote, onDismiss }: Props) {
  const [progress, setProgress] = useState(100)
  const [voted, setVoted] = useState(false)
  const [alertKey, setAlertKey] = useState(0)

  // Сброс при новом алерте
  useEffect(() => {
    if (alerts.length === 0) { setProgress(100); setVoted(false); return }
    setProgress(100)
    setVoted(false)
    setAlertKey((k) => k + 1)

    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100)
      setProgress(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 50)

    return () => clearInterval(interval)
  }, [alerts.length > 0 ? alerts[0]!.event.id : null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (alerts.length === 0) return null

  const first = alerts[0]!
  const cfg = EVENT_TYPE_CONFIG[first.event.type]

  // Живое расстояние
  const dist = first.distanceM < 50
    ? `${Math.round(first.distanceM)}м`
    : first.distanceM < 1000
    ? `${Math.round(first.distanceM / 10) * 10}м`
    : `${(first.distanceM / 1000).toFixed(1)}км`

  // Цвет дистанции: красный когда близко
  const distColor = first.distanceM < 100 ? COLORS.error
    : first.distanceM < 200 ? COLORS.warning
    : '#fff'

  const handleVote = async (vote: 'yes' | 'no') => {
    if (voted) return
    setVoted(true)
    await onVote(first.event.id, vote)
    setTimeout(onDismiss, 500)
  }

  return (
    <>
      <style>{`
        @keyframes alertPop {
          from { transform: scale(0.88) translateY(16px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Затемнение карты */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 490, pointerEvents: 'none',
      }} />

      {/* Карточка алерта */}
      <div key={alertKey} style={{
        position: 'absolute',
        left: SPACING.md, right: SPACING.md,
        top: '50%', transform: 'translateY(-55%)',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        border: `2px solid ${cfg.color}`,
        zIndex: 500,
        boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 24px ${cfg.color}33`,
        animation: 'alertPop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
        overflow: 'hidden',
      }}>
        {/* Прогресс-бар автоудаления */}
        <div style={{ height: 4, backgroundColor: COLORS.bgElevated }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            backgroundColor: cfg.color,
            transition: 'width 0.05s linear',
            borderRadius: '0 2px 2px 0',
          }} />
        </div>

        <div style={{ padding: `${SPACING.lg}px ${SPACING.md}px ${SPACING.md}px` }}>

          {/* Иконка */}
          <div style={{ textAlign: 'center', marginBottom: SPACING.md }}>
            <div style={{
              fontSize: 60, lineHeight: 1, marginBottom: SPACING.sm,
              filter: `drop-shadow(0 0 16px ${cfg.color}88)`,
            }}>
              {cfg.icon}
            </div>

            {/* ВПЕРЕДИ */}
            <div style={{
              fontSize: FONT.xs, color: cfg.color, fontWeight: 800,
              letterSpacing: 2, marginBottom: 6,
            }}>
              ВПЕРЕДИ
            </div>

            {/* Название */}
            <div style={{ fontSize: FONT.xl, fontWeight: 800, color: COLORS.textPrimary, marginBottom: 4 }}>
              {cfg.label}
            </div>

            {/* Живое расстояние */}
            <div style={{
              fontSize: 32, fontWeight: 800, color: distColor,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.3s',
            }}>
              {dist}
            </div>

            {first.event.description && (
              <div style={{ fontSize: FONT.sm, color: COLORS.textSecond, marginTop: SPACING.xs }}>
                {first.event.description}
              </div>
            )}
          </div>

          {/* Кнопки голосования */}
          <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <button
              onClick={() => void handleVote('yes')}
              disabled={voted}
              style={{
                flex: 1, padding: '13px',
                borderRadius: RADIUS.lg,
                backgroundColor: voted ? COLORS.bgElevated : COLORS.success + '20',
                border: `2px solid ${voted ? COLORS.border : COLORS.success}`,
                color: voted ? COLORS.textDisabled : COLORS.success,
                fontSize: FONT.base, fontWeight: 700,
                cursor: voted ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 24 }}>👍</span> Есть
            </button>
            <button
              onClick={() => void handleVote('no')}
              disabled={voted}
              style={{
                flex: 1, padding: '13px',
                borderRadius: RADIUS.lg,
                backgroundColor: voted ? COLORS.bgElevated : COLORS.error + '20',
                border: `2px solid ${voted ? COLORS.border : COLORS.error}`,
                color: voted ? COLORS.textDisabled : COLORS.error,
                fontSize: FONT.base, fontWeight: 700,
                cursor: voted ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <span style={{ fontSize: 24 }}>👎</span> Нет
            </button>
          </div>

          {/* Счётчик голосов + количество доп. событий */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: FONT.xs, color: COLORS.textDisabled,
          }}>
            <span>👍 {first.event.positiveVotes} · 👎 {first.event.negativeVotes}</span>
            {alerts.length > 1 && (
              <span style={{
                backgroundColor: cfg.color + '33', color: cfg.color,
                borderRadius: RADIUS.full, padding: '2px 8px', fontWeight: 600,
              }}>
                +{alerts.length - 1} ещё
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
