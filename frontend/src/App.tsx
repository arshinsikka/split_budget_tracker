import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navigation } from './components/Navigation';
import { Overview } from './components/Overview';
import { HealthCheck } from './components/HealthCheck';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Settle } from './components/Settle';
import { ErrorTest } from './components/ErrorTest';
import { api } from './lib/api';
import './App.css';

function AppContent() {
  useEffect(() => {
    // Smoke test: call getUsers() on app load
    const testAPI = async () => {
      try {
        const users = await api.getUsers();
        console.log('✅ API test successful:', users);
        toast.success('Backend API connected successfully!');
      } catch (error) {
        console.error('❌ API test failed:', error);
        toast.error(
          error instanceof Error
            ? `API Error: ${error.message}`
            : 'Failed to connect to backend API'
        );
      }
    };

    testAPI();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route
              path="/"
              element={
                <div className="space-y-6">
                  <Overview />
                  <HealthCheck />
                  <ErrorTest />
                  <Dashboard />
                </div>
              }
            />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/settle" element={<Settle />} />
          </Routes>
        </main>

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
