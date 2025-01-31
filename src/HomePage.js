// File: src/HomePage.js

import React from 'react';
import { Link } from 'react-router-dom';
import { UserContext } from './UserContext';

export default function HomePage() {
  const [propsList, setPropsList] = React.useState([]);
  const [takesByProp, setTakesByProp] = React.useState({});
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  // Logged-in user from context
  const { loggedInUser } = React.useContext(UserContext);

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
		// Filter out archived props (if you want)
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
		  const pid = take.propID;
		  if (!pid) return;
		  if (!grouped[pid]) {
			grouped[pid] = [];
		  }
		  grouped[pid].push(take);
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
		{propsList.map((prop) => {
		  // For this prop, look up all related takes
		  const relatedTakes = takesByProp[prop.propID] || [];

		  // If user is logged in, find their single latest take by phone
		  let userTake;
		  if (loggedInUser) {
			userTake = relatedTakes.find(
			  (t) => t.takeMobile === loggedInUser.phone && t.takeStatus !== 'overwritten'
			);
		  }

		  return (
			<div key={prop.propID} className="border p-4 rounded">
			  {/* -- PROP HEADER -- */}
			  <div style={{ display: 'flex', alignItems: 'center' }}>
				{prop.subjectLogoUrl && (
				  <img
					src={prop.subjectLogoUrl}
					alt={prop.subjectTitle || 'Subject Logo'}
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
				  <Link to={`/props/${prop.propID}`} className="text-blue-600 hover:underline">
					{prop.propTitle}
				  </Link>
				</h3>
			  </div>

			  {/* -- SUBJECT & STATUS -- */}
			  {(prop.subjectTitle || prop.propStatus) && (
				<p className="mt-1 text-sm text-gray-600">
				  {prop.subjectTitle && <>Subject: {prop.subjectTitle}</>}
				  {prop.subjectTitle && prop.propStatus && (
					<span className="ml-4">Status: {prop.propStatus}</span>
				  )}
				  {!prop.subjectTitle && prop.propStatus && <>Status: {prop.propStatus}</>}
				</p>
			  )}
			  <p style={{ marginTop: '0.5rem', color: '#666' }}>
				Created: {prop.createdAt}
			  </p>

			  {/* -- PROP SUMMARY -- */}
			  <p className="mt-2">{prop.propSummary}</p>

			  {/* -- "MAKE THE TAKE" LONG TEXT -- */}
			  <p className="mt-2 text-sm font-semibold">Make The Take:</p>
			  <p>
				<Link to={`/props/${prop.propID}`} className="text-blue-600 hover:underline">
				  {prop.propLong}
				</Link>
			  </p>

			  {/* -- USER'S TAKE STATUS -- */}
			  <div style={{ marginTop: '1rem' }}>
				<p className="text-sm font-semibold">Your Take:</p>

				{!loggedInUser ? (
				  <p className="text-gray-600">
					<Link to="/login?redirect=/" className="text-blue-600 underline">
					  Log in
					</Link>{' '}
					to see your take.
				  </p>
				) : userTake ? (
				  (() => {
					// Determine which side label to show
					const sideLabel =
					  userTake.propSide === 'A'
						? (userTake.propSideAShort || 'Side A')
						: (userTake.propSideBShort || 'Side B');

					return (
					  <p>
						<Link
						  to={`/takes/${userTake.TakeID || userTake.takeID}`}
						  className="text-blue-600 hover:underline"
						>
						  {sideLabel}
						</Link>
					  </p>
					);
				  })()
				) : (
				  <p className="text-gray-600">You haven’t made this take yet.</p>
				)}
			  </div>

			  {/* -- OPTIONAL: RELATED LINKS -- */}
			  {prop.content && prop.content.length > 0 && (
				<div style={{ marginTop: '1rem' }}>
				  <p className="text-sm font-semibold">Related Links:</p>
				  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
					{prop.content.map((cItem, idx) => (
					  <li key={idx} style={{ margin: '0.25rem 0' }}>
						↗{' '}
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
		  );
		})}
	  </div>
	</div>
  );
}
