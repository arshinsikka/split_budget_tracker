import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { SettlementSchema } from '../lib/validation';
import { z } from 'zod';

type UserId = 'A' | 'B';

export function Settle() {
  const [debtStatus, setDebtStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fromUserId: 'A' as UserId,
    toUserId: 'B' as UserId,
    amount: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadDebtStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getWhoOwesWho();
      setDebtStatus(data);
    } catch (error) {
      console.error('Failed to load debt status:', error);
      if (error instanceof Error) {
        toast.error(`Failed to load debt status: ${error.message}`);
      } else {
        toast.error('Failed to load debt status');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load debt status on component mount
  useEffect(() => {
    loadDebtStatus();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form data
      const validatedData = SettlementSchema.parse({
        fromUserId: formData.fromUserId,
        toUserId: formData.toUserId,
        amount: formData.amount
      });

      setSubmitting(true);
      
      // Submit settlement
      await api.settle(validatedData);
      
      toast.success('Settlement recorded successfully!');
      
      // Reset form
      setFormData({
        fromUserId: 'A',
        toUserId: 'B',
        amount: ''
      });
      
      // Reload debt status
      await loadDebtStatus();
      
    } catch (error) {
      console.error('Settlement failed:', error);
      
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach((err: z.ZodIssue) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFormErrors(errors);
        toast.error('Please fix the form errors');
      } else if (error instanceof Error) {
        toast.error(`Settlement failed: ${error.message}`);
      } else {
        toast.error('Settlement failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD'
    }).format(amount);
  };

  const renderDebtStatus = () => {
    if (!debtStatus) return null;

    if (debtStatus.owes && debtStatus.to && debtStatus.amount > 0) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-amber-600 text-lg mr-2">💰</span>
            <div>
              <p className="text-amber-800 font-medium">
                User {debtStatus.owes} owes User {debtStatus.to} {formatCurrency(debtStatus.amount)}
              </p>
              <p className="text-amber-700 text-sm mt-1">
                User {debtStatus.owes} should settle this amount to User {debtStatus.to}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <span className="text-green-600 text-lg mr-2">✅</span>
          <p className="text-green-800 font-medium">All settled up - no outstanding debts</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">💸</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Settlement Management</h2>
            <p className="text-sm text-gray-600">
              Record payments between users to settle outstanding debts. Settlements reduce inter-user balances 
              and maintain the double-entry accounting system.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settle Debts</h1>
          <p className="text-gray-600 mt-2">
            Record payments between users to settle outstanding balances
          </p>
        </div>
        <button
          onClick={loadDebtStatus}
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

      {/* Current Debt Status */}
      {renderDebtStatus()}

      {/* Settlement Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Settlement</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="fromUserId" className="block text-sm font-medium text-gray-700 mb-1">
                From User
              </label>
              <select
                id="fromUserId"
                value={formData.fromUserId}
                onChange={(e) => handleInputChange('fromUserId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.fromUserId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="A">User A</option>
                <option value="B">User B</option>
              </select>
              {formErrors.fromUserId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.fromUserId}</p>
              )}
            </div>

            <div>
              <label htmlFor="toUserId" className="block text-sm font-medium text-gray-700 mb-1">
                To User
              </label>
              <select
                id="toUserId"
                value={formData.toUserId}
                onChange={(e) => handleInputChange('toUserId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.toUserId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="A">User A</option>
                <option value="B">User B</option>
              </select>
              {formErrors.toUserId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.toUserId}</p>
              )}
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (SGD)
              </label>
              <input
                type="text"
                id="amount"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {formErrors.amount && (
                <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Recording...
                </>
              ) : (
                <>
                  <span className="mr-2">💸</span>
                  Record Settlement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}