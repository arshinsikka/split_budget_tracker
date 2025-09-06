#!/usr/bin/env node

/**
 * Demo script for Split Budget Tracker
 *
 * This script loads demo data to show how the system works with sample transactions.
 * Run with: npm run demo
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

/**
 * Run the demo script
 * @returns {Promise<void>}
 */

async function runDemo() {
  console.log('🎭 Split Budget Tracker Demo');
  console.log('============================\n');

  try {
    // Check if server is running
    console.log('Checking server health...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log(`✅ Server is running (${healthResponse.data.version})\n`);

    // Load demo data
    console.log('Loading demo data...');
    await axios.post(`${API_BASE}/seed/init?demo=true`);
    console.log('✅ Demo data loaded\n');

    // Show initial state
    console.log('📊 Initial State:');
    console.log('================');
    const usersResponse = await axios.get(`${API_BASE}/users`);
    const users = usersResponse.data.users;

    users.forEach(user => {
      console.log(`User ${user.userId}:`);
      console.log(`  Wallet: $${user.walletBalance.toFixed(2)}`);
      console.log(`  Spend by Category:`);
      Object.entries(user.budgetByCategory).forEach(([category, amount]) => {
        if (amount > 0) {
          console.log(`    ${category}: $${amount.toFixed(2)}`);
        }
      });
      console.log('');
    });

    // Show net due
    const netDue = usersResponse.data.netDue;
    if (netDue.owes) {
      const otherUser = netDue.owes === 'A' ? 'B' : 'A';
      console.log(
        `💰 Net Debt: User ${netDue.owes} owes User ${otherUser} $${netDue.amount.toFixed(2)}\n`
      );
    } else {
      console.log('✅ All settled up!\n');
    }

    // Show transactions
    console.log('📝 Transactions:');
    console.log('================');
    const transactionsResponse = await axios.get(`${API_BASE}/transactions`);
    const transactions = Array.isArray(transactionsResponse.data) ? transactionsResponse.data : [];

    if (transactions.length === 0) {
      console.log('No transactions found.');
    } else {
      transactions.forEach(tx => {
        if (tx.type === 'GROUP') {
          console.log(`• User ${tx.payerId} paid $${tx.amount.toFixed(2)} for ${tx.category}`);
          console.log(
            `  Split: $${tx.perUserShare.toFixed(2)} each${tx.remainder > 0 ? ` (${tx.payerId} gets extra $${tx.remainder.toFixed(2)})` : ''}`
          );
        } else if (tx.type === 'SETTLEMENT') {
          console.log(
            `• User ${tx.fromUserId} settled $${tx.amount.toFixed(2)} to User ${tx.toUserId}`
          );
        }
      });
    }

    console.log('\n🎯 Demo Complete!');
    console.log('================');
    console.log('You can now:');
    console.log('• View the dashboard at http://localhost:5173');
    console.log('• Try the API endpoints');
    console.log('• Add more transactions');
    console.log('• Test settlements');
    console.log('\nTo reset to clean state, use the Reset button in the UI or:');
    console.log('curl -X POST "http://localhost:3000/seed/init?demo=false"');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server is not running. Please start it first:');
      console.error('   npm run dev');
    } else {
      console.error('❌ Demo failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
    process.exit(1);
  }
}

// Run demo
runDemo();
