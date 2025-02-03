// File: src/RelatedProp.js

import React, { useState, useEffect } from 'react';

export default function RelatedProp({ currentSubjectID, currentPropID }) {
  const [relatedProp, setRelatedProp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
	// Basic check: if no subject is provided, nothing to do.
	if (!currentSubjectID) {
	  setError('No subject provided.');
	  setLoading(false);
	  return;
	}

	// Build the API URL using the current subject
	const url = `/api/related-prop?subjectID=${encodeURIComponent(currentSubjectID)}`;

	fetch(url)
	  .then((res) => res.json())
	  .then((data) => {
		// Check if the API returned a valid prop and that it’s not the current one.
		if (data.success && data.prop && data.prop.propID !== currentPropID) {
		  setRelatedProp(data.prop);
		} else {
		  setError('No related proposition found.');
		}
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('[RelatedProp] Fetch error:', err);
		setError('Error fetching related proposition.');
		setLoading(false);
	  });
  }, [currentSubjectID, currentPropID]);

  if (loading) {
	return <div>Loading related proposition...</div>;
  }

  if (error) {
	return <div style={{ color: 'red' }}>{error}</div>;
  }

  // If nothing was found, render nothing.
  if (!relatedProp) {
	return null;
  }

  return (
	<div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '2rem' }}>
	  <h3>Related Proposition</h3>
	  <h4>{relatedProp.propTitle}</h4>
	  <p>{relatedProp.propSummary}</p>
	  {/* You can add a Link or button to navigate to the related prop here */}
	</div>
  );
}
