import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createStore, type Store } from '../store/store'

const StoreContext = createContext<Store | null>(null)
const VersionContext = createContext<number>(0)

export function DataProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createStore(), [])
  const [version, setVersion] = useState(0)

  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store])

  return (
    <StoreContext.Provider value={store}>
      <VersionContext.Provider value={version}>{children}</VersionContext.Provider>
    </StoreContext.Provider>
  )
}

/** The live store instance. Methods always reflect current state; components
 * that need to re-render on change should also call useStoreVersion(). */
export function useData(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useData must be used within DataProvider')
  return store
}

/** Counter that bumps every time the store's state changes. Read (but
 * otherwise ignore) its value in a component to force it to re-render
 * whenever a mutation happens anywhere in the app. */
export function useStoreVersion(): number {
  return useContext(VersionContext)
}
