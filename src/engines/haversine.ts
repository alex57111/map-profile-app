const EARTH_R = 6_371_000

export function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dLambda = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function normAngle(deg: number): number {
  return ((deg + 180) % 360) - 180
}

export interface EventAheadInput { lat: number; lng: number }

export interface EventAhead<T extends EventAheadInput> {
  event: T; distanceM: number; bearing: number; angleDiff: number
}

export function eventsAhead<T extends EventAheadInput>(
  userLat: number, userLng: number, userHeading: number,
  events: T[], lookAheadM = 500, fovDeg = 30
): EventAhead<T>[] {
  const dLat = lookAheadM / 111_320
  const dLng = lookAheadM / (111_320 * Math.cos((userLat * Math.PI) / 180))
  const result: EventAhead<T>[] = []
  for (const ev of events) {
    if (ev.lat < userLat - dLat || ev.lat > userLat + dLat || ev.lng < userLng - dLng || ev.lng > userLng + dLng) continue
    const distanceM = haversineMetres(userLat, userLng, ev.lat, ev.lng)
    if (distanceM > lookAheadM) continue
    if (distanceM < 1) continue
    const bearing = bearingDeg(userLat, userLng, ev.lat, ev.lng)
    const angleDiff = Math.abs(normAngle(bearing - userHeading))
    if (angleDiff > fovDeg) continue
    result.push({ event: ev, distanceM, bearing, angleDiff })
  }
  return result.sort((a, b) => a.distanceM - b.distanceM)
}
