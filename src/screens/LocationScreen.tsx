
import { useEffect, useCallback, useState, useRef } from "react"
import type { CSSProperties } from "react"
import L from "leaflet"
import { LeafletMap, RecenterButton, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from "../components/map/LeafletMap"
import { AddEventSheet } from "../components/map/AddEventSheet"
import { EventDetailSheet } from "../components/map/EventDetailSheet"
import { EventAheadAlert } from "../components/map/EventAheadAlert"
import { MapHUD, AddEventFAB, ZoomControls } from "../components/map/MapHUD"
import { Speedometer } from "../components/map/Speedometer"
import { MapSearch } from "../components/map/MapSearch"
import { NavigationPanel } from "../components/map/NavigationPanel"
import { COLORS, TAB_HEIGHT } from "../components/ui/tokens"
import { useGPS } from "../hooks/useGPS"
import { useMapEvents } from "../hooks/useMapEvents"
import { usePresence } from "../hooks/usePresence"
import { useEventsAhead } from "../hooks/useEventsAhead"
import { useSpeedLimit } from "../hooks/useSpeedLimit"
import { useRoute, type Route } from "../hooks/useRoute"
import { useAverageSpeedZone } from "../hooks/useAverageSpeedZone"
import type { RoadEvent, EventType } from "../types/event"
import type { Coords } from "../types/geo"

const DEFAULT_CENTER: Coords = { lat: 55.7558, lng: 37.6176 }

export function LocationScreen() {
  const gps = useGPS()
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    gps.start()
    return () => gps.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mapCenterRef = useRef<Coords>(DEFAULT_CENTER)
  const [zoom, setZoom] = useState(14)

  const { events, createEvent, voteOnEvent, creating } = useMapEvents(null)
  const { onlineUsers } = usePresence(gps.position)
  const { alerts, dismiss } = useEventsAhead(gps.position, events)
  const speedLimit = useSpeedLimit(gps.position)
  const {
    routes, activeRoute, loading: routeLoading, selecting,
    buildRoute, selectRoute, clearRoute, checkDeviation, updateProgress,
  } = useRoute()

  // ТЗ №2 шаг 4 — подключаем useAverageSpeedZone
  useAverageSpeedZone(gps.position, events)

  const [autoCenter, setAutoCenter] = useState(true)
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<RoadEvent | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [destination, setDestination] = useState<Coords | null>(null)

  // ТЗ №1 шаг 4 — updateProgress рядом с checkDeviation
  useEffect(() => {
    if (!gps.position || !activeRoute) return
    void checkDeviation(gps.position.lat, gps.position.lng)
    void updateProgress(gps.position.lat, gps.position.lng)
  }, [gps.position?.lat, gps.position?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (selectedEvent || selecting) return
    setPendingCoords({ lat, lng })
    setAddSheetOpen(true)
    setAutoCenter(false)
  }, [selectedEvent, selecting])

  const handleMapMove = useCallback((_center: Coords) => {
    mapCenterRef.current = _center
    setAutoCenter(false)
  }, [])

  const handleEventClick = useCallback((ev: RoadEvent) => {
    if (selecting) return
    setSelectedEvent(ev); setAddSheetOpen(false)
  }, [selecting])

  // ТЗ №2 — передаём heading и доп. поля при создании события
  const handleCreateEvent = useCallback(async (
    type: EventType,
    coords: Coords,
    options?: { description?: string; heading?: number; endLat?: number; endLng?: number; zoneLimitKmh?: number }
  ) => {
    await createEvent({
      type,
      lat: coords.lat,
      lng: coords.lng,
      description: options?.description,
      heading: options?.heading,
      endLat: options?.endLat,
      endLng: options?.endLng,
      zoneLimitKmh: options?.zoneLimitKmh,
    })
    setAddSheetOpen(false)
    setPendingCoords(null)
  }, [createEvent])

  const handleVote = useCallback(async (eventId: string, vote: "yes" | "no") => {
    await voteOnEvent(eventId, vote)
    setSelectedEvent((prev) => {
      if (!prev || prev.id !== eventId) return prev
      return {
        ...prev,
        positiveVotes: vote === "yes" ? prev.positiveVotes + 1 : prev.positiveVotes,
        negativeVotes: vote === "no"  ? prev.negativeVotes + 1 : prev.negativeVotes,
      }
    })
  }, [voteOnEvent])

  const handleFABPress = useCallback(() => {
    if (selecting) return
    const center = gps.position
      ? { lat: gps.position.lat, lng: gps.position.lng }
      : mapCenterRef.current
    setPendingCoords(center)
    setAddSheetOpen(true)
  }, [gps.position, selecting])

  const handleRecenter = useCallback(() => {
    const map = mapRef.current; if (!map) return
    if (gps.position) {
      map.setView([gps.position.lat, gps.position.lng], MAP_MAX_ZOOM, { animate: true, duration: 0.6 })
    }
    setAutoCenter(true)
  }, [gps.position])

  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), [])
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), [])

  const handleSearchSelect = useCallback(async (coords: Coords) => {
    setDestination(coords)
    const from = gps.position
      ? { lat: gps.position.lat, lng: gps.position.lng }
      : mapCenterRef.current
    await buildRoute(from, coords)
    setAutoCenter(false)
  }, [gps.position, buildRoute])

  const handleRouteClick = useCallback((route: Route) => {
    selectRoute(route)
  }, [selectRoute])

  const handleClearRoute = useCallback(() => {
    clearRoute(); setDestination(null)
  }, [clearRoute])

  const speedKmh = gps.position ? gps.position.speed * 3.6 : 0
  const alertVisible = alerts.length > 0 && !addSheetOpen && !selectedEvent && !selecting
  const navActive = !!activeRoute && !alertVisible && !selecting
  const showRouteTip = selecting && routes.length > 1

  const wrapStyle: CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0,
    bottom: TAB_HEIGHT, backgroundColor: COLORS.bg, overflow: "hidden",
  }

  return (
    <div style={wrapStyle}>
      <LeafletMap
        position={gps.position}
        events={events}
        onlineUsers={onlineUsers}
        autoCenter={autoCenter}
        routes={routes}
        activeRoute={activeRoute}
        destination={destination}
        selecting={selecting}
        onMapClick={handleMapClick}
        onMapMove={handleMapMove}
        onZoomChange={setZoom}
        onEventClick={handleEventClick}
        onRouteClick={handleRouteClick}
        mapRef={mapRef}
      />

      {/* Подсказка выбора маршрута */}
      {showRouteTip && (
        <div style={{
          position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
          backgroundColor: "rgba(15,15,15,0.92)", borderRadius: 24,
          padding: "10px 20px", color: "#fff", fontSize: 14, fontWeight: 600,
          zIndex: 460, whiteSpace: "nowrap",
          backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>👆</span>
          <span>Нажмите на маршрут для выбора</span>
          <button onClick={handleClearRoute} style={{ marginLeft: 8, background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
      )}

      {navActive && (
        <NavigationPanel route={activeRoute} position={gps.position} onClear={handleClearRoute} />
      )}

      {!alertVisible && !navActive && !selecting && (
        <MapSearch onSelect={handleSearchSelect} />
      )}

      {alertVisible && (
        <EventAheadAlert alerts={alerts} onVote={handleVote} onDismiss={dismiss} />
      )}

      {!alertVisible && !activeRoute && !selecting && (
        <MapHUD gps={gps} onlineCount={onlineUsers.length} eventsCount={events.length} />
      )}

      {speedKmh > 2 && !alertVisible && (
        <Speedometer speedKmh={speedKmh} limitKmh={speedLimit} />
      )}

      {routeLoading && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          backgroundColor: "rgba(15,15,15,0.92)", borderRadius: 16,
          padding: "16px 24px", color: "#fff", fontSize: 15, fontWeight: 600,
          zIndex: 600, backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>🗺️</span>
          <span>Строю маршрут...</span>
        </div>
      )}

      <ZoomControls zoom={zoom} minZoom={MAP_MIN_ZOOM} maxZoom={MAP_MAX_ZOOM} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
      <RecenterButton active={autoCenter} onRecenter={handleRecenter} />
      {!selecting && <AddEventFAB onPress={handleFABPress} />}

      {/* ТЗ №2 — передаём heading пользователя в шторку */}
      <AddEventSheet
        coords={addSheetOpen ? pendingCoords : null}
        userHeading={gps.position?.heading}
        onCreate={handleCreateEvent}
        onClose={() => { setAddSheetOpen(false); setPendingCoords(null) }}
        creating={creating}
      />
      <EventDetailSheet
        event={selectedEvent}
        onVote={handleVote}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}
