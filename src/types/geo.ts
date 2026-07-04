export interface Coords { lat: number; lng: number }
export interface GPSPosition extends Coords {
  heading: number; speed: number; accuracy: number; timestamp: number
}
export type GPSStatus = 'idle' | 'acquiring' | 'active' | 'lost' | 'denied' | 'error'
export interface GPSState { position: GPSPosition | null; status: GPSStatus; error: string | null }
