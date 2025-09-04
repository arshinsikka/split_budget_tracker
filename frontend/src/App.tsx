import { useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { HealthCheck } from './components/HealthCheck';
import { api } from './lib/api';
import './App.css';

function App() {
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Split Budget Tracker
          </h1>
          <p className="text-gray-600">
            Track shared expenses between friends with precision
          </p>
        </header>

        <main>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              System Status
            </h2>
            <HealthCheck />
          </div>
        </main>

        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Split Budget Tracker Frontend - React + TypeScript + TailwindCSS</p>
        </footer>
      </div>

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
  );
}

export default App;
