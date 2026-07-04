import type { AuthAdapter } from '../interface'
import type { UserProfile } from '../../../types/user'

const STORAGE_KEY = 'mock_user_profile'

function makeAnonUser(): UserProfile {
  return {
    id: `anon_${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Водитель',
    avatarUrl: null,
    phone: null,
    isAnonymous: true,
    createdAt: new Date().toISOString(),
  }
}

export const mockAuthAdapter: AuthAdapter = {
  async signInAnonymous(): Promise<UserProfile> {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as UserProfile
    const user = makeAnonUser()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return user
  },
  async getCurrentUser(): Promise<UserProfile | null> {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as UserProfile
  },
  async signOut(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY)
  },
  async updateProfile(data): Promise<UserProfile> {
    const stored = localStorage.getItem(STORAGE_KEY)
    const base: UserProfile = stored ? JSON.parse(stored) : makeAnonUser()
    const updated: UserProfile = { ...base, ...data }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  },
}
