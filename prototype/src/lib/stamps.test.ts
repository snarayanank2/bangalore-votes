import { compareStampsNewestFirst, formatStamp } from './stamps'

// --- formatStamp -------------------------------------------------------------------------------

test('formatStamp renders a counter stamp as an honest "demo event" label, not a fake date', () => {
  expect(formatStamp('t9')).toBe('Demo event #9')
})

test('formatStamp renders a fixed ISO stamp as a readable, timezone-fixed string', () => {
  expect(formatStamp('2026-05-21T08:30:00.000Z')).toBe('21 May 2026, 08:30 UTC')
})

test('formatStamp returns an unrecognized value unchanged rather than throwing', () => {
  expect(formatStamp('not-a-stamp')).toBe('not-a-stamp')
})

// --- compareStampsNewestFirst -------------------------------------------------------------------

test('compareStampsNewestFirst sorts counters numerically, not lexicographically (the exact bug)', () => {
  const sorted = ['t9', 't10', 't11'].sort(compareStampsNewestFirst)
  expect(sorted).toEqual(['t11', 't10', 't9'])
})

test('compareStampsNewestFirst treats every counter as newer than every ISO seed stamp, and orders ISO chronologically', () => {
  const isoOld = '2026-05-01T00:00:00.000Z'
  const isoNew = '2026-06-01T00:00:00.000Z'
  const sorted = ['t9', isoOld, 't11', isoNew].sort(compareStampsNewestFirst)
  expect(sorted).toEqual(['t11', 't9', isoNew, isoOld])
})
