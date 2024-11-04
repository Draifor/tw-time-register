import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppBar from './components/AppBar';
import WorkTimeForm from './components/WorkTimeForm';
import Tasks from './pages/Tasks';
import UsersTable from './hooks/Users';
import CommentsTable from './hooks/Comments';
import NavBar from './components/NavBar';

const queryClient = new QueryClient();

function App() {
  console.log(window.ipcRenderer);
  console.log(new Date().toLocaleString());

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

        <div className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<h1>Bienvenido al TeamWork Time Tracker</h1>} />
            <Route path="/worktime" element={<WorkTimeForm />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/users" element={<UsersTable />} />
            <Route path="/comments" element={<CommentsTable />} />
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
    </QueryClientProvider>
  );
}
