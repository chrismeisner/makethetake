// server.js
const path = require('path');
const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2 for CommonJS
require('dotenv').config();         // loads .env variables

const app = express();

// Serve React's production build
app.use(express.static(path.join(__dirname, 'build')));

// Parse JSON in request bodies (needed for POST /api/take)
app.use(express.json());

/**
 * GET /api/prop?propID=xyz
 * Fetch a Prop record from Airtable's "Props" table
 */
app.get('/api/prop', async (req, res) => {
  const propID = req.query.propID;

  if (!propID) {
	console.log('❗️ [api/prop] No propID provided 🤷‍♂️');
	return res.status(400).json({ error: 'Missing propID' });
  }

  console.log(`🔎 [api/prop] Received propID: ${propID}`);

  try {
	const apiKey   = process.env.AIRTABLE_API_KEY;
	const baseID   = process.env.AIRTABLE_BASE_ID;
	const tableName = 'Props'; // your Airtable table

	// Construct Airtable URL with filterByFormula
	const url = `https://api.airtable.com/v0/${baseID}/${tableName}?filterByFormula={propID}='${propID}'`;
	console.log(`📡 [api/prop] Fetching from Airtable:\n   ${url}`);

	const airtableRes = await fetch(url, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!airtableRes.ok) {
	  console.error(`❌ [api/prop] Airtable responded with status: ${airtableRes.status} ${airtableRes.statusText}`);
	  return res.status(500).json({ error: 'Airtable fetch error' });
	}

	const data = await airtableRes.json();
	console.log('🔬 [api/prop] Airtable response data:', JSON.stringify(data, null, 2));

	if (!data.records || data.records.length === 0) {
	  console.log(`😕 [api/prop] No matching record for propID: ${propID}`);
	  return res.status(404).json({ error: 'Prop not found' });
	}

	const record = data.records[0];
	console.log(`✅ [api/prop] Found Airtable record: ${record.id}`);
	console.log('ℹ️ [api/prop] Fields:', record.fields);

	// Grab fields
	const fields = record.fields;
	// Respond with the relevant prop data
	res.json({
	  propID: fields.propID || propID,
	  propShort: fields.propShort || '',
	  propSideAPct: fields.propSideAPct || 0,
	  propSideBPct: fields.propSideBPct || 0,
	  // add more if needed
	});
  } catch (error) {
	console.error('💥 [api/prop] Unexpected error:', error);
	res.status(500).json({ error: 'Something went wrong' });
  }
});

/**
 * POST /api/take
 * Create a record in the "Takes" table with { takeMobile, propID, propSide }
 */
app.post('/api/take', async (req, res) => {
  const { takeMobile, propID, propSide } = req.body;
  console.log('👉 [api/take] Incoming request body:', req.body);

  if (!takeMobile || !propID || !propSide) {
	console.log('❗️ [api/take] Missing required fields');
	return res.status(400).json({ error: 'Missing required fields (takeMobile, propID, propSide).' });
  }

  try {
	const apiKey   = process.env.AIRTABLE_API_KEY;
	const baseID   = process.env.AIRTABLE_BASE_ID;
	const tableName = 'Takes'; // your Airtable "Takes" table

	const url = `https://api.airtable.com/v0/${baseID}/${tableName}`;
	console.log(`📡 [api/take] Creating record in "${tableName}" via: ${url}`);

	const airtableRes = await fetch(url, {
	  method: 'POST',
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json'
	  },
	  body: JSON.stringify({
		records: [
		  {
			fields: {
			  takeMobile: takeMobile,
			  propID: propID,
			  propSide: propSide
			}
		  }
		]
	  })
	});

	if (!airtableRes.ok) {
	  console.error(`❌ [api/take] Airtable creation error: ${airtableRes.status} ${airtableRes.statusText}`);
	  return res.status(500).json({ error: 'Failed to create record in Airtable' });
	}

	const data = await airtableRes.json();
	console.log('🎉 [api/take] Created record in Airtable:', JSON.stringify(data, null, 2));

	// Return success
	res.json({ success: true, created: data.records[0] });
  } catch (err) {
	console.error('💥 [api/take] Error creating record:', err);
	res.status(500).json({ error: 'Server error creating take' });
  }
});

// For any other route, serve the React index.html
app.get('*', (req, res) => {
  console.log('🌐 [server] Serving index.html for unmatched route');
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [server] Running on port ${PORT}`);
});
