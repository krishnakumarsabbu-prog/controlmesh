import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import TopologyPage from './pages/TopologyPage';
import MigrationPage from './pages/MigrationPage';
import MigrationPlanningPage from './pages/MigrationPlanningPage';
import ValidationPage from './pages/ValidationPage';
import AuditPage from './pages/AuditPage';
import DemoPage from './pages/DemoPage';
import LogsPage from './pages/LogsPage';
import MigrationExecutionPage from './pages/MigrationExecutionPage';
import RollbackStatePage from './pages/RollbackStatePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="topology" element={<TopologyPage />} />
        <Route path="migration" element={<MigrationPage />} />
        <Route path="migration-plan" element={<MigrationPlanningPage />} />
        <Route path="migration-execution" element={<MigrationExecutionPage />} />
        <Route path="rollback-state" element={<RollbackStatePage />} />
        <Route path="validation" element={<ValidationPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="demo" element={<DemoPage />} />
      </Route>
    </Routes>
  );
}
