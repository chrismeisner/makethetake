// File: /Users/chrismeisner/Projects/make-the-take/src/ProfilePage.js

import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function ProfilePage() {
  const { profileID } = useParams();

  const [profile, setProfile] = React.useState(null);
  const [totalTakes, setTotalTakes] = React.useState(0);
  const [userTakes, setUserTakes] = React.useState([]); // <-- Stores User's Takes
  const [error, setError] = React.useState('');

  React.useEffect(() => {
	console.log(`[ProfilePage] Fetching profile data for profileID="${profileID}"...`);

	fetch(`/api/profile/${encodeURIComponent(profileID)}`)
	  .then((res) => res.json())
	  .then((data) => {
		console.log(`[ProfilePage] API response for profileID="${profileID}":`, data);

		if (!data.success) {
		  setError(data.error || 'Unknown error loading profile');
		  return;
		}

		// Logging profile and takes data
		console.log('[ProfilePage] Profile loaded:', data.profile);
		console.log('[ProfilePage] Total Takes:', data.totalTakes);
		console.log('[ProfilePage] User Takes:', data.userTakes);

		setProfile(data.profile);       // Store profile details
		setTotalTakes(data.totalTakes); // Store the total takes count
		setUserTakes(data.userTakes || []); // Store User's Takes
		
		// Add a direct console log to confirm userTakes is being set:
		console.log(`[ProfilePage] userTakes array just set for profileID="${profileID}":`, data.userTakes);
	  })
	  .catch((err) => {
		console.error('[ProfilePage] Fetch error:', err);
		setError('Could not fetch profile. Please try again later.');
	  });
  }, [profileID]);

  if (error) {
	return (
	  <div className="p-4 text-red-600">
		<h2 className="text-xl font-bold mb-2">Profile Error</h2>
		<p>{error}</p>
	  </div>
	);
  }

  if (!profile) {
	return (
	  <div className="p-4">
		<h2 className="text-xl font-semibold">Loading profile...</h2>
	  </div>
	);
  }

  return (
	<div className="p-4">
	  <h2 className="text-2xl font-bold mb-4">User Profile</h2>

	  <div className="space-y-2">
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

	  {/* Display the user's Takes */}
	  <div className="mt-6">
		<h3 className="text-xl font-semibold">User's Takes</h3>
		{userTakes.length === 0 ? (
		  <p className="text-gray-600">No Takes yet.</p>
		) : (
		  <div className="mt-2 space-y-4">
			{userTakes.map((take) => {
			  // Log each take object for debugging
			  console.log('[ProfilePage] Rendering Take =>', take);

			  // If the "takeID" field is missing or empty, log a warning
			  if (!take.takeID) {
				console.warn('[ProfilePage] Missing takeID for the following take:', take);
			  }

			  return (
				<div key={take.airtableRecordId} className="border p-2 rounded">
				  <p>
					<strong>Take Record:</strong>{' '}
					{take.takeID ? (
					  // If we have a takeID, make it a link
					  <Link to={`/takes/${take.takeID}`}>
						{take.airtableRecordId}
					  </Link>
					) : (
					  // Otherwise just display the record ID as text
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
			  );
			})}
		  </div>
		)}
	  </div>
	</div>
  );
}
