export interface UserProfile {
  id: string; displayName: string; avatarUrl: string | null
  phone: string | null; isAnonymous: boolean; createdAt: string
}
export interface OnlineUser {
  userId: string; displayName: string; lat: number; lng: number
  heading: number; speed: number; status: 'driving' | 'idle'; updatedAt: number
}
export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: UserProfile }
  | { status: 'unauthenticated' }
