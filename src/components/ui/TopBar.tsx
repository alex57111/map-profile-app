import type { CSSProperties } from 'react'
import { COLORS, FONT, SAFE_TOP } from './tokens'

interface Props { title: string; subtitle?: string; rightSlot?: React.ReactNode }

export function TopBar({ title, subtitle, rightSlot }: Props) {
  const barStyle: CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, paddingTop: SAFE_TOP,
    backgroundColor: COLORS.bgCard, borderBottom: `1px solid ${COLORS.border}`,
    zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `calc(${SAFE_TOP} + 10px) 16px 10px`,
    WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)',
  }
  return (
    <header style={barStyle}>
      <div>
        <div style={{ fontSize: FONT.md, fontWeight: 700, color: COLORS.textPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: FONT.xs, color: COLORS.textSecond, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </header>
  )
}
