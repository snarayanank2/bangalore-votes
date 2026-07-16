import { seed } from './index'

test('every candidate references an existing ward', () => {
  const wardIds = new Set(seed.wards.map(w => w.id))
  for (const c of seed.candidates) expect(wardIds.has(c.wardId)).toBe(true)
})

test('every ward issueId maps to an issue in that ward', () => {
  const byId = new Map(seed.issues.map(i => [i.id, i]))
  for (const w of seed.wards)
    for (const id of w.issueIds) expect(byId.get(id)?.wardId).toBe(w.id)
})

test('there is at least one citizen, curator, and admin', () => {
  const roles = new Set(seed.users.map(u => u.role))
  expect(roles.has('citizen')).toBe(true)
  expect(roles.has('curator')).toBe(true)
  expect(roles.has('admin')).toBe(true)
})

test('the curator has a non-empty ward scope', () => {
  const cur = seed.users.find(u => u.role === 'curator')!
  expect(cur.curatorWardIds && cur.curatorWardIds.length).toBeTruthy()
})
