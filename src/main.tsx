import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const style = document.createElement('style')
style.textContent = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; background: #0F0F0F; }
input, button, textarea, select { font-family: inherit; }
button { -webkit-tap-highlight-color: transparent; }
`
document.head.appendChild(style)

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')
createRoot(root).render(<StrictMode><App /></StrictMode>)
