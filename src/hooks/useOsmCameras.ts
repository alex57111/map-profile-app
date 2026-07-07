
import { useEffect, useRef, useState } from "react"
import type { Coords } from "../types/geo"

export interface OsmCamera {
  id: string
  lat: number
  lng: number
  // Тип камеры из OSM тегов
  type: "speed" | "average_speed" | "red_light" | "unknown"
  // Максимальная скорость если указана в OSM
  maxspeed?: number
  // Направление камеры (0-360) если указано
  direction?: number
}

// Кэш по bbox-ключу чтобы не спамить API
const cache = new Map<string, { cameras: OsmCamera[]; ts: number }>()
const CACHE_TTL_MS = 10 * 60_000 // 10 минут

function bboxKey(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  // Округляем до 2 знаков — ~1км точность для кэша
  return `${minLat.toFixed(2)},${minLng.toFixed(2)},${maxLat.toFixed(2)},${maxLng.toFixed(2)}`
}

function parseType(tags: Record<string, string>): OsmCamera["type"] {
  const enforcement = tags["enforcement"] ?? ""
  const camera = tags["camera:type"] ?? ""
  if (enforcement === "average_speed" || camera === "average_speed") return "average_speed"
  if (enforcement === "traffic_signals" || tags["highway"] === "traffic_signals") return "red_light"
  if (enforcement === "maxspeed" || tags["highway"] === "speed_camera") return "speed"
  return "unknown"
}

function parseMaxspeed(tags: Record<string, string>): number | undefined {
  const raw = tags["maxspeed"] ?? tags["maxspeed:advisory"] ?? ""
  if (!raw) return undefined
  // Парсим "60", "60 km/h", "RU:urban" и т.д.
  if (raw === "RU:urban" || raw === "urban") return 60
  if (raw === "RU:rural" || raw === "rural") return 90
  if (raw === "RU:motorway" || raw === "motorway") return 110
  const n = parseInt(raw)
  if (!isNaN(n)) return raw.toLowerCase().includes("mph") ? Math.round(n * 1.60934) : n
  return undefined
}

async function fetchCamerasInBbox(
  minLat: number, minLng: number, maxLat: number, maxLng: number
): Promise<OsmCamera[]> {
  const key = bboxKey(minLat, minLng, maxLat, maxLng)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.cameras

  // Overpass QL — ищем все камеры в bbox
  const query = `
    [out:json][timeout:8];
    (
      node["highway"="speed_camera"](${minLat},${minLng},${maxLat},${maxLng});
      node["man_made"="surveillance"]["surveillance:type"="camera"]["enforcement"~"maxspeed|average_speed"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out body;
  `

  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cameras: OsmCamera[] = (data.elements ?? []).map((el: any) => ({
      id: `osm-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      type: parseType(el.tags ?? {}),
      maxspeed: parseMaxspeed(el.tags ?? {}),
      direction: el.tags?.["direction"] !== undefined ? parseFloat(el.tags["direction"]) : undefined,
    }))

    cache.set(key, { cameras, ts: Date.now() })
    return cameras
  } catch {
    return []
  }
}

export function useOsmCameras(center: Coords | null, radiusKm = 5) {
  const [cameras, setCameras] = useState<OsmCamera[]>([])
  const loadingRef = useRef(false)
  const lastCenterRef = useRef<string>("")

  useEffect(() => {
    if (!center) return

    // Обновляем только если сместились >1км
    const key = `${center.lat.toFixed(2)},${center.lng.toFixed(2)}`
    if (key === lastCenterRef.current) return
    lastCenterRef.current = key

    if (loadingRef.current) return
    loadingRef.current = true

    const dLat = radiusKm / 111.32
    const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180))
    const minLat = center.lat - dLat
    const maxLat = center.lat + dLat
    const minLng = center.lng - dLng
    const maxLng = center.lng + dLng

    fetchCamerasInBbox(minLat, minLng, maxLat, maxLng)
      .then((cams) => setCameras(cams))
      .finally(() => { loadingRef.current = false })
  }, [center?.lat, center?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return cameras
}
