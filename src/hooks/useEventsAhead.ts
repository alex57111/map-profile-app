import { useEffect, useRef, useState } from 'react'
import { eventsAhead, haversineMetres, type EventAhead } from '../engines/haversine'
import type { RoadEvent } from '../types/event'
import type { GPSPosition } from '../types/geo'

// Адаптивная дистанция как у Яндекса:
// до 30 км/ч  → 150м
// 30-60 км/ч  → 300м
// 60-90 км/ч  → 500м
// 90+ км/ч    → 700м
function alertDistanceM(speedKmh: number): number {
  if (speedKmh < 30) return 150
  if (speedKmh < 60) return 300
  if (speedKmh < 90) return 500
  return 700
}

const REPEAT_COOLDOWN_MS = 60_000
const FOV_DEGREES = 35
const AUTO_DISMISS_MS = 8_000

export interface EventAlert {
  event: RoadEvent
  distanceM: number
}

export function useEventsAhead(
  position: GPSPosition | null,
  events: RoadEvent[]
): { alerts: EventAlert[]; dismiss: () => void } {
  const [alerts, setAlerts] = useState<EventAlert[]>([])
  const cooldownRef = useRef<Map<string, number>>(new Map())
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    setAlerts([])
  }

  // Обновляем distanceM в реальном времени для живого счётчика
  useEffect(() => {
    if (!position || alerts.length === 0) return
    setAlerts((prev) =>
      prev.map((a) => ({
        ...a,
        distanceM: haversineMetres(position.lat, position.lng, a.event.lat, a.event.lng),
      }))
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng])

  // Основная логика — обнаружение новых событий впереди
  useEffect(() => {
    if (!position || position.speed < 1) return

    const speedKmh = position.speed * 3.6
    const lookAheadM = alertDistanceM(speedKmh)

    const ahead: EventAhead<RoadEvent>[] = eventsAhead(
      position.lat, position.lng, position.heading,
      events, lookAheadM, FOV_DEGREES
    )

    const now = Date.now()
    const newAlerts: EventAlert[] = []

    for (const { event, distanceM } of ahead) {
      const lastAlert = cooldownRef.current.get(event.id) ?? 0
      if (now - lastAlert > REPEAT_COOLDOWN_MS) {
        newAlerts.push({ event, distanceM })
        cooldownRef.current.set(event.id, now)
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(newAlerts)

      // Автоудаление через 8 сек
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => setAlerts([]), AUTO_DISMISS_MS)

      // Голосовое оповещение
      if ('speechSynthesis' in window) {
        const first = newAlerts[0]!
        const dist = Math.round(first.distanceM / 10) * 10
        const label = first.event.type === 'camera' ? 'Камера'
          : first.event.type === 'police' ? 'Полиция'
          : first.event.type === 'accident' ? 'ДТП'
          : first.event.type === 'repair' ? 'Дорожные работы'
          : 'Опасность'
        const utt = new SpeechSynthesisUtterance(`${label} через ${dist} метров`)
        utt.lang = 'ru-RU'
        utt.rate = 1.1
        window.speechSynthesis.speak(utt)
      }

      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, position?.heading, position?.speed, events])

  return { alerts, dismiss }
}
