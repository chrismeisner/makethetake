// File: server.js
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
 * 5) Return fields including 'PropSideAShort' and 'PropSideBShort' and 'propStatus'
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

	// We'll display these in the client
	const propShort = propsFields.propShort || '';
	const PropSideAShort = propsFields.PropSideAShort || 'PropSideAShort';
	const PropSideBShort = propsFields.PropSideBShort || 'PropSideBShort';
	const propStatus = propsFields.propStatus || 'open'; // possible values: open, closed, gradedA, gradedB

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

	// 5) Return dynamic percentages + question text + side labels + propStatus
	res.json({
	  propID,
	  propShort,
	  PropSideAShort,
	  PropSideBShort,
	  sideACount,
	  sideBCount,
	  propSideAPct: sideAPct,
	  propSideBPct: sideBPct,
	  propStatus // <-- new field
	});

  } catch (error) {
	console.error('💥 [api/prop] Unexpected error:', error);
	res.status(500).json({ error: 'Something went wrong' });
  }
});

/**
 * POST /api/take
 * 1) Ensure the prop is "open" by fetching from "Props"
 * 2) Fetch existing "Takes" for this propID
 * 3) Count sideA / sideB
 * 4) Compute "pre-take" popularity for the user's side
 * 5) Create record in "Takes"
 * 6) Return newTakeID in JSON response
 * 7) Send user an SMS link to their brand-new take
 */
app.post('/api/take', async (req, res) => {
  const { takeMobile, propID, propSide } = req.body;
  console.log('👉 [api/take] Incoming request body:', req.body);

  if (!takeMobile || !propID || !propSide) {
	console.log('❗️ [api/take] Missing required fields');
	return res.status(400).json({ error: 'Missing required fields (takeMobile, propID, propSide).' });
  }

  try {
	const apiKey    = process.env.AIRTABLE_API_KEY;
	const baseID    = process.env.AIRTABLE_BASE_ID;
	const tableName = 'Takes';

	// 1) Fetch the "Props" record to check propStatus
	const propsUrl = `https://api.airtable.com/v0/${baseID}/Props?filterByFormula={propID}='${propID}'`;
	console.log(`🔎 [api/take] Checking prop status from:\n   ${propsUrl}`);

	const propsRes = await fetch(propsUrl, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});
	if (!propsRes.ok) {
	  console.error(`❌ [api/take] Error fetching Props: ${propsRes.status} ${propsRes.statusText}`);
	  return res.status(500).json({ error: 'Failed to fetch Props from Airtable' });
	}
	const propsData = await propsRes.json();

	if (!propsData.records || propsData.records.length === 0) {
	  console.log(`[api/take] No "Props" record found for propID=${propID}`);
	  return res.status(404).json({ error: `No prop found for propID=${propID}` });
	}

	const propsRecord = propsData.records[0];
	const propStatus  = propsRecord.fields.propStatus || 'open';
	console.log(`[api/take] The propStatus is "${propStatus}"`);

	// If you want to block new takes when not "open":
	if (propStatus !== 'open') {
	  console.log(`[api/take] Prop "${propID}" is not open. Blocking new take.`);
	  return res.status(400).json({ error: `This prop is '${propStatus}'. No new takes allowed.` });
	}

	// 2) Fetch existing Takes for this prop
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

	// 3) Count sideA / sideB among existing takes
	let sideACount = 0;
	let sideBCount = 0;
	for (let rec of (takesData.records || [])) {
	  const side = rec.fields.propSide;
	  if (side === 'A') sideACount++;
	  if (side === 'B') sideBCount++;
	}
	console.log(`[api/take] Current counts => A=${sideACount}, B=${sideBCount}`);

	// 4) Compute the "pre-take" popularity using +1 offset
	//    (no increment for the new user yet)
	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;

	let sideAPct = 0;
	let sideBPct = 0;
	if (total > 0) {
	  sideAPct = Math.round((sideAwithOffset / total) * 100);
	  sideBPct = Math.round((sideBwithOffset / total) * 100);
	}

	// Store whichever side's pct the user chose
	const takePopularity = (propSide === 'A') ? sideAPct : sideBPct;
	console.log(`[api/take] PRE-take popularity => A=${sideAPct}%, B=${sideBPct}%. 
				 User chose "${propSide}", so storing ${takePopularity}%`);

	// 5) Create the new record in "Takes" table with that pre-take popularity
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
			  // If you have a formula or other method to generate "TakeID" in Airtable,
			  // ensure it’s part of your fields or automatically generated in the table
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

	// Grab the newly created record and determine the newTakeID
	const newlyCreatedRecord = data.records[0];
	const newTakeID = newlyCreatedRecord.fields.TakeID || newlyCreatedRecord.id;

	// 6) Return newTakeID along with success
	res.json({
	  success: true,
	  created: data.records[0],
	  newTakeID
	});

	// 7) Send user an SMS link to their new take (optional but recommended)
	const numericOnly = takeMobile.replace(/\D/g, '');
	const e164Phone = '+1' + numericOnly;

	try {
	  console.log(`📲 [api/take] Sending SMS link to ${e164Phone} ...`);
	  await twilioClient.messages.create({
		to: e164Phone,
		from: process.env.TWILIO_FROM_NUMBER, // e.g. "+16025551234"
		body: `Thanks for your take!\n\nView it here:\nhttps://make-the-take-app-db5f17d09089.herokuapp.com/takes/${newTakeID}`
	  });
	  console.log(`✅ [api/take] SMS link successfully sent to ${e164Phone}`);
	} catch (smsError) {
	  console.error('❌ [api/take] Error sending SMS link:', smsError);
	  // Decide if you want to fail the entire request or just log it.
	}

  } catch (err) {
	console.error('💥 [api/take] Error creating record:', err);
	res.status(500).json({ error: 'Server error creating take' });
  }
});

