import type { CSSProperties, ReactNode } from 'react'
import { COLORS, TAB_HEIGHT } from './tokens'

interface Props {
  children: ReactNode
  topOffset?: number
  style?: CSSProperties
  noScroll?: boolean
}

const TOP_BAR_HEIGHT = 56

export function ScreenWrapper({ children, topOffset = TOP_BAR_HEIGHT, style, noScroll }: Props) {
  return (
    <main style={{
      position: 'fixed', top: topOffset, left: 0, right: 0, bottom: TAB_HEIGHT,
      backgroundColor: COLORS.bg,
      overflowY: noScroll ? 'hidden' : 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch', ...style,
    }}>
      {children}
    </main>
  )
}
