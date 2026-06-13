import React from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { User, Mail, Calendar, Key, ShieldCheck } from 'lucide-react';

const UserProfile = () => {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="flex items-center justify-between gap-6 mb-8 border-b border-slate-800/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-sans flex items-center gap-3">
            <User className="w-8 h-8 text-indigo-400" />
            My Profile
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your credentials and view security credentials.
          </p>
        </div>
      </div>

      <div className="max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PROFILE OVERVIEW */}
        <div className="md:col-span-2 glass-panel p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-800/60 pb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border-2 border-indigo-500/35 flex items-center justify-center font-extrabold text-indigo-400 text-2xl">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name || 'Loading Name...'}</h2>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 mt-1 inline-block">Active Flatmate</span>
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

        {/* SECURITY INFO */}
        <div className="glass-panel p-6 flex flex-col justify-between h-fit space-y-4">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Security Check
            </h3>
            <p className="text-xs text-slate-500 leading-normal">
              Your account utilizes standard JWT session tokens and Bcrypt password hashing.
            </p>
          </div>
          <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span>Session: Secure</span>
            <span className="text-emerald-500">JWT Valid</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;
