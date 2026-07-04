import { getTheme } from '../../lib/settings'

export function getColors() {
  const dark = getTheme() === 'dark'
  return {
    bg:           dark ? '#0F0F0F' : '#F5F5F5',
    bgCard:       dark ? '#1A1A1A' : '#FFFFFF',
    bgElevated:   dark ? '#242424' : '#EBEBEB',
    border:       dark ? '#2E2E2E' : '#D0D0D0',
    textPrimary:  dark ? '#F0F0F0' : '#111111',
    textSecond:   dark ? '#9A9A9A' : '#555555',
    textDisabled: dark ? '#4A4A4A' : '#AAAAAA',
    accent:       '#F97316',
    accentDark:   '#C2590E',
    accentLight:  '#FDBA74',
    success:      '#22C55E',
    warning:      '#EAB308',
    error:        '#EF4444',
    info:         '#3B82F6',
    mapOverlay:   dark ? 'rgba(15,15,15,0.75)' : 'rgba(245,245,245,0.75)',
    mapOverlayHd: dark ? 'rgba(15,15,15,0.92)' : 'rgba(245,245,245,0.92)',
  }
}

// Статичные цвета (для компонентов без реактивности темы)
export const COLORS = {
  bg: '#0F0F0F', bgCard: '#1A1A1A', bgElevated: '#242424', border: '#2E2E2E',
  textPrimary: '#F0F0F0', textSecond: '#9A9A9A', textDisabled: '#4A4A4A',
  accent: '#F97316', accentDark: '#C2590E', accentLight: '#FDBA74',
  success: '#22C55E', warning: '#EAB308', error: '#EF4444', info: '#3B82F6',
  mapOverlay: 'rgba(15,15,15,0.75)', mapOverlayHd: 'rgba(15,15,15,0.92)',
} as const

export const RADIUS = { sm: 6, md: 12, lg: 20, xl: 32, full: 999 } as const
export const FONT = { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 30 } as const
export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const

export const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'
export const SAFE_TOP = 'env(safe-area-inset-top, 0px)'
export const TAB_HEIGHT = 56
