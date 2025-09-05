import { useState } from 'react';

export function Transactions() {
  const [loading, setLoading] = useState(false);

  const handleLoadTransactions = () => {
    setLoading(true);
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-600 mt-2">
          View and manage all shared expenses and settlements
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
            <p className="text-gray-600 text-sm">
              Browse all group expenses and settlement payments
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mt-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
                <div className="h-6 bg-gray-200 rounded w-full mt-4"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mt-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3 mt-2"></div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">
                Click "Load Transactions" to view your transaction history
              </p>
            </div>
          )}

          <button
            onClick={handleLoadTransactions}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load Transactions'}
          </button>
        </div>
      </div>
    </div>
  );
}
