import * as Sentry from "@sentry/react"

// Ключи, которые считаем "координатными" и округляем перед отправкой в Sentry —
// приватность пользователя (см. BLOKNOTERROR.md ТЗ, п.3.3 и п.6.5.6).
// Совпадение по имени ключа (без учёта регистра): lat, lng, latitude, longitude,
// endLat, endLng, fromLat, fromLng, toLat, toLng и т.п.
const COORD_KEY_RE = /(^|_)(lat|lng|latitude|longitude)($|_)/i

function roundCoordsDeep(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => roundCoordsDeep(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === "number" && COORD_KEY_RE.test(key)) {
        out[key] = Math.round(val * 100) / 100 // округление до 2 знаков (~1.1км)
      } else {
        out[key] = roundCoordsDeep(val, depth + 1)
      }
    }
    return out
  }
  return value
}

/**
 * Единая точка инициализации Sentry. Вызывается один раз в src/main.tsx
 * до рендера <App />.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  const isProd = import.meta.env.MODE === "production"

  // п.6.5.5 ТЗ: если DSN не долетел до прод-сборки — явно предупреждаем,
  // а не молча остаёмся без мониторинга (по аналогии с багом Supabase-переменных).
  if (isProd && !dsn) {
    // eslint-disable-next-line no-console
    console.error(
      "[Sentry] VITE_SENTRY_DSN отсутствует в production-сборке — мониторинг ошибок ВЫКЛЮЧЕН. " +
      "Проверь Build command в Cloudflare Pages (Dashboard-переменные туда не долетают)."
    )
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: !!dsn,
    tracesSampleRate: 0.2, // performance-трейсы — сэмплируем 20%
    sampleRate: 1.0,       // ошибки — отправляем 100%, явно, чтобы не понизили случайно
    beforeSend(event) {
      // п.6.5.6 ТЗ: одно центральное место, которое округляет координаты
      // перед отправкой, а не полагается на ручное округление в каждом месте вызова.
      if (event.extra) event.extra = roundCoordsDeep(event.extra) as typeof event.extra
      if (event.contexts) event.contexts = roundCoordsDeep(event.contexts) as typeof event.contexts
      return event
    },
  })
}

export { Sentry }
