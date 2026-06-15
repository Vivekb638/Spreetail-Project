import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  Users, 
  Plus, 
  FolderOpen, 
  Loader2, 
  AlertCircle,
  FileText,
  FileSpreadsheet
} from 'lucide-react';

const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Group creation modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await API.get('/groups');
      setGroups(res.data);
    } catch (err) {
      setError('Failed to fetch groups. Verify your database connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return;

    setCreating(true);
    try {
      const res = await API.post('/groups', { name: groupName, description: groupDesc });
      setGroups([res.data, ...groups]);
      setIsModalOpen(false);
      setGroupName('');
      setGroupDesc('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 font-sans">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Manage, import, and split flat expenses cleanly.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm">Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-panel p-12 text-center flex flex-col items-center max-w-xl mx-auto mt-6">
          <Users className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-200">No Groups Found</h3>
          <p className="text-sm text-slate-400 mt-2 mb-6">
            Get started by creating a group for your apartment mates, trips, or other sharing occasions.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => navigate(`/groups/${group.id}`)}
              className="glass-card p-6 flex flex-col justify-between cursor-pointer group active:scale-98"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200 group-hover:bg-slate-700 transition-all duration-300 mb-4">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-200 group-hover:text-slate-100 transition-colors">
                  {group.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1 line-clamp-2 h-10">
                  {group.description || 'No description provided.'}
                </p>
              </div>
              <div className="mt-6 border-t border-slate-800/60 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {group.active_member_count || 1} members active
                  </span>
                  <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/groups/${group.id}/import`);
                  }}
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-8 animate-fade-in relative">
            <h3 className="text-xl font-bold text-slate-100 mb-6">Create New Group</h3>
            
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Flat 4B, Goa Trip"
                  className="w-full glass-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full glass-input h-24 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary px-4 py-2 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
