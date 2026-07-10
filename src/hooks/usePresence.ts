
import { useState } from 'react'
import type { OnlineUser } from '../types/user'
import type { GPSPosition } from '../types/geo'

// Заглушка — в этом проекте присутствие других пользователей через mock.
// РАСХОЖДЕНИЕ С ТЗ (BLOKNOTERROR.md, п.6.5.2): пункт просит обернуть ошибки
// колбэков Supabase realtime-подписки в usePresence — но в текущем коде
// репозитория здесь нет ни Supabase-канала, ни realtime-подписки, только
// захардкоженный мок-массив. Оборачивать нечего: реальная Supabase-подписка
// на presence ещё не реализована. Когда она появится, использовать тот же
// паттерн, что уже сделан в supabaseEventsAdapter.subscribeToEvents —
// колбэк .subscribe((status, err) => ...) с Sentry.captureException на
// CHANNEL_ERROR/TIMED_OUT (см. src/lib/adapters/supabase/events.ts).
export function usePresence(_position: GPSPosition | null) {
  const [onlineUsers] = useState<OnlineUser[]>([
    { userId: 'mock-u1', displayName: 'Алексей', lat: 55.758, lng: 37.619, heading: 45, speed: 14, status: 'driving', updatedAt: Date.now() },
    { userId: 'mock-u2', displayName: 'Мария', lat: 55.751, lng: 37.610, heading: 180, speed: 8, status: 'driving', updatedAt: Date.now() },
  ])
  const removePresence = async () => {}
  return { onlineUsers, removePresence }
}
