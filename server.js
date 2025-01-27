// File: server.js

require('dotenv').config();
const path = require('path');
const express = require('express');
const twilio = require('twilio');
const Airtable = require('airtable'); // Official Airtable client

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// --------------------------------------
// 0) Configure Twilio + Airtable
// --------------------------------------
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY,
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// --------------------------------------
// 1) Helper: Generate a random profileID
// --------------------------------------
function generateRandomProfileID(length = 8) {
  const chars =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
	result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --------------------------------------
// 2) Helper: ensureProfileRecord(phoneE164)
//    - Returns { airtableId, profileID, mobile }
// --------------------------------------
async function ensureProfileRecord(phoneE164) {
  console.log('\n[ensureProfileRecord] Searching for phone:', phoneE164);

  // 1) Lookup in "Profiles" by filter
  const filterFormula = `{profileMobile} = "${phoneE164}"`;
  const foundRecords = await base('Profiles')
	.select({
	  filterByFormula: filterFormula,
	  maxRecords: 1,
	})
	.all();

  // 2) If found, return existing
  if (foundRecords && foundRecords.length > 0) {
	const existing = foundRecords[0];
	console.log(
	  '[ensureProfileRecord] Found existing profile:',
	  existing.id,
	  existing.fields
	);
	return {
	  airtableId: existing.id,
	  profileID: existing.fields.profileID,
	  mobile: existing.fields.profileMobile,
	};
  }

  // 3) Otherwise, create a new record
  const newProfileID = generateRandomProfileID(8);
  console.log(
	`[ensureProfileRecord] Creating new profile with ID="${newProfileID}"`
  );

  const createRecords = await base('Profiles').create([
	{
	  fields: {
		profileMobile: phoneE164,
		profileID: newProfileID,
	  },
	},
  ]);

  const newRecord = createRecords[0];
  console.log(
	'[ensureProfileRecord] Created new profile:',
	newRecord.id,
	newRecord.fields
  );

  return {
	airtableId: newRecord.id,
	profileID: newRecord.fields.profileID,
	mobile: newRecord.fields.profileMobile,
  };
}

// --------------------------------------
// 3) Twilio-based endpoints: /api/sendCode, /api/verifyCode
// --------------------------------------
app.post('/api/sendCode', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
	console.log('[api/sendCode] Missing phone');
	return res.status(400).json({ error: 'Missing phone' });
  }

  try {
	const numericOnly = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numericOnly;
	console.log(`[api/sendCode] Sending code to ${e164Phone}`);

	const verification = await twilioClient.verify
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verifications.create({ to: e164Phone, channel: 'sms' });

	console.log('[api/sendCode] Twilio Verify SID:', verification.sid);
	return res.json({ success: true });
  } catch (err) {
	console.error('[api/sendCode] Error:', err);
	return res.status(500).json({ error: 'Failed to send verification code' });
  }
});

app.post('/api/verifyCode', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
	console.log('[api/verifyCode] Missing phone or code');
	return res.status(400).json({ error: 'Missing phone or code' });
  }

  try {
	const numericOnly = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numericOnly;

	console.log(`[api/verifyCode] Checking code ${code} for ${e164Phone}`);
	const check = await twilioClient.verify
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verificationChecks.create({ to: e164Phone, code });

	console.log('[api/verifyCode] Twilio status:', check.status);

	if (check.status === 'approved') {
	  return res.json({ success: true });
	} else {
	  return res.json({ success: false, error: 'Invalid code' });
	}
  } catch (err) {
	console.error('[api/verifyCode] Error:', err);
	return res.status(500).json({ error: 'Failed to verify code' });
  }
});