/**
 * GET /api/takes/:takeID
 *  - Finds a record in the "Takes" table where {TakeID} = :takeID
 *  - Returns that Take record's fields
 *  - Also uses propID to lookup the "Props" table, returning additional details
 */
app.get('/api/takes/:takeID', async (req, res) => {
  const { takeID } = req.params;
  console.log(`🔎 [GET /api/takes/${takeID}] Looking up Take record by "TakeID" field...`);

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseID = process.env.AIRTABLE_BASE_ID;

  try {
	// 1) Fetch the "Take" record from the "Takes" table by TakeID
	const takesUrl = `https://api.airtable.com/v0/${baseID}/Takes?filterByFormula={TakeID}='${takeID}'`;
	const takesResp = await fetch(takesUrl, {
	  headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!takesResp.ok) {
	  console.error(`❌ [GET /api/takes/${takeID}] Airtable error: ${takesResp.status} ${takesResp.statusText}`);
	  return res.status(500).json({ error: 'Airtable fetch error (Takes)' });
	}

	const takesData = await takesResp.json();
	if (!takesData.records || takesData.records.length === 0) {
	  console.log(`😕 [GET /api/takes/${takeID}] No matching record found for TakeID="${takeID}"`);
	  return res.status(404).json({ error: 'Take not found' });
	}

	// We'll use the first matching record
	const takeRecord = takesData.records[0];
	console.log(`✅ [GET /api/takes/${takeID}] Found Take record: ${takeRecord.id}`);

	// Extract the fields we care about
	const takeFields = takeRecord.fields;
	const relatedPropID = takeFields.propID; // We'll use this to fetch from Props

	// 2) Fetch the related "Prop" from the "Props" table by propID
	let propData = null;
	if (relatedPropID) {
	  const propsUrl = `https://api.airtable.com/v0/${baseID}/Props?filterByFormula={propID}='${relatedPropID}'`;
	  console.log(`🔎 [GET /api/takes/${takeID}] Looking up Props by propID="${relatedPropID}"`);

	  const propsResp = await fetch(propsUrl, {
		headers: { Authorization: `Bearer ${apiKey}` },
	  });

	  if (!propsResp.ok) {
		console.error(`❌ [GET /api/takes/${takeID}] Props fetch error: ${propsResp.status} ${propsResp.statusText}`);
		return res.status(500).json({ error: 'Airtable fetch error (Props)' });
	  }

	  const propsData = await propsResp.json();
	  if (propsData.records && propsData.records.length > 0) {
		const propRecord = propsData.records[0];
		const pFields = propRecord.fields;
		console.log(`✅ [GET /api/takes/${takeID}] Found Prop record: ${propRecord.id}`);

		// We only return the fields we need
		propData = {
		  airtableRecordId: propRecord.id,
		  propID: pFields.propID,
		  propShort: pFields.propShort,
		  PropSideAShort: pFields.PropSideAShort,
		  PropSideBShort: pFields.PropSideBShort,
		  propStatus: pFields.propStatus || 'open'
		  // Add any additional Prop fields you want
		};
	  } else {
		console.log(`😕 [GET /api/takes/${takeID}] No Props record found for propID="${relatedPropID}"`);
	  }
	}

	// 3) Build our "take" response object
	const take = {
	  airtableRecordId: takeRecord.id,
	  takeID: takeFields.TakeID,
	  propID: takeFields.propID,
	  propSide: takeFields.propSide,
	  takeMobile: takeFields.takeMobile,
	  takePopularity: takeFields.takePopularity,
	  createdTime: takeRecord.createdTime,
	};

	// Return the combined data: the take + (optionally) its prop
	return res.json({
	  success: true,
	  take,
	  prop: propData // may be null if no related Prop found
	});

  } catch (err) {
	console.error(`💥 [GET /api/takes/${takeID}] Unexpected error:`, err);
	return res.status(500).json({ error: 'Server error fetching take' });
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
