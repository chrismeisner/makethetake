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

// Debug logs: confirm environment variables
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN);
console.log('APP_URL:', process.env.APP_URL);

twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID)
  .fetch()
  .then(account => console.log('Fetched account friendlyName:', account.friendlyName))
  .catch(err => console.error('Failed to fetch account:', err));

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
  console.log('[ensureProfileRecord] Checking phone:', phoneE164);

  const filterByFormula = `{profileMobile} = "${phoneE164}"`;
  const found = await base('Profiles')
	.select({
	  filterByFormula,
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
  console.log('[ensureProfileRecord] Creating new profile with ID:', newProfileID);

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
// 3) Twilio-based endpoints (Verify v2)
// --------------------------------------
app.post('/api/sendCode', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
	return res.status(400).json({ error: 'Missing phone' });
  }

  try {
	const numeric = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numeric;
	console.log('[api/sendCode] Sending code to:', e164Phone);

	await twilioClient.verify.v2
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

	const check = await twilioClient.verify.v2
	  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
	  .verificationChecks.create({ to: e164Phone, code });

	if (check.status === 'approved') {
	  try {
		// If code is correct, ensure profile
		const profile = await ensureProfileRecord(e164Phone);
		// Save user in session
		req.session.user = {
		  phone: e164Phone,
		  profileID: profile.profileID,
		};
		return res.json({ success: true });
	  } catch (errProfile) {
		console.error('[api/verifyCode] Profile error:', errProfile);
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
	const createdAt = propRec._rawJson.createdTime;

	// Subject info
	let subjectTitle = '';
	let subjectLogoUrl = '';
	if (pf.propSubjectID) {
	  const subFound = await base('Subjects')
		.select({
		  filterByFormula: `{subjectID} = "${pf.propSubjectID}"`,
		  maxRecords: 1,
		})
		.all();
	  if (subFound && subFound.length > 0) {
		const sf = subFound[0].fields;
		subjectTitle = sf.subjectTitle || '';
		if (sf.subjectLogo && Array.isArray(sf.subjectLogo) && sf.subjectLogo.length > 0) {
		  subjectLogoUrl = sf.subjectLogo[0].url;
		}
	  }
	}

	// Count takes
	const allTakes = await base('Takes')
	  .select({ filterByFormula: `{propID}='${propID}'`, maxRecords: 5000 })
	  .all();

	let sideACount = 0;
	let sideBCount = 0;
	for (const t of allTakes) {
	  if (t.fields.propSide === 'A') sideACount++;
	  if (t.fields.propSide === 'B') sideBCount++;
	}
	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const propSideAPct = Math.round((sideAwithOffset / total) * 100);
	const propSideBPct = Math.round((sideBwithOffset / total) * 100);

	// Content
	const contentRecords = await base('Content')
	  .select({
		filterByFormula: `{propID} = '${propID}'`,
		maxRecords: 100,
	  })
	  .all();

	const contentList = contentRecords.map((cRec) => {
	  const cf = cRec.fields;
	  let contentImageUrl = '';
	  if (cf.contentImage && Array.isArray(cf.contentImage) && cf.contentImage.length > 0) {
		contentImageUrl = cf.contentImage[0].url;
	  }
	  return {
		contentTitle: cf.contentTitle || '',
		contentURL: cf.contentURL || '',
		contentImageUrl,
	  };
	});

	return res.json({
	  success: true,
	  propID,
	  propTitle: pf.propTitle || '',
	  propSummary: pf.propSummary || '',
	  propShort: pf.propShort || '',
	  propLong: pf.propLong || '',
	  propStatus: pf.propStatus || 'open',

	  createdAt,
	  subjectTitle,
	  subjectLogoUrl,

	  PropSideAShort: pf.PropSideAShort || 'Side A',
	  PropSideBShort: pf.PropSideBShort || 'Side B',

	  sideACount,
	  sideBCount,
	  propSideAPct,
	  propSideBPct,
	  content: contentList,
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
	// 1) Check prop
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
	const propAirtableID = propRec.id;
	const propStatus = propRec.fields.propStatus || 'open';

	if (propStatus !== 'open') {
	  return res
		.status(400)
		.json({ error: `This prop is '${propStatus}'. No new takes allowed.` });
	}

	// 2) Count existing
	const allTakes = await base('Takes')
	  .select({ filterByFormula: `{propID}='${propID}'`, maxRecords: 5000 })
	  .all();

	let sideACount = 0;
	let sideBCount = 0;
	for (const t of allTakes) {
	  if (t.fields.propSide === 'A') sideACount++;
	  if (t.fields.propSide === 'B') sideBCount++;
	}

	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const sideAPct = Math.round((sideAwithOffset / total) * 100);
	const sideBPct = Math.round((sideBwithOffset / total) * 100);
	const takePopularity = propSide === 'A' ? sideAPct : sideBPct;

	// 3) E.164
	let e164 = takeMobile;
	if (!e164.startsWith('+')) {
	  e164 = '+1' + e164.replace(/\D/g, '');
	}

	// 4) Ensure profile
	const profile = await ensureProfileRecord(e164);

	// 5) Mark older takes as overwritten
	const existingMatches = await base('Takes')
	  .select({
		filterByFormula: `AND({propID}="${propID}", {takeMobile}="${e164}")`,
		maxRecords: 50,
	  })
	  .all();

	if (existingMatches.length > 0) {
	  const updates = existingMatches.map((rec) => ({
		id: rec.id,
		fields: {
		  takeStatus: 'overwritten',
		},
	  }));
	  await base('Takes').update(updates);
	}

	// 6) Create new "latest" take
	const created = await base('Takes').create([
	  {
		fields: {
		  takeMobile: e164,
		  propID,
		  propSide,
		  takePopularity,
		  Profile: [profile.airtableId],
		  takeStatus: 'latest',
		  Prop: [propAirtableID],
		},
	  },
	]);
	const newRec = created[0];
	const newTakeID = newRec.fields.TakeID || newRec.id;

	// 7) Re‐fetch all takes => new side counts
	const updatedTakes = await base('Takes')
	  .select({ filterByFormula: `{propID}='${propID}'`, maxRecords: 5000 })
	  .all();

	let newSideACount = 0;
	let newSideBCount = 0;
	for (const t of updatedTakes) {
	  if (t.fields.propSide === 'A') newSideACount++;
	  if (t.fields.propSide === 'B') newSideBCount++;
	}

	// 8) Return success
	res.json({
	  success: true,
	  newTakeID,
	  sideACount: newSideACount,
	  sideBCount: newSideBCount,
	});

	// 9) Optional SMS confirmation
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

	// If there's a propID, fetch prop
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

	// Optional: load "Content" for that prop
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
		let contentImageUrl = '';
		if (cf.contentImage && Array.isArray(cf.contentImage) && cf.contentImage.length > 0) {
		  contentImageUrl = cf.contentImage[0].url;
		}
		return {
		  airtableRecordId: c.id,
		  contentTitle: cf.contentTitle || '',
		  contentURL: cf.contentURL || '',
		  contentSource: cf.contentSource || '',
		  contentImageUrl,
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
	  takeStatus: tf.takeStatus || '',
	};

	res.json({
	  success: true,
	  take: takeData,
	  prop: propData,
	  content: contentData,
	});
  } catch (err) {
	console.error('[api/takes/:takeID] Error:', err);
	return res.status(500).json({ error: 'Could not fetch take data. Please try again later.' });
  }
});

// --------------------------------------
// 7) GET /api/leaderboard (UPDATED to allow ?subjectID=... with includes check)
// --------------------------------------
app.get('/api/leaderboard', async (req, res) => {
  try {
	// 1) Load all Profiles => map phone => profileID
	const allProfiles = await base('Profiles').select({ maxRecords: 5000 }).all();
	const phoneToProfileID = new Map();
	for (const p of allProfiles) {
	  const pf = p.fields;
	  if (pf.profileMobile && pf.profileID) {
		phoneToProfileID.set(pf.profileMobile, pf.profileID);
	  }
	}

	// 2) Load all Takes, but exclude ones with {takeStatus} != "overwritten"
	let allTakes = await base('Takes')
	  .select({
		maxRecords: 5000,
		filterByFormula: '{takeStatus} != "overwritten"',
	  })
	  .all();

	// 3) If we have ?subjectID=..., filter accordingly
	const subjectID = req.query.subjectID || null;
	if (subjectID) {
	  allTakes = allTakes.filter((t) => {
		// "propSubjectID" might be an array
		const propSubj = t.fields.propSubjectID || [];
		if (Array.isArray(propSubj)) {
		  return propSubj.includes(subjectID);
		} else {
		  return propSubj === subjectID;
		}
	  });
	}

	// 4) Track the count & sum of takePTS
	const phoneStats = new Map();
	for (const t of allTakes) {
	  const ph = t.fields.takeMobile || 'Unknown';
	  const pts = t.fields.takePTS || 0;
	  const current = phoneStats.get(ph) || { takes: 0, points: 0 };

	  current.takes += 1;
	  current.points += pts;

	  phoneStats.set(ph, current);
	}

	// 5) Final array => sort by points desc
	const leaderboard = Array.from(phoneStats.entries())
	  .map(([phone, stats]) => ({
		phone,
		count: stats.takes,
		points: stats.points,
		profileID: phoneToProfileID.get(phone) || null,
	  }))
	  .sort((a, b) => b.points - a.points);

	res.json({ success: true, leaderboard });
  } catch (err) {
	console.error('[GET /api/leaderboard] Error:', err);
	res.status(500).json({ error: 'Server error generating leaderboard' });
  }
});

// --------------------------------------
// 7.5) GET /api/subjectIDs (NEW route to get distinct propSubjectID values)
// --------------------------------------
app.get('/api/subjectIDs', async (req, res) => {
  try {
	// 1) Load all Takes (not overwritten)
	const takeRecords = await base('Takes').select({
	  filterByFormula: '{takeStatus} != "overwritten"',
	  maxRecords: 5000,
	}).all();

	// 2) Build a set of subject IDs from propSubjectID
	const subjectSet = new Set();
	for (const t of takeRecords) {
	  const subjField = t.fields.propSubjectID || [];
	  // If it's an array, add each
	  if (Array.isArray(subjField)) {
		subjField.forEach((val) => subjectSet.add(val));
	  } else if (typeof subjField === 'string') {
		subjectSet.add(subjField);
	  }
	}

	// 3) Convert set to array
	const subjectIDs = Array.from(subjectSet);
	res.json({ success: true, subjectIDs });
  } catch (err) {
	console.error('[GET /api/subjectIDs] Error:', err);
	res.status(500).json({ success: false, error: 'Server error fetching subject IDs' });
  }
});

// --------------------------------------
// 8) GET /api/profile/:profileID
// --------------------------------------
app.get('/api/profile/:profileID', async (req, res) => {
  const { profileID } = req.params;
  console.log(`[GET /api/profile/${profileID}] Starting lookup...`);

  try {
	// 1) Find the single matching profile
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

	// 2) Build a filter to fetch all relevant Takes
	let userTakes = [];
	if (Array.isArray(pf.Takes) && pf.Takes.length > 0) {
	  const filterByFormula = `OR(${pf.Takes.map(
		(id) => `RECORD_ID() = '${id}'`
	  ).join(',')})`;

	  const takeRecords = await base('Takes')
		.select({ filterByFormula, maxRecords: 5000 })
		.all();

	  // 3) Map the take data, skip any with takeStatus="overwritten"
	  userTakes = takeRecords
		.filter((t) => t.fields.takeStatus !== 'overwritten')
		.map((t) => {
		  const tf = t.fields;

		  // Derive a side label if needed
		  let sideLabel = '';
		  if (tf.propSide === 'A') {
			sideLabel = tf.propSideAShort || 'Side A';
		  } else if (tf.propSide === 'B') {
			sideLabel = tf.propSideBShort || 'Side B';
		  }

		  let contentImageUrl = '';
		  if (Array.isArray(tf.contentImage) && tf.contentImage.length > 0) {
			contentImageUrl = tf.contentImage[0].url;
		  }

		  return {
			airtableRecordId: t.id,
			takeID: tf.TakeID || t.id,
			propID: tf.propID || '',
			propSide: tf.propSide || null,
			sideLabel,
			propTitle: tf.propTitle || '',
			contentImageUrl,
			takePopularity: tf.takePopularity || 0,
			createdTime: t._rawJson.createdTime,
			takeStatus: tf.takeStatus || '',
		  };
		});
	}

	// 4) Prepare the final profile object
	const profileData = {
	  airtableRecordId: profRec.id,
	  profileID: pf.profileID,
	  profileMobile: pf.profileMobile,
	  profileUsername: pf.profileUsername || '',
	  createdTime: profRec._rawJson.createdTime,
	};

	// 5) Return the JSON
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

	const feed = takeRecords.map((t) => {
	  const tf = t.fields;
	  return {
		takeID: tf.TakeID || t.id,
		propID: tf.propID,
		propSide: tf.propSide,
		createdTime: t._rawJson.createdTime,
		takePopularity: tf.takePopularity || 0,
	  };
	});

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
// 9.5) GET /api/takes
// --------------------------------------
app.get('/api/takes', async (req, res) => {
  try {
	const takeRecords = await base('Takes')
	  .select({
		filterByFormula: '{takeStatus} != "overwritten"',
		maxRecords: 5000,
		sort: [{ field: 'Created', direction: 'desc' }],
	  })
	  .all();

	const allTakes = takeRecords.map((t) => ({
	  ...t.fields,
	  airtableId: t.id,
	  createdTime: t._rawJson.createdTime,
	}));

	res.json({
	  success: true,
	  takes: allTakes,
	});
  } catch (err) {
	console.error('[GET /api/takes] Error:', err);
	res.status(500).json({
	  success: false,
	  error: 'Server error fetching takes',
	});
  }
});

// --------------------------------------
// 10) GET /api/props
// --------------------------------------
app.get('/api/props', async (req, res) => {
  try {
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

		PropSideAShort: f.PropSideAShort || 'Side A',
		PropSideBShort: f.PropSideBShort || 'Side B',

		subjectID: subID,
		subjectTitle,
		subjectLogoUrl,
		content: cArr,
	  };
	});

	return res.json({ success: true, props: propsData });
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
