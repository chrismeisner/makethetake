// File: src/TakePage.js

import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import VerificationWidget from './VerificationWidget';
import { UserContext } from './UserContext'; // <-- NEW: import context

export default function TakePage() {
  const { takeID } = useParams();
  const { loggedInUser } = useContext(UserContext); // <-- NEW: access logged-in user
  
  const [takeData, setTakeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
	// Log whether the user is logged in
	console.log('[TakePage] loggedInUser =>', loggedInUser);
	console.log(`[TakePage] Fetching take data for takeID="${takeID}"...`);

	// Call your backend endpoint: /api/takes/:takeID
	fetch(`/api/takes/${takeID}`)
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Unknown error loading take');
		  setLoading(false);
		  return;
		}

		console.log('[TakePage] Take data loaded:', data);
		setTakeData(data);
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('[TakePage] Fetch error:', err);
		setError('Could not fetch take data. Please try again later.');
		setLoading(false);
	  });
  }, [takeID, loggedInUser]); 
  // ^ include loggedInUser in dependencies so it logs if user changes

  if (loading) {
	return (
	  <div className="p-4">
		<h2 className="text-xl font-semibold">Loading take...</h2>
	  </div>
	);
  }

  if (error) {
	return (
	  <div className="p-4 text-red-600">
		<h2 className="text-xl font-bold mb-2">Take Error</h2>
		<p>{error}</p>
	  </div>
	);
  }

  // If no data came back or "take" is missing, show a 404-ish message
  if (!takeData || !takeData.take) {
	return (
	  <div className="p-4 text-red-600">
		<h2 className="text-xl font-bold mb-2">Take Not Found</h2>
		<p>We could not find any take details for ID "{takeID}".</p>
	  </div>
	);
  }

  // Destructure fields from the returned data
  const { take, prop, content } = takeData;

  return (
	<div className="p-4">
	  <h2 className="text-2xl font-bold mb-4">Take Details</h2>

	  {/* Take Info */}
	  <div className="border p-4 rounded mb-6">
		<h3 className="text-xl font-semibold">Take Info</h3>
		<p>
		  <strong>Take ID:</strong> {take.takeID}
		</p>
		<p>
		  <strong>Prop ID:</strong> {take.propID}
		</p>
		<p>
		  <strong>Chosen Side:</strong> {take.propSide}
		</p>
		<p>
		  <strong>Take Popularity:</strong> {take.takePopularity}%
		</p>
		<p>
		  <strong>Created:</strong> {take.createdTime}
		</p>
		{take.profileID && (
		  <p>
			<strong>Profile:</strong>{' '}
			<Link to={`/profile/${take.profileID}`}>
			  {take.profileID}
			</Link>
		  </p>
		)}
	  </div>

	  {/* Prop Info (if any) */}
	  {prop ? (
		<div className="border p-4 rounded mb-6">
		  <h3 className="text-xl font-semibold">Prop Info</h3>
		  <p>
			<strong>Prop ID:</strong> {prop.propID}
		  </p>
		  <p>
			<strong>Description:</strong> {prop.propShort}
		  </p>
		  <p>
			<strong>Side A Label:</strong> {prop.PropSideAShort}
		  </p>
		  <p>
			<strong>Side B Label:</strong> {prop.PropSideBShort}
		  </p>
		  <p>
			<strong>Status:</strong> {prop.propStatus}
		  </p>
		</div>
	  ) : (
		<p>No prop data found for this take.</p>
	  )}

	  {/* Related Content (if any) */}
	  {content && content.length > 0 ? (
		<div className="border p-4 rounded">
		  <h3 className="text-xl font-semibold">Related Content</h3>
		  <ul className="list-disc list-inside mt-2">
			{content.map((c) => (
			  <li key={c.airtableRecordId} className="my-1">
				<strong>{c.contentTitle}</strong>
				{c.contentSource ? ` (Source: ${c.contentSource})` : ''}{' '}
				{c.contentURL && (
				  <a
					href={c.contentURL}
					target="_blank"
					rel="noreferrer"
					className="text-blue-600 underline ml-1"
				  >
					[Link]
				  </a>
				)}
			  </li>
			))}
		  </ul>
		</div>
	  ) : (
		<p>No related content found.</p>
	  )}

	  {/* Now we embed the same poll/verification widget if we want to let user vote again */}
	  <div style={{ marginTop: '2rem' }}>
		<h3>Vote on This Prop</h3>

		{/* Pass in the actual propID from the loaded take data */}
		{prop && prop.propID ? (
		  <VerificationWidget embeddedPropID={prop.propID} />
		) : (
		  <p>No propID to vote on.</p>
		)}
	  </div>
	</div>
  );
}
