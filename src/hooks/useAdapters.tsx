import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getAdapters } from '../lib/adapters'
import type { AppAdapters } from '../lib/adapters/interface'

const AdaptersContext = createContext<AppAdapters | null>(null)

interface Props { children: ReactNode }

export function AdaptersProvider({ children }: Props) {
  const [adapters, setAdapters] = useState<AppAdapters | null>(null)

  useEffect(() => { getAdapters().then(setAdapters) }, [])

  if (!adapters) return null

  return <AdaptersContext.Provider value={adapters}>{children}</AdaptersContext.Provider>
}

export function useAdapters(): AppAdapters {
  const ctx = useContext(AdaptersContext)
  if (!ctx) throw new Error('useAdapters must be used within AdaptersProvider')
  return ctx
}
