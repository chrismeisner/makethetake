// File: /Users/chrismeisner/Projects/make-the-take/src/TakePage.js

import React from 'react';
import { useParams } from 'react-router-dom';

export default function TakePage() {
  const { takeID } = useParams();

  const [takeData, setTakeData] = React.useState(null);
  const [propData, setPropData] = React.useState(null);
  const [contentItems, setContentItems] = React.useState([]); // new state for Content
  const [error, setError] = React.useState('');

  React.useEffect(() => {
	// 1) Fetch from our endpoint => /api/takes/xxx
	fetch(`/api/takes/${takeID}`)
	  .then((res) => res.json())
	  .then((json) => {
		if (json.error) {
		  setError(json.error);
		} else {
		  // We'll store the "take" and "prop" separately for clarity
		  setTakeData(json.take);
		  setPropData(json.prop);
		  setContentItems(json.content || []); // store the returned content array
		}
	  })
	  .catch((err) => {
		console.error('Error fetching take:', err);
		setError('Could not fetch take data. Please try again later.');
	  });
  }, [takeID]);

  if (error) {
	return (
	  <div style={{ padding: '2rem', color: 'red' }}>
		<h2>Take Error</h2>
		<p>{error}</p>
	  </div>
	);
  }

  if (!takeData) {
	return <div style={{ padding: '2rem' }}>Loading Take data...</div>;
  }

  // We'll see if there's a propStatus to show
  const propStatus = propData?.propStatus;
  const userSide = takeData.propSide;

  // If it's graded, let's see if the user was correct or not
  let wasUserCorrect = null;
  if (propStatus === 'gradedA') {
	wasUserCorrect = (userSide === 'A');
  } else if (propStatus === 'gradedB') {
	wasUserCorrect = (userSide === 'B');
  }
  // wasUserCorrect could be true, false, or null

  return (
	<div style={{ padding: '2rem' }}>
	  <h2>Take Details (TakeID: {takeID})</h2>

	  <p>
		<strong>Airtable Record ID (Take):</strong> {takeData.airtableRecordId}
	  </p>
	  <p>
		<strong>Chosen Side:</strong> {takeData.propSide}
	  </p>
	  <p>
		<strong>Popularity (at time of creation):</strong> {takeData.takePopularity}%
	  </p>
	  <p>
		<strong>propID:</strong> {takeData.propID}
	  </p>
	  <p>
		<strong>Phone (User):</strong> {takeData.takeMobile}
	  </p>
	  <p>
		<strong>Created Time:</strong> {takeData.createdTime}
	  </p>

	  {propData ? (
		<div style={{ marginTop: '2rem' }}>
		  <h3>Prop Details</h3>
		  <p>
			<strong>Airtable Record ID (Prop):</strong> {propData.airtableRecordId}
		  </p>
		  <p>
			<strong>propID:</strong> {propData.propID}
		  </p>
		  <p>
			<strong>propShort:</strong> {propData.propShort}
		  </p>
		  <p>
			<strong>Side A Label:</strong> {propData.PropSideAShort}
		  </p>
		  <p>
			<strong>Side B Label:</strong> {propData.PropSideBShort}
		  </p>
		  <p>
			<strong>propStatus:</strong> {propData.propStatus}
		  </p>

		  {/* Additional message if graded */}
		  {(propStatus === 'gradedA' || propStatus === 'gradedB') && (
			<div style={{ marginTop: '1rem' }}>
			  {wasUserCorrect ? (
				<p style={{ color: 'green' }}>✅ You chose the correct side!</p>
			  ) : (
				<p style={{ color: 'red' }}>❌ You chose the incorrect side.</p>
			  )}
			</div>
		  )}
		</div>
	  ) : (
		<div style={{ marginTop: '2rem', color: 'gray' }}>
		  <em>No related Prop found for this Take</em>
		</div>
	  )}

	  {/* Display Content items if any */}
	  <div style={{ marginTop: '2rem' }}>
		<h3>Related Content</h3>
		{contentItems.length === 0 ? (
		  <p style={{ color: '#666' }}>No related content found for this prop.</p>
		) : (
		  contentItems.map((content) => (
			<div
			  key={content.airtableRecordId}
			  style={{ 
				border: '1px solid #ccc',
				padding: '1rem',
				marginBottom: '1rem'
			  }}
			>
			  <h4 style={{ margin: 0 }}>{content.contentTitle}</h4>
			  <p style={{ margin: '0.25rem 0' }}>
				<strong>Source:</strong> {content.contentSource} <br />
				<strong>Created:</strong> {content.created}
			  </p>
			  <a href={content.contentURL} target="_blank" rel="noopener noreferrer">
				{content.contentURL}
			  </a>
			</div>
		  ))
		)}
	  </div>
	</div>
  );
}
