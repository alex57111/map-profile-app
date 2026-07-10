import { useEffect, useRef, useState, useCallback } from 'react'
import { useAdapters } from './useAdapters'
import { useAuth } from './useAuth'
import { Sentry } from '../lib/sentry'
import type { RoadEvent, CreateEventPayload } from '../types/event'
import type { Coords } from '../types/geo'

export interface MapBounds { minLat: number; maxLat: number; minLng: number; maxLng: number }

export function useMapEvents(_bounds: MapBounds | null) {
  const { events: eventsAdapter } = useAdapters()
  const { status: authStatus } = useAuth()
  const [events, setEvents] = useState<RoadEvent[]>([])
  const [creating, setCreating] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  // Показываем ВСЕ активные события без фильтра по bounds
  // Leaflet сам покажет только те маркеры что в viewport
  useEffect(() => {
    const unsub = eventsAdapter.subscribeToEvents((all) => {
      setEvents(all)
    })
    unsubRef.current = unsub
    return () => { unsub(); unsubRef.current = null }
  }, [eventsAdapter])

  const createEvent = useCallback(async (payload: CreateEventPayload): Promise<void> => {
    setCreating(true)
    try {
      await eventsAdapter.createEvent(payload)
    } catch (e) {
      Sentry.captureException(e, {
        tags: { op: 'useMapEvents.createEvent', authStatus },
        extra: {
          type: payload.type,
          lat: payload.lat, lng: payload.lng, // округляются централизованно в beforeSend
        },
      })
      throw e
    } finally {
      setCreating(false)
    }
  }, [eventsAdapter, authStatus])

  const voteOnEvent = useCallback(async (eventId: string, vote: 'yes' | 'no'): Promise<void> => {
    try {
      await eventsAdapter.voteOnEvent(eventId, vote)
    } catch (e) {
      Sentry.captureException(e, {
        tags: { op: 'useMapEvents.voteOnEvent' },
        extra: { eventId, vote },
      })
      throw e
    }
  }, [eventsAdapter])

  return { events, createEvent, voteOnEvent, creating }
}

export function boundsFromCenter(center: Coords, radiusKm = 5): MapBounds {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180))
  return {
    minLat: center.lat - dLat, maxLat: center.lat + dLat,
    minLng: center.lng - dLng, maxLng: center.lng + dLng,
  }
}
