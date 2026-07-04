
import type { AppAdapters } from '../interface'
import { supabaseAuthAdapter } from './auth'
import { supabaseEventsAdapter } from './events'

export const supabaseAdapters: AppAdapters = {
  auth: supabaseAuthAdapter,
  events: supabaseEventsAdapter,
}
