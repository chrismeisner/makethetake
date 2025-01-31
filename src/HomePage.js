// File: src/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [propsList, setPropsList] = React.useState([]);
  const [takesByProp, setTakesByProp] = React.useState({});
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
	async function loadData() {
	  try {
		// 1) Fetch /api/props
		const propsRes = await fetch('/api/props');
		const propsData = await propsRes.json();
		if (!propsData.success) {
		  setError(propsData.error || 'Unknown error fetching props');
		  setLoading(false);
		  return;
		}
		// Filter out archived
		const filteredProps = (propsData.props || []).filter(
		  (prop) => prop.propStatus !== 'archived'
		);
		setPropsList(filteredProps);

		// 2) Fetch /api/takes
		const takesRes = await fetch('/api/takes');
		const takesData = await takesRes.json();
		if (!takesData.success) {
		  setError(takesData.error || 'Error fetching takes');
		  setLoading(false);
		  return;
		}

		// 3) Group takes by propID
		const grouped = {};
		(takesData.takes || []).forEach((take) => {
		  if (!grouped[take.propID]) {
			grouped[take.propID] = [];
		  }
		  grouped[take.propID].push(take);
		});
		setTakesByProp(grouped);

		setLoading(false);
	  } catch (err) {
		console.error('[HomePage] error:', err);
		setError('Could not fetch data');
		setLoading(false);
	  }
	}

	loadData();
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
		{propsList.map((p) => {
		  const relatedTakes = takesByProp[p.propID] || [];

		  return (
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
				  {/* Link to prop detail page */}
				  <Link to={`/props/${p.propID}`} className="text-blue-600 hover:underline">
					{p.propTitle}
				  </Link>
				</h3>
			  </div>

			  {/* Subject and Status */}
			  {(p.subjectTitle || p.propStatus) && (
				<p className="mt-1 text-sm text-gray-600">
				  {p.subjectTitle && <>Subject: {p.subjectTitle}</>}
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

			  {/* "Make The Take:" line */}
			  <p className="mt-2 text-sm font-semibold">Make The Take:</p>
			  <p>
				<Link to={`/props/${p.propID}`} className="text-blue-600 hover:underline">
				  {p.propLong}
				</Link>
			  </p>

			  {/* Show related content, if any */}
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

			  {/* Display user takes (with short label) */}
			  <div style={{ marginTop: '1rem' }}>
				<p className="text-sm font-semibold">User Takes:</p>
				{relatedTakes.length === 0 ? (
				  <p className="text-gray-600">No user takes yet.</p>
				) : (
				  <ul style={{ margin: '0.25rem 0', paddingLeft: '1rem' }}>
					{relatedTakes.map((take) => {
					  // Decide which side label to show
					  const sideLabel =
						take.propSide === 'A'
						  ? p.PropSideAShort || 'Side A'
						  : p.PropSideBShort || 'Side B';

					  return (
						<li key={take.takeID} style={{ marginBottom: '0.25rem' }}>
						  {/* The side label is the clickable link to this Take */}
						  <Link
							to={`/takes/${take.takeID}`}
							className="text-blue-600 hover:underline"
						  >
							{sideLabel}
						  </Link>
						</li>
					  );
					})}
				  </ul>
				)}
			  </div>
			</div>
		  );
		})}
	  </div>
	</div>
  );
}
