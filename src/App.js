// File: src/App.js

import React from 'react';
import './App.css';

// React Router imports
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Outlet
} from 'react-router-dom';

// Import your main pages:
import TakePage from './TakePage';
import LeaderboardPage from './LeaderboardPage';
import ProfilePage from './ProfilePage';

// Import the extracted VerificationWidget
import VerificationWidget from './VerificationWidget';

// --------------------------------------
// Layout component: universal header + <Outlet />
// --------------------------------------
function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left: brand / site title */}
          <Link to="/" className="text-xl font-bold hover:text-gray-200">
            Make The Take
          </Link>

          {/* Right: simple nav links */}
          <nav className="space-x-4">
            <Link to="/leaderboard" className="hover:text-gray-300">
              Leaderboard
            </Link>
            {/* Example profile link with a placeholder ID */}
            <Link to="/profile/exampleProfileID" className="hover:text-gray-300">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* This is where child routes are rendered */}
        <Outlet />
      </main>
    </div>
  );
}

// --------------------------------------
// The top-level App: sets up Router, Routes, Layout
// --------------------------------------
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Wrap multiple routes under Layout to get the universal header & nav */}
        <Route element={<Layout />}>
          {/* Home route: show the polling widget */}
          <Route path="/" element={<VerificationWidget />} />

          {/* Takes Detail Page */}
          <Route path="/takes/:takeID" element={<TakePage />} />

          {/* Leaderboard */}
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          {/* User Profiles */}
          <Route path="/profile/:profileID" element={<ProfilePage />} />
        </Route>
      </Routes>
    </Router>
  );
}
