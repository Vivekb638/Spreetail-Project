import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  Calculator, 
  ArrowRight, 
  User, 
  DollarSign, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

const BalanceSummary = () => {
  const { id: groupId } = useParams();
  
  const [balances, setBalances] = useState({});
  const [simplified, setSimplified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected user for explainability drilldown
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchBalanceData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch group balances
      const balRes = await API.get(`/groups/${groupId}/balance`);
      setBalances(balRes.data);

      // Fetch simplified settlements
      const simpRes = await API.get(`/groups/${groupId}/simplified-settlements`);
      setSimplified(simpRes.data);

      // Default selected user to first member if available
      const userIds = Object.keys(balRes.data);
      if (userIds.length > 0) {
        setSelectedUserId(userIds[0]);
      }
    } catch (err) {
      setError('Failed to compute group balances. Ensure the group exists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceData();
  }, [groupId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Running Balance Engine...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      </Layout>
    );
  }

  const selectedLedger = balances[selectedUserId];

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${groupId}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Balance Engine</span>
      </div>

      <div className="flex items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-sans flex items-center gap-3">
            <Calculator className="w-8 h-8 text-indigo-400" />
            Group Balance & Settlements
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Calculated balances, Splitwise-style simplified debts, and trace logs.
          </p>
        </div>
        <button
          onClick={fetchBalanceData}
          className="btn-secondary px-4 py-2 flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Recalculate
        </button>
      </div>

      {/* AISHA'S REQUIREMENT: SIMPLIFIED SETTLEMENTS HERO */}
      <div className="glass-panel p-6 border-l-4 border-l-emerald-500 mb-8">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-emerald-400" />
          Aisha's Summary: Final Settlements
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          The mathematical minimum number of peer-to-peer transactions required to settle the entire group's debts.
        </p>

        {simplified.length === 0 ? (
          <div className="bg-emerald-500/10 text-emerald-300 font-bold p-4 rounded-xl border border-emerald-500/20 text-center">
            All balances are settled! Nobody owes anyone anything.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {simplified.map((tx, idx) => (
              <div key={idx} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-rose-300 text-sm">{tx.payerName}</span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-emerald-300 text-sm">{tx.receiverName}</span>
                </div>
                <span className="font-mono font-extrabold text-emerald-400 text-base">
                  ₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BALANCES SUMMARY TABLE */}
      <div className="glass-panel p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Member Balances overview</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Total Paid</th>
                <th>Total Owed</th>
                <th>Net Expenses</th>
                <th>Settlements Sent</th>
                <th>Settlements Got</th>
                <th>Final Balance</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(balances).map((userId) => {
                const b = balances[userId];
                const isPositive = b.finalBalance >= 0;
                const isSelected = selectedUserId === userId;
                
                return (
                  <tr 
                    key={userId}
                    className={`${isSelected ? 'bg-indigo-600/10 hover:bg-indigo-600/15' : ''}`}
                  >
                    <td>
                      <div className="font-bold text-slate-200">{b.user.name}</div>
                    </td>
                    <td className="font-mono text-slate-300">₹{b.totalPaid.toLocaleString('en-IN')}</td>
                    <td className="font-mono text-slate-350">₹{b.totalOwed.toLocaleString('en-IN')}</td>
                    <td className="font-mono text-slate-400">₹{b.netExpenseBalance.toLocaleString('en-IN')}</td>
                    <td className="font-mono text-indigo-400">₹{b.settlementsSent.toLocaleString('en-IN')}</td>
                    <td className="font-mono text-rose-400">₹{b.settlementsReceived.toLocaleString('en-IN')}</td>
                    <td className={`font-mono font-extrabold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}₹{b.finalBalance.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div className="flex justify-center">
                        <button
                          onClick={() => setSelectedUserId(userId)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                            isSelected 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/10' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          Trace
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROHAN'S REQUIREMENT: TRACEABILITY EXPLORER */}
      {selectedLedger && (
        <div className="glass-panel p-6 animate-fade-in">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            Explainability Audit: {selectedLedger.user.name}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Formula: 
            <code className="text-indigo-300 font-mono ml-2">
              Final Balance (₹{selectedLedger.finalBalance.toLocaleString('en-IN')}) = 
              Paid (₹{selectedLedger.totalPaid.toLocaleString('en-IN')}) - 
              Owed (₹{selectedLedger.totalOwed.toLocaleString('en-IN')}) + 
              Sent (₹{selectedLedger.settlementsSent.toLocaleString('en-IN')}) - 
              Got (₹{selectedLedger.settlementsReceived.toLocaleString('en-IN')})
            </code>
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* PAID EXPENSES (ADDITIONS TO BALANCE) */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                Expenses Paid (+ Credits)
              </h3>
              {selectedLedger.breakdown.paidExpenses.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No expenses paid by this member.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {selectedLedger.breakdown.paidExpenses.map((pe) => (
                    <div key={pe.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-200">{pe.title}</p>
                        <span className="text-slate-500">{new Date(pe.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-right">
                        {pe.originalCurrency === 'USD' && (
                          <p className="text-[10px] text-slate-400 mb-0.5">
                            Original: ${pe.originalAmount.toFixed(2)} (Rate: {pe.exchangeRate})
                          </p>
                        )}
                        <p className="font-mono font-bold text-emerald-400">₹{pe.amountInr.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OWED SPLITS (SUBTRACTIONS FROM BALANCE) */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-rose-400" />
                Splits Owed (- Debts)
              </h3>
              {selectedLedger.breakdown.owedSplits.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No split shares owed by this member.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {selectedLedger.breakdown.owedSplits.map((os, idx) => (
                    <div key={idx} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-200">{os.title}</p>
                        <p className="text-slate-500">
                          {new Date(os.date).toLocaleDateString()} • Paid by {os.paidByName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 mb-0.5">Share weight: {os.shareValue}</p>
                        <p className="font-mono font-bold text-rose-400">₹{os.amountInr.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SETTLEMENTS SENT */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-400" />
                Settlements Sent (+ Reduces Debt)
              </h3>
              {selectedLedger.breakdown.sentSettlements.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No settlements sent.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {selectedLedger.breakdown.sentSettlements.map((ss) => (
                    <div key={ss.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-200">Paid to {ss.receiverName}</p>
                        <span className="text-slate-500">{new Date(ss.date).toLocaleDateString()}</span>
                        {ss.note && <p className="text-[10px] text-slate-400 italic mt-0.5">"{ss.note}"</p>}
                      </div>
                      <div className="text-right">
                        {ss.originalCurrency === 'USD' && (
                          <p className="text-[10px] text-slate-400 mb-0.5">
                            Original: ${ss.originalAmount.toFixed(2)} (Rate: {ss.exchangeRate})
                          </p>
                        )}
                        <p className="font-mono font-bold text-indigo-400">₹{ss.amountInr.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SETTLEMENTS RECEIVED */}
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-rose-500" />
                Settlements Received (- Reduces Credit)
              </h3>
              {selectedLedger.breakdown.receivedSettlements.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No settlements received.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {selectedLedger.breakdown.receivedSettlements.map((sr) => (
                    <div key={sr.id} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-200">Got from {sr.payerName}</p>
                        <span className="text-slate-500">{new Date(sr.date).toLocaleDateString()}</span>
                        {sr.note && <p className="text-[10px] text-slate-400 italic mt-0.5">"{sr.note}"</p>}
                      </div>
                      <div className="text-right">
                        {sr.originalCurrency === 'USD' && (
                          <p className="text-[10px] text-slate-400 mb-0.5">
                            Original: ${sr.originalAmount.toFixed(2)} (Rate: {sr.exchangeRate})
                          </p>
                        )}
                        <p className="font-mono font-bold text-rose-500">₹{sr.amountInr.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
};

export default BalanceSummary;
