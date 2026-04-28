import './lib/legacyMigration.js'   // MUST stay first — migrates stockline_* → ember_*
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installLocaleShim } from './lib/localeBootstrap.js'
import './lib/theme.js'
import './index.css'
import App from './App.jsx'

installLocaleShim()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
