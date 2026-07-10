
import type { AppAdapters } from './interface'
import { mockAuthAdapter } from './mock/auth'
import { mockEventsAdapter } from './mock/events'

// TEMP DIAG (Блок 4, диагностика supabase-режима) — убрать вместе с debug-баннером
// в LocationScreen.tsx после решения проблемы.
export const DEBUG_VITE_USE_SUPABASE_RAW = String(import.meta.env.VITE_USE_SUPABASE)

const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true'
export const DEBUG_USE_SUPABASE = USE_SUPABASE // TEMP DIAG — убрать вместе с баннером

async function buildAdapters(): Promise<AppAdapters> {
  if (USE_SUPABASE) {
    const { supabaseAdapters } = await import('./supabase/index')
    return supabaseAdapters
  }
  return { auth: mockAuthAdapter, events: mockEventsAdapter }
}

let _adapters: AppAdapters | null = null
export async function getAdapters(): Promise<AppAdapters> {
  if (!_adapters) _adapters = await buildAdapters()
  return _adapters
}
