import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import VerificationWidget from './VerificationWidget';
import { UserContext } from './UserContext';
import RelatedProp from './RelatedProp';

export default function TakePage() {
  const { takeID } = useParams();
  const { loggedInUser } = useContext(UserContext);

  const [takeData, setTakeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
	fetch(`/api/takes/${takeID}`)
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Error loading take.');
		} else {
		  setTakeData(data);
		}
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('Fetch error:', err);
		setError('Could not fetch take data.');
		setLoading(false);
	  });
  }, [takeID]);

  if (loading) return <div>Loading take...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!takeData || !takeData.take) return <div style={{ color: 'red' }}>Take not found.</div>;

  const { take, prop, content } = takeData;

  return (
	<div style={{ padding: '1rem' }}>
	  <h2>Take Details</h2>

	  {/* Display Take Information */}
	  <section style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
		<h3>Take Info</h3>
		<p><strong>Take ID:</strong> {take.takeID}</p>
		<p><strong>Prop ID:</strong> {take.propID}</p>
		<p><strong>Chosen Side:</strong> {take.propSide}</p>
		<p><strong>Take Popularity:</strong> {take.takePopularity}%</p>
		<p><strong>Created:</strong> {take.createdTime}</p>
		{take.profileID && (
		  <p>
			<strong>Profile:</strong> <Link to={`/profile/${take.profileID}`}>{take.profileID}</Link>
		  </p>
		)}
	  </section>

	  {/* Display Prop Information if available */}
	  {prop && (
		<section style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
		  <h3>Prop Info</h3>
		  <p><strong>Prop ID:</strong> {prop.propID}</p>
		  <p><strong>Description:</strong> {prop.propShort}</p>
		  <p><strong>Side A Label:</strong> {prop.PropSideAShort}</p>
		  <p><strong>Side B Label:</strong> {prop.PropSideBShort}</p>
		  <p><strong>Status:</strong> {prop.propStatus}</p>
		</section>
	  )}

	  {/* Display any Related Content */}
	  {content && content.length > 0 && (
		<section style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
		  <h3>Related Content</h3>
		  <ul>
			{content.map((c, i) => (
			  <li key={i}>
				<strong>{c.contentTitle}</strong>
				{c.contentURL && (
				  <a href={c.contentURL} target="_blank" rel="noopener noreferrer">
					{' '}[Link]
				  </a>
				)}
			  </li>
			))}
		  </ul>
		</section>
	  )}

	  {/* Verification widget for voting */}
	  <section style={{ marginBottom: '1rem' }}>
		<h3>Vote on This Prop</h3>
		{prop && prop.propID ? (
		  <VerificationWidget embeddedPropID={prop.propID} />
		) : (
		  <p>No propID to vote on.</p>
		)}
	  </section>

	  {/* Simplified Related Prop Section */}
	  {prop && prop.propSubjectID && (
		<section style={{ border: '1px solid #ccc', padding: '1rem' }}>
		  <h3>Related Proposition</h3>
		  <RelatedProp
			currentSubjectID={prop.propSubjectID}
			currentPropID={prop.propID}
		  />
		</section>
	  )}
	</div>
  );
}
