
import { useEffect, useRef, useState } from "react"
import { eventsAhead, type EventAhead } from "../engines/haversine"
import type { RoadEvent } from "../types/event"
import type { GPSPosition } from "../types/geo"

// Адаптивная дистанция по скорости
function alertDistanceM(speedKmh: number): number {
  if (speedKmh < 30) return 150
  if (speedKmh < 60) return 300
  if (speedKmh < 90) return 500
  return 700
}

// Угловая разница с учётом кругового 0-360
function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

const REPEAT_COOLDOWN_MS = 60_000
const FOV_DEGREES = 35
const AUTO_DISMISS_MS = 8_000
// Максимальная угловая разница для направленных событий (ТЗ №2)
const HEADING_FILTER_DEG = 45

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

  // Обновляем distanceM в реальном времени (живой счётчик в алерте)
  useEffect(() => {
    if (!position || alerts.length === 0) return
    const { haversineMetres } = require("../engines/haversine") as typeof import("../engines/haversine")
    setAlerts((prev) =>
      prev.map((a) => ({
        ...a,
        distanceM: haversineMetres(position.lat, position.lng, a.event.lat, a.event.lng),
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng])

  useEffect(() => {
    if (!position || position.speed < 1) return

    const speedKmh = position.speed * 3.6
    const lookAheadM = alertDistanceM(speedKmh)

    // Исключаем speed_zone из обычных алертов (они обрабатываются useAverageSpeedZone)
    const alertableEvents = events.filter((e) => e.type !== "speed_zone")

    const ahead: EventAhead<RoadEvent>[] = eventsAhead(
      position.lat, position.lng, position.heading,
      alertableEvents, lookAheadM, FOV_DEGREES
    )

    // ТЗ №2: фильтрация по направлению события
    const directionFiltered = ahead.filter(({ event }) => {
      if (event.heading === undefined || event.heading === null) return true
      // Событие направленное — проверяем угол
      return angleDiff(event.heading, position.heading) <= HEADING_FILTER_DEG
    })

    const now = Date.now()
    const newAlerts: EventAlert[] = []

    for (const { event, distanceM } of directionFiltered) {
      const lastAlert = cooldownRef.current.get(event.id) ?? 0
      if (now - lastAlert > REPEAT_COOLDOWN_MS) {
        newAlerts.push({ event, distanceM })
        cooldownRef.current.set(event.id, now)
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(newAlerts)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = setTimeout(() => setAlerts([]), AUTO_DISMISS_MS)

      if ("speechSynthesis" in window) {
        const first = newAlerts[0]!
        const dist = Math.round(first.distanceM / 10) * 10
        const label = first.event.type === "camera"  ? "Камера"
          : first.event.type === "police"   ? "Полиция"
          : first.event.type === "accident" ? "ДТП"
          : first.event.type === "repair"   ? "Дорожные работы"
          : "Опасность"
        const utt = new SpeechSynthesisUtterance(`${label} через ${dist} метров`)
        utt.lang = "ru-RU"; utt.rate = 1.1
        window.speechSynthesis.speak(utt)
      }
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200])
    }

    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, position?.heading, position?.speed, events])

  return { alerts, dismiss }
}
