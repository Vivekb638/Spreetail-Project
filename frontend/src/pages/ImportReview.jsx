import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  UserCheck,
  HelpCircle,
  Copy,
  TrendingUp,
  ChevronRight
} from 'lucide-react';

const ImportReview = () => {
  const { importId } = useParams();
  const navigate = useNavigate();

  const [importMeta, setImportMeta] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolution map: anomalyId -> { decision: string, data: object }
  const [resolutions, setResolutions] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch import metadata and anomalies
      const reportRes = await API.get(`/imports/${importId}/report`);
      setImportMeta(reportRes.data.import);
      setAnomalies(reportRes.data.anomalies);

      // Fetch group members for name mapping dropdowns
      const membersRes = await API.get(`/groups/${reportRes.data.import.group_id}/members`);
      setGroupMembers(membersRes.data);
    } catch (err) {
      setError('Failed to retrieve import anomalies. Make sure the import ID exists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [importId]);

  const handleDecisionChange = (anomalyId, type, decision, data = null) => {
    setResolutions(prev => ({
      ...prev,
      [anomalyId]: { decision, data }
    }));
  };

  const handleApprove = async () => {
    setSubmitting(true);
    setError('');

    // Check if there are unhandled high/critical anomalies
    const unhandledHigh = anomalies.filter(a => 
      (a.severity === 'high' || a.severity === 'critical') && 
      !resolutions[a.id]
    );

    if (unhandledHigh.length > 0) {
      setError('You must select resolutions for all High and Critical anomalies before proceeding.');
      setSubmitting(false);
      window.scrollTo(0, 0);
      return;
    }

    try {
      await API.post(`/imports/${importId}/approve`, { resolutions });
      navigate(`/imports/${importId}/report`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete import process.');
      window.scrollTo(0, 0);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this import? All uploaded rows and flagged anomalies will be discarded.')) return;
    
    setSubmitting(true);
    try {
      await API.post(`/imports/${importId}/reject`);
      navigate(`/groups/${importMeta.group_id}`);
    } catch (err) {
      setError('Failed to reject import.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return <span className="text-[10px] uppercase font-bold bg-rose-500/20 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded-full">Critical</span>;
      case 'high':
        return <span className="text-[10px] uppercase font-bold bg-orange-500/20 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-full">High</span>;
      case 'medium':
        return <span className="text-[10px] uppercase font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 px-2.5 py-0.5 rounded-full">Medium</span>;
      default:
        return <span className="text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">Low</span>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Analyzing anomalies...</p>
        </div>
      </Layout>
    );
  }

  if (error && !importMeta) {
    return (
      <Layout>
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${importMeta?.group_id}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Review Import</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-sans flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
            Interactive Anomaly Review
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            File: <strong className="text-slate-200">{importMeta?.filename}</strong>. Flagged {anomalies.length} potential anomalies.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={submitting}
            className="btn-secondary text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-5"
          >
            <XCircle className="w-4 h-4 inline mr-2" />
            Reject Import
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="btn-success px-6"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 inline mr-2" />
            )}
            Approve & Save
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      {/* ANOMALIES LIST */}
      <div className="space-y-6">
        {anomalies.length === 0 ? (
          <div className="glass-panel p-10 text-center text-slate-400">
            No anomalies found! All rows are clean and valid. Click "Approve & Save" to proceed with importing.
          </div>
        ) : (
          anomalies.map((anom) => {
            const currentRes = resolutions[anom.id] || { decision: '', data: null };
            
            return (
              <div 
                key={anom.id}
                className={`glass-panel p-6 border-l-4 transition-all duration-300 ${
                  currentRes.decision 
                    ? 'border-l-emerald-500 bg-slate-900/20' 
                    : anom.severity === 'critical' || anom.severity === 'high' 
                    ? 'border-l-rose-500 bg-rose-500/5' 
                    : 'border-l-yellow-500 bg-yellow-500/5'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left detail */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Row {anom.row_number}</span>
                      {getSeverityBadge(anom.severity)}
                      <span className="font-extrabold text-slate-200 text-sm">{anom.type}</span>
                      {currentRes.decision && (
                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                          Resolved: {currentRes.decision}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300">{anom.description}</p>
                    <p className="text-xs text-slate-500 leading-normal">
                      <strong className="text-slate-400">Recommendation:</strong> {anom.suggested_action}
                    </p>
                  </div>

                  {/* Right: Actions / Resolutions selectors */}
                  <div className="md:w-72 flex-shrink-0 flex flex-col justify-end gap-3 border-t md:border-t-0 border-slate-800/60 pt-4 md:pt-0">
                    
                    {/* Action decision buttons */}
                    {anom.type === 'Unknown member' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Map User To</label>
                        <select
                          value={currentRes.data?.mappedUserId || ''}
                          onChange={(e) => handleDecisionChange(anom.id, anom.type, 'map_user', { mappedUserId: e.target.value })}
                          className="w-full glass-input text-xs py-1.5"
                        >
                          <option value="">-- Select Member --</option>
                          {groupMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(anom.type === 'Duplicate expenses' || anom.type === 'Near duplicate expenses') && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecisionChange(anom.id, anom.type, 'merge')}
                          className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold border ${
                            currentRes.decision === 'merge' 
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500' 
                              : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          Merge / Skip
                        </button>
                        <button
                          onClick={() => handleDecisionChange(anom.id, anom.type, 'keep_both')}
                          className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold border ${
                            currentRes.decision === 'keep_both' 
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500' 
                              : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          Keep Both
                        </button>
                      </div>
                    )}

                    {anom.type === 'Settlement logged as expense' && (
                      <button
                        onClick={() => handleDecisionChange(anom.id, anom.type, 'map_settlement')}
                        className={`w-full text-xs py-2 px-3 rounded-lg font-semibold border flex items-center justify-center gap-1.5 ${
                          currentRes.decision === 'map_settlement'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Import as Settlement Transaction
                      </button>
                    )}

                    {/* Generic warning resolutions */}
                    {anom.type !== 'Unknown member' && anom.type !== 'Duplicate expenses' && anom.type !== 'Near duplicate expenses' && anom.type !== 'Settlement logged as expense' && (
                      <button
                        onClick={() => handleDecisionChange(anom.id, anom.type, 'ignore_warning')}
                        className={`w-full text-xs py-2 px-3 rounded-lg font-semibold border flex items-center justify-center gap-1.5 ${
                          currentRes.decision === 'ignore_warning'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                            : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Acknowledge & Ignore
                      </button>
                    )}

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex justify-end gap-3 mt-10 border-t border-slate-800/60 pt-6">
        <button
          onClick={handleReject}
          disabled={submitting}
          className="btn-secondary text-rose-400 hover:bg-rose-500/10 px-6 py-2.5"
        >
          Discard Import
        </button>
        <button
          onClick={handleApprove}
          disabled={submitting}
          className="btn-success px-8 py-2.5"
        >
          {submitting ? 'Processing...' : 'Approve & Save'}
        </button>
      </div>
    </Layout>
  );
};

export default ImportReview;
