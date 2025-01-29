// File: src/HomePage.js

import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [propsList, setPropsList] = React.useState([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
	fetch('/api/props')
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Unknown error fetching props');
		  setLoading(false);
		} else {
		  // Filter out any props with status = "archived"
		  const filteredProps = (data.props || []).filter(
			(p) => p.propStatus !== 'archived'
		  );
		  setPropsList(filteredProps);
		  setLoading(false);
		}
	  })
	  .catch((err) => {
		console.error('[HomePage] error fetching props:', err);
		setError('Could not fetch props');
		setLoading(false);
	  });
  }, []);

  if (loading) {
	return <div className="p-4">Loading props...</div>;
  }

  if (error) {
	return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (propsList.length === 0) {
	return <div className="p-4">No props found (none are open or non-archived).</div>;
  }

  return (
	<div className="p-4">
	  <h2 className="text-2xl font-bold mb-4">All Propositions</h2>

	  <div className="space-y-6">
		{propsList.map((p) => (
		  <div key={p.propID} className="border p-4 rounded">
			{/* Top row: optional subject logo, then prop title */}
			<div style={{ display: 'flex', alignItems: 'center' }}>
			  {p.subjectLogoUrl && (
				<img
				  src={p.subjectLogoUrl}
				  alt={p.subjectTitle || 'Subject Logo'}
				  style={{
					width: '40px',
					height: '40px',
					objectFit: 'cover',
					borderRadius: '4px',
					marginRight: '0.5rem',
				  }}
				/>
			  )}

			  <h3 className="text-xl font-semibold">
				{/* Wrap the title in a <Link> to the prop detail route */}
				<Link to={`/props/${p.propID}`} className="text-blue-600 hover:underline">
				  {p.propTitle}
				</Link>
			  </h3>
			</div>

			{/* Subject and Status on the same line */}
			{(p.subjectTitle || p.propStatus) && (
			  <p className="mt-1 text-sm text-gray-600">
				{p.subjectTitle && (
				  <>Subject: {p.subjectTitle}</>
				)}
				{p.subjectTitle && p.propStatus && (
				  <span className="ml-4">Status: {p.propStatus}</span>
				)}
				{!p.subjectTitle && p.propStatus && (
				  <>Status: {p.propStatus}</>
				)}
			  </p>
			)}

			<p style={{ marginTop: '0.5rem', color: '#666' }}>
			  Created: {p.createdAt}
			</p>

			<p className="mt-2">{p.propSummary}</p>

			{/* "Make The Take:" line and link (same style as "Related Links:") */}
			<p className="mt-2 text-sm font-semibold">Make The Take:</p>
			<p>
			  <Link
				to={`/props/${p.propID}`}
				className="text-blue-600 hover:underline"
			  >
				{p.propLong}
			  </Link>
			</p>

			{/* Show the content array if we have any */}
			{p.content && p.content.length > 0 && (
			  <div style={{ marginTop: '1rem' }}>
				<p className="text-sm font-semibold">Related Links:</p>
				<ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
				  {p.content.map((cItem, idx) => (
					<li key={idx} style={{ margin: '0.25rem 0' }}>
					  <span style={{ marginRight: '4px' }}>↗</span>
					  <a
						href={cItem.contentURL}
						target="_blank"
						rel="noreferrer"
						className="text-blue-600 hover:underline"
					  >
						{cItem.contentTitle || 'View Link'}
					  </a>
					</li>
				  ))}
				</ul>
			  </div>
			)}
		  </div>
		))}
	  </div>
	</div>
  );
}
