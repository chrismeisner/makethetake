// File: src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Import the UserContext and Provider
import { UserProvider } from './UserContext';

// Pages and components
import Layout from './Layout';
import HomePage from './HomePage';
import VerificationWidget from './VerificationWidget';
import TakePage from './TakePage';
import LeaderboardPage from './LeaderboardPage';
import ProfilePage from './ProfilePage';
import PropDetailPage from './PropDetailPage'; 
import LoginPage from './LoginPage'; // <-- NEW: import your simple login page

/**
 * The main App wraps everything in <UserProvider> so any component
 * can access the logged-in user context. We define our routes inside:
 * - Layout-based routes ("/", "/takes/:id", etc.)
 * - Standalone routes ("/widget", "/test", "/login") with or without headers
 */
export default function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Routes that use our Layout (header/nav) */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/takes/:takeID" element={<TakePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile/:profileID" element={<ProfilePage />} />
            <Route path="/props/:propID" element={<PropDetailPage />} />

            {/* NEW: /login route => a simple login page */}
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Routes that skip the Layout (no header) */}
          <Route path="/widget" element={<VerificationWidget />} />
          <Route path="/test" element={<VerificationWidget />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}
