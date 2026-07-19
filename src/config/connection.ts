// Connection state: which uro-server Loom is pointed at and with which token.
//
// Storage choice (decision LD-4): the token lives in sessionStorage — cleared when
// the tab closes — which is the conservative default for operator mode. It is NOT a
// place for an admin token in a multi-user deploy; that moves behind the M6 BFF,
// where the browser never holds a privileged credential.

import { createContext, useContext } from 'react'
import type { Connection } from '../api/client'

const STORAGE_KEY = 'uro-loom.connection'

export interface ConnectionContextValue {
  connection: Connection | null
  connect: (conn: Connection) => void
  disconnect: () => void
}

export function loadConnection(): Connection | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Connection>
    if (typeof parsed.baseUrl === 'string' && parsed.baseUrl) {
      return {
        baseUrl: parsed.baseUrl,
        token: typeof parsed.token === 'string' ? parsed.token : null,
      }
    }
  } catch {
    // Corrupt/blocked storage — fall through to no connection.
  }
  return null
}

export function saveConnection(conn: Connection): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conn))
}

export function clearConnection(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export const ConnectionContext = createContext<ConnectionContextValue>({
  connection: null,
  connect: () => {},
  disconnect: () => {},
})

export function useConnection(): ConnectionContextValue {
  return useContext(ConnectionContext)
}
