// server.js
const path = require('path');
const express = require('express');
const fetch = require('node-fetch'); // node-fetch@2 for CommonJS
require('dotenv').config();         // loads .env variables
const twilio = require('twilio');

// Twilio setup
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();

// Serve React's production build
app.use(express.static(path.join(__dirname, 'build')));

// Parse JSON in request bodies (needed for POST /api/take, /api/sendCode, etc.)
app.use(express.json());

/**
 * POST /api/sendCode
 *  - Receives phone (e.g., "(602) 380-2794" or "+16023802794")
 *  - Converts to E.164 (if needed)
 *  - Calls Twilio Verify to send an SMS code
 */
app.post('/api/sendCode', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
	console.log('❗ [api/sendCode] Missing phone');
	return res.status(400).json({ error: 'Missing phone' });
  }

  try {
	// Convert phone to E.164 if you're in the US, for example:
	const numericOnly = phone.replace(/\D/g, ''); // e.g., "6023802794"
	const e164Phone = '+1' + numericOnly;         // e.g., "+16023802794"
	console.log(`[api/sendCode] Sending code to ${e164Phone}`);

	const verification = await twilioClient.verify
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verifications.create({ to: e164Phone, channel: 'sms' });

	console.log('[api/sendCode] Twilio Verify sid:', verification.sid);
	return res.json({ success: true });
  } catch (err) {
	console.error('[api/sendCode] Error:', err);
	return res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/verifyCode
 *  - Receives phone and code
 *  - Checks code via Twilio Verify
 *  - If valid => success: true
 *  - If invalid => success: false
 */
app.post('/api/verifyCode', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
	console.log('❗ [api/verifyCode] Missing phone or code');
	return res.status(400).json({ error: 'Missing phone or code' });
  }

  try {
	// Convert phone to E.164 again if needed
	const numericOnly = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numericOnly;

	console.log(`[api/verifyCode] Checking code ${code} for ${e164Phone}`);
	const check = await twilioClient.verify
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verificationChecks.create({ to: e164Phone, code });

	console.log('[api/verifyCode] Twilio status:', check.status);

	if (check.status === 'approved') {
	  // Code is correct
	  return res.json({ success: true });
	} else {
	  // Invalid code
	  return res.json({ success: false, error: 'Invalid code' });
	}
  } catch (err) {
	console.error('[api/verifyCode] Error:', err);
	return res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * GET /api/prop?propID=xyz
 * 1) Fetch "Props" record for the question text, etc.
 * 2) Fetch all "Takes" where {propID}='xyz'
 * 3) Count how many sideA vs sideB
 * 4) Apply +1 offset => compute integer percentages
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

	// --- 1) Fetch the "Props" record
	const propsUrl = `https://api.airtable.com/v0/${baseID}/Props?filterByFormula={propID}='${propID}'`;
	console.log(`📡 [api/prop] Fetching props from:\n   ${propsUrl}`);

	const propsRes = await fetch(propsUrl, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!propsRes.ok) {
	  console.error(`❌ [api/prop] Props fetch error: ${propsRes.status} ${propsRes.statusText}`);
	  return res.status(500).json({ error: 'Airtable fetch error (Props)' });
	}
	const propsData = await propsRes.json();

	if (!propsData.records || propsData.records.length === 0) {
	  console.log(`😕 [api/prop] No matching record in "Props" for propID: ${propID}`);
	  return res.status(404).json({ error: 'Prop not found' });
	}

	const propsRecord = propsData.records[0];
	const propsFields = propsRecord.fields;
	console.log(`✅ [api/prop] Found Props record: ${propsRecord.id}`);

	// We'll display this in the client
	const propShort = propsFields.propShort || '';

	// --- 2) Fetch all "Takes" for this propID
	const takesUrl = `https://api.airtable.com/v0/${baseID}/Takes?filterByFormula={propID}='${propID}'`;
	console.log(`📡 [api/prop] Fetching takes from:\n   ${takesUrl}`);

	const takesRes = await fetch(takesUrl, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!takesRes.ok) {
	  console.error(`❌ [api/prop] Takes fetch error: ${takesRes.status} ${takesRes.statusText}`);
	  return res.status(500).json({ error: 'Airtable fetch error (Takes)' });
	}
	const takesData = await takesRes.json();

	console.log(`[api/prop] "Takes" total records fetched: ${takesData.records?.length || 0}`);

	// --- 3) Count how many side A vs side B
	let sideACount = 0;
	let sideBCount = 0;
	for (let rec of (takesData.records || [])) {
	  const side = rec.fields.propSide;
	  if (side === 'A') sideACount++;
	  if (side === 'B') sideBCount++;
	}
	console.log(`[api/prop] Real counts => sideA=${sideACount}, sideB=${sideBCount}`);

	// --- 4) Add +1 offset => compute integer percentages
	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;

	const sideAPct = Math.round((sideAwithOffset / total) * 100);
	const sideBPct = Math.round((sideBwithOffset / total) * 100);

	console.log(`[api/prop] With offset => A=${sideAwithOffset}, B=${sideBwithOffset}, total=${total}`);
	console.log(`[api/prop] => sideAPct=${sideAPct}%, sideBPct=${sideBPct}%`);

	// Return dynamic percentages + question text
	res.json({
	  propID,
	  propShort,
	  sideACount,
	  sideBCount,
	  propSideAPct: sideAPct,
	  propSideBPct: sideBPct,
	});

  } catch (error) {
	console.error('💥 [api/prop] Unexpected error:', error);
	res.status(500).json({ error: 'Something went wrong' });
  }
});