// --------------------------------------
// 4) GET /api/prop?propID=xyz
// --------------------------------------
app.get('/api/prop', async (req, res) => {
  const propID = req.query.propID;
  if (!propID) {
	console.log('[api/prop] No propID provided');
	return res.status(400).json({ error: 'Missing propID' });
  }
  console.log(`[api/prop] Received propID: ${propID}`);

  try {
	// 1) Fetch the matching Props record
	const props = await base('Props')
	  .select({
		filterByFormula: `{propID}='${propID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!props || props.length === 0) {
	  console.log(`[api/prop] No matching record for propID: ${propID}`);
	  return res.status(404).json({ error: 'Prop not found' });
	}

	const propRecord = props[0];
	const propFields = propRecord.fields;

	const propShort = propFields.propShort || '';
	const PropSideAShort = propFields.PropSideAShort || 'Side A';
	const PropSideBShort = propFields.PropSideBShort || 'Side B';
	const propStatus = propFields.propStatus || 'open';

	// 2) Fetch all Takes for that prop to compute side counts
	const allTakes = await base('Takes')
	  .select({
		filterByFormula: `{propID}='${propID}'`,
		maxRecords: 5000,
	  })
	  .all();

	let sideACount = 0;
	let sideBCount = 0;
	for (const rec of allTakes) {
	  const side = rec.fields.propSide;
	  if (side === 'A') sideACount++;
	  if (side === 'B') sideBCount++;
	}

	// We'll add a +1 offset to each side to avoid 0% or 100% outcomes
	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const propSideAPct = Math.round((sideAwithOffset / total) * 100);
	const propSideBPct = Math.round((sideBwithOffset / total) * 100);

	return res.json({
	  propID,
	  propShort,
	  PropSideAShort,
	  PropSideBShort,
	  sideACount,
	  sideBCount,
	  propSideAPct,
	  propSideBPct,
	  propStatus,
	});
  } catch (error) {
	console.error('[api/prop] Unexpected error:', error);
	return res.status(500).json({ error: 'Something went wrong' });
  }
});

// --------------------------------------
// 5) POST /api/take
// --------------------------------------
app.post('/api/take', async (req, res) => {
  let { takeMobile, propID, propSide } = req.body;
  console.log('[api/take] Incoming body:', req.body);

  if (!takeMobile || !propID || !propSide) {
	return res
	  .status(400)
	  .json({ error: 'Missing required fields (takeMobile, propID, propSide).' });
  }

  try {
	// 1) Check prop status
	const props = await base('Props')
	  .select({
		filterByFormula: `{propID}='${propID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!props || props.length === 0) {
	  console.log(`[api/take] No Props record found for propID=${propID}`);
	  return res.status(404).json({ error: `No prop found for propID=${propID}` });
	}

	const propRecord = props[0];
	const propStatus = propRecord.fields.propStatus || 'open';
	if (propStatus !== 'open') {
	  console.log(`[api/take] Prop "${propID}" is not open. Blocking new take.`);
	  return res
		.status(400)
		.json({ error: `This prop is '${propStatus}'. No new takes allowed.` });
	}

	// 2) Get existing Takes to compute popularity at time of creation
	const allTakes = await base('Takes')
	  .select({
		filterByFormula: `{propID}='${propID}'`,
		maxRecords: 5000,
	  })
	  .all();

	let sideACount = 0;
	let sideBCount = 0;
	for (const rec of allTakes) {
	  const side = rec.fields.propSide;
	  if (side === 'A') sideACount++;
	  if (side === 'B') sideBCount++;
	}

	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const sideAPct = Math.round((sideAwithOffset / total) * 100);
	const sideBPct = Math.round((sideBwithOffset / total) * 100);
	const takePopularity = propSide === 'A' ? sideAPct : sideBPct;

	// 3) Convert phone to E.164
	const numericOnly = takeMobile.replace(/\D/g, '');
	const e164Phone = '+1' + numericOnly;
	takeMobile = e164Phone;

	// 4) Ensure there's a Profile record
	let profile;
	try {
	  profile = await ensureProfileRecord(e164Phone);
	  console.log('[api/take] Found or created profile:', profile);
	} catch (errProfile) {
	  console.error('[api/take] Error ensuring profile:', errProfile);
	  return res
		.status(500)
		.json({ error: 'Could not create/find user profile' });
	}

	// 5) Create the new Take
	const createRecords = await base('Takes').create([
	  {
		fields: {
		  takeMobile,
		  propID,
		  propSide,
		  takePopularity,
		  // Link to the existing Profile record by ID
		  Profile: [profile.airtableId],
		},
	  },
	]);

	const newlyCreatedRecord = createRecords[0];
	console.log('[api/take] Created new take:', newlyCreatedRecord.fields);

	// The "TakeID" might be auto-generated by a formula, or fallback to record.id
	const newTakeID =
	  newlyCreatedRecord.fields.TakeID || newlyCreatedRecord.id;

	// 6) Return newTakeID
	res.json({
	  success: true,
	  created: newlyCreatedRecord,
	  newTakeID,
	});

	// 7) Send user an SMS link (optional)
	try {
	  console.log(`[api/take] Sending SMS link to ${takeMobile}...`);
	  await twilioClient.messages.create({
		to: takeMobile,
		from: process.env.TWILIO_FROM_NUMBER,
		body: `Thanks for your take!\n\nView it here:\n${process.env.APP_URL}/takes/${newTakeID}`,
	  });
	  console.log('[api/take] SMS link sent successfully.');
	} catch (smsError) {
	  console.error('[api/take] Error sending SMS link:', smsError);
	}
  } catch (err) {
	console.error('[api/take] Error:', err);
	res.status(500).json({ error: 'Server error creating take' });
  }
});

// --------------------------------------
// 6) GET /api/takes/:takeID
//    => Now uses expand: ['Profile'] to fetch linked Profile details in one query
// --------------------------------------
app.get('/api/takes/:takeID', async (req, res) => {
  const { takeID } = req.params;
  console.log(`[GET /api/takes/${takeID}] Looking up Take by "TakeID"...`);

  try {
	// 1) Find the "Take" by formula => {TakeID}='someValue'
	//    with expand: ['Profile'] to get user info from the linked record
	const foundTakes = await base('Takes')
	  .select({
		filterByFormula: `{TakeID}='${takeID}'`,
		maxRecords: 1,
		expand: ['Profile'], // <--- HERE WE ASK AIRTABLE TO RETURN EXPANDED PROFILE DATA
	  })
	  .all();

	if (!foundTakes || foundTakes.length === 0) {
	  console.log(`[GET /api/takes/${takeID}] No match for TakeID="${takeID}"`);
	  return res.status(404).json({ error: 'Take not found' });
	}

	const takeRecord = foundTakes[0];
	const takeFields = takeRecord.fields;

	// 2) If there's a propID, fetch the related Prop
	let propData = null;
	const relatedPropID = takeFields.propID;
	if (relatedPropID) {
	  const foundProps = await base('Props')
		.select({
		  filterByFormula: `{propID}='${relatedPropID}'`,
		  maxRecords: 1,
		})
		.all();

	  if (foundProps && foundProps.length > 0) {
		const propRec = foundProps[0];
		const pFields = propRec.fields;
		propData = {
		  airtableRecordId: propRec.id,
		  propID: pFields.propID,
		  propShort: pFields.propShort,
		  PropSideAShort: pFields.PropSideAShort,
		  PropSideBShort: pFields.PropSideBShort,
		  propStatus: pFields.propStatus || 'open',
		};
	  }
	}

	// 3) (Optional) Fetch any "Content" records for that prop
	let contentData = [];
	if (relatedPropID) {
	  const contentRecords = await base('Content')
		.select({
		  filterByFormula: `{propID}='${relatedPropID}'`,
		  maxRecords: 100,
		})
		.all();

	  contentData = contentRecords.map((rec) => {
		const f = rec.fields;
		return {
		  airtableRecordId: rec.id,
		  contentTitle: f.contentTitle || '',
		  contentURL: f.contentURL || '',
		  contentSource: f.contentSource || '',
		  created: rec._rawJson.createdTime,
		};
	  });
	}

	// 4) Because we used expand: ["Profile"], the Profile field is an array of expanded records
	//    instead of just record IDs.
	let expandedProfileFields = null;
	if (Array.isArray(takeFields.Profile) && takeFields.Profile.length > 0) {
	  // The first linked profile's fields
	  expandedProfileFields = takeFields.Profile[0].fields || null;
	}

	// Extract relevant fields from the expanded profile
	const profileID = expandedProfileFields?.profileID || null;
	const profileMobile = expandedProfileFields?.profileMobile || null;
	const profileUsername = expandedProfileFields?.profileUsername || null;

	// 5) Build final "take" response
	const take = {
	  airtableRecordId: takeRecord.id,
	  takeID: takeFields.TakeID,
	  propID: takeFields.propID,
	  propSide: takeFields.propSide,
	  takeMobile: takeFields.takeMobile,
	  takePopularity: takeFields.takePopularity,
	  createdTime: takeRecord._rawJson.createdTime,
	  // Attach expanded profile fields
	  profileID,
	  profileMobile,
	  profileUsername,
	};

	return res.json({
	  success: true,
	  take,
	  prop: propData,
	  content: contentData,
	});
  } catch (err) {
	console.error(`[GET /api/takes/${takeID}] Unexpected error:`, err);
	return res.status(500).json({ error: 'Server error fetching take' });
  }
});

// --------------------------------------
// 7) GET /api/leaderboard
//    This route now also returns profileID so the UI can link phones to profiles
// --------------------------------------
app.get('/api/leaderboard', async (req, res) => {
  try {
	// 1) Fetch all Profiles to map phone -> profileID
	const allProfiles = await base('Profiles')
	  .select({ maxRecords: 5000 })
	  .all();

	const phoneToProfileID = new Map();
	for (const profileRec of allProfiles) {
	  const pf = profileRec.fields;
	  if (pf.profileMobile && pf.profileID) {
		// e.g. phone = "+16023802794", profileID = "abcd1234"
		phoneToProfileID.set(pf.profileMobile, pf.profileID);
	  }
	}

	// 2) Fetch all Takes to build (phone -> count)
	const allTakes = await base('Takes')
	  .select({ maxRecords: 5000 })
	  .all();

	const countsMap = new Map();
	for (const record of allTakes) {
	  const phone = record.fields.takeMobile || 'Unknown';
	  countsMap.set(phone, (countsMap.get(phone) || 0) + 1);
	}

	// 3) Convert countsMap into an array of { phone, count, profileID? }
	const leaderboard = Array.from(countsMap.entries())
	  .map(([phone, count]) => ({
		phone,
		count,
		profileID: phoneToProfileID.get(phone) || null, // might be null if no matching profile
	  }))
	  .sort((a, b) => b.count - a.count);

	return res.json({ success: true, leaderboard });
  } catch (err) {
	console.error('[GET /api/leaderboard] Unexpected error:', err);
	return res
	  .status(500)
	  .json({ error: 'Server error generating leaderboard' });
  }
});

// --------------------------------------
// 8) GET /api/profile/:profileID
// --------------------------------------
app.get('/api/profile/:profileID', async (req, res) => {
  const { profileID } = req.params;
  console.log(
	`\n[GET /api/profile/${profileID}] Starting lookup by profileID...`
  );

  try {
	// 1) Fetch the Profile by filter
	const profileRecords = await base('Profiles')
	  .select({
		filterByFormula: `{profileID}='${profileID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!profileRecords || profileRecords.length === 0) {
	  console.log(
		`[GET /api/profile/${profileID}] No matching profile found!`
	  );
	  return res.status(404).json({
		error: `Profile not found for profileID="${profileID}"`,
	  });
	}

	const profileRecord = profileRecords[0];
	const pf = profileRecord.fields;
	console.log(
	  `[GET /api/profile/${profileID}] Found profile =>`,
	  profileRecord.id,
	  pf
	);

	// 2) If the "Takes" field is just an array of string IDs, we do a second query.
	const linkedTakes = pf.Takes || [];
	let userTakes = [];

	if (linkedTakes.length > 0) {
	  // If the first item is a string, they're not expanded
	  if (typeof linkedTakes[0] === 'string') {
		console.log(
		  '[GET /api/profile] "Takes" are just string IDs, fetching them...'
		);
		const filterClauses = linkedTakes.map(
		  (id) => `RECORD_ID() = '${id}'`
		);
		// separate each condition with commas for OR()
		const joined = filterClauses.join(', ');
		const filter = `OR(${joined})`;

		const takesRecords = await base('Takes')
		  .select({
			filterByFormula: filter,
			maxRecords: 5000,
		  })
		  .all();

		userTakes = takesRecords.map((takeRec) => ({
		  airtableRecordId: takeRec.id,
		  takeID: takeRec.fields.TakeID || takeRec.id,
		  propID: takeRec.fields.propID || '',
		  propSide: takeRec.fields.propSide || null,
		  takePopularity: takeRec.fields.takePopularity || 0,
		  createdTime: takeRec._rawJson.createdTime,
		}));
	  } else {
		// Possibly expanded objects:
		console.log('[GET /api/profile] "Takes" are expanded objects');
		userTakes = linkedTakes.map((take) => ({
		  airtableRecordId: take.id,
		  takeID: take.fields.TakeID || take.id,
		  propID: take.fields.propID || '',
		  propSide: take.fields.propSide || null,
		  takePopularity: take.fields.takePopularity || 0,
		  createdTime: take._rawJson.createdTime,
		}));
	  }
	} else {
	  console.log('[GET /api/profile] No linked takes or empty "Takes" array.');
	}

	// 3) Build the main profile object
	const profileData = {
	  airtableRecordId: profileRecord.id,
	  profileID: pf.profileID,
	  profileMobile: pf.profileMobile,
	  profileUsername: pf.profileUsername || '',
	  createdTime: profileRecord._rawJson.createdTime,
	};

	console.log(
	  `[GET /api/profile/${profileID}] Returning profile + totalTakes=${userTakes.length}`
	);

	return res.json({
	  success: true,
	  profile: profileData,
	  totalTakes: userTakes.length,
	  userTakes,
	});
  } catch (err) {
	console.error(`[GET /api/profile/${profileID}] Unexpected error:`, err);
	return res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// --------------------------------------
// 9) Catch-all route => serve index.html
// --------------------------------------
app.get('*', (req, res) => {
  console.log('[server] Serving index.html for unmatched route');
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// --------------------------------------
// 10) Start the server
// --------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [server] Running on port ${PORT}`);
});
