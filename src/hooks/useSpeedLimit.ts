import { useEffect, useRef, useState } from 'react'
import type { GPSPosition } from '../types/geo'

// Кэш: geohash → limit
const cache = new Map<string, number | null>()

function geohashApprox(lat: number, lng: number): string {
  // Грубый ключ ~500м точность
  return `${(lat * 100).toFixed(0)}_${(lng * 100).toFixed(0)}`
}

async function fetchSpeedLimit(lat: number, lng: number): Promise<number | null> {
  const key = geohashApprox(lat, lng)
  if (cache.has(key)) return cache.get(key)!

  try {
    const query = `
      [out:json][timeout:5];
      way(around:30,${lat},${lng})[highway][maxspeed];
      out tags 1;
    `
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) { cache.set(key, null); return null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    const elements = data.elements ?? []
    if (elements.length === 0) { cache.set(key, null); return null }

    const raw: string = elements[0].tags?.maxspeed ?? ''
    // Парсим "60", "60 mph", "RU:urban" и т.д.
    let limit: number | null = null
    if (raw === 'RU:urban' || raw === 'urban') limit = 60
    else if (raw === 'RU:rural' || raw === 'rural') limit = 90
    else if (raw === 'RU:motorway' || raw === 'motorway') limit = 110
    else {
      const n = parseInt(raw)
      if (!isNaN(n)) {
        // mph → km/h
        limit = raw.includes('mph') ? Math.round(n * 1.60934) : n
      }
    }

    cache.set(key, limit)
    return limit
  } catch {
    cache.set(key, null)
    return null
  }
}

export function useSpeedLimit(position: GPSPosition | null): number | null {
  const [limit, setLimit] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeyRef = useRef<string>('')

  useEffect(() => {
    if (!position) return

    const key = geohashApprox(position.lat, position.lng)
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key

    // Дебаунс 2 сек чтобы не спамить API при быстрой езде
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const l = await fetchSpeedLimit(position.lat, position.lng)
      setLimit(l)
    }, 2000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [position?.lat, position?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return limit
}
