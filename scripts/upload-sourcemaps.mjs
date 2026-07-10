// Загружает sourcemaps в Sentry после сборки — для читаемых (не минифицированных)
// стектрейсов (п.3.4 BLOKNOTERROR.md ТЗ).
//
// Требует переменные окружения (задаются в Cloudflare Pages как СЕКРЕТЫ, не в
// открытой команде сборки — в отличие от VITE_SENTRY_DSN, который публичен):
//   SENTRY_AUTH_TOKEN — токен с правом project:releases
//   SENTRY_ORG        — slug организации в Sentry
//   SENTRY_PROJECT    — slug проекта в Sentry
//
// Если переменные не заданы (локальная разработка, dev-сборка) — скрипт молча
// пропускает загрузку и завершается успешно, чтобы `npm run build` продолжал
// работать без доступа к Sentry.

import { execSync } from 'node:child_process'

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env

if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
  console.log(
    '[sentry-sourcemaps] SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT не заданы — ' +
    'пропускаю загрузку sourcemaps (это нормально для локальной сборки).'
  )
  process.exit(0)
}

try {
  execSync(`npx @sentry/cli sourcemaps inject ./dist`, { stdio: 'inherit' })
  execSync(
    `npx @sentry/cli sourcemaps upload --org ${SENTRY_ORG} --project ${SENTRY_PROJECT} ./dist`,
    { stdio: 'inherit' }
  )
  // Не раздаём .map публично с Cloudflare Pages после того, как они уже в Sentry —
  // это лучшая практика (иначе минифицированный код тривиально восстанавливается).
  execSync(`find ./dist -name "*.map" -delete`, { stdio: 'inherit' })
  console.log('[sentry-sourcemaps] Sourcemaps загружены в Sentry и удалены из dist.')
} catch (e) {
  // Не роняем весь билд из-за проблем с загрузкой sourcemaps — приложение
  // должно задеплоиться, даже если стектрейсы временно останутся нечитаемыми.
  console.error('[sentry-sourcemaps] Не удалось загрузить sourcemaps:', e.message)
}
