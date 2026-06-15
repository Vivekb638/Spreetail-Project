import React, { useState, useEffect } from 'react';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  ShieldAlert, 
  Loader2, 
  AlertCircle,
  Database,
  History
} from 'lucide-react';

const AdminPanel = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      
      // We will implement GET /admin/audit-logs on the backend
      const res = await API.get('/admin/audit-logs');
      setLogs(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch database audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-sans flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            System Administration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Database audit trails, history trackers, and entity change logs.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      {/* AUDIT TRAIL PANEL */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          Global Audit Trail Log ({logs.length})
        </h2>

        {loading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-slate-500 text-center py-6 text-sm">No audit logs recorded in the system.</p>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Performed By</th>
                  <th>Action Type</th>
                  <th>Entity Type</th>
                  <th>Previous State</th>
                  <th>New State</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap font-medium text-slate-400 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="text-slate-300 font-semibold text-xs">{log.user_name || 'System / Seed'}</td>
                    <td>
                      <span className="text-[10px] font-extrabold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="capitalize text-slate-400 text-xs font-semibold">{log.entity_type}</td>
                    <td className="text-slate-500 text-[10px] font-mono max-w-[200px] truncate">
                      {log.old_values ? JSON.stringify(log.old_values) : 'N/A'}
                    </td>
                    <td className="text-slate-400 text-[10px] font-mono max-w-[200px] truncate">
                      {log.new_values ? JSON.stringify(log.new_values) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPanel;
