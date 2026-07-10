import { useCallback, useRef } from 'react'
import type { Coords } from '../types/geo'
import { Sentry } from '../lib/sentry'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const HEADERS = { 'Accept-Language': 'ru,en', 'User-Agent': 'poputchik-app/1.0' }

export interface GeoResult { name: string; displayName: string; coords: Coords }

export async function geocodeForward(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return []
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error('Geocoding failed')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json()
  return data.map((item) => ({
    name: buildShortName(item),
    displayName: item.display_name as string,
    coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
  }))
}

export async function geocodeReverse(coords: Coords): Promise<string> {
  const url = `${NOMINATIM}/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=16`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json()
  return buildShortName(data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildShortName(item: any): string {
  const a = item.address ?? {}
  const place = a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? ''
  const road = a.road ?? a.pedestrian ?? a.suburb ?? ''
  if (place && road) return `${place}, ${road}`
  if (place) return place as string
  const full = (item.display_name as string | undefined) ?? ''
  return full.split(',').slice(0, 2).join(',').trim()
}

export function useGeocoder() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const search = useCallback((query: string, onResults: (results: GeoResult[]) => void, delayMs = 400) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { onResults([]); return }
    timerRef.current = setTimeout(() => {
      geocodeForward(query).then(onResults).catch((e) => {
        Sentry.captureException(e, { tags: { op: 'useGeocoder.search' }, extra: { queryLength: query.length } })
        onResults([])
      })
    }, delayMs)
  }, [])
  return { search }
}
