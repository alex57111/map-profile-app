// TEMP DIAG (Блок 4, диагностика supabase-режима) — УДАЛИТЬ ВЕСЬ ФАЙЛ и импорт
// в LocationScreen.tsx после того, как проблема с env-переменными на Cloudflare
// будет найдена и подтверждена как решённая. См. AGENT_LOG.md.

import { useEffect, useState } from "react"
import { DEBUG_VITE_USE_SUPABASE_RAW, DEBUG_USE_SUPABASE } from "../lib/adapters/index"
import { supabase } from "../lib/supabase"

export function DebugBanner() {
  const [pingStatus, setPingStatus] = useState<string>("проверяю...")
  const [copyStatus, setCopyStatus] = useState<string>("Copy")

  useEffect(() => {
    let cancelled = false
    // Лёгкий пингующий запрос напрямую через supabase-клиент — независимо от
    // того, какой адаптер выбран (mock/supabase), чтобы проверить саму
    // связность и валидность env-переменных.
    void (async () => {
      try {
        const { error, count } = await supabase
          .from("road_events")
          .select("id", { count: "exact", head: true })
        if (cancelled) return
        setPingStatus(error ? `FAIL: ${error.message}` : `OK (rows=${count ?? "?"})`)
      } catch (e) {
        if (cancelled) return
        setPingStatus(`THROW: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKeyPresent = !!(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

  const debugText = [
    `MODE=${import.meta.env.MODE}`,
    `VITE_USE_SUPABASE raw=${DEBUG_VITE_USE_SUPABASE_RAW}`,
    `USE_SUPABASE(bool)=${DEBUG_USE_SUPABASE}`,
    `VITE_SUPABASE_URL=${rawUrl ?? "(undefined)"}`,
    `VITE_SUPABASE_ANON_KEY present=${anonKeyPresent}`,
    `supabase ping=${pingStatus}`,
  ].join("\n")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugText)
      setCopyStatus("Copied!")
    } catch {
      // Фолбэк для мобильных браузеров без Clipboard API/без HTTPS-контекста
      try {
        const ta = document.createElement("textarea")
        ta.value = debugText
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus(); ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        setCopyStatus("Copied!")
      } catch {
        setCopyStatus("Copy failed — выдели вручную")
      }
    }
    setTimeout(() => setCopyStatus("Copy"), 2000)
  }

  return (
    <div style={{
      position: "absolute", top: 4, left: 4, right: 4, zIndex: 9999,
      backgroundColor: "rgba(0,0,0,0.85)", color: "#0f0",
      fontSize: 9, fontFamily: "monospace", padding: "6px 8px",
      borderRadius: 4, lineHeight: 1.5,
      display: "flex", alignItems: "flex-start", gap: 6,
      userSelect: "text", WebkitUserSelect: "text",
    }}>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", flex: 1, userSelect: "text", WebkitUserSelect: "text" }}>
        {debugText}
      </pre>
      <button
        onClick={handleCopy}
        style={{
          flexShrink: 0, fontSize: 9, padding: "3px 6px",
          backgroundColor: "#0f0", color: "#000", border: "none",
          borderRadius: 3, fontWeight: 700, cursor: "pointer",
        }}
      >
        {copyStatus}
      </button>
    </div>
  )
}
