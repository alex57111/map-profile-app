import { useState } from 'react'
import type { CSSProperties } from 'react'
import { TopBar } from '../components/ui/TopBar'
import { ScreenWrapper } from '../components/ui/ScreenWrapper'
import { RideCard, RideStatusBadge } from '../components/rides/RideCard'
import { COLORS, FONT, SPACING, RADIUS } from '../components/ui/tokens'
import { useAuth } from '../hooks/useAuth'
import { useMyRides } from '../hooks/useRides'
import { useSettings } from '../hooks/useSettings'
import { setTheme, setLang, T } from '../lib/settings'

type Tab = 'driver' | 'passenger' | 'settings'

export function ProfileScreen() {
  const auth = useAuth()
  const { asDriver, asPassenger, loading, cancelRide } = useMyRides()
  const { theme, lang } = useSettings()
  const [tab, setTab] = useState<Tab>('driver')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const user = auth.status === 'authenticated' ? auth.user : null
  const C = COLORS
  const t = (key: string) => T[key]?.[lang] ?? key

  const isDark = theme === 'dark'
  // Цвета с учётом темы
  const cardBg = isDark ? C.bgCard : '#FFFFFF'
  const bg = isDark ? C.bg : '#F5F5F5'
  const border = isDark ? C.border : '#D0D0D0'
  const textPrimary = isDark ? C.textPrimary : '#111'
  const textSecond = isDark ? C.textSecond : '#555'

  async function saveName() {
    if (!name.trim()) return
    await auth.updateProfile({ displayName: name.trim() })
    setEditing(false)
  }

  const sectionLabel: CSSProperties = {
    fontSize: FONT.xs, color: textSecond,
    marginBottom: SPACING.xs, letterSpacing: 0.6, fontWeight: 600,
  }

  return (
    <>
      <TopBar title={t('profile')} />
      <ScreenWrapper style={{ backgroundColor: bg }}>
        <div style={{ padding: SPACING.md }}>

          {/* Профиль */}
          <div style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: RADIUS.lg, padding: SPACING.md, display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: C.accent + '22', border: `2px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <div style={{ display: 'flex', gap: SPACING.xs }}>
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveName() }}
                    placeholder={lang === 'ru' ? 'Ваше имя' : 'Your name'}
                    style={{ flex: 1, padding: '8px 10px', backgroundColor: isDark ? C.bgElevated : '#EBEBEB', border: `1px solid ${C.accent}`, borderRadius: RADIUS.sm, color: textPrimary, fontSize: FONT.base, outline: 'none' }} />
                  <button onClick={() => void saveName()} style={smallBtnStyle(C.accent)}>✓</button>
                  <button onClick={() => setEditing(false)} style={smallBtnStyle(isDark ? C.bgElevated : '#EBEBEB')}>✕</button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: FONT.md, color: textPrimary, fontWeight: 700 }}>{user?.displayName ?? (lang === 'ru' ? 'Водитель' : 'Driver')}</div>
                  <div style={{ fontSize: FONT.xs, color: textSecond, marginTop: 2 }}>{user?.isAnonymous ? t('anon') : user?.phone ?? ''}</div>
                </>
              )}
            </div>
            {!editing && (
              <button onClick={() => { setName(user?.displayName ?? ''); setEditing(true) }}
                style={{ padding: '8px 14px', backgroundColor: isDark ? C.bgElevated : '#EBEBEB', color: textSecond, border: `1px solid ${border}`, borderRadius: RADIUS.md, fontSize: FONT.xs, cursor: 'pointer' }}>
                {t('edit')}
              </button>
            )}
          </div>

          {/* Статистика */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING.sm, marginBottom: SPACING.md }}>
            <StatCard label={t('as_driver')} value={asDriver.length} icon="🚗" cardBg={cardBg} border={border} textPrimary={textPrimary} textSecond={textSecond} />
            <StatCard label={t('as_pass')} value={asPassenger.length} icon="🎒" cardBg={cardBg} border={border} textPrimary={textPrimary} textSecond={textSecond} />
          </div>

          {/* Вкладки */}
          <div style={{ display: 'flex', gap: 2, marginBottom: SPACING.md, backgroundColor: isDark ? C.bgElevated : '#EBEBEB', borderRadius: RADIUS.md, padding: 3 }}>
            {(['driver', 'passenger', 'settings'] as Tab[]).map((t_) => (
              <button key={t_} onClick={() => setTab(t_)} style={{
                flex: 1, padding: '8px 4px',
                backgroundColor: tab === t_ ? cardBg : 'transparent',
                border: 'none', borderRadius: RADIUS.sm - 2,
                color: tab === t_ ? textPrimary : textSecond,
                fontSize: FONT.xs, fontWeight: tab === t_ ? 600 : 400, cursor: 'pointer',
              }}>
                {t_ === 'driver' ? t('driver') : t_ === 'passenger' ? t('passenger') : t('settings')}
              </button>
            ))}
          </div>

          {/* Поездки водителя */}
          {tab === 'driver' && (
            <div>
              <p style={sectionLabel}>{t('as_driver')}</p>
              {loading && <LoadingPlaceholder text={t('loading')} textSecond={textSecond} />}
              {!loading && asDriver.length === 0 && <EmptyState text={t('no_rides')} textSecond={textSecond} />}
              {asDriver.map((ride) => (
                <div key={ride.id}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}><RideStatusBadge status={ride.status} /></div>
                  <RideCard ride={ride} showCancel={ride.status === 'active'} onCancel={() => void cancelRide(ride.id)} />
                </div>
              ))}
            </div>
          )}

          {/* Поездки пассажира */}
          {tab === 'passenger' && (
            <div>
              <p style={sectionLabel}>{t('as_pass')}</p>
              {loading && <LoadingPlaceholder text={t('loading')} textSecond={textSecond} />}
              {!loading && asPassenger.length === 0 && <EmptyState text={t('no_reqs')} textSecond={textSecond} />}
              {asPassenger.map((req) => (
                <div key={req.id} style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: FONT.sm, color: textSecond }}>{lang === 'ru' ? 'Запрос' : 'Request'} #{req.id.slice(-6)}</span>
                    <RequestBadge status={req.status} lang={lang} />
                  </div>
                  <div style={{ fontSize: FONT.xs, color: isDark ? C.textDisabled : '#AAA', marginTop: 4 }}>
                    {new Date(req.createdAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')} · {req.seatsCount} {lang === 'ru' ? 'мест' : 'seats'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Настройки */}
          {tab === 'settings' && (
            <div>
              <p style={sectionLabel}>{t('settings')}</p>
              <div style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md }}>

                {/* Тема — одним тапом */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${SPACING.sm}px ${SPACING.md}px`, borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: FONT.base, color: textPrimary }}>
                    {lang === 'ru' ? 'Тема' : 'Theme'}
                  </span>
                  <button
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px',
                      backgroundColor: isDark ? '#333' : '#E0E0E0',
                      border: `1px solid ${border}`,
                      borderRadius: RADIUS.full,
                      color: textPrimary,
                      fontSize: FONT.sm, fontWeight: 600,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all 0.2s',
                    }}>
                    <span>{isDark ? '🌙' : '☀️'}</span>
                    <span>{isDark ? t('theme_dark') : t('theme_light')}</span>
                  </button>
                </div>

                {/* Язык — одним тапом */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${SPACING.sm}px ${SPACING.md}px`, borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: FONT.base, color: textPrimary }}>
                    {lang === 'ru' ? 'Язык' : 'Language'}
                  </span>
                  <button
                    onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px',
                      backgroundColor: isDark ? '#333' : '#E0E0E0',
                      border: `1px solid ${border}`,
                      borderRadius: RADIUS.full,
                      color: textPrimary,
                      fontSize: FONT.sm, fontWeight: 600,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'all 0.2s',
                    }}>
                    <span>{lang === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
                    <span>{lang === 'ru' ? 'Русский' : 'English'}</span>
                  </button>
                </div>

                <SettingRow label={t('notif')} value={t('on')} textPrimary={textPrimary} textSecond={textSecond} border={border} />
                <SettingRow label={t('voice')} value={t('on')} textPrimary={textPrimary} textSecond={textSecond} border={border} last />
              </div>
            </div>
          )}
        </div>
      </ScreenWrapper>
    </>
  )
}

function StatCard({ label, value, icon, cardBg, border, textPrimary, textSecond }: { label: string; value: number; icon: string; cardBg: string; border: string; textPrimary: string; textSecond: string }) {
  return (
    <div style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: RADIUS.lg, padding: SPACING.md, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: textPrimary }}>{value}</div>
      <div style={{ fontSize: FONT.xs, color: textSecond }}>{label}</div>
    </div>
  )
}

function SettingRow({ label, value, textPrimary, textSecond, border, last }: { label: string; value: string; textPrimary: string; textSecond: string; border: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${SPACING.sm}px ${SPACING.md}px`, borderBottom: last ? 'none' : `1px solid ${border}` }}>
      <span style={{ fontSize: FONT.base, color: textPrimary }}>{label}</span>
      <span style={{ fontSize: FONT.sm, color: textSecond }}>{value}</span>
    </div>
  )
}

