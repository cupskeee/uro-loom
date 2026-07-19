import { type ReactNode, useCallback, useMemo, useState } from 'react'
import type { Connection } from '../api/client'
import {
  ConnectionContext,
  type ConnectionContextValue,
  clearConnection,
  loadConnection,
  saveConnection,
} from './connection'

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(() => loadConnection())

  const connect = useCallback((conn: Connection) => {
    saveConnection(conn)
    setConnection(conn)
  }, [])

  const disconnect = useCallback(() => {
    clearConnection()
    setConnection(null)
  }, [])

  const value = useMemo<ConnectionContextValue>(
    () => ({ connection, connect, disconnect }),
    [connection, connect, disconnect],
  )

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}
