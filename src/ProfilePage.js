// File: src/ProfilePage.js

import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { UserContext } from './UserContext';

export default function ProfilePage() {
  const { profileID } = useParams();
  const navigate = useNavigate();
  const { loggedInUser, setLoggedInUser } = useContext(UserContext);

  const [profile, setProfile] = useState(null);
  const [totalTakes, setTotalTakes] = useState(0);
  const [userTakes, setUserTakes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
	console.log(`[ProfilePage] Fetching profile for ID="${profileID}"...`);
	fetch(`/api/profile/${encodeURIComponent(profileID)}`)
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Unknown error loading profile');
		  return;
		}
		setProfile(data.profile);
		setTotalTakes(data.totalTakes);
		setUserTakes(data.userTakes || []);
	  })
	  .catch((err) => {
		console.error('[ProfilePage] Error:', err);
		setError('Could not fetch profile');
	  });
  }, [profileID]);

  function handleLogout() {
	fetch('/api/logout', {
	  method: 'POST',
	  credentials: 'include'
	})
	  .then((res) => res.json())
	  .then((data) => {
		if (data.success) {
		  setLoggedInUser(null);
		  navigate('/'); // or navigate('/login') if you prefer
		} else {
		  setError('Logout failed. Please try again.');
		}
	  })
	  .catch((err) => {
		console.error('[ProfilePage] Logout error:', err);
		setError('Logout error. Please try again.');
	  });
  }

  if (error) {
	return (
	  <div className="p-4 text-red-600">
		<h2 className="text-xl font-bold mb-2">Profile Error</h2>
		<p>{error}</p>
	  </div>
	);
  }

  if (!profile) {
	return <div className="p-4">Loading profile...</div>;
  }

  return (
	<div className="p-4">
	  <h2 className="text-2xl font-bold mb-4">User Profile</h2>

	  <div className="space-y-2 mb-6">
		<p>
		  <span className="font-semibold">Profile ID:</span> {profile.profileID}
		</p>
		<p>
		  <span className="font-semibold">Mobile (E.164):</span> {profile.profileMobile}
		</p>
		<p>
		  <span className="font-semibold">Username:</span>{' '}
		  {profile.profileUsername ? profile.profileUsername : '(none)'}
		</p>
		<p>
		  <span className="font-semibold">Total Takes:</span> {totalTakes}
		</p>
		<p>
		  <span className="font-semibold">Created:</span> {profile.createdTime}
		</p>
	  </div>

	  {/* Logout button here (only if user is indeed the owner, or just always) */}
	  {loggedInUser?.profileID === profileID && (
		<button
		  onClick={handleLogout}
		  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
		>
		  Logout
		</button>
	  )}

	  {/* Display the user's Takes */}
	  <div className="mt-6">
		<h3 className="text-xl font-semibold">User's Takes</h3>
		{userTakes.length === 0 ? (
		  <p className="text-gray-600">No Takes yet.</p>
		) : (
		  <div className="mt-2 space-y-4">
			{userTakes.map((take) => (
			  <div key={take.airtableRecordId} className="border p-2 rounded">
				<p>
				  <strong>Take Record:</strong>{' '}
				  {take.takeID ? (
					<Link to={`/takes/${take.takeID}`}>
					  {take.airtableRecordId}
					</Link>
				  ) : (
					<span>{take.airtableRecordId}</span>
				  )}
				</p>
				<p>
				  <strong>Prop ID:</strong> {take.propID}
				</p>
				<p>
				  <strong>Prop Side:</strong> {take.propSide}
				</p>
				<p>
				  <strong>Popularity:</strong> {take.takePopularity}%
				</p>
				<p>
				  <strong>Created Time:</strong> {take.createdTime}
				</p>
			  </div>
			))}
		  </div>
		)}
	  </div>
	</div>
  );
}
