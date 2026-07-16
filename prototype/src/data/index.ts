import { seedWards } from './wards'
import { seedCandidates } from './candidates'
import { seedIssues, seedIssueVotes } from './issues'
import { seedUsers } from './users'
import { seedSubmissions } from './submissions'
import { seedAudit } from './audit'
import { seedPartners } from './partners'

export const seed = {
  wards: seedWards,
  candidates: seedCandidates,
  issues: seedIssues,
  issueVotes: seedIssueVotes,
  users: seedUsers,
  submissions: seedSubmissions,
  audit: seedAudit,
  partners: seedPartners,
}

export {
  seedWards,
  seedCandidates,
  seedIssues,
  seedIssueVotes,
  seedUsers,
  seedSubmissions,
  seedAudit,
  seedPartners,
}
