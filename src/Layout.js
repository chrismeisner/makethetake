// File: src/Layout.js

import React, { useContext, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { UserContext } from './UserContext';

export default function Layout() {
  const { loggedInUser } = useContext(UserContext);
  const location = useLocation();

  // Log the user context each time 'loggedInUser' changes
  useEffect(() => {
	console.log('[Layout] loggedInUser =>', loggedInUser);
  }, [loggedInUser]);

  // If the user is NOT logged in, we append ?redirect=[current path]
  // e.g. if current path is "/props/abc", then link becomes "/login?redirect=/props/abc"
  const redirectPath = encodeURIComponent(location.pathname + location.search);
  // ^ also includes the current query parameters if any

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
			{/* Poll Demo link removed, but route still exists if needed */}

			{loggedInUser ? (
			  // If user IS logged in => link to their profile using phone number
			  <Link to={`/profile/${loggedInUser.profileID}`} className="hover:text-gray-300">
				{loggedInUser.phone}
			  </Link>
			) : (
			  // If user is NOT logged in => show "Log in" with ?redirect=
			  <Link
				to={`/login?redirect=${redirectPath}`}
				className="hover:text-gray-300"
			  >
				Log in
			  </Link>
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
