import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CodeEditor from './components/CodeEditor';
import Login from './components/Login';
import Register from './components/Register';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/editor" 
              element={
                <ProtectedRoute>
                  <CodeEditor />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/editor" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
