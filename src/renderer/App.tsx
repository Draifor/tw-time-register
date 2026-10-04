import React, { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import AppBar from './components/AppBar';
import NavBar from './components/NavBar';
import { Toaster } from './components/ui/sonner';

// Route-level code splitting: heavy pages (and their flatpickr/date-fns
// dependencies) load on demand so the initial renderer chunk stays small.
const WorkTimeForm = lazy(() => import('./components/WorkTimeForm'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: 1 }
  }
});

function App() {
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

        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">Loading...</div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/worktime" element={<WorkTimeForm />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </div>
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
