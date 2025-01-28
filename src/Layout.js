// File: src/Layout.js
import React, { useContext, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { UserContext } from './UserContext';

export default function Layout() {
  const { loggedInUser, setLoggedInUser } = useContext(UserContext);

  // Log the user context each time 'loggedInUser' changes:
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
		  {/* Left: site title */}
		  <Link to="/" className="text-xl font-bold hover:text-gray-200">
			Make The Take
		  </Link>

		  {/* Right: nav links + login status */}
		  <nav className="space-x-4 flex items-center">
			<Link to="/leaderboard" className="hover:text-gray-300">
			  Leaderboard
			</Link>
			<Link to="/test" className="hover:text-gray-300">
			  Poll Demo
			</Link>

			{/* If user is logged in, link to their real profile; otherwise a fallback */}
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

			{/* If logged in, show phone & logout; otherwise show "Not logged in" */}
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
