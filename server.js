// File: server.js

require('dotenv').config();
const path = require('path');
const express = require('express');
const twilio = require('twilio');
const Airtable = require('airtable');
const session = require('express-session');

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
// 0.5) Configure express-session
// --------------------------------------
app.use(
  session({
	secret: process.env.SESSION_SECRET || 'CHANGE_THIS_BEFORE_PRODUCTION',
	resave: false,
	saveUninitialized: false,
	cookie: {
	  httpOnly: true,
	  sameSite: 'lax',
	  // maxAge: ...
	},
  })
);

// --------------------------------------
// 1) Helper: Generate random profileID
// --------------------------------------
function generateRandomProfileID(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
	result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --------------------------------------
// 2) Helper: ensureProfileRecord(phoneE164)
// --------------------------------------
async function ensureProfileRecord(phoneE164) {
  console.log('\n[ensureProfileRecord] Searching for phone:', phoneE164);

  const filterFormula = `{profileMobile} = "${phoneE164}"`;
  const found = await base('Profiles')
	.select({
	  filterByFormula: filterFormula,
	  maxRecords: 1,
	})
	.all();

  if (found && found.length > 0) {
	const existing = found[0];
	console.log('[ensureProfileRecord] Found existing profile:', existing.id);
	return {
	  airtableId: existing.id,
	  profileID: existing.fields.profileID,
	  mobile: existing.fields.profileMobile,
	};
  }

  const newProfileID = generateRandomProfileID(8);
  console.log(`[ensureProfileRecord] Creating new profile with ID="${newProfileID}"`);

  const created = await base('Profiles').create([
	{
	  fields: {
		profileMobile: phoneE164,
		profileID: newProfileID,
	  },
	},
  ]);

  const newRec = created[0];
  console.log('[ensureProfileRecord] Created profile:', newRec.id, newRec.fields);
  return {
	airtableId: newRec.id,
	profileID: newRec.fields.profileID,
	mobile: newRec.fields.profileMobile,
  };
}

// --------------------------------------
// 3) Twilio-based endpoints
// --------------------------------------
app.post('/api/sendCode', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
	return res.status(400).json({ error: 'Missing phone' });
  }

  try {
	const numeric = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numeric;
	console.log('[api/sendCode] Sending code to', e164Phone);

	const verification = await twilioClient.verify
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verifications.create({ to: e164Phone, channel: 'sms' });

	return res.json({ success: true });
  } catch (err) {
	console.error('[api/sendCode] Error:', err);
	return res.status(500).json({ error: 'Failed to send verification code' });
  }
});

app.post('/api/verifyCode', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
	return res.status(400).json({ error: 'Missing phone or code' });
  }

  try {
	const numeric = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numeric;

	const check = await twilioClient.verify
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verificationChecks.create({ to: e164Phone, code });

	if (check.status === 'approved') {
	  // If code is correct, ensure we have a Profile
	  try {
		const profile = await ensureProfileRecord(e164Phone);
		// Save user in session
		req.session.user = {
		  phone: e164Phone,
		  profileID: profile.profileID,
		};
		return res.json({ success: true });
	  } catch (errProfile) {
		return res.status(500).json({ error: 'Could not create/find profile' });
	  }
	} else {
	  return res.json({ success: false, error: 'Invalid code' });
	}
  } catch (err) {
	console.error('[api/verifyCode] Error:', err);
	return res.status(500).json({ error: 'Failed to verify code' });
  }
});

// --------------------------------------
// 3.5) Session-based login
// --------------------------------------
app.get('/api/me', (req, res) => {
  if (req.session.user) {
	return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
	if (err) {
	  console.error('[api/logout] Error:', err);
	  return res.json({ success: false });
	}
	res.clearCookie('connect.sid');
	return res.json({ success: true });
  });
});

