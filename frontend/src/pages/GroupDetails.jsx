import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  Plus, 
  FileSpreadsheet, 
  Calculator, 
  Users, 
  Trash2, 
  Edit, 
  Calendar, 
  DollarSign, 
  TrendingDown, 
  TrendingUp,
  AlertCircle,
  Loader2,
  ChevronRight,
  HandCoins
} from 'lucide-react';

const GroupDetails = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch group details
      const groupRes = await API.get(`/groups`);
      const matched = groupRes.data.find(g => g.id === groupId);
      if (!matched) throw new Error('Group not found');
      setGroup(matched);

      // Fetch expenses
      const expensesRes = await API.get(`/expenses?group_id=${groupId}`);
      setExpenses(expensesRes.data);

      // Fetch settlements
      const settlementsRes = await API.get(`/settlements?group_id=${groupId}`);
      setSettlements(settlementsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense? This will recalculate all balances.')) return;
    
    try {
      await API.delete(`/expenses/${expenseId}`);
      setExpenses(expenses.filter(e => e.id !== expenseId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete expense.');
    }
  };

  const formatCurrency = (amount, curr) => {
    const symbol = curr === 'USD' ? '$' : '₹';
    return `${symbol}${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading group data...</p>
        </div>
      </Layout>
    );
  }

  if (error || !group) {
    return (
      <Layout>
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error || 'Group details not found.'}
        </div>
        <button onClick={() => navigate('/')} className="btn-secondary">Back to Dashboard</button>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Group Title and Navigation Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
            <Link to="/" className="hover:underline">Groups</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Details</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-sans">{group.name}</h1>
          <p className="text-sm text-slate-400 mt-1">{group.description}</p>
        </div>
        
        {/* Navigation Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Link to={`/groups/${groupId}/balances`} className="btn-secondary flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            Balance Engine
          </Link>
          <Link to={`/groups/${groupId}/members`} className="btn-secondary flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Members & Timelines
          </Link>
          <Link to={`/groups/${groupId}/import`} className="btn-secondary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            Import CSV
          </Link>
        </div>
      </div>

      {/* Main Actions Panel */}
      <div className="flex flex-wrap gap-4 mb-10">
        <Link to={`/groups/${groupId}/expenses/new`} className="btn-primary flex items-center gap-2 shadow-indigo-600/10">
          <Plus className="w-4 h-4" />
          Add Expense
        </Link>
        <Link to={`/groups/${groupId}/settlements/new`} className="btn-success flex items-center gap-2 shadow-emerald-600/10">
          <HandCoins className="w-4 h-4" />
          Record Settlement
        </Link>
      </div>

      {/* Grid containing Expenses and Settlements */}
      <div className="space-y-10">
        
        {/* EXPENSES SECTION */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-indigo-400" />
            Expenses History ({expenses.length})
          </h2>

          {expenses.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No expenses recorded. Click "Add Expense" or upload the CSV to load expenses!
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Paid By</th>
                    <th>Amount</th>
                    <th>Split Type</th>
                    <th>Converted INR</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap font-medium text-slate-400">
                        {new Date(e.expense_date).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/expenses/${e.id}`} className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline">
                          {e.title}
                        </Link>
                      </td>
                      <td className="text-slate-300 font-semibold">{e.paid_by_name || 'System / Unassigned'}</td>
                      <td className="whitespace-nowrap font-mono">{formatCurrency(e.original_amount, e.original_currency)}</td>
                      <td className="capitalize text-slate-400 font-semibold">{e.split_type}</td>
                      <td className="font-mono text-emerald-400">₹{parseFloat(e.converted_amount_in_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td>
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => navigate(`/expenses/${e.id}/edit`)}
                            className="text-slate-400 hover:text-indigo-400 p-1 transition-colors"
                            title="Edit Expense"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SETTLEMENTS SECTION */}
        <div className="glass-panel p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Settlements History ({settlements.length})
          </h2>

          {settlements.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No settlements recorded yet.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payer (Sent)</th>
                    <th>Receiver (Got)</th>
                    <th>Amount</th>
                    <th>Converted INR</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap font-medium text-slate-400">
                        {new Date(s.settlement_date).toLocaleDateString()}
                      </td>
                      <td className="text-rose-300 font-semibold">{s.payer_name}</td>
                      <td className="text-emerald-300 font-semibold">{s.receiver_name}</td>
                      <td className="whitespace-nowrap font-mono">{formatCurrency(s.amount, s.currency)}</td>
                      <td className="font-mono text-emerald-400 font-bold">₹{parseFloat(s.converted_amount_in_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="text-slate-400 text-xs italic">{s.note || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default GroupDetails;
