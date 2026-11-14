import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LegalPage } from './legal/LegalPage'
import { legalRoute } from './legal/routes'

// The app is loaded lazily so the legal pages (/terms, /privacy, /disclaimer) open without
// starting Firebase, anonymous sign-in or reCAPTCHA.
const App = lazy(() => import('./App.tsx'))
const legal = legalRoute(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {legal ? (
      <LegalPage page={legal} />
    ) : (
      <Suspense fallback={<p className="pad muted">Starting Rounds…</p>}>
        <App />
      </Suspense>
    )}
  </StrictMode>,
)
