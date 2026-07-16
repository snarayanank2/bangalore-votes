import { render, screen, act } from '@testing-library/react'
import { DataProvider, useData } from './DataContext'

let store: ReturnType<typeof useData>
function Probe() { store = useData(); return <div>{store.listWards().length}</div> }
test('provides a live store', () => {
  render(<DataProvider><Probe /></DataProvider>)
  expect(screen.getByText(/[0-9]/)).toBeInTheDocument()
  act(() => { store.reset() })
  expect(store.listWards().length).toBeGreaterThanOrEqual(4)
})
