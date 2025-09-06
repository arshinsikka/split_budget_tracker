import { useState } from 'react';

export function ErrorTest() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('This is a test error to demonstrate the error boundary');
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">
        Error Boundary Test
      </h3>
      <p className="text-yellow-700 text-sm mb-3">
        Click the button below to test the error boundary functionality
      </p>
      <button
        onClick={() => setShouldThrow(true)}
        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
      >
        Trigger Error
      </button>
    </div>
  );
}
