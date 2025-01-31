// File: src/LeaderboardPage.js

import React from 'react';
import { Link } from 'react-router-dom';

export default function LeaderboardPage() {
  const [subjectIDs, setSubjectIDs] = React.useState([]);      // e.g. ["nba-trade-deadline", "nfl", ...]
  const [selectedSubject, setSelectedSubject] = React.useState(''); // '' means "All"
  const [leaderboard, setLeaderboard] = React.useState([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  // 1) On mount, load the distinct subject IDs
  React.useEffect(() => {
	fetch('/api/subjectIDs')
	  .then((res) => res.json())
	  .then((data) => {
		console.log('[LeaderboardPage] /api/subjectIDs =>', data);
		if (!data.success) {
		  console.error('Error fetching subjectIDs:', data.error);
		  return;
		}
		// store the list of IDs, e.g. ["nba-trade-deadline", "some-other-subject"]
		setSubjectIDs(data.subjectIDs || []);
	  })
	  .catch((err) => {
		console.error('[LeaderboardPage] /api/subjectIDs error =>', err);
	  });
  }, []);

  // 2) A function to fetch the leaderboard for either "all" or a particular subject
  const fetchLeaderboard = React.useCallback((subjectID) => {
	setLoading(true);
	setError('');
	setLeaderboard([]);

	let url = '/api/leaderboard';
	if (subjectID) {
	  url += `?subjectID=${encodeURIComponent(subjectID)}`;
	}

	console.log('[LeaderboardPage] fetching leaderboard at url =>', url);

	fetch(url)
	  .then((res) => res.json())
	  .then((data) => {
		console.log('[LeaderboardPage] response =>', data);
		if (!data.success) {
		  setError(data.error || 'Unknown error fetching leaderboard');
		} else {
		  setLeaderboard(data.leaderboard || []);
		}
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('[LeaderboardPage] fetch error =>', err);
		setError('Could not fetch leaderboard. Please try again later.');
		setLoading(false);
	  });
  }, []);

  // 3) On first load, let's fetch the "all" leaderboard
  React.useEffect(() => {
	fetchLeaderboard(''); // '' means no subject => all
  }, [fetchLeaderboard]);

  // 4) If user picks a subject => setSelectedSubject(...) => fetch again
  function handleSubjectChange(e) {
	const val = e.target.value;
	setSelectedSubject(val);
	// If val === '' => all
	fetchLeaderboard(val);
  }

  return (
	<div style={{ padding: '2rem' }}>
	  <h2>Subject Leaderboard</h2>

	  {/* Subject dropdown (with an "All" option) */}
	  <div style={{ marginBottom: '1rem' }}>
		<label style={{ marginRight: '0.5rem' }}>Choose Subject:</label>
		<select value={selectedSubject} onChange={handleSubjectChange}>
		  <option value="">All</option>
		  {subjectIDs.map((id) => (
			<option key={id} value={id}>{id}</option>
		  ))}
		</select>
	  </div>

	  {loading ? (
		<p>Loading leaderboard...</p>
	  ) : error ? (
		<div style={{ marginBottom: '1rem', color: 'red' }}>
		  {error}
		</div>
	  ) : leaderboard.length === 0 ? (
		<p>No data found for this subject.</p>
	  ) : (
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
				<td style={{ padding: '0.5rem' }}>{Math.round(item.points)}</td>
			  </tr>
			))}
		  </tbody>
		</table>
	  )}
	</div>
  );
}
