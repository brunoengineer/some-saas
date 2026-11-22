import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './app/auth';
import { SessionProvider } from './app/session';
import { AuthGate } from './features/onboarding/AuthGate';
import { AppShell } from './layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { CampaignDetail } from './features/campaigns/CampaignDetail';
import { PillarsPage } from './features/pillars/PillarsPage';
import { PartnersPage } from './features/partners/PartnersPage';
import { PartnerDetail } from './features/partners/PartnerDetail';
import { KpisPage } from './features/kpis/KpisPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ReportView, SharedReport } from './features/reports/ReportView';
import { SettingsPage } from './features/settings/SettingsPage';

// Hash routing so the built prototype works from any static host or file.
const router = createHashRouter([
  { path: '/share/:id', element: <SharedReport /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'campaigns/:id', element: <CampaignDetail /> },
      { path: 'pillars', element: <PillarsPage /> },
      { path: 'partners', element: <PartnersPage /> },
      { path: 'partners/:id', element: <PartnerDetail /> },
      { path: 'kpis', element: <KpisPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/:id', element: <ReportView /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
