import { useEffect, useState } from 'react'
import { useAdapters } from './useAdapters'
import type { AuthState, UserProfile } from '../types/user'
export function useAuth(): AuthState & {
  signIn: () => Promise<void>
  updateProfile: (data: Partial<Pick<UserProfile, 'displayName' | 'phone'>>) => Promise<void>
} {
  const { auth } = useAdapters()
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  useEffect(() => {
    auth.getCurrentUser().then((user) => {
      if (user) setState({ status: 'authenticated', user })
      else auth.signInAnonymous().then((u) => setState({ status: 'authenticated', user: u }))
        .catch(() => setState({ status: 'unauthenticated' }))
    })
  }, [auth])
  const signIn = async () => { const user = await auth.signInAnonymous(); setState({ status: 'authenticated', user }) }
  const updateProfile = async (data: Partial<Pick<UserProfile, 'displayName' | 'phone'>>) => {
    const updated = await auth.updateProfile(data); setState({ status: 'authenticated', user: updated })
  }
  return { ...state, signIn, updateProfile }
}
