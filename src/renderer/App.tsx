import React, { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppBar from './components/AppBar';
import NavBar from './components/NavBar';
import { Toaster } from './components/ui/sonner';

// Route-level code splitting: heavy pages (and their flatpickr/date-fns
// dependencies) load on demand so the initial renderer chunk stays small.
const WorkTimeForm = lazy(() => import('./components/WorkTimeForm'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: 1 }
  }
});

function App() {
  const { t } = useTranslation();

  useEffect(() => {
    window.Main.removeLoading();
  }, []);

  return (
    <Router>
      <div className="flex min-h-screen flex-col bg-background">
        {window.Main && (
          // Reserve the AppBar's real height (h-8 = 32px) so the sticky NavBar
          // (top-8) sits flush under it with no gap.
          <div className="flex-none h-8">
            <AppBar />
          </div>
        )}
        <NavBar />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/worktime" element={<WorkTimeForm />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/tasks" element={<Navigate to="/catalog" replace />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}
