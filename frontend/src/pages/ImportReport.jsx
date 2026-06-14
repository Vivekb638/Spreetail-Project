import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  FileCheck, 
  Download, 
  Loader2, 
  AlertCircle,
  FileText,
  FileCode,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

const ImportReport = () => {
  const { importId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await API.get(`/imports/${importId}/report`);
      setReport(res.data);
    } catch (err) {
      setError('Failed to fetch import report details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [importId]);

  const handleDownload = (format) => {
    const token = localStorage.getItem('accessToken');
    const apiUrl = API.defaults.baseURL || 'http://localhost:5000';
    // Open in a new tab with access token as a query parameter or download directly using fetch.
    // Fetch is safer because it passes authorization header natively!
    fetch(`${apiUrl}/imports/${importId}/report/export?format=${format}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) throw new Error('Download failed');
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-report-${importId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      alert('Failed to download report.');
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Retrieving report details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      </Layout>
    );
  }

  const { import: meta, anomalies } = report;

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${meta.group_id}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Import Report</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-sans flex items-center gap-3">
            <FileCheck className="w-8 h-8 text-emerald-500" />
            CSV Import Validation Report
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Summary of resolved spreadsheet anomalies and final database insertions.
          </p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleDownload('pdf')}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            Export PDF Report
          </button>
          <button
            onClick={() => handleDownload('json')}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <FileCode className="w-4 h-4 text-amber-500" />
            Export JSON Report
          </button>
          <Link to={`/groups/${meta.group_id}`} className="btn-primary flex items-center gap-2 text-xs">
            Finish
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* STATS SUMMARY CARD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="glass-panel p-5 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Rows</span>
          <span className="text-2xl font-extrabold text-white">{meta.total_rows}</span>
        </div>
        <div className="glass-panel p-5 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Imported Rows</span>
          <span className="text-2xl font-extrabold text-emerald-400">{meta.imported_rows}</span>
        </div>
        <div className="glass-panel p-5 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Valid Rows</span>
          <span className="text-2xl font-extrabold text-slate-300">{meta.valid_rows}</span>
        </div>
        <div className="glass-panel p-5 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Flagged Rows</span>
          <span className="text-2xl font-extrabold text-yellow-500">{meta.flagged_rows}</span>
        </div>
        <div className="glass-panel p-5 text-center col-span-2 md:col-span-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Status</span>
          <span className="text-sm font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 inline-block uppercase">
            {meta.status}
          </span>
        </div>
      </div>

      {/* ANOMALIES TABLE SUMMARY */}
      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white mb-6">Resolution Log ({anomalies.length})</h2>

        {anomalies.length === 0 ? (
          <p className="text-slate-400 text-center py-6">All rows were valid. No anomalies were encountered.</p>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Issue Type</th>
                  <th>Description</th>
                  <th>Resolution Applied</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => (
                  <tr key={a.id}>
                    <td className="font-bold text-slate-400">Row {a.row_number}</td>
                    <td className="font-semibold text-slate-200 text-xs">{a.type}</td>
                    <td className="text-slate-300 text-xs">{a.description}</td>
                    <td className="font-semibold text-emerald-400 text-xs">
                      {a.decision ? a.decision.toUpperCase().replace(/_/g, ' ') : 'AUTO RESOLVED'}
                    </td>
                    <td>
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md">
                        {a.status}
                      </span>
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

export default ImportReport;
