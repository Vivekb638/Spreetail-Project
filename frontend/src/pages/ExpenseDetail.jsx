import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  TrendingDown, 
  ChevronRight, 
  Calendar, 
  DollarSign, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
  Users
} from 'lucide-react';

const ExpenseDetail = () => {
  const { groupId, expenseId } = useParams();
  const navigate = useNavigate();

  const [expense, setExpense] = useState(null);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExpenseDetails = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get(`/expenses/${expenseId}`);
        setExpense(res.data.expense);
        setSplits(res.data.splits);
      } catch (err) {
        setError('Failed to fetch expense details.');
      } finally {
        setLoading(false);
      }
    };

    fetchExpenseDetails();
  }, [expenseId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading expense details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !expense) {
    return (
      <Layout>
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error || 'Expense details not found.'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${expense.group_id}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Expense Details</span>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(`/groups/${expense.group_id}`)}
          className="btn-secondary p-2.5 rounded-xl active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-white font-sans">{expense.title}</h1>
          <p className="text-sm text-slate-400 mt-1">Detailed splits breakdown.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* DETAIL SHEET */}
        <div className="lg:col-span-2 glass-panel p-8 space-y-6">
          <div className="border-b border-slate-800/60 pb-6">
            <h2 className="text-lg font-bold text-white mb-4">Transaction Details</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Paid By</span>
                <span className="text-slate-200 font-bold">{expense.paid_by_name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Date</span>
                <span className="text-slate-205 font-medium flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  {new Date(expense.expense_date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Original Amount</span>
                <span className="text-slate-200 font-mono font-bold">
                  {expense.original_currency === 'USD' ? '$' : '₹'}
                  {parseFloat(expense.original_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Exchange Rate</span>
                <span className="text-slate-200 font-mono">{parseFloat(expense.exchange_rate).toFixed(4)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 font-semibold block mb-1">Total Converted Value</span>
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  ₹{parseFloat(expense.converted_amount_in_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white mb-2">Description / Notes</h2>
            <p className="text-slate-350 text-sm leading-relaxed">{expense.description || 'No description provided.'}</p>
          </div>
        </div>

        {/* SPLITS BREAKDOWN */}
        <div className="glass-panel p-6 h-fit space-y-6">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Split Shares ({splits.length})
            </h3>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-6">
              Method: {expense.split_type}
            </p>
            
            <div className="space-y-3">
              {splits.map(s => (
                <div key={s.id} className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{s.user_name}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      Weight: {parseFloat(s.split_value).toLocaleString()}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-200 text-sm">
                    ₹{parseFloat(s.owed_amount_in_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ExpenseDetail;
