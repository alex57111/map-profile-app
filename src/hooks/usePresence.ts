
import { useState } from 'react'
import type { OnlineUser } from '../types/user'
import type { GPSPosition } from '../types/geo'

// Заглушка — в этом проекте присутствие других пользователей через mock
export function usePresence(_position: GPSPosition | null) {
  const [onlineUsers] = useState<OnlineUser[]>([
    { userId: 'mock-u1', displayName: 'Алексей', lat: 55.758, lng: 37.619, heading: 45, speed: 14, status: 'driving', updatedAt: Date.now() },
    { userId: 'mock-u2', displayName: 'Мария', lat: 55.751, lng: 37.610, heading: 180, speed: 8, status: 'driving', updatedAt: Date.now() },
  ])
  const removePresence = async () => {}
  return { onlineUsers, removePresence }
}
