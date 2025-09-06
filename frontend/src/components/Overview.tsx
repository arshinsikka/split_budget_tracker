
export function Overview() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Split Budget Tracker</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">What this app does:</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A shared expense management system for two users (A & B) that tracks group expenses,
                calculates equal splits, and manages settlements using double-entry accounting
                principles.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Key APIs provided:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <div className="font-medium text-gray-900 mb-1">📊 Users</div>
                  <div className="text-gray-600">GET /users - View balances & budgets</div>
                </div>
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <div className="font-medium text-gray-900 mb-1">💳 Transactions</div>
                  <div className="text-gray-600">
                    POST/GET /transactions - Record & view expenses
                  </div>
                </div>
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <div className="font-medium text-gray-900 mb-1">🤝 Settlements</div>
                  <div className="text-gray-600">POST /settle - Record payments between users</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Navigation tabs:</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  🏠 Dashboard - Overview & balances
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  📝 Transactions - Add/view expenses
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  💸 Settle - Record payments
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() => {
              const element = document.querySelector('.space-y-6 > div:nth-child(2)');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Skip to content ↓
          </button>
        </div>
      </div>
    </div>
  );
}
