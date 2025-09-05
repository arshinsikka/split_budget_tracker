import { useState } from 'react';

export function Settle() {
  const [loading, setLoading] = useState(false);

  const handleOpenSettlementForm = () => {
    setLoading(true);
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settle</h1>
        <p className="text-gray-600 mt-2">
          Record payments to settle outstanding debts between users
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Settlement Form</h2>
            <p className="text-gray-600 text-sm">
              Create a new settlement payment to clear outstanding balances
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-full"></div>
                <div className="h-8 bg-gray-200 rounded w-full mt-3"></div>
                <div className="h-8 bg-gray-200 rounded w-full mt-3"></div>
                <div className="h-10 bg-gray-200 rounded w-1/3 mt-4"></div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-600 text-sm">
                Click "Open Settlement Form" to create a new settlement payment
              </p>
            </div>
          )}

          <button
            onClick={handleOpenSettlementForm}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Open Settlement Form'}
          </button>
        </div>
      </div>
    </div>
  );
}
