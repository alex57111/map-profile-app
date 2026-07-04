
import type { AppAdapters } from './interface'
import { mockAuthAdapter } from './mock/auth'
import { mockEventsAdapter } from './mock/events'

const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true'

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
