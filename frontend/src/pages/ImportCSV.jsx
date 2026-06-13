import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  FileSpreadsheet, 
  Upload, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Info
} from 'lucide-react';

const ImportCSV = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select a valid CSV file.');
        setFile(null);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target.result;
      
      try {
        const res = await API.post('/imports/csv', {
          csvData,
          filename: file.name,
          group_id: groupId
        });
        
        const importId = res.data.import.id;
        navigate(`/imports/${importId}/review`);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to upload and analyze CSV file.');
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file.');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${groupId}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Import CSV</span>
      </div>

      <h1 className="text-3xl font-extrabold text-white mb-8 font-sans flex items-center gap-3">
        <FileSpreadsheet className="w-8 h-8 text-amber-500" />
        Import Expenses Export CSV
      </h1>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* UPLOAD FORM COLUMN */}
        <div className="lg:col-span-2 glass-panel p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            
            {/* File Dropzone */}
            <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/40 rounded-2xl p-10 flex flex-col items-center justify-center transition-all bg-slate-900/10 cursor-pointer relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-12 h-12 text-slate-500 mb-4" />
              
              {file ? (
                <div className="text-center">
                  <p className="font-bold text-slate-200 text-lg">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-bold text-slate-300 text-lg">Choose a CSV file or drag it here</p>
                  <p className="text-xs text-slate-500 mt-1">Select the spreadsheet export (CSV format)</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Link to={`/groups/${groupId}`} className="btn-secondary px-6 py-2.5">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !file}
                className="btn-primary px-8 py-2.5 flex items-center gap-2 shadow-indigo-600/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing CSV...
                  </>
                ) : (
                  'Upload & Analyze'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* INFO COLUMN */}
        <div className="glass-panel p-6 h-fit space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-400" />
            Import Guidelines
          </h3>
          <div className="text-xs text-slate-400 space-y-3 leading-relaxed">
            <p>
              Our import wizard scans the uploaded spreadsheet against <strong>15 required anomaly checks</strong>, including:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-500">
              <li>Duplicates & Near Duplicates</li>
              <li>Missing Payer or Split List</li>
              <li>Split Mismatch (Sum != 100% or amount)</li>
              <li>Unknown Members</li>
              <li>Settlements logged as Expenses</li>
              <li>Timeline mismatches (before joining / after leaving)</li>
            </ul>
            <p>
              Once analyzed, you will review a report and resolve warnings before completing the database import.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ImportCSV;
