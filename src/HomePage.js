// File: src/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const [feed, setFeed] = React.useState([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
	fetch('/api/feed')
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Error fetching feed');
		} else {
		  setFeed(data.feed || []);
		}
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('[HomePage] error fetching feed:', err);
		setError('Could not fetch feed');
		setLoading(false);
	  });
  }, []);

  if (loading) {
	return <div className="p-4">Loading feed...</div>;
  }
  if (error) {
	return (
	  <div className="p-4 text-red-600">
		<strong>Error:</strong> {error}
	  </div>
	);
  }
  if (feed.length === 0) {
	return <div className="p-4">No recent takes found.</div>;
  }

  return (
	<div className="p-4">
	  <h2 className="text-2xl font-bold mb-4">Latest Takes</h2>
	  <div className="space-y-4">
		{feed.map((item) => {
		  return (
			<div key={item.takeID} className="border p-4 rounded">
			  <p>
				<strong>Take ID:</strong>{' '}
				<Link to={`/takes/${item.takeID}`}>
				  {item.takeID}
				</Link>
			  </p>
			  <p>
				<strong>Prop:</strong> {item.propShort}
			  </p>
			  <p>
				<strong>Chosen Side:</strong> {item.propSide}
			  </p>
			  {item.profileID ? (
				<p>
				  <strong>By:</strong>{' '}
				  <Link to={`/profile/${item.profileID}`}>
					{item.profileUsername || item.profileID}
				  </Link>
				</p>
			  ) : (
				<p>
				  <strong>By:</strong> Unknown
				</p>
			  )}
			  <p>
				<strong>Created:</strong> {item.createdTime}
			  </p>
			</div>
		  );
		})}
	  </div>
	</div>
  );
}
