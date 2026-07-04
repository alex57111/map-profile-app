import { useState, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { COLORS, FONT, SPACING, RADIUS, SAFE_TOP } from '../ui/tokens'
import { geocodeForward } from '../../hooks/useGeocoder'
import type { Coords } from '../../types/geo'

interface SearchResult {
  name: string
  displayName: string
  coords: Coords
}

interface Props {
  onSelect: (coords: Coords, name: string) => void
}

export function MapSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInput = useCallback((text: string) => {
    setQuery(text)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!text.trim()) { setResults([]); return }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const found = await geocodeForward(text)
        setResults(found.slice(0, 5))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  }, [])

  const handleSelect = useCallback((r: SearchResult) => {
    setQuery(r.name)
    setResults([])
    setOpen(false)
    inputRef.current?.blur()
    onSelect(r.coords, r.name)
  }, [onSelect])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.blur()
  }, [])

  const wrapStyle: CSSProperties = {
    position: 'absolute',
    top: `calc(${SAFE_TOP} + 12px)`,
    left: 12, right: 60, // оставляем место для zoom
    zIndex: 450,
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 36px 10px 14px',
    backgroundColor: open ? COLORS.bgCard : 'rgba(26,26,26,0.92)',
    border: `1px solid ${open ? COLORS.accent : COLORS.border}`,
    borderRadius: open && results.length > 0 ? `${RADIUS.lg}px ${RADIUS.lg}px 0 0` : RADIUS.lg,
    color: COLORS.textPrimary,
    fontSize: FONT.base,
    outline: 'none',
    boxSizing: 'border-box',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    transition: 'border-color 0.15s, border-radius 0.1s',
  }

  return (
    <div style={wrapStyle}>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, pointerEvents: 'none', opacity: 0.6,
        }}>🔍</span>
        <input
          ref={inputRef}
          style={{ ...inputStyle, paddingLeft: 36 }}
          placeholder="Поиск адреса..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query.length > 0 && (
          <button
            onMouseDown={(e) => { e.preventDefault(); handleClear() }}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: COLORS.textDisabled,
              fontSize: 18, cursor: 'pointer', padding: 4,
              lineHeight: 1,
            }}>✕</button>
        )}
      </div>

      {/* Результаты */}
      {open && (results.length > 0 || loading) && (
        <div style={{
          backgroundColor: COLORS.bgCard,
          border: `1px solid ${COLORS.accent}`,
          borderTop: 'none',
          borderRadius: `0 0 ${RADIUS.lg}px ${RADIUS.lg}px`,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {loading && (
            <div style={{ padding: `${SPACING.sm}px ${SPACING.md}px`, color: COLORS.textDisabled, fontSize: FONT.sm }}>
              Поиск...
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r) }}
              style={{
                width: '100%', padding: `${SPACING.sm}px ${SPACING.md}px`,
                backgroundColor: 'transparent', border: 'none',
                borderBottom: i < results.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                color: COLORS.textPrimary, fontSize: FONT.sm,
                textAlign: 'left', cursor: 'pointer',
                display: 'block',
              }}>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>📍 {r.name}</div>
              <div style={{ fontSize: FONT.xs, color: COLORS.textSecond }}>
                {r.displayName.split(',').slice(0, 3).join(',')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
