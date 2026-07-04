import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { COLORS, FONT, RADIUS } from '../ui/tokens'

interface Props {
  speedKmh: number
  limitKmh: number | null
}

export function Speedometer({ speedKmh, limitKmh }: Props) {
  const prevSpeedRef = useRef(speedKmh)
  const [flash, setFlash] = useState(false)

  const isOver = limitKmh !== null && speedKmh > limitKmh + 5
  const isWarn = limitKmh !== null && speedKmh > limitKmh - 5 && !isOver

  // Вибрация и мигание при превышении
  useEffect(() => {
    if (isOver && !flash) {
      setFlash(true)
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
      setTimeout(() => setFlash(false), 600)
    }
    prevSpeedRef.current = speedKmh
  }, [isOver, speedKmh]) // eslint-disable-line react-hooks/exhaustive-deps

  const bg = isOver
    ? (flash ? '#EF4444' : '#C2190E')
    : isWarn
    ? '#F59E0B'
    : 'rgba(15,15,15,0.88)'

  const textColor = isOver || isWarn ? '#fff' : COLORS.textPrimary

  const wrapStyle: CSSProperties = {
    position: 'absolute',
    bottom: 88,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 450,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'background 0.2s',
    pointerEvents: 'none',
  }

  const dialStyle: CSSProperties = {
    backgroundColor: bg,
    borderRadius: RADIUS.xl,
    padding: '6px 18px 4px',
    boxShadow: isOver
      ? '0 0 20px rgba(239,68,68,0.6), 0 4px 12px rgba(0,0,0,0.4)'
      : '0 4px 12px rgba(0,0,0,0.4)',
    border: isOver ? '2px solid #EF4444' : `1px solid ${COLORS.border}`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'all 0.2s',
    minWidth: 72,
    textAlign: 'center',
  }

  return (
    <div style={wrapStyle}>
      <div style={dialStyle}>
        <div style={{
          fontSize: 34,
          fontWeight: 800,
          color: textColor,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: -1,
        }}>
          {Math.round(speedKmh)}
        </div>
        <div style={{
          fontSize: FONT.xs,
          color: isOver || isWarn ? 'rgba(255,255,255,0.8)' : COLORS.textDisabled,
          fontWeight: 500,
          marginTop: 1,
        }}>
          км/ч
        </div>
      </div>

      {/* Знак ограничения скорости */}
      {limitKmh !== null && (
        <div style={{
          width: 36, height: 36,
          borderRadius: '50%',
          backgroundColor: '#fff',
          border: `3px solid ${isOver ? '#EF4444' : '#CC0000'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: '#CC0000', lineHeight: 1,
          }}>
            {limitKmh}
          </span>
        </div>
      )}
    </div>
  )
}
