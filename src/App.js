// File: src/App.js

import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Outlet } from 'react-router-dom';
import './App.css';

// Import the UserContext and Provider
import { UserProvider, UserContext } from './UserContext';

// Pages and components
import HomePage from './HomePage';
import VerificationWidget from './VerificationWidget';
import TakePage from './TakePage';
import LeaderboardPage from './LeaderboardPage';
import ProfilePage from './ProfilePage';
import PropDetailPage from './PropDetailPage'; // <-- The new page

/**
 * This Layout component is now context-aware:
 * - Logs the current user on each render
 * - Shows "Logged in as ..." if user is present
 * - Provides a "Logout" button
 */
function Layout() {
  const { loggedInUser, setLoggedInUser } = useContext(UserContext);

  // Whenever loggedInUser changes, log it
  useEffect(() => {
    console.log('[Layout] loggedInUser =>', loggedInUser);
  }, [loggedInUser]);

  function handleLogout() {
    fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLoggedInUser(null);
        }
      })
      .catch((err) => console.error('[Layout] Logout error:', err));
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header/Nav */}
      <header className="bg-gray-800 text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left side: site title */}
          <Link to="/" className="text-xl font-bold hover:text-gray-200">
            Make The Take
          </Link>

          {/* Right side: nav links + user login status */}
          <nav className="space-x-4 flex items-center">
            <Link to="/leaderboard" className="hover:text-gray-300">
              Leaderboard
            </Link>
            <Link to="/test" className="hover:text-gray-300">
              Poll Demo
            </Link>

            {/* If user is logged in, link to their real profile; otherwise fallback */}
            {loggedInUser ? (
              <Link
                to={`/profile/${loggedInUser.profileID}`}
                className="hover:text-gray-300"
              >
                My Profile
              </Link>
            ) : (
              <Link to="/profile/exampleProfileID" className="hover:text-gray-300">
                Profile
              </Link>
            )}

            {/* Show "Logged in as ..."/Logout or "Not logged in" */}
            {loggedInUser ? (
              <div className="flex items-center space-x-2">
                <span>Logged in as {loggedInUser.phone}</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                >
                  Logout
                </button>
              </div>
            ) : (
              <span>Not logged in</span>
            )}
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

/**
 * The main App wraps everything in <UserProvider> so any component
 * can access the logged-in user context. We define our routes inside:
 * - Layout-based routes ("/", "/takes/:id", etc.)
 * - Standalone routes ("/widget", "/test") with no header
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

            {/* NEW: prop detail page route */}
            <Route path="/props/:propID" element={<PropDetailPage />} />
          </Route>

          {/* Routes that skip the Layout (no header) */}
          <Route path="/widget" element={<VerificationWidget />} />
          <Route path="/test" element={<VerificationWidget />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}