/**
 * POST /api/take
 * 1) Fetch existing "Takes" for this propID
 * 2) Count sideA / sideB
 * 3) Increment whichever side the user picked
 * 4) Apply +1 offset => store new popularity in "takePopularity"
 * 5) Create record in "Takes"
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
	const tableName = 'Takes';

	// 1) Fetch existing Takes
	const takesUrl = `https://api.airtable.com/v0/${baseID}/Takes?filterByFormula={propID}='${propID}'`;
	console.log(`🔎 [api/take] Fetching existing takes from:\n   ${takesUrl}`);

	const takesRes = await fetch(takesUrl, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!takesRes.ok) {
	  console.error(`❌ [api/take] Error fetching existing Takes: ${takesRes.status} ${takesRes.statusText}`);
	  return res.status(500).json({ error: 'Failed to fetch existing Takes from Airtable' });
	}

	const takesData = await takesRes.json();
	console.log(`[api/take] Found ${takesData.records?.length || 0} existing takes for propID=${propID}`);

	// 2) Count sideA / sideB
	let sideACount = 0;
	let sideBCount = 0;
	for (let rec of (takesData.records || [])) {
	  const side = rec.fields.propSide;
	  if (side === 'A') sideACount++;
	  if (side === 'B') sideBCount++;
	}
	console.log(`[api/take] Current counts => A=${sideACount}, B=${sideBCount}`);

	// 3) Simulate adding this new take => compute popularity
	if (propSide === 'A') {
	  sideACount++;
	} else {
	  sideBCount++;
	}

	// Then apply +1 offset for the snapshot popularity
	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;

	let takePopularity = 0;
	if (total > 0) {
	  if (propSide === 'A') {
		takePopularity = Math.round((sideAwithOffset / total) * 100);
	  } else {
		takePopularity = Math.round((sideBwithOffset / total) * 100);
	  }
	}
	console.log(`[api/take] After increment + offset => A=${sideAwithOffset}, B=${sideBwithOffset}, newTakePopularity=${takePopularity}%`);

	// 4) Create the new record in "Takes" table
	const createUrl = `https://api.airtable.com/v0/${baseID}/${tableName}`;
	console.log(`📡 [api/take] Creating record in "${tableName}" via: ${createUrl}`);

	const airtableRes = await fetch(createUrl, {
	  method: 'POST',
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json'
	  },
	  body: JSON.stringify({
		records: [
		  {
			fields: {
			  takeMobile,
			  propID,
			  propSide,
			  takePopularity
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
