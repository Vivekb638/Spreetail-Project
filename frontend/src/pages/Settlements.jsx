import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  HandCoins, 
  Loader2, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';

const Settlements = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [payerId, setPayerId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const fetchGroupMembers = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get(`/groups/${groupId}/members`);
        setMembers(res.data);
        if (res.data.length > 1) {
          setPayerId(res.data[0].id);
          setReceiverId(res.data[1].id);
        }
      } catch (err) {
        setError('Failed to fetch members list.');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupMembers();
  }, [groupId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!payerId || !receiverId || !amount || !settlementDate) {
      setError('Please fill in all required fields.');
      return;
    }

    if (payerId === receiverId) {
      setError('Payer and receiver cannot be the same person.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      group_id: groupId,
      payer_id: payerId,
      receiver_id: receiverId,
      amount: parseFloat(amount),
      currency,
      exchange_rate: currency === 'USD' ? parseFloat(exchangeRate) : 1,
      settlement_date: new Date(settlementDate).toISOString(),
      note: note.trim()
    };

    try {
      await API.post('/settlements', payload);
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record settlement.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading members list...</p>
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
        <span>Record Settlement</span>
      </div>

      <h1 className="text-3xl font-extrabold text-white mb-8 font-sans flex items-center gap-3">
        <HandCoins className="w-8 h-8 text-emerald-400" />
        Record Settlement Payment
      </h1>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      <div className="max-w-2xl glass-panel p-8 mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-rose-400">Payer (Who Paid)</label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full glass-input font-semibold text-rose-300"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">Receiver (Who Received)</label>
              <select
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                className="w-full glass-input font-semibold text-emerald-300"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Amount Sent</label>
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
                Converted value: <strong className="text-emerald-400">₹{(parseFloat(amount || 0) * parseFloat(exchangeRate || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Settlement Date</label>
              <input
                type="date"
                required
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                className="w-full glass-input text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Short Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Settle rent split, dinner reimbursement"
                className="w-full glass-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60 mt-6">
            <Link to={`/groups/${groupId}`} className="btn-secondary px-6 py-2.5">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-success px-8 py-2.5 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settlement
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default Settlements;
