import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAdapters } from './useAdapters'
import type { AuthState, UserProfile } from '../types/user'

type AuthContextValue = AuthState & {
  signIn: () => Promise<void>
  updateProfile: (data: Partial<Pick<UserProfile, 'displayName' | 'phone'>>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface Props { children: ReactNode }

// Единственное место, где реально стартует анонимный вход (auth.getCurrentUser()/
// signInAnonymous()) — раньше это был обычный хук, вызывавшийся независимо в
// ProfileScreen и (по задумке) должен был вызываться в LocationScreen, из-за
// чего signInAnonymous() мог не сработать вообще, если пользователь не заходил
// на экран профиля. Теперь один вход в дереве, состояние расшаривается через
// контекст — LocationScreen и ProfileScreen читают один и тот же useAuth().
export function AuthProvider({ children }: Props) {
  const { auth } = useAdapters()
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    auth.getCurrentUser().then((user) => {
      if (cancelled) return
      if (user) setState({ status: 'authenticated', user })
      else auth.signInAnonymous().then((u) => { if (!cancelled) setState({ status: 'authenticated', user: u }) })
        .catch(() => { if (!cancelled) setState({ status: 'unauthenticated' }) })
    })
    return () => { cancelled = true }
  }, [auth])

  const signIn = async () => { const user = await auth.signInAnonymous(); setState({ status: 'authenticated', user }) }
  const updateProfile = async (data: Partial<Pick<UserProfile, 'displayName' | 'phone'>>) => {
    const updated = await auth.updateProfile(data); setState({ status: 'authenticated', user: updated })
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
