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
		} else {
		  console.log('[HomePage] /api/props =>', data.props);
		  setPropsList(data.props || []);
		}
		setLoading(false);
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
	return <div className="p-4">No props found.</div>;
  }

  return (
	<div className="p-4">
	  <h2 className="text-2xl font-bold mb-4">All Propositions</h2>

	  <div className="space-y-6">
		{propsList.map((p) => (
		  <div key={p.propID} className="border p-4 rounded">
			{/* Top row: possible subject logo, then title */}
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
					marginRight: '0.5rem'
				  }}
				/>
			  )}

			  <h3 className="text-xl font-semibold">
				<Link to={`/props/${p.propID}`} className="text-blue-600 hover:underline">
				  {p.propTitle}
				</Link>
			  </h3>
			</div>

			{p.subjectTitle && (
			  <p className="mt-1 text-sm text-gray-600">Subject: {p.subjectTitle}</p>
			)}

			<p style={{ marginTop: '0.5rem', color: '#666' }}>Created: {p.createdAt}</p>
			<p className="mt-2">{p.propSummary}</p>

			{/* Show the content array if we have any */}
			{p.content && p.content.length > 0 && (
			  <div style={{ marginTop: '1rem' }}>
				<strong>Related Links:</strong>
				<ul style={{ marginLeft: '1.25rem', listStyle: 'disc' }}>
				  {p.content.map((cItem, idx) => (
					<li key={idx} style={{ margin: '0.25rem 0' }}>
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

			<p className="mt-2 text-gray-600">Status: {p.propStatus}</p>

			<p className="mt-2">
			  <Link to={`/props/${p.propID}`} className="text-blue-600 hover:underline">
				{p.propLong}
			  </Link>
			</p>
		  </div>
		))}
	  </div>
	</div>
  );
}
