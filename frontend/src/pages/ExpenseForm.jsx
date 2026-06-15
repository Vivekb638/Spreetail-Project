import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  PlusCircle, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  TrendingDown
} from 'lucide-react';

const ExpenseForm = () => {
  const { id: groupId, expenseId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!expenseId;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal');
  
  // Splits configuration: { [userId]: { selected: boolean, value: string } }
  const [splits, setSplits] = useState({});

  useEffect(() => {
    const initForm = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch group members
        const membersRes = await API.get(`/groups/${groupId}/members`);
        setMembers(membersRes.data);
        
        if (membersRes.data.length > 0) {
          setPaidBy(membersRes.data[0].id);
        }

        // Initialize empty splits map
        const initialSplits = {};
        membersRes.data.forEach(m => {
          initialSplits[m.id] = { selected: true, value: '' };
        });
        setSplits(initialSplits);

        if (isEditMode) {
          // Fetch existing expense details
          const expRes = await API.get(`/expenses/${expenseId}`);
          const { expense, splits: dbSplits } = expRes.data;
          
          setTitle(expense.title);
          setDescription(expense.description || '');
          setAmount(expense.original_amount);
          setCurrency(expense.original_currency);
          setExchangeRate(expense.exchange_rate);
          setExpenseDate(new Date(expense.expense_date).toISOString().split('T')[0]);
          setPaidBy(expense.paid_by);
          setSplitType(expense.split_type);

          // Populates splits selections
          const populatedSplits = {};
          membersRes.data.forEach(m => {
            const matchedSplit = dbSplits.find(ds => ds.user_id === m.id);
            populatedSplits[m.id] = {
              selected: !!matchedSplit,
              value: matchedSplit ? matchedSplit.split_value.toString() : ''
            };
          });
          setSplits(populatedSplits);
        }
      } catch (err) {
        setError('Failed to load form details.');
      } finally {
        setLoading(false);
      }
    };

    initForm();
  }, [groupId, expenseId, isEditMode]);

  const handleToggleMember = (userId) => {
    setSplits(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        selected: !prev[userId].selected
      }
    }));
  };

  const handleSplitValueChange = (userId, value) => {
    setSplits(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !amount || !paidBy) {
      setError('Please fill in all required fields.');
      return;
    }

    // Prepare splits array
    const selectedSplits = Object.keys(splits)
      .filter(uid => splits[uid].selected)
      .map(uid => ({
        user_id: uid,
        split_value: splits[uid].value ? parseFloat(splits[uid].value) : 1
      }));

    if (selectedSplits.length === 0) {
      setError('At least one group member must be selected in the split.');
      return;
    }

    // Validations based on splitType
    if (splitType === 'percentage') {
      const sum = selectedSplits.reduce((acc, curr) => acc + (curr.split_value || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        setError(`Split percentages must sum to exactly 100%. Current sum: ${sum}%`);
        return;
      }
    } else if (splitType === 'unequal') { // exact unequal amounts
      const sum = selectedSplits.reduce((acc, curr) => acc + (curr.split_value || 0), 0);
      if (Math.abs(sum - parseFloat(amount)) > 0.02) {
        setError(`Split exact amounts must sum to the expense total (${amount}). Current sum: ${sum}`);
        return;
      }
    } else if (splitType === 'share') {
      const sum = selectedSplits.reduce((acc, curr) => acc + (curr.split_value || 0), 0);
      if (sum <= 0) {
        setError('Sum of shares weight must be greater than zero.');
        return;
      }
    }

    setSaving(true);
    setError('');

    const payload = {
      group_id: groupId,
      title,
      description,
      original_amount: parseFloat(amount),
      original_currency: currency,
      exchange_rate: currency === 'USD' ? parseFloat(exchangeRate) : 1,
      expense_date: new Date(expenseDate).toISOString(),
      paid_by: paidBy,
      split_type: splitType,
      splits: selectedSplits
    };

    try {
      if (isEditMode) {
        await API.put(`/expenses/${expenseId}`, payload);
      } else {
        await API.post('/expenses', payload);
      }
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense details.');
      setSaving(false);
    }
  };

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

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${groupId}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>{isEditMode ? 'Edit Expense' : 'Add Expense'}</span>
      </div>

      <h1 className="text-3xl font-extrabold text-slate-100 mb-8 font-sans flex items-center gap-3">
        <TrendingDown className="w-8 h-8 text-indigo-400" />
        {isEditMode ? 'Edit Expense Transaction' : 'Record New Expense'}
      </h1>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* DETAILS SECTION */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-100 mb-4">Transaction Details</h2>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Expense Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Electricity Bill, Groceries DMart"
              className="w-full glass-input"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this expense..."
              className="w-full glass-input h-20 resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Amount</label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full glass-input font-mono"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full glass-input"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {currency === 'USD' && (
            <div className="space-y-1.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800 animate-fade-in">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-400">Exchange Rate (USD to INR)</label>
              <input
                type="number"
                step="any"
                required
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="e.g. 83.50"
                className="w-full glass-input font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Amount converts to: <strong className="text-emerald-400">₹{(parseFloat(amount || 0) * parseFloat(exchangeRate || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Expense Date</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full glass-input text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Paid By</label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full glass-input font-semibold"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SPLIT ENGINE COLUMN */}
        <div className="glass-panel p-6 flex flex-col justify-between h-fit space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Split configuration</h2>
            
            <div className="space-y-1.5 mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Split Method</label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value)}
                className="w-full glass-input text-sm font-bold text-indigo-400"
              >
                <option value="equal">Equally</option>
                <option value="percentage">Percentage Split (%)</option>
                <option value="share">Share Weights (Ratio)</option>
                <option value="unequal">Exact Unequal Amounts</option>
              </select>
            </div>

            {/* Split Members List */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {members.map(m => {
                const s = splits[m.id] || { selected: false, value: '' };
                return (
                  <div key={m.id} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={() => handleToggleMember(m.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                      />
                      <span className={`text-xs font-semibold ${s.selected ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{m.name}</span>
                    </div>

                    {s.selected && splitType !== 'equal' && (
                      <div className="w-24">
                        <input
                          type="number"
                          step="any"
                          required
                          value={s.value}
                          onChange={(e) => handleSplitValueChange(m.id, e.target.value)}
                          placeholder={
                            splitType === 'percentage' 
                              ? '%' 
                              : splitType === 'share' 
                              ? 'shares' 
                              : 'amount'
                          }
                          className="w-full glass-input text-xs py-1 px-2 font-mono text-right"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-4 flex gap-2">
            <Link to={`/groups/${groupId}`} className="flex-1 btn-secondary text-center py-2.5 text-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Expense
            </button>
          </div>
        </div>

      </form>
    </Layout>
  );
};

export default ExpenseForm;
