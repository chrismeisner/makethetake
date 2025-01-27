// File: src/Layout.js
import React from 'react';
import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
	<div className="min-h-screen flex flex-col">
	  {/* Header */}
	  <header className="bg-gray-800 text-white">
		<div className="container mx-auto px-4 py-4 flex items-center justify-between">
		  {/* Left side: a brand or site title */}
		  <Link to="/" className="text-xl font-bold hover:text-gray-200">
			Make The Take
		  </Link>

		  {/* Right side: basic nav links */}
		  <nav className="space-x-4">
			<Link
			  to="/leaderboard"
			  className="hover:text-gray-300"
			>
			  Leaderboard
			</Link>

			{/* Example of a "Profile" link: 
				You might pass a real profileID or route param if known */}
			<Link
			  to="/profile/demo123"
			  className="hover:text-gray-300"
			>
			  Profile
			</Link>
		  </nav>
		</div>
	  </header>

	  {/* Main content area: an Outlet for child routes */}
	  <main className="flex-grow container mx-auto px-4 py-6">
		<Outlet />
	  </main>
	</div>
  );
}
