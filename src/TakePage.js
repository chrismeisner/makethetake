// File: src/TakePage.js
import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import VerificationWidget from './VerificationWidget';
import { UserContext } from './UserContext';

// A sub-component to fetch & render a "Related Proposition" (based on subjectID).
function RelatedPropSection({ currentPropSubjectID }) {
  const { loggedInUser } = useContext(UserContext);
  const [relatedProp, setRelatedProp] = useState(null);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [errorRelated, setErrorRelated] = useState('');

  useEffect(() => {
	async function fetchRelatedProp() {
	  console.log('[RelatedPropSection] Starting fetch. currentPropSubjectID:', currentPropSubjectID);

	  // If not logged in, can't fetch related props
	  if (!loggedInUser) {
		console.log('[RelatedPropSection] No logged-in user.');
		setErrorRelated('Please log in to see related propositions.');
		setLoadingRelated(false);
		return;
	  }
	  // If no subject ID is provided, we can’t look up related props
	  if (!currentPropSubjectID) {
		console.log('[RelatedPropSection] No subject ID provided.');
		setErrorRelated(`No subject available for related propositions. (subjectID: "${currentPropSubjectID}")`);
		setLoadingRelated(false);
		return;
	  }

	  try {
		const url = `/api/related-prop?subjectID=${encodeURIComponent(
		  currentPropSubjectID
		)}&profileID=${encodeURIComponent(loggedInUser.profileID)}`;

		console.log('[RelatedPropSection] Fetching URL:', url);
		const response = await fetch(url);
		const data = await response.json();
		console.log('[RelatedPropSection] API response:', data);

		if (data.success) {
		  if (data.prop) {
			console.log('[RelatedPropSection] Related prop found:', data.prop);
			setRelatedProp(data.prop);
		  } else if (data.message) {
			console.log('[RelatedPropSection] No related prop available. Message:', data.message);
			setErrorRelated(data.message);
		  }
		} else {
		  console.log('[RelatedPropSection] API returned failure:', data.error);
		  setErrorRelated(data.error || 'No related prop found.');
		}
	  } catch (err) {
		console.error('[RelatedPropSection] Error during fetch:', err);
		setErrorRelated('Could not fetch related prop.');
	  }
	  setLoadingRelated(false);
	}
	fetchRelatedProp();
  }, [currentPropSubjectID, loggedInUser]);

  if (loadingRelated) {
	return <div>Loading related proposition...</div>;
  }

  if (errorRelated) {
	return <div className="text-red-600">{errorRelated}</div>;
  }

  if (!relatedProp) {
	return <div>No more props available, good job!</div>;
  }

  return (
	<div style={{ marginTop: '2rem' }}>
	  <h3 className="text-2xl font-bold mb-4">Related Proposition</h3>
	  <VerificationWidget embeddedPropID={relatedProp.propID} />
	</div>
  );
}

export default function TakePage() {
  const { takeID } = useParams();
  const { loggedInUser } = useContext(UserContext);

  const [takeData, setTakeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
	console.log('[TakePage] loggedInUser =>', loggedInUser);
	console.log(`[TakePage] Fetching take data for takeID="${takeID}"...`);

	// Fetch from your server: /api/takes/:takeID
	fetch(`/api/takes/${takeID}`)
	  .then((res) => res.json())
	  .then((data) => {
		console.log('[TakePage] API response for take:', data);
		if (!data.success) {
		  setError(data.error || 'Unknown error loading take');
		  setLoading(false);
		  return;
		}
		setTakeData(data);
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('[TakePage] Fetch error:', err);
		setError('Could not fetch take data. Please try again later.');
		setLoading(false);
	  });
  }, [takeID, loggedInUser]);

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

  // If there's no "take" object, show a fallback
  if (!takeData || !takeData.take) {
	return (
	  <div className="p-4 text-red-600">
		<h2 className="text-xl font-bold mb-2">Take Not Found</h2>
		<p>We could not find any take details for ID "{takeID}".</p>
	  </div>
	);
  }

  // The server now returns { success: true, take, prop, content }
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
			{content.map((c, i) => (
			  <li
				key={c.airtableRecordId || i}
				className="my-1"
			  >
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

	  {/* Vote on this Prop */}
	  <div style={{ marginTop: '2rem' }}>
		<h3 className="text-2xl font-bold mb-4">Vote on This Prop</h3>
		{prop && prop.propID ? (
		  <VerificationWidget embeddedPropID={prop.propID} />
		) : (
		  <p>No propID to vote on.</p>
		)}
	  </div>

	  {/* ALWAYS render the Related Proposition section for logged-in users */}
	  {loggedInUser && (
		<RelatedPropSection currentPropSubjectID={prop?.propSubjectID || ''} />
	  )}
	</div>
  );
}
