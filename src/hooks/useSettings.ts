import { useEffect, useState } from 'react'
import { getTheme, getLang, type Theme, type Lang } from '../lib/settings'
export function useSettings() {
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const [lang, setLangState] = useState<Lang>(getLang)
  useEffect(() => {
    const handler = () => { setThemeState(getTheme()); setLangState(getLang()) }
    window.addEventListener('app-settings-change', handler)
    return () => window.removeEventListener('app-settings-change', handler)
  }, [])
  return { theme, lang }
}
