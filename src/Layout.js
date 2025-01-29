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
			  <Link
				to={`/profile/${loggedInUser.profileID}`}
				className="hover:text-gray-300"
			  >
				{loggedInUser.phone}
			  </Link>
			) : (
			  // If user is NOT logged in => show "Log in"
			  <Link to="/login" className="hover:text-gray-300">
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
