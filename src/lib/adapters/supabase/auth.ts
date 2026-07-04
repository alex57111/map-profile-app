import { supabase, db } from '../../supabase'
import type { AuthAdapter } from '../interface'
import type { UserProfile } from '../../../types/user'

interface ProfileRow { display_name: string; avatar_url: string | null; phone: string | null; is_anonymous: boolean; created_at: string }

function toProfile(id: string, row: ProfileRow): UserProfile {
  return { id, displayName: row.display_name, avatarUrl: row.avatar_url, phone: row.phone, isAnonymous: row.is_anonymous, createdAt: row.created_at }
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await db.from('profiles').select('display_name, avatar_url, phone, is_anonymous, created_at').eq('id', userId).single()
  return data as ProfileRow | null
}

export const supabaseAuthAdapter: AuthAdapter = {
  async signInAnonymous(): Promise<UserProfile> {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) throw new Error(error?.message ?? 'Anonymous sign-in failed')
    let profile: ProfileRow | null = null
    for (let i = 0; i < 3; i++) {
      profile = await fetchProfile(data.user.id)
      if (profile) break
      await new Promise((r) => setTimeout(r, 300))
    }
    if (!profile) throw new Error('Profile not created after sign-in')
    return toProfile(data.user.id, profile)
  },
  async getCurrentUser(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const profile = await fetchProfile(user.id)
    if (!profile) return null
    return toProfile(user.id, profile)
  },
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },
  async updateProfile(patch): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const update: Record<string, string> = {}
    if (patch.displayName !== undefined) update['display_name'] = patch.displayName
    if (patch.phone != null) update['phone'] = patch.phone
    const { data: updated, error } = await db.from('profiles').update(update).eq('id', user.id)
      .select('display_name, avatar_url, phone, is_anonymous, created_at').single()
    if (error || !updated) throw new Error(error?.message ?? 'Update failed')
    return toProfile(user.id, updated as ProfileRow)
  },
}
