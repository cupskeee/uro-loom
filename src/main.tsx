import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ApiError } from './api/errors'
import { ConnectionProvider } from './config/ConnectionProvider'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry deterministic client errors — unauthorized (401), forbidden/out-of-scope
      // (403), not-found (404), unsupported-by-server (501). They won't change on retry and only
      // delay the graceful-degradation UX (QueryBoundary shows the right panel immediately).
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404, 501].includes(error.status)) return false
        return failureCount < 2
      },
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConnectionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
