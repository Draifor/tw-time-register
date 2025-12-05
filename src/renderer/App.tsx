import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppBar from './components/AppBar';
import WorkTimeForm from './components/WorkTimeForm';
import TasksPage from './pages/TasksPage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import NavBar from './components/NavBar';
import { Toaster } from './components/ui/sonner';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    window.Main.removeLoading();
  }, []);

  return (
    <Router>
      <div className="flex flex-col">
        {window.Main && (
          <div className="flex-none h-14">
            <AppBar />
          </div>
        )}
        <NavBar />

        <div className="container mx-auto p-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/worktime" element={<WorkTimeForm />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
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
