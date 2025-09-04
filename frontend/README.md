# Split Budget Tracker Frontend

A React + TypeScript + TailwindCSS frontend for the Split Budget Tracker API.

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and building
- ✅ TailwindCSS for styling
- ✅ Comprehensive API client with error handling
- ✅ Toast notifications for user feedback
- ✅ Health check component that connects to backend API
- ✅ Environment-based API URL configuration

## Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Environment Configuration

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:3000
```

This configures the API URL for the backend. The default is `http://localhost:3000`.

## API Client Usage

The frontend includes a comprehensive API client (`src/lib/api.ts`) with TypeScript interfaces and error handling.

### Basic Usage

```typescript
import { api } from './lib/api';

// Get all users
const users = await api.getUsers();

// Create a transaction
const transaction = await api.createTransaction({
  payerId: 'A',
  amount: '100.00',
  category: 'food'
});

// Get user summary
const summary = await api.getSummary('A');

// Get debt summary
const debt = await api.getWhoOwesWho();
```

### Idempotency Keys

For POST requests (transactions and settlements), you can include an idempotency key to prevent duplicate processing:

```typescript
// Create transaction with idempotency key
const transaction = await api.createTransaction({
  payerId: 'A',
  amount: '100.00',
  category: 'food'
}, 'unique-transaction-key');

// Settle debt with idempotency key
const settlement = await api.settle({
  fromUserId: 'B',
  toUserId: 'A',
  amount: '50.00'
}, 'unique-settlement-key');
```

### Error Handling

The API client includes comprehensive error handling with RFC 7807 Problem Details support:

```typescript
try {
  const users = await api.getUsers();
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.problemDetails);
  }
}
```

### Available API Functions

- `api.getHealth()` - Get backend health status
- `api.getUsers()` - Get all users and their balances
- `api.createTransaction(data, idempotencyKey?)` - Create a new transaction
- `api.getTransactions()` - Get all transactions
- `api.settle(data, idempotencyKey?)` - Settle debt between users
- `api.getSummary(userId)` - Get user dashboard summary
- `api.getWhoOwesWho()` - Get simplified debt summary

## Development

- **Development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Lint code**: `npm run lint`

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── HealthCheck.tsx    # Health check component
│   ├── lib/
│   │   └── api.ts            # API client with all functions
│   ├── App.tsx               # Main app component with toast integration
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles (TailwindCSS)
│   └── App.css              # App-specific styles
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # TailwindCSS configuration
├── postcss.config.js        # PostCSS configuration
├── vite.config.ts           # Vite configuration
└── .env                     # Environment variables
```

## Backend Integration

The frontend connects to the Split Budget Tracker backend API. Make sure the backend is running on the configured URL (default: http://localhost:3000).

The application includes:
- ✅ Health check component showing backend status
- ✅ Toast notifications for API success/error feedback
- ✅ Automatic API test on app load
- ✅ Comprehensive error handling with user-friendly messages
