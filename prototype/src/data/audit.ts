import type { AuditEntry } from '../types'

export const seedAudit: AuditEntry[] = [
  {
    id: 'audit-1',
    at: '2026-05-21T08:30:00.000Z',
    actorUserId: 'u-curator',
    action: 'candidate.trackRecord.updated',
    wardId: 'koramangala',
    detail: 'Corrected track-record wording for Suresh Gowda to credit the RWA drive as a joint effort, following accepted flag sub-2.',
  },
  {
    id: 'audit-2',
    at: '2026-06-10T13:00:00.000Z',
    actorUserId: 'u-curator',
    action: 'candidate.assets.updated',
    wardId: 'indiranagar',
    detail: 'Refreshed asset summary for Priya Shetty based on the latest EC affidavit filing.',
  },
]
