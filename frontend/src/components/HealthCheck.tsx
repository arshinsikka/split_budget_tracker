import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function HealthCheck() {
  const [health, setHealth] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        setLoading(true);
        setError(null);
        const healthData = await api.getHealth();
        setHealth(healthData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setHealth(null);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Checking backend health...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <span className="text-red-600 text-2xl mr-2">❌</span>
          <div>
            <h3 className="text-red-800 font-medium">Backend Connection Failed</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center">
        <span className="text-green-600 text-2xl mr-2">✅</span>
        <div>
          <h3 className="text-green-800 font-medium">Backend is healthy</h3>
          <p className="text-green-600 text-sm mt-1">
            Service: {health?.service} v{health?.version}
          </p>
          <p className="text-green-600 text-sm">
            Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Unknown'}
          </p>
        </div>
      </div>
    </div>
  );
}
