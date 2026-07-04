import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RoadEvent } from '../../types/event'
import type { OnlineUser } from '../../types/user'
import type { GPSPosition, Coords } from '../../types/geo'
import { EVENT_TYPE_CONFIG } from '../../types/event'
import { useDraggable } from '../../hooks/useDraggable'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

function arrowSvg(heading: number, color = '#F97316'): L.DivIcon {
  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${heading}, 20, 20)">
      <polygon points="20,4 28,32 20,26 12,32" fill="${color}" stroke="white" stroke-width="1.5"/>
    </g>
    <circle cx="20" cy="20" r="5" fill="${color}" stroke="white" stroke-width="2"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [40, 40], iconAnchor: [20, 20] })
}

function eventIcon(type: RoadEvent['type']): L.DivIcon {
  const cfg = EVENT_TYPE_CONFIG[type]
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${cfg.color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.8);">${cfg.icon}</div>`,
    className: '', iconSize: [36, 36], iconAnchor: [18, 18],
  })
}

function destIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🏁</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 32],
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MCGroup = any

export const MAP_MIN_ZOOM = 3
export const MAP_MAX_ZOOM = 19

interface Props {
  position: GPSPosition | null
  events: RoadEvent[]
  onlineUsers: OnlineUser[]
  autoCenter: boolean
  routeCoords?: Coords[]
  destination?: Coords | null
  onMapClick: (lat: number, lng: number) => void
  onMapMove?: (center: Coords) => void
  onZoomChange?: (zoom: number) => void
  onEventClick: (event: RoadEvent) => void
  mapRef?: React.MutableRefObject<L.Map | null>
}

const DEFAULT_CENTER: [number, number] = [55.7558, 37.6176]

export function LeafletMap({
  position, events, onlineUsers, autoCenter,
  routeCoords, destination,
  onMapClick, onMapMove, onZoomChange, onEventClick, mapRef: externalMapRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalMapRef = useRef<L.Map | null>(null)
  const mapRef = externalMapRef ?? internalMapRef
  const ownMarkerRef = useRef<L.Marker | null>(null)
  const clusterGroupRef = useRef<MCGroup>(null)
  const eventMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const userMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const routeLineRef = useRef<L.Polyline | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const autoCenterRef = useRef(autoCenter)
  autoCenterRef.current = autoCenter
  const onEventClickRef = useRef(onEventClick)
  onEventClickRef.current = onEventClick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER, zoom: 14,
      zoomControl: false, attributionControl: false,
      minZoom: MAP_MIN_ZOOM, maxZoom: MAP_MAX_ZOOM,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: MAP_MAX_ZOOM, attribution: '© OpenStreetMap',
    }).addTo(map)
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LG = window.L as any
    if (LG?.markerClusterGroup) {
      const cluster = LG.markerClusterGroup({ maxClusterRadius: 60, showCoverageOnHover: false })
      cluster.addTo(map)
      clusterGroupRef.current = cluster
    }

    map.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng))
    map.on('moveend', () => { const c = map.getCenter(); onMapMove?.({ lat: c.lat, lng: c.lng }) })
    map.on('zoomend', () => onZoomChange?.(map.getZoom()))

    mapRef.current = map
    return () => {
      map.remove(); mapRef.current = null; clusterGroupRef.current = null
      ownMarkerRef.current = null; eventMarkersRef.current.clear(); userMarkersRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    const latlng = L.latLng(position.lat, position.lng)
    if (!ownMarkerRef.current) {
      ownMarkerRef.current = L.marker(latlng, { icon: arrowSvg(position.heading), zIndexOffset: 1000, interactive: false }).addTo(map)
    } else {
      ownMarkerRef.current.setLatLng(latlng)
      ownMarkerRef.current.setIcon(arrowSvg(position.heading))
    }
    if (autoCenterRef.current) map.panTo(latlng, { animate: true, duration: 0.5 })
  }, [position]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null }
    if (destMarkerRef.current) { destMarkerRef.current.remove(); destMarkerRef.current = null }
    if (routeCoords && routeCoords.length > 0) {
      routeLineRef.current = L.polyline(
        routeCoords.map((c) => [c.lat, c.lng] as [number, number]),
        { color: '#3B82F6', weight: 5, opacity: 0.85 }
      ).addTo(map)
      if (destination) {
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destIcon(), zIndexOffset: 900 }).addTo(map)
      }
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [40, 40] })
    }
  }, [routeCoords, destination]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current; const cluster = clusterGroupRef.current
    if (!map) return
    const currentIds = new Set(events.map((e) => e.id))
    for (const [id, marker] of eventMarkersRef.current) {
      if (!currentIds.has(id)) {
        if (cluster) cluster.removeLayer(marker); else marker.remove()
        eventMarkersRef.current.delete(id)
      }
    }
    for (const ev of events) {
      if (eventMarkersRef.current.has(ev.id)) continue
      const marker = L.marker([ev.lat, ev.lng], { icon: eventIcon(ev.type) })
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onEventClickRef.current(ev) })
      if (cluster) cluster.addLayer(marker); else marker.addTo(map)
      eventMarkersRef.current.set(ev.id, marker)
    }
  }, [events]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const currentIds = new Set(onlineUsers.map((u) => u.userId))
    for (const [id, marker] of userMarkersRef.current) {
      if (!currentIds.has(id)) { marker.remove(); userMarkersRef.current.delete(id) }
    }
    for (const user of onlineUsers) {
      const existing = userMarkersRef.current.get(user.userId)
      if (existing) {
        existing.setLatLng([user.lat, user.lng])
        existing.setIcon(arrowSvg(user.heading, '#3B82F6'))
      } else {
        const marker = L.marker([user.lat, user.lng], { icon: arrowSvg(user.heading, '#3B82F6') })
        marker.bindTooltip(user.displayName, { permanent: false, direction: 'top', offset: [0, -20], className: 'leaflet-tooltip-dark' })
        marker.addTo(map)
        userMarkersRef.current.set(user.userId, marker)
      }
    }
  }, [onlineUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' } as CSSProperties} />
}

// Кнопка рецентра — перетаскиваемая, полупрозрачная
interface RecenterProps { onRecenter: () => void; active: boolean }

export function RecenterButton({ onRecenter, active }: RecenterProps) {
  const { pos, onPointerDown, onPointerMove, onPointerUp, wasTap } = useDraggable({ x: 0, y: 0 })

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => { onPointerUp(); if (wasTap()) onRecenter() }}
      style={{
        position: 'absolute',
        bottom: 80 - pos.y,
        right: 12 - pos.x,
        width: 44, height: 44, borderRadius: '50%',
        backgroundColor: active ? 'rgba(249,115,22,0.8)' : 'rgba(26,26,26,0.7)',
        border: `1px solid ${active ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.15)'}`,
        color: '#fff', fontSize: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', zIndex: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        WebkitTapHighlightColor: 'transparent',
        backdropFilter: 'blur(4px)',
        touchAction: 'none',
        userSelect: 'none',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >📍</div>
  )
}
