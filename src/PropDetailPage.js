import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import VerificationWidget from './VerificationWidget';
import RelatedProp from './RelatedProp';

export default function PropDetailPage() {
  const { propID } = useParams();
  const [propData, setPropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch the prop data from /api/prop
  useEffect(() => {
	setLoading(true);
	fetch(`/api/prop?propID=${encodeURIComponent(propID)}`)
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Error loading prop.');
		} else {
		  setPropData(data);
		}
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('Error fetching prop:', err);
		setError('Could not load prop data.');
		setLoading(false);
	  });
  }, [propID]);

  // Auto-hit /api/prop-cover to ensure the PNG is generated or cached
  useEffect(() => {
	if (propData) {
	  fetch(`/api/prop-cover/${propID}`)
		.then(() => console.log(`Cover image generated/served for prop ${propID}`))
		.catch((err) => console.error('Error generating cover:', err));
	}
  }, [propID, propData]);

  if (loading) return <div>Loading prop...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!propData) return <div>Prop not found.</div>;

  // Our dynamic route for the OG image (for debugging purposes)
  const coverImageUrl = `${window.location.origin}/api/prop-cover/${propID}`;
  console.log('Cover image URL:', coverImageUrl);

  return (
	<div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
	  {/*
		The static meta tags are now provided in your public/index.html.
		The Helmet component is removed so that social scrapers get the 
		static OG data.
	  */}

	  {/* Prop Title */}
	  <h1>{propData.propTitle}</h1>

	  {/* Subject Logo */}
	  {propData.subjectLogoUrl && (
		<img
		  src={propData.subjectLogoUrl}
		  alt={propData.subjectTitle || 'Subject Logo'}
		  style={{
			width: '80px',
			height: '80px',
			objectFit: 'cover',
			borderRadius: '4px',
		  }}
		/>
	  )}

	  {/* Main Prop Image */}
	  {propData.contentImageUrl && (
		<div style={{ margin: '1rem 0' }}>
		  <img
			src={propData.contentImageUrl}
			alt="Prop Content"
			style={{ width: '100%', maxWidth: '600px', objectFit: 'cover' }}
		  />
		</div>
	  )}

	  {/* Subject & Created Date */}
	  <div style={{ color: '#555', marginBottom: '1rem' }}>
		{propData.subjectTitle && <p>Subject: {propData.subjectTitle}</p>}
		<p>Created: {propData.createdAt}</p>
	  </div>

	  {/* Prop Summary */}
	  <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
		{propData.propSummary}
	  </p>

	  {/* Verification Widget for Voting */}
	  <section style={{ marginBottom: '1rem' }}>
		<h3>Vote on This Prop</h3>
		<VerificationWidget embeddedPropID={propData.propID} />
	  </section>

	  {/* Related Prop Section */}
	  {propData.propSubjectID ? (
		<section style={{ border: '1px solid #ccc', padding: '1rem' }}>
		  <h3>Related Proposition</h3>
		  <RelatedProp
			currentSubjectID={propData.propSubjectID}
			currentPropID={propData.propID}
		  />
		</section>
	  ) : (
		<p style={{ color: '#999' }}>
		  No subject information available for related props.
		</p>
	  )}

	  <p style={{ marginTop: '1rem' }}>
		<Link to="/">Back to Home</Link>
	  </p>
	</div>
  );
}