// --------------------------------------
// 4) GET /api/prop?propID=xyz
// --------------------------------------
app.get('/api/prop', async (req, res) => {
  const propID = req.query.propID;
  if (!propID) {
	return res.status(400).json({ error: 'Missing propID' });
  }

  try {
	// Load 1 matching prop
	const found = await base('Props')
	  .select({
		filterByFormula: `{propID}='${propID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!found || found.length === 0) {
	  return res.status(404).json({ error: 'Prop not found' });
	}

	const propRec = found[0];
	const pf = propRec.fields;
	const propStatus = pf.propStatus || 'open';

	// Count how many Takes for each side
	const allTakes = await base('Takes')
	  .select({ filterByFormula: `{propID}='${propID}'`, maxRecords: 5000 })
	  .all();

	let sideACount = 0,
	  sideBCount = 0;
	for (const t of allTakes) {
	  const s = t.fields.propSide;
	  if (s === 'A') sideACount++;
	  if (s === 'B') sideBCount++;
	}

	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const propSideAPct = Math.round((sideAwithOffset / total) * 100);
	const propSideBPct = Math.round((sideBwithOffset / total) * 100);

	return res.json({
	  propID,
	  propShort: pf.propShort || '',
	  PropSideAShort: pf.PropSideAShort || 'Side A',
	  PropSideBShort: pf.PropSideBShort || 'Side B',
	  sideACount,
	  sideBCount,
	  propSideAPct,
	  propSideBPct,
	  propStatus,
	});
  } catch (err) {
	console.error('[api/prop] Error:', err);
	return res.status(500).json({ error: 'Something went wrong' });
  }
});

// --------------------------------------
// 5) POST /api/take
// --------------------------------------
app.post('/api/take', async (req, res) => {
  const { takeMobile, propID, propSide } = req.body;
  if (!takeMobile || !propID || !propSide) {
	return res
	  .status(400)
	  .json({ error: 'Missing required fields (takeMobile, propID, propSide).' });
  }

  try {
	// Check prop status
	const propsFound = await base('Props')
	  .select({
		filterByFormula: `{propID}='${propID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!propsFound || propsFound.length === 0) {
	  return res
		.status(404)
		.json({ error: `No prop found for propID=${propID}` });
	}

	const propRec = propsFound[0];
	const propStatus = propRec.fields.propStatus || 'open';
	if (propStatus !== 'open') {
	  return res
		.status(400)
		.json({ error: `This prop is '${propStatus}'. No new takes allowed.` });
	}

	// Count existing Takes
	const allTakes = await base('Takes')
	  .select({ filterByFormula: `{propID}='${propID}'`, maxRecords: 5000 })
	  .all();

	let sideACount = 0,
	  sideBCount = 0;
	for (const t of allTakes) {
	  const s = t.fields.propSide;
	  if (s === 'A') sideACount++;
	  if (s === 'B') sideBCount++;
	}
	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const sideAPct = Math.round((sideAwithOffset / total) * 100);
	const sideBPct = Math.round((sideBwithOffset / total) * 100);
	const takePopularity = propSide === 'A' ? sideAPct : sideBPct;

	// Convert phone to E.164 if needed
	let e164 = takeMobile;
	if (!e164.startsWith('+')) {
	  e164 = '+1' + e164.replace(/\D/g, '');
	}

	// Ensure a Profile
	let profile;
	try {
	  profile = await ensureProfileRecord(e164);
	} catch (errProfile) {
	  return res.status(500).json({ error: 'Could not create/find user profile' });
	}

	// Create the new Take
	const created = await base('Takes').create([
	  {
		fields: {
		  takeMobile: e164,
		  propID,
		  propSide,
		  takePopularity,
		  Profile: [profile.airtableId],
		},
	  },
	]);

	const newRec = created[0];
	const newTakeID = newRec.fields.TakeID || newRec.id;

	// Return success
	res.json({ success: true, newTakeID });

	// Optional: Send SMS link
	try {
	  await twilioClient.messages.create({
		to: e164,
		from: process.env.TWILIO_FROM_NUMBER,
		body: `Thanks for your take!\n\nView it here:\n${process.env.APP_URL}/takes/${newTakeID}`,
	  });
	} catch (smsErr) {
	  console.error('[api/take] SMS send error:', smsErr);
	}
  } catch (err) {
	console.error('[api/take] Error:', err);
	res.status(500).json({ error: 'Server error creating take' });
  }
});

// --------------------------------------
// 6) GET /api/takes/:takeID
// --------------------------------------
app.get('/api/takes/:takeID', async (req, res) => {
  const { takeID } = req.params;

  try {
	// 1) find the "Take"
	const found = await base('Takes')
	  .select({
		filterByFormula: `{TakeID}='${takeID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!found || found.length === 0) {
	  return res.status(404).json({ error: 'Take not found' });
	}

	const takeRec = found[0];
	const tf = takeRec.fields;

	// 2) If there's a propID, fetch that prop
	let propData = null;
	if (tf.propID) {
	  const propsFound = await base('Props')
		.select({
		  filterByFormula: `{propID}='${tf.propID}'`,
		  maxRecords: 1,
		})
		.all();
	  if (propsFound && propsFound.length > 0) {
		const p = propsFound[0];
		const pf = p.fields;
		propData = {
		  airtableRecordId: p.id,
		  propID: pf.propID,
		  propShort: pf.propShort,
		  PropSideAShort: pf.PropSideAShort,
		  PropSideBShort: pf.PropSideBShort,
		  propStatus: pf.propStatus || 'open',
		};
	  }
	}

	// 3) (Optional) load "Content" for that prop
	let contentData = [];
	if (tf.propID) {
	  const contentRecords = await base('Content')
		.select({
		  filterByFormula: `{propID}='${tf.propID}'`,
		  maxRecords: 100,
		})
		.all();

	  contentData = contentRecords.map((c) => {
		const cf = c.fields;
		return {
		  airtableRecordId: c.id,
		  contentTitle: cf.contentTitle || '',
		  contentURL: cf.contentURL || '',
		  contentSource: cf.contentSource || '',
		  created: c._rawJson.createdTime,
		};
	  });
	}

	// Build final "take" object
	const takeData = {
	  airtableRecordId: takeRec.id,
	  takeID: tf.TakeID,
	  propID: tf.propID,
	  propSide: tf.propSide,
	  takeMobile: tf.takeMobile,
	  takePopularity: tf.takePopularity || 0,
	  createdTime: takeRec._rawJson.createdTime,
	};

	res.json({
	  success: true,
	  take: takeData,
	  prop: propData,
	  content: contentData,
	});
  } catch (err) {
	console.error('[api/takes/:takeID] Error:', err);
	return res.status(500).json({ error: 'Server error fetching take' });
  }
});

// --------------------------------------
// 7) GET /api/leaderboard
// --------------------------------------
app.get('/api/leaderboard', async (req, res) => {
  try {
	// fetch all profiles
	const allProfiles = await base('Profiles').select({ maxRecords: 5000 }).all();
	const phoneToProfileID = new Map();
	for (const p of allProfiles) {
	  const pf = p.fields;
	  if (pf.profileMobile && pf.profileID) {
		phoneToProfileID.set(pf.profileMobile, pf.profileID);
	  }
	}

	// fetch all takes => phone -> count
	const allTakes = await base('Takes').select({ maxRecords: 5000 }).all();
	const countsMap = new Map();
	for (const t of allTakes) {
	  const ph = t.fields.takeMobile || 'Unknown';
	  countsMap.set(ph, (countsMap.get(ph) || 0) + 1);
	}

	// build final
	const leaderboard = Array.from(countsMap.entries())
	  .map(([phone, count]) => ({
		phone,
		count,
		profileID: phoneToProfileID.get(phone) || null,
	  }))
	  .sort((a, b) => b.count - a.count);

	res.json({ success: true, leaderboard });
  } catch (err) {
	console.error('[GET /api/leaderboard] Error:', err);
	res.status(500).json({ error: 'Server error generating leaderboard' });
  }
});

// --------------------------------------
// 8) GET /api/profile/:profileID
//    <-- FIXED the variable name usage here
// --------------------------------------
app.get('/api/profile/:profileID', async (req, res) => {
  const { profileID } = req.params;
  console.log(`[GET /api/profile/${profileID}] Starting lookup...`);

  try {
	// 1) fetch 1 profile
	const found = await base('Profiles')
	  .select({
		filterByFormula: `{profileID}='${profileID}'`,
		maxRecords: 1,
	  })
	  .all();

	if (!found || found.length === 0) {
	  return res.status(404).json({ error: 'Profile not found' });
	}

	const profRec = found[0];
	const pf = profRec.fields;

	// 2) if "Takes" is an array of record IDs
	let userTakes = [];
	if (Array.isArray(pf.Takes) && pf.Takes.length > 0) {
	  // Construct the filterByFormula string properly
	  const filterByFormula = `OR(${pf.Takes.map(
		(id) => `RECORD_ID() = '${id}'`
	  ).join(',')})`;

	  // Then pass it as "filterByFormula"
	  const takeRecords = await base('Takes')
		.select({ filterByFormula, maxRecords: 5000 })
		.all();

	  userTakes = takeRecords.map((t) => {
		const tf = t.fields;
		return {
		  airtableRecordId: t.id,
		  takeID: tf.TakeID || t.id,
		  propID: tf.propID || '',
		  propSide: tf.propSide || null,
		  takePopularity: tf.takePopularity || 0,
		  createdTime: t._rawJson.createdTime,
		};
	  });
	}

	// final
	const profileData = {
	  airtableRecordId: profRec.id,
	  profileID: pf.profileID,
	  profileMobile: pf.profileMobile,
	  profileUsername: pf.profileUsername || '',
	  createdTime: profRec._rawJson.createdTime,
	};

	res.json({
	  success: true,
	  profile: profileData,
	  totalTakes: userTakes.length,
	  userTakes,
	});
  } catch (err) {
	console.error('[GET /api/profile/:profileID] Error:', err);
	res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// --------------------------------------
// 9) GET /api/feed (optional feed of takes)
// --------------------------------------
app.get('/api/feed', async (req, res) => {
  try {
	const takeRecords = await base('Takes')
	  .select({
		maxRecords: 20,
		sort: [{ field: 'Created', direction: 'desc' }],
	  })
	  .all();

	const feed = [];
	for (const t of takeRecords) {
	  const tf = t.fields;
	  const createdTime = t._rawJson.createdTime;

	  const item = {
		takeID: tf.TakeID || t.id,
		propID: tf.propID,
		propSide: tf.propSide,
		createdTime,
		takePopularity: tf.takePopularity || 0,
	  };

	  // optionally fetch prop or profile data, etc.
	  feed.push(item);
	}

	return res.json({ success: true, feed });
  } catch (err) {
	console.error('[api/feed] error:', err);
	return res.status(500).json({
	  success: false,
	  error: 'Server error fetching feed',
	});
  }
});

// --------------------------------------
// 10) GET /api/props
//     (Text-based subjectID => subjectTitle/subjectLogo, plus matched content)
// --------------------------------------
app.get('/api/props', async (req, res) => {
  try {
	// 1) Fetch all props
	const propsRecords = await base('Props')
	  .select({
		view: 'Grid view',
		maxRecords: 100,
	  })
	  .all();

	const subjectIDs = new Set();
	const propIDs = new Set();

	for (const propRec of propsRecords) {
	  const f = propRec.fields;
	  if (f.propSubjectID) {
		subjectIDs.add(f.propSubjectID);
	  }
	  if (f.propID) {
		propIDs.add(f.propID);
	  }
	}

	// 2) Build a map of subjectID => {subjectTitle, subjectLogo}
	let subjectsMap = new Map();
	if (subjectIDs.size > 0) {
	  const subFilter = `OR(${[...subjectIDs]
		.map((id) => `{subjectID} = "${id}"`)
		.join(',')})`;

	  const subjectRecords = await base('Subjects')
		.select({
		  filterByFormula: subFilter,
		  maxRecords: 500,
		})
		.all();

	  subjectsMap = new Map();
	  for (const subRec of subjectRecords) {
		const sf = subRec.fields;
		const subjID = sf.subjectID;
		if (!subjID) continue;

		subjectsMap.set(subjID, {
		  subjectTitle: sf.subjectTitle || '',
		  subjectLogo: Array.isArray(sf.subjectLogo) ? sf.subjectLogo : [],
		});
	  }
	}

	// 3) Build a map of propID => array of content
	let contentMap = new Map();
	if (propIDs.size > 0) {
	  const contentFilter = `OR(${[...propIDs]
		.map((id) => `{propID} = "${id}"`)
		.join(',')})`;

	  const contentRecords = await base('Content')
		.select({
		  filterByFormula: contentFilter,
		  maxRecords: 500,
		})
		.all();

	  for (const cRec of contentRecords) {
		const cf = cRec.fields;
		const cPropID = cf.propID;
		if (!cPropID) continue;

		const contentItem = {
		  contentTitle: cf.contentTitle || '',
		  contentURL: cf.contentURL || '',
		};

		if (!contentMap.has(cPropID)) {
		  contentMap.set(cPropID, []);
		}
		contentMap.get(cPropID).push(contentItem);
	  }
	}

	// 4) Construct final props array
	const propsData = propsRecords.map((propRec) => {
	  const f = propRec.fields;
	  const createdAt = propRec._rawJson.createdTime;

	  const subID = f.propSubjectID || '';
	  let subjectTitle = '';
	  let subjectLogoUrl = '';
	  const subjObj = subjectsMap.get(subID);
	  if (subjObj) {
		subjectTitle = subjObj.subjectTitle;
		if (subjObj.subjectLogo.length > 0) {
		  subjectLogoUrl = subjObj.subjectLogo[0].url;
		}
	  }

	  const cArr = contentMap.get(f.propID) || [];

	  return {
		propID: f.propID,
		propTitle: f.propTitle || '',
		propSummary: f.propSummary || '',
		propLong: f.propLong || '',
		propStatus: f.propStatus || 'open',
		createdAt,

		// subject-related
		subjectID: subID,
		subjectTitle,
		subjectLogoUrl,

		// content-related
		content: cArr,
	  };
	});

	res.json({ success: true, props: propsData });
  } catch (err) {
	console.error('[api/props] Error:', err);
	return res.status(500).json({ success: false, error: 'Server error fetching props' });
  }
});

// --------------------------------------
// 11) Catch-all => serve index.html
// --------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// --------------------------------------
// 12) Start server
// --------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [server] Running on port ${PORT}`);
});
