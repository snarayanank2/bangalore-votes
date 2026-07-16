import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { DataProvider, useData } from './context/DataContext'
import { AuthProvider } from './context/AuthContext'
import { I18nProvider } from './context/I18nContext'

/** Bridges DataProvider's store instance into AuthProvider, so both share
 * exactly one store (AuthProvider needs it as a prop to stay testable). */
function AuthAndI18n({ children }: { children: ReactNode }) {
  const store = useData()
  return (
    <AuthProvider store={store}>
      <I18nProvider>{children}</I18nProvider>
    </AuthProvider>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <AuthAndI18n>{children}</AuthAndI18n>
    </DataProvider>
  )
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        {/* Routes mount here — added in Task 9 */}
        <div className="p-8 text-2xl font-bold">Bangalore Votes</div>
      </BrowserRouter>
    </AppProviders>
  )
}
