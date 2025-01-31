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

		// Sort the user's takes by createdTime desc (most recent first)
		const sortedTakes = (data.userTakes || []).sort((a, b) => {
		  const dateA = new Date(a.createdTime);
		  const dateB = new Date(b.createdTime);
		  return dateB - dateA; // descending
		});

		setUserTakes(sortedTakes);
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

	  {/* Only show the logout button if this profile belongs to the logged-in user */}
	  {loggedInUser?.profileID === profileID && (
		<button
		  onClick={handleLogout}
		  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
		>
		  Logout
		</button>
	  )}

	  {/* Display the user's Takes (sorted by date desc) */}
	  <div className="mt-6">
		<h3 className="text-xl font-semibold">User's Takes</h3>
		{userTakes.length === 0 ? (
		  <p className="text-gray-600">No Takes yet.</p>
		) : (
		  <div className="mt-2 space-y-4">
			{userTakes.map((take) => (
			  <div
				key={take.airtableRecordId}
				className="border p-2 rounded flex items-center gap-4"
			  >
				{take.contentImageUrl ? (
				  <img
					src={take.contentImageUrl}
					alt="Take content"
					style={{ width: '50px', height: '50px', objectFit: 'cover' }}
					className="rounded"
				  />
				) : (
				  <div
					style={{
					  width: 50,
					  height: 50,
					  backgroundColor: '#eee',
					  display: 'flex',
					  alignItems: 'center',
					  justifyContent: 'center',
					  borderRadius: 4,
					  color: '#999',
					}}
				  >
					No Img
				  </div>
				)}

				<div>
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
					<strong>Prop Title:</strong>{' '}
					{take.propTitle ? (
					  <Link to={`/props/${take.propID}`}>{take.propTitle}</Link>
					) : (
					  '(No Title)'
					)}
				  </p>
				  <p>
					<strong>Side:</strong> {take.sideLabel || take.propSide}
				  </p>
				  <p>
					<strong>Popularity:</strong> {take.takePopularity}%
				  </p>
				  <p>
					<strong>Created Time:</strong> {take.createdTime}
				  </p>
				</div>
			  </div>
			))}
		  </div>
		)}
	  </div>
	</div>
  );
}
