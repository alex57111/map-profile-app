import { useEffect, useState } from 'react'
import { COLORS, FONT, SPACING, RADIUS } from '../ui/tokens'
import { EVENT_TYPE_CONFIG } from '../../types/event'
import type { RoadEvent } from '../../types/event'

interface Props { event: RoadEvent | null; onVote: (eventId: string, vote: 'yes' | 'no') => Promise<void>; onClose: () => void }

export function EventDetailSheet({ event, onVote, onClose }: Props) {
  // По образцу EventAheadAlert.tsx: блокируем повторный тап по кнопкам
  // после голоса — сервер и так молча игнорирует второй голос того же
  // юзера (одно правило на событие в vote_on_event), но без этого кнопки
  // визуально выглядят активными, будто голос не засчитался.
  const [voted, setVoted] = useState(false)

  // Хуки должны идти до раннего return — сброс по event?.id, аналогично
  // сбросу в EventAheadAlert по alerts[0]?.event.id.
  useEffect(() => {
    setVoted(false)
  }, [event?.id])

  if (!event) return null
  const cfg = EVENT_TYPE_CONFIG[event.type]
  const score = event.positiveVotes - event.negativeVotes
  const expiresIn = Math.max(0, Math.round((new Date(event.expiresAt).getTime() - Date.now()) / 60_000))

  const handleVote = async (vote: 'yes' | 'no') => {
    if (voted) return
    await onVote(event.id, vote)
    setVoted(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{
        width: '100%', backgroundColor: COLORS.bgCard, borderRadius: `${RADIUS.xl}px ${RADIUS.xl}px 0 0`,
        padding: SPACING.md, paddingBottom: `calc(${SPACING.lg}px + env(safe-area-inset-bottom, 0px))`,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', backgroundColor: cfg.color + '22', border: `2px solid ${cfg.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
          }}>{cfg.icon}</div>
          <div>
            <div style={{ fontSize: FONT.md, fontWeight: 700, color: COLORS.textPrimary }}>{cfg.label}</div>
            {event.description && <div style={{ fontSize: FONT.sm, color: COLORS.textSecond, marginTop: 2 }}>{event.description}</div>}
            <div style={{ fontSize: FONT.xs, color: COLORS.textDisabled, marginTop: 2 }}>Истекает через {expiresIn} мин</div>
          </div>
        </div>

        <div style={{
          backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: FONT.sm, color: COLORS.textSecond }}>Рейтинг события</span>
          <span style={{ fontSize: FONT.md, fontWeight: 700, color: score > 0 ? COLORS.success : score < 0 ? COLORS.error : COLORS.textSecond }}>
            {score > 0 ? `+${score}` : score}
          </span>
        </div>

        <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.sm }}>
          <button onClick={() => void handleVote('yes')} disabled={voted} style={{
            flex: 1, padding: '12px',
            backgroundColor: voted ? COLORS.bgElevated : COLORS.success + '22',
            border: `1px solid ${voted ? COLORS.border : COLORS.success}`,
            borderRadius: RADIUS.md, color: voted ? COLORS.textDisabled : COLORS.success,
            fontSize: FONT.base, fontWeight: 600, cursor: voted ? 'default' : 'pointer',
          }}>👍 Да ({event.positiveVotes})</button>
          <button onClick={() => void handleVote('no')} disabled={voted} style={{
            flex: 1, padding: '12px',
            backgroundColor: voted ? COLORS.bgElevated : COLORS.error + '22',
            border: `1px solid ${voted ? COLORS.border : COLORS.error}`,
            borderRadius: RADIUS.md, color: voted ? COLORS.textDisabled : COLORS.error,
            fontSize: FONT.base, fontWeight: 600, cursor: voted ? 'default' : 'pointer',
          }}>👎 Нет ({event.negativeVotes})</button>
        </div>

        <button onClick={onClose} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: COLORS.textSecond, border: 'none', fontSize: FONT.sm, cursor: 'pointer' }}>Закрыть</button>
      </div>
    </div>
  )
}
