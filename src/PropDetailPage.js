// File: src/PropDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import VerificationWidget from './VerificationWidget';
import RelatedProp from './RelatedProp';

export default function PropDetailPage() {
  const { propID } = useParams();
  const [propData, setPropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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

  if (loading) return <div>Loading prop...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!propData) return <div>Prop not found.</div>;

  // Construct the cover image URL using the Puppeteer endpoint.
  // For example, we pass the prop's short text (or title) as the "propTitle" query parameter.
  // Optionally, if a background image is available (say from propData.contentImageUrl), we pass it as well.
  const coverImageUrl = `${window.location.origin}/api/propCoverPuppeteer?propTitle=${encodeURIComponent(
	propData.propShort || propData.propTitle
  )}${propData.contentImageUrl ? `&backgroundURL=${encodeURIComponent(propData.contentImageUrl)}` : ''}`;

  return (
	<div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
	  {/* Open Graph meta tags for social sharing */}
	  <Helmet>
		<meta property="og:image" content={coverImageUrl} />
		<meta property="og:title" content={propData.propTitle} />
		<meta property="og:description" content={propData.propSummary} />
	  </Helmet>

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
	  <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{propData.propSummary}</p>

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
