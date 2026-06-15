import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import API from '../services/api';
import { User, Mail, Calendar, Edit2, Check, X, Loader2 } from 'lucide-react';

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await API.put('/auth/profile', { name: newName });
      updateUser(res.data.user);
      setSuccess('Name updated successfully!');
      setIsEditing(false);
      
      // Auto clear success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile name.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNewName(user?.name || '');
    setIsEditing(false);
    setError('');
  };

  return (
    <Layout>
      <div className="flex items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 font-sans flex items-center gap-3">
            <User className="w-8 h-8 text-slate-100" />
            My Profile
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your personal credentials and flatmate details.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3 max-w-xl">
          <X className="w-5 h-5 flex-shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-3 max-w-xl">
          <Check className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          {success}
        </div>
      )}

      <div className="max-w-xl grid grid-cols-1 gap-6">
        {/* PROFILE OVERVIEW */}
        <div className="glass-panel p-8 space-y-6">
          <div className="flex items-center gap-5 border-b border-slate-800/60 pb-6">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-extrabold text-slate-100 text-2xl shadow-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            
            <div className="flex-grow">
              {isEditing ? (
                <form onSubmit={handleSave} className="flex items-center gap-2 max-w-md mt-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    className="glass-input text-sm py-1.5 px-3 flex-grow focus:border-slate-500"
                    placeholder="Enter your name"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-colors"
                    title="Save"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="p-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-100">{user?.name || 'Loading Name...'}</h2>
                  <button
                    onClick={() => {
                      setNewName(user?.name || '');
                      setIsEditing(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-700"
                    title="Edit Name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 mt-2 inline-block">Active Flatmate</span>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-600" />
                Email Address
              </span>
              <span className="text-slate-200 font-medium">{user?.email || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                Joined Since
              </span>
              <span className="text-slate-200 font-medium">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;

