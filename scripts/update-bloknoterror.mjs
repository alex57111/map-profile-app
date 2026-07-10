// Дёргает Sentry REST API (unresolved + недавно resolved issues) и
// переписывает BLOKNOTERROR.md в корне репозитория.
// Запускается ТОЛЬКО из .github/workflows/error-log.yml — кодер этот файл
// руками не редактирует (см. BLOKNOTERROR.md ТЗ, раздел 4.3 и раздел 5).

import { writeFileSync } from 'node:fs'

const { SENTRY_API_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env

if (!SENTRY_API_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
  console.error(
    '[update-bloknoterror] SENTRY_API_TOKEN/SENTRY_ORG/SENTRY_PROJECT не заданы в GitHub Secrets. ' +
    'Добавь их в Settings → Secrets and variables → Actions репозитория и перезапусти workflow.'
  )
  process.exit(1)
}

const BASE = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`

async function fetchIssues(query) {
  const url = `${BASE}?query=${encodeURIComponent(query)}&statsPeriod=14d&limit=50`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SENTRY_API_TOKEN}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sentry API ${res.status} ${res.statusText} для запроса "${query}": ${body.slice(0, 300)}`)
  }
  return res.json()
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toISOString().slice(0, 10)
}

function issueLine(issue) {
  const users = issue.count && issue.userCount !== undefined ? `${issue.count} событий / ${issue.userCount} пользователей` : `${issue.count ?? '?'} событий`
  const component = issue.metadata?.filename ?? issue.culprit ?? '—'
  const link = `https://sentry.io/organizations/${SENTRY_ORG}/issues/${issue.id}/`
  return [
    `### [${issue.shortId ?? issue.id}] ${issue.title ?? issue.metadata?.value ?? 'Без названия'}`,
    `- Первый раз: ${fmtDate(issue.firstSeen)}`,
    `- Частота: ${users}`,
    `- Компонент: ${component}`,
    `- Ссылка: ${link}`,
    '',
  ].join('\n')
}

function resolvedLine(issue) {
  const link = `https://sentry.io/organizations/${SENTRY_ORG}/issues/${issue.id}/`
  return [
    `### [${issue.shortId ?? issue.id}] ${issue.title ?? issue.metadata?.value ?? 'Без названия'}`,
    `- Исправлено: ${fmtDate(issue.lastSeen)}`, // Sentry issues API не отдаёт resolvedAt напрямую — используем lastSeen как приближение
    `- Ссылка: ${link}`,
    '',
  ].join('\n')
}

async function main() {
  const [unresolved, resolved] = await Promise.all([
    fetchIssues('is:unresolved'),
    fetchIssues('is:resolved'),
  ])

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const openSection = unresolved.length > 0
    ? unresolved.map(issueLine).join('\n')
    : '_Открытых issues нет._\n'

  const resolvedSection = resolved.length > 0
    ? resolved.slice(0, 20).map(resolvedLine).join('\n')
    : '_За последние 14 дней ничего не исправлено (или resolved issues отсутствуют)._\n'

  const content = `# BLOKNOTERROR.md — журнал ошибок (автообновление)

> Обновляется автоматически GitHub Action \`.github/workflows/error-log.yml\`
> Последнее обновление: ${now}
> Источник: Sentry project "${SENTRY_PROJECT}"

## Открытые (unresolved)

${openSection}
## Недавно исправленные (resolved, последние ~14 дней)

${resolvedSection}
`

  writeFileSync(new URL('../BLOKNOTERROR.md', import.meta.url), content, 'utf-8')
  console.log(`[update-bloknoterror] Записано: ${unresolved.length} open, ${resolved.length} resolved.`)
}

main().catch((e) => {
  console.error('[update-bloknoterror] Ошибка:', e.message)
  process.exit(1)
})
