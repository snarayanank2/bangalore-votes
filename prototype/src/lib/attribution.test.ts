import { captureSrcFromSearch, getAttributedSrc } from './attribution'

// sessionStorage is a browser global (jsdom provides one); nothing here touches localStorage,
// so src/test/setup.ts's afterEach(localStorage.clear()) does not reset it between tests — clear
// it ourselves so tests don't leak state into each other.
afterEach(() => sessionStorage.clear())

test('getAttributedSrc returns undefined when no ?src= has ever been captured', () => {
  expect(getAttributedSrc()).toBeUndefined()
})

test('captureSrcFromSearch persists a present, non-empty src so it survives the rest of the visit', () => {
  captureSrcFromSearch(new URLSearchParams('src=demo-rwa-one'))
  expect(getAttributedSrc()).toBe('demo-rwa-one')
})

test('captureSrcFromSearch ignores a request with no src param, leaving any prior value intact', () => {
  captureSrcFromSearch(new URLSearchParams('src=demo-rwa-one'))
  captureSrcFromSearch(new URLSearchParams(''))
  expect(getAttributedSrc()).toBe('demo-rwa-one')
})

test('captureSrcFromSearch ignores an empty/whitespace-only src value', () => {
  captureSrcFromSearch(new URLSearchParams('src='))
  expect(getAttributedSrc()).toBeUndefined()
})

test('a later ?src= on the same visit overwrites an earlier one (last-touch attribution)', () => {
  captureSrcFromSearch(new URLSearchParams('src=demo-rwa-one'))
  captureSrcFromSearch(new URLSearchParams('src=demo-civic-trust'))
  expect(getAttributedSrc()).toBe('demo-civic-trust')
})
