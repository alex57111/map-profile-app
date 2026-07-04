import { useCallback, useRef, useState } from 'react'
import type { Coords } from '../types/geo'
import { haversineMetres } from '../engines/haversine'

export interface RouteStep {
  instruction: string
  distanceM: number
  lat: number
  lng: number
  maneuver: string
}

export interface Route {
  id: string           // 'fast' | 'short' | 'balanced'
  label: string        // 'Быстрый' | 'Короткий' | 'Без пробок'
  coords: Coords[]
  steps: RouteStep[]
  distanceM: number
  durationS: number
}

const MANEUVER_RU: Record<string, string> = {
  'turn-left':         'Поверните налево',
  'turn-right':        'Поверните направо',
  'turn-slight-left':  'Держитесь левее',
  'turn-slight-right': 'Держитесь правее',
  'turn-sharp-left':   'Резкий поворот налево',
  'turn-sharp-right':  'Резкий поворот направо',
  'uturn':             'Разворот',
  'merge':             'Перестройтесь',
  'roundabout':        'Въезжайте в кольцо',
  'arrive':            'Вы прибыли',
  'depart':            'Начинайте движение',
  'continue':          'Продолжайте движение',
  'new name':          'Продолжайте движение',
  'end of road':       'В конце дороги',
  'fork':              'На развилке',
}

function parseManeuver(type: string, modifier?: string): string {
  const key = type + (modifier ? `-${modifier}` : '')
  return MANEUVER_RU[key] ?? MANEUVER_RU[type] ?? 'Продолжайте движение'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRoute(data: any, id: string, label: string): Route {
  const r = data.routes[0]
  const coords: Coords[] = r.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: RouteStep[] = r.legs[0].steps.map((s: any) => ({
    instruction: parseManeuver(s.maneuver?.type ?? 'continue', s.maneuver?.modifier),
    distanceM: s.distance,
    lat: s.maneuver.location[1],
    lng: s.maneuver.location[0],
    maneuver: (s.maneuver?.type ?? 'continue') + (s.maneuver?.modifier ? `-${s.maneuver.modifier}` : ''),
  }))
  return { id, label, coords, steps, distanceM: r.distance, durationS: r.duration }
}

async function fetchRouteVariant(from: Coords, to: Coords, profile: string): Promise<Route | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full&alternatives=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null

    const labels: Record<string, string> = {
      driving: 'Быстрый',
      foot:    'Пешком',
      cycling: 'Велосипед',
    }
    return parseRoute(data, profile, labels[profile] ?? profile)
  } catch { return null }
}

// Получаем 3 варианта маршрута параллельно
async function fetchAllRoutes(from: Coords, to: Coords): Promise<Route[]> {
  const dist = haversineMetres(from.lat, from.lng, to.lat, to.lng)

  // Для коротких расстояний предлагаем пешком
  const profiles = dist < 3000
    ? ['driving', 'foot', 'cycling']
    : ['driving', 'driving', 'driving']

  const labels = dist < 3000
    ? ['На машине', 'Пешком', 'Велосипед']
    : ['Быстрый', 'Обычный', 'Альтернативный']

  const results = await Promise.all(
    profiles.map((p, i) =>
      fetchRouteVariant(from, to, p).then((r) =>
        r ? { ...r, id: `variant-${i}`, label: labels[i] ?? r.label } : null
      )
    )
  )

  const valid = results.filter((r): r is Route => r !== null)

  // Убираем полные дубли (одинаковое время ±5%)
  const unique: Route[] = []
  for (const r of valid) {
    const isDuplicate = unique.some((u) =>
      Math.abs(u.durationS - r.durationS) / u.durationS < 0.05 && u.id !== r.id
    )
    if (!isDuplicate) unique.push(r)
  }

  return unique.length > 0 ? unique : valid.slice(0, 1)
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'ru-RU'; utt.rate = 1.05
  window.speechSynthesis.speak(utt)
}

// Порог отклонения от маршрута — 50м
const REROUTE_THRESHOLD_M = 50
// Мин. время между перестройками — 10 сек
const REROUTE_COOLDOWN_MS = 10_000

export function useRoute() {
  const [routes, setRoutes] = useState<Route[]>([])       // все варианты
  const [activeRoute, setActiveRoute] = useState<Route | null>(null)  // выбранный
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)        // показываем выбор вариантов

  const destinationRef = useRef<Coords | null>(null)
  const lastRerouteRef = useRef(0)
  const spokenStepsRef = useRef<Set<number>>(new Set())

  // Построить маршрут — показать 3 варианта
  const buildRoute = useCallback(async (from: Coords, to: Coords) => {
    setLoading(true)
    setError(null)
    setSelecting(false)
    destinationRef.current = to
    spokenStepsRef.current = new Set()

    try {
      const variants = await fetchAllRoutes(from, to)
      if (variants.length === 0) { setError('Не удалось построить маршрут'); return }
      setRoutes(variants)
      setSelecting(true)  // показываем выбор
    } catch {
      setError('Ошибка маршрута')
    } finally {
      setLoading(false)
    }
  }, [])

  // Выбрать вариант маршрута
  const selectRoute = useCallback((route: Route) => {
    setActiveRoute(route)
    setSelecting(false)
    spokenStepsRef.current = new Set()
    if (route.steps[0]) speak(route.steps[0].instruction)
  }, [])

  // Сбросить маршрут
  const clearRoute = useCallback(() => {
    setActiveRoute(null)
    setRoutes([])
    setSelecting(false)
    setError(null)
    destinationRef.current = null
    window.speechSynthesis?.cancel()
  }, [])

  // Проверка отклонения и автоперестройка
  const checkDeviation = useCallback(async (lat: number, lng: number) => {
    const route = activeRoute
    const dest = destinationRef.current
    if (!route || !dest) return

    const now = Date.now()
    if (now - lastRerouteRef.current < REROUTE_COOLDOWN_MS) return

    // Находим ближайшую точку маршрута
    let minDist = Infinity
    for (const coord of route.coords) {
      const d = haversineMetres(lat, lng, coord.lat, coord.lng)
      if (d < minDist) minDist = d
    }

    if (minDist > REROUTE_THRESHOLD_M) {
      lastRerouteRef.current = now
      speak('Перестраиваю маршрут')

      // Тихая перестройка без UI варiantов
      const variants = await fetchAllRoutes({ lat, lng }, dest)
      if (variants[0]) {
        setActiveRoute(variants[0])
        spokenStepsRef.current = new Set()
      }
    }
  }, [activeRoute])

  return {
    routes,
    activeRoute,
    loading,
    error,
    selecting,
    buildRoute,
    selectRoute,
    clearRoute,
    checkDeviation,
  }
}
