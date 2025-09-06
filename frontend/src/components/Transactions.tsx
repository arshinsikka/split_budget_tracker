import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { CreateTransactionSchema, type CreateTransactionRequest } from '../lib/validation';
import { z } from 'zod';

type TransactionType = 'GROUP' | 'SETTLEMENT';
type Category = 'food' | 'groceries' | 'transport' | 'entertainment' | 'other';
type UserId = 'A' | 'B';

interface TransactionFilters {
  type: TransactionType | 'ALL';
  category: Category | 'ALL';
}

export function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({ type: 'ALL', category: 'ALL' });
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Form state
  const [formData, setFormData] = useState({
    payer: 'A' as UserId,
    amount: '',
    category: 'food' as Category,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      if (error instanceof Error) {
        toast.error(`Failed to load transactions: ${error.message}`);
      } else {
        toast.error('Failed to load transactions');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load transactions on component mount
  useEffect(() => {
    loadTransactions();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-SG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredAndSortedTransactions = () => {
    let filtered = transactions.filter(transaction => {
      const typeMatch = filters.type === 'ALL' || transaction.type === filters.type;
      const categoryMatch = filters.category === 'ALL' || transaction.category === filters.category;
      return typeMatch && categoryMatch;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setFormErrors({});

    try {
      // Parse and validate amount
      const amount = parseFloat(formData.amount);
      if (isNaN(amount)) {
        setFormErrors({ amount: 'Amount must be a valid number' });
        return;
      }

      // Round to 2 decimal places and convert to string
      const roundedAmount = Math.round(amount * 100) / 100;
      const amountString = roundedAmount.toFixed(2);

      // Create request object
      const request: CreateTransactionRequest = {
        payerId: formData.payer,
        amount: amountString,
        category: formData.category,
      };

      // Validate with Zod
      CreateTransactionSchema.parse(request);

      setSubmitting(true);

      // Generate idempotency key
      const idempotencyKey = `transaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await api.createTransaction(request, idempotencyKey);

      // Clear form and refresh transactions
      setFormData({ payer: 'A', amount: '', category: 'food' });
      setFormErrors({});
      await loadTransactions();

      toast.success('Group expense added successfully!');
    } catch (error) {
      console.error('Failed to create transaction:', error);

      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((err: any) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setFormErrors(fieldErrors);
        toast.error('Please fix the form errors');
      } else if (error instanceof Error) {
        toast.error(`Failed to add expense: ${error.message}`);
      } else {
        toast.error('Failed to add expense');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderTransactionRow = (transaction: any) => {
    const isGroupExpense = transaction.type === 'GROUP';
    const payerReceiver = isGroupExpense
      ? `Paid by User ${transaction.payerId}`
      : `User ${transaction.fromUserId} → User ${transaction.toUserId}`;

    return (
      <tr key={transaction.id} className="border-b border-gray-200 hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              isGroupExpense ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
            }`}
          >
            {transaction.type}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payerReceiver}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {transaction.category ? (
            <span className="capitalize">{transaction.category}</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {formatCurrency(transaction.amount)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatDate(transaction.createdAt)}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">📝</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Transaction Management</h2>
            <p className="text-sm text-gray-600">
              Record group expenses that are automatically split 50/50 between users A and B. Each
              transaction creates balanced ledger entries and updates both users' budgets.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-2">View and manage your shared expenses and settlements</p>
        </div>
        <button
          onClick={loadTransactions}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Loading...
            </>
          ) : (
            <>
              <span className="mr-2">🔄</span>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Add Group Expense Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Group Expense</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="payer" className="block text-sm font-medium text-gray-700 mb-1">
                Payer
              </label>
              <select
                id="payer"
                value={formData.payer}
                onChange={e => handleInputChange('payer', e.target.value as UserId)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="A">User A</option>
                <option value="B">User B</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (SGD)
              </label>
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={e => handleInputChange('amount', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
              {formErrors.amount && (
                <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
              )}
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={e => handleInputChange('category', e.target.value as Category)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="food">Food</option>
                <option value="groceries">Groceries</option>
                <option value="transport">Transport</option>
                <option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adding...
              </>
            ) : (
              <>
                <span className="mr-2">➕</span>
                Add Group Expense
              </>
            )}
          </button>
        </form>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            <select
              value={filters.type}
              onChange={e =>
                setFilters(prev => ({ ...prev, type: e.target.value as TransactionType | 'ALL' }))
              }
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All</option>
              <option value="GROUP">Group Expenses</option>
              <option value="SETTLEMENT">Settlements</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={filters.category}
              onChange={e =>
                setFilters(prev => ({ ...prev, category: e.target.value as Category | 'ALL' }))
              }
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All</option>
              <option value="food">Food</option>
              <option value="groceries">Groceries</option>
              <option value="transport">Transport</option>
              <option value="entertainment">Entertainment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'date' | 'amount')}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ) : filteredAndSortedTransactions().length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-400 text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-600">
              {transactions.length === 0
                ? 'No transactions have been recorded yet. Add a group expense to get started!'
                : 'No transactions match your current filters. Try adjusting the filters above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payer/Receiver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedTransactions().map(renderTransactionRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
