import { render, screen } from '@testing-library/react'
import { SourceBadge } from './SourceBadge'

test('affidavit source shows the kind and its specific label', () => {
  render(<SourceBadge source={{ type: 'affidavit', label: 'EC affidavit' }} />)
  expect(screen.getByText('Official (affidavit)')).toBeInTheDocument()
  expect(screen.getByText('EC affidavit')).toBeInTheDocument()
})

test('a label identical to the kind is not printed twice', () => {
  // Seed curator sources are labelled "Curator-compiled", which is also the kind's label —
  // rendering both produced "Curator-compiled · Curator-compiled".
  const { container } = render(
    <SourceBadge source={{ type: 'curator', label: 'Curator-compiled' }} />,
  )
  expect(screen.getByText('Curator-compiled')).toBeInTheDocument()
  expect(container.textContent).toBe('Curator-compiled')
  expect(container.textContent).not.toMatch(/Curator-compiled.*Curator-compiled/)
})

test('a curator source with a distinct label still shows both', () => {
  render(<SourceBadge source={{ type: 'curator', label: 'Ward office records' }} />)
  expect(screen.getByText('Curator-compiled')).toBeInTheDocument()
  expect(screen.getByText('Ward office records')).toBeInTheDocument()
})

test('renders a source link when the source carries a url', () => {
  render(
    <SourceBadge source={{ type: 'affidavit', label: 'EC affidavit', url: 'https://x.test' }} />,
  )
  expect(screen.getByRole('link', { name: 'source' })).toHaveAttribute('href', 'https://x.test')
})
