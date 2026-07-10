
import { useEffect, useRef, useState } from "react"
import type { Coords } from "../types/geo"
import type { RoadEvent } from "../types/event"
import { Sentry } from "../lib/sentry"

// Кэш запросов: ключ bbox (округлённый до ~2 знаков, как рекомендовано в ТЗ) → зоны
const cache = new Map<string, { zones: RoadEvent[]; ts: number }>()
const CACHE_TTL_MS = 10 * 60_000  // 10 минут — зоны меняются редко, дольше чем камеры (5 мин в useOsmCameras)
const FETCH_RADIUS_M = 15000      // 15 км — зоны средней скорости обычно длинные участки на трассах,
                                   // радиус больше, чем у точечных камер (8 км в useOsmCameras)

function cacheKey(lat: number, lng: number): string {
  // Округляем до ~1км, аналогично useOsmCameras.cacheKey
  return `zones_${(lat * 10).toFixed(0)}_${(lng * 10).toFixed(0)}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function elementKey(el: any): string {
  return `${el.type}/${el.id}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstCoord(el: any): { lat: number; lng: number } | null {
  if (el.type === "node" && typeof el.lat === "number") return { lat: el.lat, lng: el.lon }
  if (el.geometry && el.geometry.length > 0) {
    const p = el.geometry[0]
    return { lat: p.lat, lng: p.lon }
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastCoord(el: any): { lat: number; lng: number } | null {
  if (el.type === "node" && typeof el.lat === "number") return { lat: el.lat, lng: el.lon }
  if (el.geometry && el.geometry.length > 0) {
    const p = el.geometry[el.geometry.length - 1]
    return { lat: p.lat, lng: p.lon }
  }
  return null
}

function parseMaxspeed(raw: string | undefined): number | null {
  if (!raw) return null
  if (raw === "RU:urban" || raw === "urban") return 60
  if (raw === "RU:rural" || raw === "rural") return 90
  if (raw === "RU:motorway" || raw === "motorway") return 110
  const n = parseInt(raw)
  if (isNaN(n)) return null
  return raw.includes("mph") ? Math.round(n * 1.60934) : n
}

async function fetchZonesFromOsm(lat: number, lng: number): Promise<RoadEvent[]> {
  // Отдельный, самостоятельный Overpass-запрос — существующий maxspeed-запрос
  // в useSpeedLimit.ts не трогаем. Используем around(), а не bbox — тем же
  // способом, каким уже работает useOsmCameras (единообразие с mapCenter).
  const query = `
    [out:json][timeout:15];
    relation["enforcement"="average_speed"](around:${FETCH_RADIUS_M},${lat},${lng});
    out body;
    >;
    out geom qt;
  `
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = data.elements ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byKey = new Map<string, any>()
  for (const el of elements) byKey.set(elementKey(el), el)

  const zones: RoadEvent[] = []

  for (const el of elements) {
    if (el.type !== "relation") continue
    const tags = el.tags ?? {}
    if (tags["enforcement"] !== "average_speed") continue

    const limit = parseMaxspeed(tags["maxspeed"])
    if (limit === null) continue // нет данных о лимите — зону не показываем (п.3 ТЗ)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members: any[] = el.members ?? []
    const fromMember = members.find((m) => m.role === "from")
    const toMember = members.find((m) => m.role === "to")
    const deviceMembers = members.filter((m) => m.role === "device")

    let start: { lat: number; lng: number } | null = null
    let end: { lat: number; lng: number } | null = null

    if (fromMember && toMember) {
      const fromEl = byKey.get(`${fromMember.type}/${fromMember.ref}`)
      const toEl = byKey.get(`${toMember.type}/${toMember.ref}`)
      start = fromEl ? firstCoord(fromEl) : null
      end = toEl ? lastCoord(toEl) : null
    } else if (deviceMembers.length >= 2) {
      // Фолбэк: если нет ролей from/to, но есть минимум 2 device-камеры —
      // берём первую и последнюю как границы участка
      const firstDevice = byKey.get(`${deviceMembers[0].type}/${deviceMembers[0].ref}`)
      const lastDevice = byKey.get(`${deviceMembers[deviceMembers.length - 1].type}/${deviceMembers[deviceMembers.length - 1].ref}`)
      start = firstDevice ? firstCoord(firstDevice) : null
      end = lastDevice ? firstCoord(lastDevice) : null
    }

    if (!start || !end) continue // недостаточно данных о геометрии зоны

    zones.push({
      id: `osm-zone-${el.id}`,
      authorId: "osm",
      type: "speed_zone",
      lat: start.lat,
      lng: start.lng,
      description: "OSM", // визуальная пометка «зона из OSM» (п.4 ТЗ, минимально для MVP)
      positiveVotes: 0,
      negativeVotes: 0,
      // Долгий TTL — зона из OSM не "протухает" как пользовательское событие
      expiresAt: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(),
      createdAt: new Date().toISOString(),
      endLat: end.lat,
      endLng: end.lng,
      zoneLimitKmh: limit,
    })
  }

  return zones
}

export function useOsmSpeedZones(mapCenter: Coords | null): RoadEvent[] {
  const [zones, setZones] = useState<RoadEvent[]>([])
  const loadingRef = useRef(false)
  const lastKeyRef = useRef("")

  useEffect(() => {
    if (!mapCenter) return

    const key = cacheKey(mapCenter.lat, mapCenter.lng)
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key

    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setZones(cached.zones)
      return
    }

    if (loadingRef.current) return
    loadingRef.current = true

    fetchZonesFromOsm(mapCenter.lat, mapCenter.lng)
      .then((result) => {
        cache.set(key, { zones: result, ts: Date.now() })
        setZones(result)
      })
      .catch((e) => {
        // Отсутствие зон не должно ломать экран, но репортим — как и в
        // useOsmCameras, это может сигналить о проблемах с Overpass API.
        Sentry.captureException(e, {
          tags: { op: 'useOsmSpeedZones' },
          extra: { lat: mapCenter.lat, lng: mapCenter.lng, radiusM: FETCH_RADIUS_M },
        })
      })
      .finally(() => { loadingRef.current = false })
  }, [mapCenter?.lat, mapCenter?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return zones
}
