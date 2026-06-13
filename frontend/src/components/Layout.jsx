import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  User, 
  LogOut, 
  Wallet,
  Sun,
  Moon,
  History,
  FileSpreadsheet
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize theme state from localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Keep HTML class in sync with theme state
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Extract groupId from path if present (e.g., /groups/:groupId)
  const groupMatch = location.pathname.match(/^\/groups\/([a-f0-9-]+)/i);
  const currentGroupId = groupMatch ? groupMatch[1] : null;

  // Main navigation items (Admin panel mapped as History, Groups merged into Dashboard)
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { 
      name: 'Import CSV', 
      path: currentGroupId ? `/groups/${currentGroupId}/import` : '/import', 
      icon: FileSpreadsheet,
      isActive: location.pathname === '/import' || location.pathname.includes('/import')
    },
    { name: 'History', path: '/admin', icon: History },
    { name: 'Profile', path: '/profile', icon: User }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 transition-colors duration-200">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Left Side: Logo & Main Navigation */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 shadow-sm">
                <Wallet className="w-4 h-4 text-slate-100" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-sm tracking-tight text-slate-100">SplitWise</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Pro</span>
              </div>
            </Link>

            {/* Horizontal Nav Links */}
            <nav className="hidden sm:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.isActive !== undefined 
                  ? item.isActive 
                  : (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)));
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 border ${
                      isActive 
                        ? 'bg-slate-800 text-slate-100 border-slate-700/80' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Side: Theme Toggle & User Menu */}
          <div className="flex items-center gap-4">
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all duration-150"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* User Pill & Logout */}
            {user && (
              <div className="flex items-center gap-3 border-l border-slate-800/80 pl-4">
                <Link to="/profile" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</p>
                    <p className="text-[9px] text-slate-500 leading-none">{user.email}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center font-bold text-slate-100 border border-slate-800 text-xs">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Mobile Navigation Bar */}
        <div className="sm:hidden border-t border-slate-800/60 bg-slate-900/30">
          <div className="flex items-center justify-around py-1.5 px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.isActive !== undefined 
                ? item.isActive 
                : (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-all duration-150 ${
                    isActive 
                      ? 'text-slate-100 font-semibold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

