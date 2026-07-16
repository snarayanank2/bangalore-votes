import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // App.tsx's default export builds a real createBrowserRouter with
    // basename '/bangalore-votes' (the site's GitHub Pages subpath). jsdom's
    // default test URL is 'http://localhost:3000/', which doesn't start with
    // that basename, so the router matches nothing when App is rendered
    // directly (App.test.tsx). Pointing jsdom's initial URL at the basename
    // fixes that; routes.test.tsx is unaffected since it uses
    // createMemoryRouter with its own initialEntries.
    environmentOptions: { jsdom: { url: 'http://localhost/bangalore-votes/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
