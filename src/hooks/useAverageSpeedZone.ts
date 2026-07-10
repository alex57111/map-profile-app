
import { useRef } from "react"
import type { GPSPosition } from "../types/geo"
import type { RoadEvent } from "../types/event"
import { haversineMetres } from "../engines/haversine"
import { Sentry } from "../lib/sentry"

const ZONE_ENTER_RADIUS_M = 30
const ZONE_EXIT_RADIUS_M = 30

interface ZoneState {
  zoneId: string
  entryTime: number
  entryLat: number
  entryLng: number
  limitKmh: number
  // Накопленный путь в метрах
  accumulatedDistM: number
  lastLat: number
  lastLng: number
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "ru-RU"; utt.rate = 1.0
  window.speechSynthesis.speak(utt)
}

export function useAverageSpeedZone(
  position: GPSPosition | null,
  events: RoadEvent[]
) {
  const activeZoneRef = useRef<ZoneState | null>(null)
  const notifiedEnterRef = useRef<Set<string>>(new Set())

  // Всё в одном вызове — вызывается при каждом обновлении позиции
  if (!position) return

  try {
    const speedZones = events.filter((e) => e.type === "speed_zone")
    if (speedZones.length === 0) return

    const { lat, lng } = position

    // Обновляем накопленный путь если в зоне
    if (activeZoneRef.current) {
      const prev = activeZoneRef.current
      const moved = haversineMetres(prev.lastLat, prev.lastLng, lat, lng)
      if (moved > 0 && moved < 50) { // фильтруем GPS-прыжки
        activeZoneRef.current = { ...prev, accumulatedDistM: prev.accumulatedDistM + moved, lastLat: lat, lastLng: lng }
      }
    }

    for (const zone of speedZones) {
      const distToEntry = haversineMetres(lat, lng, zone.lat, zone.lng)

      // Вход в зону
      if (!activeZoneRef.current && distToEntry < ZONE_ENTER_RADIUS_M && !notifiedEnterRef.current.has(zone.id)) {
        notifiedEnterRef.current.add(zone.id)
        activeZoneRef.current = {
          zoneId: zone.id,
          entryTime: Date.now(),
          entryLat: lat,
          entryLng: lng,
          limitKmh: zone.zoneLimitKmh ?? 60,
          accumulatedDistM: 0,
          lastLat: lat,
          lastLng: lng,
        }
        const limit = zone.zoneLimitKmh ?? 60
        speak(`Начинается контроль средней скорости. Лимит ${limit} километров в час`)
      }

      // Выход из зоны
      if (
        activeZoneRef.current &&
        activeZoneRef.current.zoneId === zone.id &&
        zone.endLat !== undefined && zone.endLng !== undefined
      ) {
        const distToExit = haversineMetres(lat, lng, zone.endLat, zone.endLng)
        if (distToExit < ZONE_EXIT_RADIUS_M) {
          const state = activeZoneRef.current
          const elapsedS = (Date.now() - state.entryTime) / 1000

          // Средняя скорость по накопленному пути
          const distM = state.accumulatedDistM > 10
            ? state.accumulatedDistM
            : haversineMetres(state.entryLat, state.entryLng, lat, lng) // запасной вариант

          const avgKmh = elapsedS > 0 ? (distM / elapsedS) * 3.6 : 0
          const limit = state.limitKmh

          if (avgKmh > limit) {
            speak(`Зона пройдена. Средняя скорость ${Math.round(avgKmh)} километров в час — превышение лимита ${limit}`)
          } else {
            speak(`Зона пройдена. Средняя скорость ${Math.round(avgKmh)} километров в час — всё в порядке`)
          }

          activeZoneRef.current = null
          // Разрешаем повторный вход через 60 сек
          setTimeout(() => notifiedEnterRef.current.delete(zone.id), 60_000)
        }
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { op: 'useAverageSpeedZone' } })
  }
}
