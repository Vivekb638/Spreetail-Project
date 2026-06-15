import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import Layout from '../components/Layout';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  AlertCircle,
  Calendar,
  ChevronRight,
  UserPlus
} from 'lucide-react';

const Members = () => {
  const { id: groupId } = useParams();
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Member add state
  const [email, setEmail] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingMember, setEditingMember] = useState(null);
  const [editJoinedAt, setEditJoinedAt] = useState('');
  const [editLeftAt, setEditLeftAt] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await API.get(`/groups/${groupId}/members`);
      setMembers(res.data);
    } catch (err) {
      setError('Failed to fetch members list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!email) return;

    setAdding(true);
    setError('');
    try {
      await API.post(`/groups/${groupId}/members`, {
        email: email.trim(),
        joinedAt: joinedAt ? new Date(joinedAt).toISOString() : undefined
      });
      setEmail('');
      setJoinedAt('');
      await fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member. Make sure they are a registered user.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (membershipId) => {
    if (!window.confirm("Removing a member will record their leaving date as today, preventing them from splitting future expenses while keeping historical splits. Proceed?")) return;

    try {
      await API.delete(`/groups/${groupId}/members/${membershipId}`);
      await fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  const handleOpenEdit = (m) => {
    setEditingMember(m);
    setEditJoinedAt(m.joined_at ? new Date(m.joined_at).toISOString().split('T')[0] : '');
    setEditLeftAt(m.left_at ? new Date(m.left_at).toISOString().split('T')[0] : '');
  };

  const handleUpdateTimeline = async (e) => {
    e.preventDefault();
    if (!editingMember) return;

    setUpdating(true);
    try {
      await API.put(`/groups/${groupId}/members/${editingMember.membership_id}`, {
        joinedAt: editJoinedAt ? new Date(editJoinedAt).toISOString() : undefined,
        leftAt: editLeftAt ? new Date(editLeftAt).toISOString() : null
      });
      setEditingMember(null);
      await fetchMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update membership timeline.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">
        <Link to="/" className="hover:underline">Groups</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/groups/${groupId}`} className="hover:underline">Group Details</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>Members</span>
      </div>

      <h1 className="text-3xl font-extrabold text-slate-100 mb-8 font-sans flex items-center gap-3">
        <Users className="w-8 h-8 text-indigo-400" />
        Members & Historical Timelines
      </h1>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ADD MEMBER COLUMN */}
        <div className="glass-panel p-6 h-fit">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Add Group Member
          </h2>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">User Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="flatmate@example.com"
                className="w-full glass-input text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Join Date (Historical)</label>
              <input
                type="date"
                value={joinedAt}
                onChange={(e) => setJoinedAt(e.target.value)}
                className="w-full glass-input text-sm"
              />
              <p className="text-[10px] text-slate-500 leading-normal">
                Leave blank for current time. Setting a date helps validate historical expenses.
              </p>
            </div>

            <button
              type="submit"
              disabled={adding}
              className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Member
            </button>
          </form>
        </div>

        {/* LIST MEMBERS COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Membership List ({members.length})</h2>

            {loading ? (
              <div className="flex justify-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-center py-6 text-slate-500 text-sm">No members registered in this group.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Timeline Period</th>
                      <th>Status</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const isPast = m.left_at && new Date(m.left_at) < new Date();
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="font-bold text-slate-200">{m.name}</div>
                          </td>
                          <td className="text-slate-400 text-xs truncate max-w-[120px]">{m.email}</td>
                          <td className="text-slate-300 text-xs">
                            <div>Joined: {new Date(m.joined_at).toLocaleDateString()}</div>
                            {m.left_at && (
                              <div className="text-rose-400">Left: {new Date(m.left_at).toLocaleDateString()}</div>
                            )}
                          </td>
                          <td>
                            {isPast ? (
                              <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-md">Past</span>
                            ) : (
                              <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md">Active</span>
                            )}
                          </td>
                          <td>
                            <div className="flex justify-center gap-3">
                              <button
                                onClick={() => handleOpenEdit(m)}
                                className="text-slate-400 hover:text-indigo-400 p-1"
                                title="Edit membership dates"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {!isPast && (
                                <button
                                  onClick={() => handleRemoveMember(m.membership_id)}
                                  className="text-slate-400 hover:text-rose-400 p-1"
                                  title="End membership"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT TIMELINE MODAL */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-8 animate-fade-in">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Edit Membership Timeline</h3>
            <p className="text-slate-400 text-xs mb-6">User: {editingMember.name} ({editingMember.email})</p>

            <form onSubmit={handleUpdateTimeline} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Joined Date</label>
                <input
                  type="date"
                  required
                  value={editJoinedAt}
                  onChange={(e) => setEditJoinedAt(e.target.value)}
                  className="w-full glass-input text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Left Date (Optional)</label>
                <input
                  type="date"
                  value={editLeftAt}
                  onChange={(e) => setEditLeftAt(e.target.value)}
                  className="w-full glass-input text-sm"
                />
                <p className="text-[10px] text-slate-500 leading-normal">
                  Leave empty if the user is still active in the flat.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary px-4 py-2 flex items-center gap-2"
                >
                  {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Members;
