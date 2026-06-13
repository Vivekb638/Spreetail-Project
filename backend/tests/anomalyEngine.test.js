const { detectAnomalies } = require('../src/services/anomalyEngine');

describe('Anomaly Detection Engine Unit Tests', () => {
  const mockGroupMembers = [
    { id: '1', name: 'Aisha', email: 'aisha@example.com', joined_at: '2026-01-01T00:00:00Z', left_at: null },
    { id: '2', name: 'Rohan', email: 'rohan@example.com', joined_at: '2026-01-01T00:00:00Z', left_at: null },
    { id: '3', name: 'Priya', email: 'priya@example.com', joined_at: '2026-01-01T00:00:00Z', left_at: null },
    { id: '4', name: 'Meera', email: 'meera@example.com', joined_at: '2026-01-01T00:00:00Z', left_at: '2026-03-31T23:59:59Z' },
    { id: '5', name: 'Sam', email: 'sam@example.com', joined_at: '2026-04-15T00:00:00Z', left_at: null }
  ];

  test('should detect zero or negative amount anomalies', () => {
    const csvRows = [
      {
        date: '10-02-2026',
        description: 'Dinner',
        paid_by: 'Aisha',
        amount: '-500',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan',
        split_details: ''
      },
      {
        date: '11-02-2026',
        description: 'Swiggy',
        paid_by: 'Aisha',
        amount: '0',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan',
        split_details: ''
      }
    ];

    const anomalies = detectAnomalies(csvRows, mockGroupMembers);
    const negative = anomalies.find(a => a.type === 'Negative amount');
    const zero = anomalies.find(a => a.type === 'Empty amount' && a.description.includes('zero'));

    expect(negative).toBeDefined();
    expect(zero).toBeDefined();
  });

  test('should detect unknown member anomalies', () => {
    const csvRows = [
      {
        date: '10-02-2026',
        description: 'Taxi',
        paid_by: 'Kabir', // Unknown
        amount: '600',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan;Kabir',
        split_details: ''
      }
    ];

    const anomalies = detectAnomalies(csvRows, mockGroupMembers);
    const unknownPayer = anomalies.find(a => a.type === 'Unknown member' && a.description.includes('Payer "Kabir"'));
    const unknownParticipant = anomalies.find(a => a.type === 'Unknown member' && a.description.includes('participant "Kabir"'));

    expect(unknownPayer).toBeDefined();
    expect(unknownParticipant).toBeDefined();
  });

  test('should detect percentage split mismatches', () => {
    const csvRows = [
      {
        date: '20-02-2026',
        description: 'Pizza',
        paid_by: 'Aisha',
        amount: '1200',
        currency: 'INR',
        split_type: 'percentage',
        split_with: 'Aisha;Rohan',
        split_details: 'Aisha 40%; Rohan 50%' // Sum is 90%
      }
    ];

    const anomalies = detectAnomalies(csvRows, mockGroupMembers);
    const mismatch = anomalies.find(a => a.type === 'Split mismatch');
    
    expect(mismatch).toBeDefined();
    expect(mismatch.description).toContain('90%');
  });

  test('should detect timeline boundary anomalies (left member / not joined yet)', () => {
    const csvRows = [
      {
        date: '10-04-2026', // Meera left on March 31
        description: 'April Groceries',
        paid_by: 'Aisha',
        amount: '1500',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan;Meera',
        split_details: ''
      },
      {
        date: '10-03-2026', // Sam joins mid-April
        description: 'March Internet',
        paid_by: 'Sam',
        amount: '1000',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Sam',
        split_details: ''
      }
    ];

    const anomalies = detectAnomalies(csvRows, mockGroupMembers);
    const meeraAnomaly = anomalies.find(a => a.type === 'Expense outside membership period' && a.description.includes('Meera'));
    const samAnomaly = anomalies.find(a => a.type === 'Expense outside membership period' && a.description.includes('Payer Sam'));

    expect(meeraAnomaly).toBeDefined();
    expect(samAnomaly).toBeDefined();
  });

  test('should detect exact duplicate and near duplicate rows', () => {
    const csvRows = [
      {
        date: '08-02-2026',
        description: 'Dinner at Marina Bites',
        paid_by: 'Aisha',
        amount: '3200',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan',
        split_details: ''
      },
      {
        date: '08-02-2026',
        description: 'Dinner at Marina Bites',
        paid_by: 'Aisha',
        amount: '3200',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan',
        split_details: ''
      },
      {
        date: '09-02-2026', // next day
        description: 'dinner - marina bites', // lowercase and near match
        paid_by: 'Aisha',
        amount: '3200',
        currency: 'INR',
        split_type: 'equal',
        split_with: 'Aisha;Rohan',
        split_details: ''
      }
    ];

    const anomalies = detectAnomalies(csvRows, mockGroupMembers);
    const duplicates = anomalies.filter(a => a.type === 'Duplicate expenses');
    const nearDuplicates = anomalies.filter(a => a.type === 'Near duplicate expenses');

    expect(duplicates.length).toBeGreaterThan(0);
    expect(nearDuplicates.length).toBeGreaterThan(0);
  });
});
