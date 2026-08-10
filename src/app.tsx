import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import { startSyncLifecycle } from '@/services/sync'
import { ThemeProvider } from '@/theme'
import './app.css'

function App({ children }: PropsWithChildren) {
  useEffect(() => startSyncLifecycle(), [])
  return <ThemeProvider>{children}</ThemeProvider>
}

export default App