function EmptyState({ text, textSecond }: { text: string; textSecond: string }) {
  return <div style={{ textAlign: 'center', padding: `${SPACING.lg}px 0`, color: textSecond, fontSize: FONT.sm }}>{text}</div>
}

function LoadingPlaceholder({ text, textSecond }: { text: string; textSecond: string }) {
  return <div style={{ textAlign: 'center', padding: `${SPACING.lg}px 0`, color: textSecond, fontSize: FONT.sm }}>{text}</div>
}

const REQ_STATUS_COLOR: Record<string, string> = { pending: '#EAB308', accepted: '#22C55E', rejected: '#EF4444' }
const REQ_STATUS_LABEL: Record<string, Record<string, string>> = {
  pending:  { ru: 'Ожидание', en: 'Pending' },
  accepted: { ru: 'Принято', en: 'Accepted' },
  rejected: { ru: 'Отклонено', en: 'Rejected' },
}

function RequestBadge({ status, lang }: { status: string; lang: string }) {
  return (
    <span style={{ fontSize: FONT.xs, fontWeight: 600, color: REQ_STATUS_COLOR[status] ?? '#9A9A9A', backgroundColor: (REQ_STATUS_COLOR[status] ?? '#9A9A9A') + '22', borderRadius: RADIUS.full, padding: '2px 10px' }}>
      {REQ_STATUS_LABEL[status]?.[lang] ?? status}
    </span>
  )
}

function smallBtnStyle(bg: string): CSSProperties {
  return { padding: '8px 12px', backgroundColor: bg, color: '#F0F0F0', border: 'none', borderRadius: RADIUS.sm, cursor: 'pointer' }
}
