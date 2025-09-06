import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

export function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [userASummary, setUserASummary] = useState<any | null>(null);
  const [userBSummary, setUserBSummary] = useState<any | null>(null);
  const [debtStatus, setDebtStatus] = useState<any | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch data from the users endpoint which we know works
      const usersData = await api.getUsers();

      // Extract user data
      const userA = usersData.users.find((u: any) => u.userId === 'A');
      const userB = usersData.users.find((u: any) => u.userId === 'B');

      setUserASummary(userA);
      setUserBSummary(userB);
      setDebtStatus(usersData.netDue);

      toast.success('Dashboard data refreshed successfully!');
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error(
        error instanceof Error
          ? `Failed to load dashboard: ${error.message}`
          : 'Failed to load dashboard data'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetData = async () => {
    if (
      !confirm(
        'Are you sure you want to reset all data? This will clear all transactions and settlements.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await api.resetData(false); // Reset to clean state, not demo
      await fetchDashboardData();
      toast.success('Data reset successfully!');
    } catch (error) {
      console.error('Failed to reset data:', error);
      toast.error(
        error instanceof Error ? `Failed to reset data: ${error.message}` : 'Failed to reset data'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = async () => {
    if (
      !confirm('Load demo data? This will add sample transactions to show how the system works.')
    ) {
      return;
    }

    setLoading(true);
    try {
      await api.resetData(true); // Load demo data
      await fetchDashboardData();
      toast.success('Demo data loaded successfully!');
    } catch (error) {
      console.error('Failed to load demo data:', error);
      toast.error(
        error instanceof Error
          ? `Failed to load demo data: ${error.message}`
          : 'Failed to load demo data'
      );
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
    }).format(amount);
  };

  const renderBudgetCategories = (budgetByCategory: any) => {
    return Object.entries(budgetByCategory).map(([category, amount]) => (
      <div key={category} className="flex justify-between items-center py-1">
        <span className="text-sm text-gray-600 capitalize">{category}</span>
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(amount as number)}
        </span>
      </div>
    ));
  };

  const renderDebtBanner = () => {
    if (!debtStatus) return null;

    if (debtStatus.owes && debtStatus.to && debtStatus.amount > 0) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-amber-600 text-lg mr-2">💰</span>
            <p className="text-amber-800 font-medium">
              User {debtStatus.owes} owes User {debtStatus.to} {formatCurrency(debtStatus.amount)}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <span className="text-green-600 text-lg mr-2">✅</span>
          <p className="text-green-800 font-medium">All settled up</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Overview of your shared expenses and current balances
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={loadDemoData}
              disabled={loading}
              className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
            >
              <span className="mr-1 sm:mr-2">🎭</span>
              <span className="hidden sm:inline">Demo</span>
            </button>
            <button
              onClick={resetData}
              disabled={loading}
              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
            >
              <span className="mr-1 sm:mr-2">🗑️</span>
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1 sm:mr-2"></div>
                  <span className="hidden sm:inline">Loading...</span>
                </>
              ) : (
                <>
                  <span className="mr-1 sm:mr-2">🔄</span>
                  <span className="hidden sm:inline">Refresh</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Spend</strong> = your own share of each bill, regardless of who paid.
            <strong> Wallet</strong> = cash you actually paid/received.
            <strong> Settle</strong> = net debt between users.
          </p>
        </div>
      </div>

      {/* Debt Status Banner */}
      {renderDebtBanner()}

      {/* User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User A Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">User A</h2>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Wallet (cash)</div>
              <div className="text-2xl font-bold text-blue-600">
                {userASummary ? formatCurrency(userASummary.walletBalance) : '...'}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              Spend by Category (this month)
            </h3>
            {userASummary ? (
              <div className="space-y-1">
                {renderBudgetCategories(userASummary.budgetByCategory)}
              </div>
            ) : (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            )}
          </div>
        </div>

        {/* User B Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">User B</h2>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Wallet (cash)</div>
              <div className="text-2xl font-bold text-green-600">
                {userBSummary ? formatCurrency(userBSummary.walletBalance) : '...'}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              Spend by Category (this month)
            </h3>
            {userBSummary ? (
              <div className="space-y-1">
                {renderBudgetCategories(userBSummary.budgetByCategory)}
              </div>
            ) : (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
