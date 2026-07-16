import { Outlet, type RouteObject } from 'react-router-dom'
import type { Role } from './types'
import { AppBar } from './components/AppBar'
import { Footer } from './components/Footer'
import { RoleGuard } from './components/RoleGuard'

import Home from './pages/public/Home'
import WardResult from './pages/public/WardResult'
import WardCandidates from './pages/public/WardCandidates'
import CandidateReportCard from './pages/public/CandidateReportCard'
import CompareCandidates from './pages/public/CompareCandidates'
import WardIssues from './pages/public/WardIssues'
import CheckRegistration from './pages/public/CheckRegistration'
import AboutElection from './pages/public/AboutElection'
import VotingGuideHub from './pages/public/VotingGuideHub'
import VoterId from './pages/public/VoterId'
import HowToVote from './pages/public/HowToVote'
import FindBooth from './pages/public/FindBooth'
import About from './pages/public/About'
import Login from './pages/public/Login'
import NotFound from './pages/public/NotFound'

import Account from './pages/account/Account'
import Notifications from './pages/account/Notifications'
import Submissions from './pages/account/Submissions'

import CuratorDashboard from './pages/curator/Dashboard'
import CuratorQueue from './pages/curator/Queue'
import SubmissionReview from './pages/curator/SubmissionReview'
import EditCandidate from './pages/curator/EditCandidate'
import EditWard from './pages/curator/EditWard'
import WardIssuesEditor from './pages/curator/WardIssuesEditor'

import AdminConsole from './pages/admin/Console'
import AdminRoles from './pages/admin/Roles'
import AdminUsers from './pages/admin/Users'
import AdminAudit from './pages/admin/Audit'

/** Roles allowed on every /account/* page — any registered user (citizen,
 * curator, or admin); see PRD §7's "Registered" column. */
const REGISTERED: Role[] = ['citizen', 'curator', 'admin']
/** Roles allowed on every /curator/* page — admins bypass ward scope inside
 * the store itself (requireScope), but can still reach the UI. */
const CURATOR_OR_ADMIN: Role[] = ['curator', 'admin']
const ADMIN_ONLY: Role[] = ['admin']

/** Root layout: global app bar (incl. the fictional-data banner) + page
 * outlet + global footer, present on every route. */
function RootLayout() {
  return (
    <>
      <AppBar />
      <main className="min-h-[60vh]">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

/**
 * Plain route-object array — the canonical URL map, mirroring
 * docs/information-architecture.md §2 exactly. Kept separate from the
 * `basename`-bound `router` in App.tsx so tests can feed this into
 * `createMemoryRouter` directly. Every page component here is a thin
 * placeholder (Tasks 13–22 flesh them out); `/login` is the fallback page
 * for the Register/Login modal (IA §7.1); `*` is a defensive not-found page
 * (not in the IA's page count, added so unknown deep links don't crash the
 * router when it can't match a route within the basename).
 */
export const routeObjects: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ward/:wardId', element: <WardResult /> },
      { path: 'ward/:wardId/candidates', element: <WardCandidates /> },
      { path: 'candidate/:candidateSlug', element: <CandidateReportCard /> },
      { path: 'ward/:wardId/compare', element: <CompareCandidates /> },
      { path: 'ward/:wardId/issues', element: <WardIssues /> },
      { path: 'check-registration', element: <CheckRegistration /> },
      { path: 'about-election', element: <AboutElection /> },
      { path: 'voting-guide', element: <VotingGuideHub /> },
      { path: 'voting-guide/voter-id', element: <VoterId /> },
      { path: 'voting-guide/how-to-vote', element: <HowToVote /> },
      { path: 'voting-guide/find-booth', element: <FindBooth /> },
      { path: 'about', element: <About /> },
      { path: 'login', element: <Login /> },

      {
        path: 'account',
        element: (
          <RoleGuard allow={REGISTERED}>
            <Account />
          </RoleGuard>
        ),
      },
      {
        path: 'account/notifications',
        element: (
          <RoleGuard allow={REGISTERED}>
            <Notifications />
          </RoleGuard>
        ),
      },
      {
        path: 'account/submissions',
        element: (
          <RoleGuard allow={REGISTERED}>
            <Submissions />
          </RoleGuard>
        ),
      },

      {
        path: 'curator',
        element: (
          <RoleGuard allow={CURATOR_OR_ADMIN}>
            <CuratorDashboard />
          </RoleGuard>
        ),
      },
      {
        path: 'curator/queue',
        element: (
          <RoleGuard allow={CURATOR_OR_ADMIN}>
            <CuratorQueue />
          </RoleGuard>
        ),
      },
      {
        path: 'curator/queue/:submissionId',
        element: (
          <RoleGuard allow={CURATOR_OR_ADMIN}>
            <SubmissionReview />
          </RoleGuard>
        ),
      },
      {
        path: 'curator/candidate/:candidateId',
        element: (
          <RoleGuard allow={CURATOR_OR_ADMIN}>
            <EditCandidate />
          </RoleGuard>
        ),
      },
      {
        path: 'curator/ward/:wardId',
        element: (
          <RoleGuard allow={CURATOR_OR_ADMIN}>
            <EditWard />
          </RoleGuard>
        ),
      },
      {
        path: 'curator/ward/:wardId/issues',
        element: (
          <RoleGuard allow={CURATOR_OR_ADMIN}>
            <WardIssuesEditor />
          </RoleGuard>
        ),
      },

      {
        path: 'admin',
        element: (
          <RoleGuard allow={ADMIN_ONLY}>
            <AdminConsole />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <RoleGuard allow={ADMIN_ONLY}>
            <AdminRoles />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RoleGuard allow={ADMIN_ONLY}>
            <AdminUsers />
          </RoleGuard>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <RoleGuard allow={ADMIN_ONLY}>
            <AdminAudit />
          </RoleGuard>
        ),
      },

      { path: '*', element: <NotFound /> },
    ],
  },
]
