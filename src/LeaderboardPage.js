// File: /Users/chrismeisner/Projects/make-the-take/src/LeaderboardPage.js

import React from 'react';
import { Link } from 'react-router-dom';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = React.useState([]);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
	fetch('/api/leaderboard')
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Unknown error fetching leaderboard');
		} else {
		  setLeaderboard(data.leaderboard || []);
		}
	  })
	  .catch((err) => {
		console.error('[LeaderboardPage] Fetch error:', err);
		setError('Could not fetch leaderboard. Please try again later.');
	  });
  }, []);

  if (error) {
	return (
	  <div style={{ padding: '2rem', color: 'red' }}>
		<h2>Leaderboard Error</h2>
		<p>{error}</p>
	  </div>
	);
  }

  if (leaderboard.length === 0) {
	return <div style={{ padding: '2rem' }}>Loading leaderboard...</div>;
  }

  return (
	<div style={{ padding: '2rem' }}>
	  <h2>Leaderboard</h2>
	  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
		<thead>
		  <tr style={{ borderBottom: '1px solid #ccc' }}>
			<th style={{ textAlign: 'left', padding: '0.5rem' }}>Phone (E.164)</th>
			<th style={{ textAlign: 'left', padding: '0.5rem' }}>Takes Count</th>
			<th style={{ textAlign: 'left', padding: '0.5rem' }}>Points</th>
		  </tr>
		</thead>
		<tbody>
		  {leaderboard.map((item) => (
			<tr key={item.phone} style={{ borderBottom: '1px solid #eee' }}>
			  <td style={{ padding: '0.5rem' }}>
				{item.profileID ? (
				  <Link to={`/profile/${item.profileID}`}>
					{item.phone}
				  </Link>
				) : (
				  item.phone
				)}
			  </td>
			  <td style={{ padding: '0.5rem' }}>{item.count}</td>
			  {/* Round the points to 0 decimal places */}
			  <td style={{ padding: '0.5rem' }}>{Math.round(item.points)}</td>
			</tr>
		  ))}
		</tbody>
	  </table>
	</div>
  );
}
