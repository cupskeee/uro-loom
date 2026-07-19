import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ConnectionProvider } from './config/ConnectionProvider'
import './index.css'

const queryClient = new QueryClient()

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
