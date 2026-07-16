import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useI18n } from './I18nContext'

function Probe() {
  const { lang, setLang } = useI18n()
  return <button onClick={() => setLang(lang === 'en' ? 'kn' : 'en')}>{lang}</button>
}
test('toggles language state', async () => {
  render(<I18nProvider><Probe /></I18nProvider>)
  expect(screen.getByRole('button')).toHaveTextContent('en')
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('kn')
})
