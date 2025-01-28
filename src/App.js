// File: src/App.js
import React from 'react';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Outlet
} from 'react-router-dom';

import HomePage from './HomePage';
import VerificationWidget from './VerificationWidget';
import TakePage from './TakePage';
import LeaderboardPage from './LeaderboardPage';
import ProfilePage from './ProfilePage';

function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header/Nav */}
      <header className="bg-gray-800 text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold hover:text-gray-200">
            Make The Take
          </Link>
          <nav className="space-x-4">
            <Link to="/leaderboard" className="hover:text-gray-300">
              Leaderboard
            </Link>
            <Link to="/profile/exampleProfileID" className="hover:text-gray-300">
              Profile
            </Link>
            {/* Link to /widget (or /test) for poll demo */}
            <Link to="/test" className="hover:text-gray-300">
              Poll Demo
            </Link>
          </nav>
        </div>
      </header>
      {/* Main content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Regular routes use the Layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/takes/:takeID" element={<TakePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile/:profileID" element={<ProfilePage />} />
        </Route>

        {/* Routes outside the Layout (no nav/header) */}
        <Route path="/widget" element={<VerificationWidget />} />
        <Route path="/test" element={<VerificationWidget />} />
      </Routes>
    </Router>
  );
}
