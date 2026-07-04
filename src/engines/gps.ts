import type { GPSPosition, GPSStatus } from '../types/geo'

export type GPSCallback = (pos: GPSPosition) => void
export type GPSErrorCallback = (status: GPSStatus, msg: string) => void

interface GPSEngineOptions {
  onPosition: GPSCallback
  onError: GPSErrorCallback
  maxAge?: number
  timeout?: number
  minDistanceM?: number
  minIntervalMs?: number
}

interface KalmanState { lat: number; lng: number; variance: number }

const EARTH_R = 6_371_000

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function kalmanUpdate(state: KalmanState, measLat: number, measLng: number, accuracy: number, q = 3): KalmanState {
  const r = accuracy * accuracy
  const newVariance = state.variance + q
  const k = newVariance / (newVariance + r)
  return {
    lat: state.lat + k * (measLat - state.lat),
    lng: state.lng + k * (measLng - state.lng),
    variance: (1 - k) * newVariance,
  }
}

class HeadingSmootherImpl {
  private samples: number[] = []
  private readonly maxSamples: number
  constructor(maxSamples = 5) { this.maxSamples = maxSamples }
  push(heading: number): number {
    this.samples.push(heading)
    if (this.samples.length > this.maxSamples) this.samples.shift()
    let sinSum = 0, cosSum = 0
    for (const h of this.samples) {
      const r = (h * Math.PI) / 180
      sinSum += Math.sin(r)
      cosSum += Math.cos(r)
    }
    const mean = (Math.atan2(sinSum, cosSum) * 180) / Math.PI
    return (mean + 360) % 360
  }
  reset(): void { this.samples = [] }
}

export class GPSEngine {
  private watchId: number | null = null
  private kalman: KalmanState | null = null
  private headingSmoother = new HeadingSmootherImpl(5)
  private lastEmitTime = 0
  private lastEmitLat = 0
  private lastEmitLng = 0
  private readonly opts: Required<GPSEngineOptions>

  constructor(opts: GPSEngineOptions) {
    this.opts = { maxAge: 3_000, timeout: 10_000, minDistanceM: 2, minIntervalMs: 1_000, ...opts }
  }

  start(): void {
    if (!navigator.geolocation) {
      this.opts.onError('denied', 'Геолокация не поддерживается устройством')
      return
    }
    this.watchId = navigator.geolocation.watchPosition(
      (raw) => this.handleRaw(raw),
      (err) => this.handleGeoError(err),
      { enableHighAccuracy: true, maximumAge: this.opts.maxAge, timeout: this.opts.timeout }
    )
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.kalman = null
    this.headingSmoother.reset()
  }

  private handleRaw(raw: GeolocationPosition): void {
    const { latitude, longitude, accuracy, heading, speed } = raw.coords
    if (accuracy > 100) return
    if (!this.kalman) this.kalman = { lat: latitude, lng: longitude, variance: accuracy * accuracy }
    this.kalman = kalmanUpdate(this.kalman, latitude, longitude, accuracy)
    if (this.lastEmitTime > 0) {
      const jump = haversineMetres(this.lastEmitLat, this.lastEmitLng, latitude, longitude)
      if (jump > 500) return
    }
    const now = Date.now()
    if (now - this.lastEmitTime < this.opts.minIntervalMs) return
    const dist = haversineMetres(this.lastEmitLat, this.lastEmitLng, this.kalman.lat, this.kalman.lng)
    if (this.lastEmitTime > 0 && dist < this.opts.minDistanceM) return
    const rawHeading = heading ?? this.derivedHeading(this.kalman.lat, this.kalman.lng)
    const smoothHeading = this.headingSmoother.push(rawHeading)
    const pos: GPSPosition = {
      lat: this.kalman.lat, lng: this.kalman.lng, heading: smoothHeading,
      speed: speed ?? 0, accuracy, timestamp: now,
    }
    this.lastEmitTime = now
    this.lastEmitLat = this.kalman.lat
    this.lastEmitLng = this.kalman.lng
    this.opts.onPosition(pos)
  }

  private derivedHeading(lat: number, lng: number): number {
    if (this.lastEmitTime === 0) return 0
    const dLng = lng - this.lastEmitLng
    const dLat = lat - this.lastEmitLat
    const angle = (Math.atan2(dLng, dLat) * 180) / Math.PI
    return (angle + 360) % 360
  }

  private handleGeoError(err: GeolocationPositionError): void {
    switch (err.code) {
      case err.PERMISSION_DENIED: this.opts.onError('denied', 'Доступ к геолокации запрещён'); break
      case err.POSITION_UNAVAILABLE: this.opts.onError('lost', 'Сигнал GPS потерян'); break
      case err.TIMEOUT: this.opts.onError('error', 'Превышено время ожидания GPS'); break
    }
  }
}
