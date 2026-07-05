
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(
  supabaseUrl ?? "http://localhost:54321",
  supabaseAnon ?? "placeholder"
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: ReturnType<typeof createClient<any>> = supabase
