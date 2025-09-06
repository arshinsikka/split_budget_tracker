# Split Budget Tracker Frontend

A React + TypeScript + TailwindCSS frontend for the Split Budget Tracker API.

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and building
- ✅ TailwindCSS for styling
- ✅ React Router for client-side navigation
- ✅ Comprehensive API client with error handling
- ✅ Toast notifications for user feedback
- ✅ Error boundary for graceful error handling
- ✅ Health check component that connects to backend API
- ✅ Environment-based API URL configuration

## Layout & Navigation

The app features a clean, minimal layout with three main views:

- **Dashboard** (`/`) - Overview of shared expenses and balances
- **Transactions** (`/transactions`) - View and manage transaction history
- **Settle** (`/settle`) - Record settlement payments

### Navigation

- Top navigation bar with project title
- Responsive design with focus styles for accessibility
- Active route highlighting with color-coded indicators

### Error Handling

- App-level error boundary with user-friendly fallback UI
- Development mode shows detailed error information
- Graceful error recovery with refresh option

## Quick Start

### Option 1: Full Stack Demo (Recommended)

Launch both backend and frontend with a single command:

```bash
# From the project root
bash scripts/demo-ui.sh
```

This script will:

- Start the backend API server on port 3000
- Start the frontend development server on port 5173
- Wait for both services to be ready
- Open your browser to the frontend
- Provide clear logs and service URLs

### Option 2: Manual Setup

1. **Start the backend** (from project root):

```bash
npm run dev
```

2. **Start the frontend** (in a new terminal):

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173

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
  category: 'food',
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
const transaction = await api.createTransaction(
  {
    payerId: 'A',
    amount: '100.00',
    category: 'food',
  },
  'unique-transaction-key'
);

// Settle debt with idempotency key
const settlement = await api.settle(
  {
    fromUserId: 'B',
    toUserId: 'A',
    amount: '50.00',
  },
  'unique-settlement-key'
);
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
│   │   ├── Dashboard.tsx         # Dashboard page component
│   │   ├── Transactions.tsx      # Transactions page component
│   │   ├── Settle.tsx           # Settle page component
│   │   ├── Navigation.tsx       # Top navigation component
│   │   ├── ErrorBoundary.tsx    # Error boundary component
│   │   ├── ErrorTest.tsx        # Error boundary test component
│   │   └── HealthCheck.tsx      # Health check component
│   ├── lib/
│   │   └── api.ts              # API client with all functions
│   ├── App.tsx                 # Main app component with routing
│   ├── main.tsx               # React entry point
│   ├── index.css              # Global styles (TailwindCSS)
│   └── App.css                # App-specific styles
├── index.html                 # HTML entry point
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.js         # TailwindCSS configuration
├── postcss.config.js          # PostCSS configuration
├── vite.config.ts             # Vite configuration
└── .env                       # Environment variables
```

## Transactions Page

The Transactions page (`/transactions`) provides comprehensive transaction management:

### Features

- **Transaction List**: Displays all transactions with key fields (type, payer/receiver, category, amount, date)
- **Real-time Data**: Fetches live data from `GET /transactions` endpoint
- **Filtering & Sorting**: Filter by transaction type and category, sort by date or amount
- **Add Group Expense**: Form to create new group expenses with validation
- **Currency Formatting**: All amounts displayed in SGD with 2 decimal places
- **Loading States**: Skeleton animations during data fetch
- **Empty States**: Clear messaging when no transactions exist
- **Error Handling**: Toast notifications for API errors with retry functionality

### Add Group Expense Form

- **Fields**: Payer (User A/B), Amount (SGD), Category (food/groceries/transport/entertainment/other)
- **Validation**: Client-side validation with inline error messages
- **Double-submit Protection**: Form disabled during submission to prevent duplicates
- **Success Feedback**: Toast notification and automatic list refresh on success
- **Error Handling**: Server validation errors displayed as toast messages

### Transaction Display

- **Type Badges**: Color-coded badges for GROUP (blue) and SETTLEMENT (green) transactions
- **Payer/Receiver Info**: Clear indication of who paid or who owes whom
- **Category Display**: Capitalized category names with fallback for missing categories
- **Date Formatting**: Singapore locale formatting with date and time
- **Responsive Table**: Horizontal scroll on mobile devices

### Filtering & Sorting

- **Type Filter**: Show all, group expenses only, or settlements only
- **Category Filter**: Filter by specific expense categories
- **Sort Options**: Sort by date (newest/oldest) or amount (highest/lowest)
- **Real-time Updates**: Filters and sorting apply immediately to the displayed list

## Screenshots

### Dashboard

The Dashboard provides an overview of shared expenses and current balances:

- **User Cards**: Display wallet balances and budget breakdowns by category
- **Debt Status Banner**: Shows who owes whom or "All settled up" status
- **Real-time Data**: Fetches live data from the backend API
- **Refresh Button**: Manual refresh with loading state

### Transactions

The Transactions page manages all shared expenses and settlements:

- **Transaction Table**: Lists all transactions with type, payer/receiver, category, amount, and date
- **Filtering & Sorting**: Filter by type and category, sort by date or amount
- **Add Group Expense Form**: Create new group expenses with validation
- **Currency Formatting**: All amounts displayed in SGD with 2 decimal places

### Settlement

The Settlement page handles debt payments between users:

- **Current Debt Status**: Shows outstanding debt and maximum settlement amount
- **Settlement Form**: Record payments with validation for self-settlement and over-settlement
- **Idempotency Protection**: Prevents duplicate submissions
- **Success Feedback**: Toast notifications and automatic data refresh

### Error Handling

Comprehensive error handling throughout the application:

- **Error Boundary**: Catches JavaScript errors with user-friendly fallback UI
- **Toast Notifications**: API errors displayed as toast messages
- **Form Validation**: Real-time validation with inline error messages
- **Loading States**: Skeleton animations and spinners during API calls

## Backend Integration

The frontend connects to the Split Budget Tracker backend API. Make sure the backend is running on the configured URL (default: http://localhost:3000).

The application includes:

- ✅ Health check component showing backend status
- ✅ Toast notifications for API success/error feedback
- ✅ Automatic API test on app load
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Client-side routing with React Router
- ✅ Error boundary for graceful error handling
- ✅ Real-time transaction management with filtering and sorting
- ✅ Form validation and double-submit protection
