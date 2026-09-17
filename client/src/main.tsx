import './instrumentation'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './app/App.tsx'
import { AppCrashFallback } from './app/AppCrashFallback.tsx'

document.documentElement.classList.toggle('dark', localStorage.getItem('dashboardTheme') === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
