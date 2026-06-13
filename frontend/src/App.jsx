import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Import Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import Members from './pages/Members';
import ImportCSV from './pages/ImportCSV';
import ImportReview from './pages/ImportReview';
import ImportReport from './pages/ImportReport';
import BalanceSummary from './pages/BalanceSummary';
import ExpenseForm from './pages/ExpenseForm';
import ExpenseDetail from './pages/ExpenseDetail';
import Settlements from './pages/Settlements';
import UserProfile from './pages/UserProfile';
import AdminPanel from './pages/AdminPanel';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-sm font-medium">Validating credentials...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Main Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } />

          {/* Groups & Members */}
          <Route path="/groups/:id" element={
            <ProtectedRoute>
              <GroupDetails />
            </ProtectedRoute>
          } />
          
          <Route path="/groups/:id/members" element={
            <ProtectedRoute>
              <Members />
            </ProtectedRoute>
          } />

          {/* Expenses */}
          <Route path="/groups/:id/expenses/new" element={
            <ProtectedRoute>
              <ExpenseForm />
            </ProtectedRoute>
          } />
          
          <Route path="/expenses/:expenseId/edit" element={
            <ProtectedRoute>
              <ExpenseForm />
            </ProtectedRoute>
          } />

          <Route path="/expenses/:expenseId" element={
            <ProtectedRoute>
              <ExpenseDetail />
            </ProtectedRoute>
          } />

          {/* Settlements */}
          <Route path="/groups/:id/settlements/new" element={
            <ProtectedRoute>
              <Settlements />
            </ProtectedRoute>
          } />

          {/* Balance Engine */}
          <Route path="/groups/:id/balances" element={
            <ProtectedRoute>
              <BalanceSummary />
            </ProtectedRoute>
          } />

          {/* Importer Pipeline */}
          <Route path="/groups/:id/import" element={
            <ProtectedRoute>
              <ImportCSV />
            </ProtectedRoute>
          } />

          <Route path="/imports/:importId/review" element={
            <ProtectedRoute>
              <ImportReview />
            </ProtectedRoute>
          } />

          <Route path="/imports/:importId/report" element={
            <ProtectedRoute>
              <ImportReport />
            </ProtectedRoute>
          } />

          {/* Fallback to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
