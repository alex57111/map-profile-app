/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_USE_SUPABASE: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SENTRY_DSN: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
declare module '*.png' { const src: string; export default src }
