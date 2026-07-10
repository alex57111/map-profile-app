import { useEffect, useRef, useState, useCallback } from 'react'
import { GPSEngine } from '../engines/gps'
import { Sentry } from '../lib/sentry'
import type { GPSState, GPSPosition } from '../types/geo'

const INITIAL_STATE: GPSState = { position: null, status: 'idle', error: null }

export function useGPS(): GPSState & { start: () => void; stop: () => void } {
  const [state, setState] = useState<GPSState>(INITIAL_STATE)
  const engineRef = useRef<GPSEngine | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; engineRef.current?.stop() }
  }, [])

  const start = useCallback(() => {
    if (engineRef.current) return
    setState((s) => ({ ...s, status: 'acquiring', error: null }))
    engineRef.current = new GPSEngine({
      onPosition: (pos: GPSPosition) => {
        if (!mountedRef.current) return
        setState({ position: pos, status: 'active', error: null })
      },
      onError: (status, msg, code) => {
        if (!mountedRef.current) return
        setState((s) => ({ ...s, status, error: msg }))
        // 'lost' (POSITION_UNAVAILABLE) — обычный кейс на въезде в тоннель/паркинг,
        // не шлём в Sentry как ошибку, чтобы не засорять — остальное репортим.
        if (status !== 'lost') {
          Sentry.captureMessage(`GPS error: ${msg}`, {
            level: 'warning',
            tags: { op: 'useGPS', gpsStatus: status },
            extra: { geolocationErrorCode: code },
          })
        }
      },
      minDistanceM: 2, minIntervalMs: 1_000,
    })
    engineRef.current.start()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current = null
    setState(INITIAL_STATE)
  }, [])

  return { ...state, start, stop }
}
