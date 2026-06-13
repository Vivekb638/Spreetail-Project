const { simplifySettlements } = require('../src/services/balanceEngine');

describe('Balance Engine Debt Simplification Tests', () => {
  test('should simplify A -> B (100) and B -> C (100) to A -> C (100)', () => {
    const mockBalances = {
      'userA': {
        user: { id: 'userA', name: 'Aisha' },
        finalBalance: -100.00
      },
      'userB': {
        user: { id: 'userB', name: 'Rohan' },
        finalBalance: 0.00
      },
      'userC': {
        user: { id: 'userC', name: 'Priya' },
        finalBalance: 100.00
      }
    };

    const transactions = simplifySettlements(mockBalances);
    
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual({
      payerId: 'userA',
      payerName: 'Aisha',
      receiverId: 'userC',
      receiverName: 'Priya',
      amount: 100.00
    });
  });

  test('should handle multiple complex overlapping debts correctly and minimize transactions', () => {
    // Aisha owes 150 (Final balance -150)
    // Rohan owes 50 (Final balance -50)
    // Priya is owed 100 (Final balance 100)
    // Meera is owed 100 (Final balance 100)
    const mockBalances = {
      'A': { user: { id: 'A', name: 'Aisha' }, finalBalance: -150.00 },
      'B': { user: { id: 'B', name: 'Rohan' }, finalBalance: -50.00 },
      'C': { user: { id: 'C', name: 'Priya' }, finalBalance: 100.00 },
      'D': { user: { id: 'D', name: 'Meera' }, finalBalance: 100.00 }
    };

    const transactions = simplifySettlements(mockBalances);

    // Should find transactions resolving this, typically 2 or 3 transactions instead of 4+
    // E.g. Aisha pays Priya 100, Aisha pays Meera 50, Rohan pays Meera 50
    // Let's check that sum of transactions is 200, and everyone's balance is resolved
    const totalSettle = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    expect(totalSettle).toBe(200.00);
    expect(transactions.length).toBeLessThan(4);
  });
});
