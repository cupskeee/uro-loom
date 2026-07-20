import { Navigate, Route, Routes } from 'react-router-dom'
import { useConnection } from './config/connection'
import { ConnectionScreen } from './components/ConnectionScreen'
import { Layout } from './components/Layout'
import { WorldsPage } from './pages/WorldsPage'
import { AuthoringPage } from './pages/AuthoringPage'
import { WorldDetailPage } from './pages/WorldDetailPage'
import { TimelinePanel } from './pages/panels/TimelinePanel'
import { EventsPanel } from './pages/panels/EventsPanel'
import { CampaignsPage } from './pages/CampaignsPage'
import { CampaignDetailPage } from './pages/CampaignDetailPage'
import { OverviewPanel } from './pages/panels/OverviewPanel'
import { PlayPanel } from './pages/panels/PlayPanel'
import { RosterPanel } from './pages/panels/RosterPanel'
import { StatePanel } from './pages/panels/StatePanel'
import { EpistemicsPanel } from './pages/panels/EpistemicsPanel'
import { PreviewPanel } from './pages/panels/PreviewPanel'
import { CodexPanel } from './pages/panels/CodexPanel'
import { ChroniclePanel } from './pages/panels/ChroniclePanel'
import { ManagePanel } from './pages/panels/ManagePanel'

export function App() {
  const { connection } = useConnection()

  // Not connected → the connection/auth gate (no routing needed).
  if (!connection) {
    return <ConnectionScreen />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/worlds" replace />} />
        <Route path="worlds" element={<WorldsPage />} />
        <Route path="worlds/:worldId" element={<WorldDetailPage />}>
          <Route index element={<TimelinePanel />} />
          <Route path="events" element={<EventsPanel />} />
        </Route>
        <Route path="authoring" element={<AuthoringPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetailPage />}>
          <Route index element={<OverviewPanel />} />
          <Route path="play" element={<PlayPanel />} />
          <Route path="roster" element={<RosterPanel />} />
          <Route path="state" element={<StatePanel />} />
          <Route path="epistemics" element={<EpistemicsPanel />} />
          <Route path="preview" element={<PreviewPanel />} />
          <Route path="codex" element={<CodexPanel />} />
          <Route path="chronicle" element={<ChroniclePanel />} />
          <Route path="manage" element={<ManagePanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/worlds" replace />} />
      </Route>
    </Routes>
  )
}
