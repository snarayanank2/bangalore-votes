import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'kn'

/**
 * English catalogue. Kannada has no catalogue yet (intentional — session
 * toggle works as state, but t() falls back to English/key until a
 * translation pass fills `kn`).
 */
const en: Record<string, string> = {
  'app.title': 'Bangalore Votes',
}

const kn: Record<string, string> = {}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  function t(key: string): string {
    const catalogue = lang === 'kn' ? kn : en
    return catalogue[key] ?? en[key] ?? key
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
