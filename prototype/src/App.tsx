import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { DataProvider, useData } from './context/DataContext'
import { AuthProvider } from './context/AuthContext'
import { I18nProvider } from './context/I18nContext'
import { routeObjects } from './routes'

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

// The site deploys to https://snarayanank2.github.io/bangalore-votes/ — the
// basename MUST match that subpath exactly, or every route fails to match.
const router = createBrowserRouter(routeObjects, { basename: '/bangalore-votes' })

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
