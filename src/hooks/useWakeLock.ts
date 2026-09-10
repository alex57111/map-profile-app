import { useEffect, useRef } from "react"
import { Sentry } from "../lib/sentry"

// Шаг 1 топ-5 (антирадар, часть 1 — веб-версия того, что возможно без
// нативной обёртки): Screen Wake Lock API — не даёт экрану гаснуть/
// блокироваться, пока идёт активная навигация. НЕ решает полный фон
// (свёрнутое приложение/выключенный экран) — это ограничение браузеров,
// см. AGENT_LOG.md заход 21. Решает только "погас экран прямо во время
// поездки, пропустил манёвр/камеру".
//
// Поддержка: Chrome/Edge/Android WebView — да; Safari iOS 16.4+ — да (с
// ограничениями); старые браузеры — API отсутствует, тогда просто no-op.

type WakeLockSentinel = { released: boolean; release: () => Promise<void>; addEventListener: (type: "release", cb: () => void) => void }
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } }

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock
    if (!active || !nav.wakeLock) return

    let cancelled = false

    async function acquire() {
      try {
        const sentinel = await nav.wakeLock!.request("screen")
        if (cancelled) {
          // active стал false / компонент размонтирован, пока ждали промис —
          // сразу отпускаем, чтобы не держать лишний lock.
          void sentinel.release()
          return
        }
        sentinelRef.current = sentinel
      } catch (e) {
        // Частая причина — вкладка не в фокусе в момент запроса (не ошибка
        // конфигурации), не шумим в Sentry при обычном NotAllowedError.
        const name = e instanceof Error ? e.name : undefined
        if (name !== "NotAllowedError") {
          Sentry.captureException(e, { tags: { op: "useWakeLock.acquire" } })
        }
      }
    }

    void acquire()

    // Вкладка сворачивается → sentinel браузер освобождает сам и шлёт
    // release-событие; при возврате на вкладку — запрашиваем заново.
    function handleVisibility() {
      if (document.visibilityState === "visible" && active && !sentinelRef.current) {
        void acquire()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibility)
      if (sentinelRef.current && !sentinelRef.current.released) {
        void sentinelRef.current.release()
      }
      sentinelRef.current = null
    }
  }, [active])
}
