// server.js
const path = require('path');
const express = require('express');
const fetch = require('node-fetch'); // node-fetch v2 for CommonJS
require('dotenv').config();         // If you're using .env for AIRTABLE_API_KEY, etc.

const app = express();

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// Example route: GET /api/prop?propID=abc123
app.get('/api/prop', async (req, res) => {
  const propID = req.query.propID;
  
  // Log if propID is missing
  if (!propID) {
	console.log('[api/prop] No propID in query parameters.');
	return res.status(400).json({ error: 'Missing propID' });
  }

  console.log(`[api/prop] Received request for propID: ${propID}`);

  try {
	// Load environment variables
	const apiKey  = process.env.AIRTABLE_API_KEY;
	const baseID  = process.env.AIRTABLE_BASE_ID;
	const tableName = 'Props'; // or your actual table name

	// Construct the Airtable URL
	const url = `https://api.airtable.com/v0/${baseID}/${tableName}?filterByFormula={propID}='${propID}'`;
	console.log(`[api/prop] Fetching from Airtable with URL:\n  ${url}`);

	// Make the call to Airtable
	const airtableRes = await fetch(url, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});

	// Check response status
	if (!airtableRes.ok) {
	  console.error(
		`[api/prop] Airtable responded with an error:`,
		airtableRes.status,
		airtableRes.statusText
	  );
	  return res.status(500).json({ error: 'Airtable fetch error' });
	}

	// Parse the JSON
	const data = await airtableRes.json();
	console.log('[api/prop] Airtable response data:', JSON.stringify(data, null, 2));

	// If no matching record found
	if (!data.records || data.records.length === 0) {
	  console.log(`[api/prop] No matching prop found for propID: ${propID}`);
	  return res.status(404).json({ error: 'Prop not found' });
	}

	// Log the first record
	const record = data.records[0];
	console.log('[api/prop] Found Airtable record:', record.id);

	// Extract fields
	const fields = record.fields;
	console.log('[api/prop] Fields from Airtable:', fields);

	// Return to the front-end
	res.json({
	  propShort: fields.propShort || '',
	  propSideAPct: fields.propSideAPct || 0,
	  propSideBPct: fields.propSideBPct || 0,
	  // Add other fields as needed
	});

  } catch (error) {
	// Catch any unexpected errors
	console.error('[api/prop] Error processing request:', error);
	res.status(500).json({ error: 'Something went wrong' });
  }
});

// For all other routes, serve the React index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
