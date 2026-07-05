
import { useCallback, useRef, useState } from "react"
import type { Coords } from "../types/geo"
import { haversineMetres } from "../engines/haversine"

export interface RouteStep {
  instruction: string
  distanceM: number
  lat: number
  lng: number
  maneuver: string
}

export interface Route {
  id: string
  label: string
  color: string
  coords: Coords[]
  steps: RouteStep[]
  distanceM: number
  durationS: number
}

const MANEUVER_RU: Record<string, string> = {
  "turn-left":         "Поверните налево",
  "turn-right":        "Поверните направо",
  "turn-slight-left":  "Держитесь левее",
  "turn-slight-right": "Держитесь правее",
  "turn-sharp-left":   "Резкий поворот налево",
  "turn-sharp-right":  "Резкий поворот направо",
  "uturn":             "Разворот",
  "roundabout":        "Въезжайте в кольцо",
  "arrive":            "Вы прибыли",
  "depart":            "Начинайте движение",
  "continue":          "Продолжайте движение",
  "new name":          "Продолжайте движение",
  "end of road":       "В конце дороги",
  "fork":              "На развилке",
}

function parseManeuver(type: string, modifier?: string): string {
  const key = type + (modifier ? `-${modifier}` : "")
  return MANEUVER_RU[key] ?? MANEUVER_RU[type] ?? "Продолжайте движение"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOsrmRoute(r: any, id: string, label: string, color: string): Route {
  const coords: Coords[] = r.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: RouteStep[] = r.legs[0].steps.map((s: any) => ({
    instruction: parseManeuver(s.maneuver?.type ?? "continue", s.maneuver?.modifier),
    distanceM: s.distance,
    lat: s.maneuver.location[1],
    lng: s.maneuver.location[0],
    maneuver: (s.maneuver?.type ?? "continue") + (s.maneuver?.modifier ? `-${s.maneuver.modifier}` : ""),
  }))
  return { id, label, color, coords, steps, distanceM: r.distance, durationS: r.duration }
}

async function fetchRoutes(from: Coords, to: Coords): Promise<Route[]> {
  const ROUTE_COLORS = ["#F97316", "#3B82F6", "#22C55E"]
  const ROUTE_LABELS = ["Быстрый", "Альтернативный", "Объездной"]
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full&alternatives=true`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    if (data.code !== "Ok" || !data.routes?.length) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.routes.slice(0, 3).map((r: any, i: number) =>
      parseOsrmRoute(r, `route-${i}`, ROUTE_LABELS[i] ?? `Маршрут ${i+1}`, ROUTE_COLORS[i] ?? "#888")
    )
  } catch { return [] }
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "ru-RU"; utt.rate = 1.05
  window.speechSynthesis.speak(utt)
}

const REROUTE_THRESHOLD_M = 60
const REROUTE_COOLDOWN_MS = 10_000

// Пороги озвучки в метрах
const THRESHOLD_FAR  = 250  // первое предупреждение
const THRESHOLD_NEAR = 50   // "Сейчас поверните"
const THRESHOLD_PASS = 20   // переход к следующему шагу

export function useRoute() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [activeRoute, setActiveRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)

  const destinationRef = useRef<Coords | null>(null)
  const lastRerouteRef = useRef(0)

  // ТЗ №1: индекс текущего шага и Set уже озвученных порогов
  // Ключ в Set: "{stepIndex}-{threshold}" чтобы не повторять
  const currentStepIndexRef = useRef<number>(0)
  const spokenStepsRef = useRef<Set<string>>(new Set())
  const arrivedRef = useRef(false)

  function resetProgress() {
    currentStepIndexRef.current = 0
    spokenStepsRef.current = new Set()
    arrivedRef.current = false
  }

  const buildRoute = useCallback(async (from: Coords, to: Coords) => {
    setLoading(true)
    setError(null)
    setSelecting(false)
    destinationRef.current = to
    resetProgress()

    try {
      const variants = await fetchRoutes(from, to)
      if (variants.length === 0) { setError("Не удалось построить маршрут"); return }
      setRoutes(variants)
      if (variants.length === 1) {
        setActiveRoute(variants[0]!)
        speak(variants[0]!.steps[0]?.instruction ?? "Начинайте движение")
      } else {
        setSelecting(true)
      }
    } catch {
      setError("Ошибка маршрута")
    } finally {
      setLoading(false)
    }
  }, [])

  const selectRoute = useCallback((route: Route) => {
    setActiveRoute(route)
    setSelecting(false)
    resetProgress()
    speak(route.steps[0]?.instruction ?? "Начинайте движение")
  }, [])

  const clearRoute = useCallback(() => {
    setActiveRoute(null)
    setRoutes([])
    setSelecting(false)
    setError(null)
    destinationRef.current = null
    resetProgress()
    window.speechSynthesis?.cancel()
  }, [])

  // ТЗ №1: updateProgress — живое отслеживание шагов маршрута
  const updateProgress = useCallback((lat: number, lng: number) => {
    const route = activeRoute
    if (!route) return

    const stepIdx = currentStepIndexRef.current
    const step = route.steps[stepIdx]
    if (!step) return

    const dist = haversineMetres(lat, lng, step.lat, step.lng)
    const isLastStep = step.maneuver === "arrive" || stepIdx === route.steps.length - 1

    // Переход к следующему шагу
    if (dist < THRESHOLD_PASS) {
      if (isLastStep) {
        if (!arrivedRef.current) {
          arrivedRef.current = true
          speak("Вы прибыли в пункт назначения")
        }
        return
      }
      currentStepIndexRef.current = stepIdx + 1
      // Очищаем пороги для нового шага
      for (const key of spokenStepsRef.current) {
        if (key.startsWith(`${stepIdx}-`)) spokenStepsRef.current.delete(key)
      }
      return
    }

    // Озвучка на 250м
    const farKey = `${stepIdx}-far`
    if (dist < THRESHOLD_FAR && !spokenStepsRef.current.has(farKey)) {
      spokenStepsRef.current.add(farKey)
      const distText = dist < 100 ? `${Math.round(dist)} метров` : `${Math.round(dist / 10) * 10} метров`
      speak(`Через ${distText} — ${step.instruction}`)
    }

    // Озвучка на 50м — короткая
    const nearKey = `${stepIdx}-near`
    if (dist < THRESHOLD_NEAR && !spokenStepsRef.current.has(nearKey)) {
      spokenStepsRef.current.add(nearKey)
      speak(`Сейчас — ${step.instruction}`)
    }
  }, [activeRoute])

  // Автоперестройка при отклонении
  const checkDeviation = useCallback(async (lat: number, lng: number) => {
    const route = activeRoute
    const dest = destinationRef.current
    if (!route || !dest) return

    const now = Date.now()
    if (now - lastRerouteRef.current < REROUTE_COOLDOWN_MS) return

    let minDist = Infinity
    for (const coord of route.coords) {
      const d = haversineMetres(lat, lng, coord.lat, coord.lng)
      if (d < minDist) minDist = d
    }

    if (minDist > REROUTE_THRESHOLD_M) {
      lastRerouteRef.current = now
      speak("Перестраиваю маршрут")
      const variants = await fetchRoutes({ lat, lng }, dest)
      if (variants[0]) {
        setActiveRoute({ ...variants[0], color: route.color })
        resetProgress()
      }
    }
  }, [activeRoute])

  return {
    routes, activeRoute, loading, error, selecting,
    buildRoute, selectRoute, clearRoute, checkDeviation, updateProgress,
  }
}
