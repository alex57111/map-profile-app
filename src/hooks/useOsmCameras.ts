
import { useEffect, useRef, useState } from "react"
import type { Coords } from "../types/geo"

export interface OsmCamera {
  id: string
  lat: number
  lng: number
  type: "speed_camera" | "traffic_signals" | "average_speed"
  maxspeed?: number     // лимит скорости если указан в OSM
  direction?: number    // направление камеры если указано
  name?: string
}

// Кэш запросов: "lat_lng_zoom" → камеры
const cache = new Map<string, { cameras: OsmCamera[]; ts: number }>()
const CACHE_TTL_MS = 5 * 60_000  // 5 минут
const FETCH_RADIUS_M = 8000       // 8 км от центра карты

function cacheKey(lat: number, lng: number): string {
  // Округляем до ~1км для переиспользования кэша
  return `${(lat * 10).toFixed(0)}_${(lng * 10).toFixed(0)}`
}

async function fetchCamerasFromOsm(lat: number, lng: number): Promise<OsmCamera[]> {
  const query = `
    [out:json][timeout:10];
    (
      node["highway"="speed_camera"](around:${FETCH_RADIUS_M},${lat},${lng});
      node["enforcement"="maxspeed"](around:${FETCH_RADIUS_M},${lat},${lng});
      node["highway"="traffic_signals"]["camera"="yes"](around:${FETCH_RADIUS_M},${lat},${lng});
    );
    out body;
  `
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.elements ?? []).map((el: any): OsmCamera => {
    const tags = el.tags ?? {}
    let type: OsmCamera["type"] = "speed_camera"
    if (tags["highway"] === "traffic_signals") type = "speed_camera"
    if (tags["enforcement"] === "average_speed" || tags["camera:type"] === "average_speed") {
      type = "average_speed"
    }

    // Парсим лимит скорости
    let maxspeed: number | undefined
    const raw = tags["maxspeed"] ?? tags["maxspeed:enforcement"] ?? ""
    if (raw) {
      const n = parseInt(raw)
      if (!isNaN(n)) maxspeed = raw.includes("mph") ? Math.round(n * 1.60934) : n
    }

    // Направление камеры
    let direction: number | undefined
    const dir = tags["direction"] ?? tags["camera:direction"]
    if (dir !== undefined) {
      const d = parseFloat(dir)
      if (!isNaN(d)) direction = d
    }

    return {
      id: `osm-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      type,
      maxspeed,
      direction,
      name: tags["name"] ?? tags["ref"],
    }
  })
}

export function useOsmCameras(mapCenter: Coords | null): OsmCamera[] {
  const [cameras, setCameras] = useState<OsmCamera[]>([])
  const loadingRef = useRef(false)
  const lastKeyRef = useRef("")

  useEffect(() => {
    if (!mapCenter) return

    const key = cacheKey(mapCenter.lat, mapCenter.lng)
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key

    // Проверяем кэш
    const cached = cache.get(key)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setCameras(cached.cameras)
      return
    }

    if (loadingRef.current) return
    loadingRef.current = true

    fetchCamerasFromOsm(mapCenter.lat, mapCenter.lng)
      .then((result) => {
        cache.set(key, { cameras: result, ts: Date.now() })
        setCameras(result)
      })
      .catch(() => {}) // тихо игнорируем ошибки сети
      .finally(() => { loadingRef.current = false })
  }, [mapCenter?.lat, mapCenter?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return cameras
}
