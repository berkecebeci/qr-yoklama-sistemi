import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import LiveAttendance from './components/LiveAttendance';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

// FR-28: Route Guard — ziyaretçiler yalnızca giriş sayfasını görebilir
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/live/:sessionId" element={<ProtectedRoute><LiveAttendance /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
