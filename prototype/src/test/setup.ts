import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { fetch, Headers, Request, Response, FormData } from 'undici'

// Vitest's jsdom environment unconditionally overwrites globalThis.AbortController
// / AbortSignal with jsdom's own (DOM-spec) implementation, shadowing Node's
// native ones. react-router-dom's data router (createBrowserRouter /
// createMemoryRouter) constructs a `Request` on every client-side navigation
// (see @remix-run/router's `createClientSideRequest`), even when no route has
// a loader/action. Node's built-in `Request` (undici) does a strict identity
// check that the given `signal` is an instance of *its own* internal
// AbortSignal class — which jsdom's polyfilled AbortController does not
// satisfy — throwing `TypeError: Expected signal ... to be an instance of
// AbortSignal` on any navigation (including a RoleGuard's <Navigate> redirect).
// Fix: install the `undici` package's fetch primitives, which read
// globalThis.AbortController/AbortSignal (jsdom's, at import time) as their
// own reference, keeping the whole fetch/Request/AbortSignal set internally
// consistent regardless of what jsdom put on the global object.
Object.assign(globalThis, { fetch, Headers, Request, Response, FormData })

afterEach(() => { cleanup(); localStorage.clear() })
