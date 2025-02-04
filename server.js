require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const twilio = require('twilio');
const Airtable = require('airtable');
const session = require('express-session');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// --------------------------------------
// Twilio + Airtable setup
// --------------------------------------
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// --------------------------------------
// Session config
// --------------------------------------
app.use(
  session({
	secret: process.env.SESSION_SECRET || 'CHANGE_THIS_BEFORE_PRODUCTION',
	resave: false,
	saveUninitialized: false,
	cookie: {
	  httpOnly: true,
	  sameSite: 'lax',
	},
  })
);

// --------------------------------------
// Helper: Generate random profileID
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
// Helper: ensureProfileRecord(phoneE164)
// --------------------------------------
async function ensureProfileRecord(phoneE164) {
  const filterByFormula = `{profileMobile} = "${phoneE164}"`;
  const found = await base('Profiles')
	.select({ filterByFormula, maxRecords: 1 })
	.all();

  if (found.length > 0) {
	const existing = found[0];
	return {
	  airtableId: existing.id,
	  profileID: existing.fields.profileID,
	  mobile: existing.fields.profileMobile,
	};
  }

  const newProfileID = generateRandomProfileID(8);
  const created = await base('Profiles').create([
	{
	  fields: {
		profileMobile: phoneE164,
		profileID: newProfileID,
	  },
	},
  ]);

  const newRec = created[0];
  return {
	airtableId: newRec.id,
	profileID: newRec.fields.profileID,
	mobile: newRec.fields.profileMobile,
  };
}

// --------------------------------------
// Twilio Verify endpoints
// --------------------------------------
app.post('/api/sendCode', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  try {
	const numeric = phone.replace(/\D/g, '');
	const e164Phone = '+1' + numeric;

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
		const profile = await ensureProfileRecord(e164Phone);
		req.session.user = { phone: e164Phone, profileID: profile.profileID };
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
// Session-based login endpoints
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
// GET /api/prop
// --------------------------------------
app.get('/api/prop', async (req, res) => {
  const propID = req.query.propID;
  if (!propID) return res.status(400).json({ error: 'Missing propID' });

  try {
	const propsFound = await base('Props')
	  .select({ filterByFormula: `{propID} = "${propID}"`, maxRecords: 1 })
	  .all();

	if (propsFound.length === 0) {
	  return res.status(404).json({ error: 'Prop not found' });
	}

	const propRec = propsFound[0];
	const pf = propRec.fields;
	const createdAt = propRec._rawJson.createdTime;

	let subjectLogoUrl = '';
	if (pf.subjectLogo && Array.isArray(pf.subjectLogo) && pf.subjectLogo.length > 0) {
	  subjectLogoUrl = pf.subjectLogo[0].url || '';
	}

	let contentImageUrl = '';
	if (Array.isArray(pf.contentImage) && pf.contentImage.length > 0) {
	  contentImageUrl = pf.contentImage[0].url || '';
	}

	const contentTitles = pf.contentTitles || [];
	const contentURLs = pf.contentURLs || [];
	const contentList = contentTitles.map((title, i) => ({
	  contentTitle: title,
	  contentURL: contentURLs[i] || '',
	}));

	const allTakes = await base('Takes')
	  .select({
		filterByFormula: `AND({propID}="${propID}", {takeStatus} != "overwritten")`,
		maxRecords: 5000,
	  })
	  .all();

	let sideACount = 0;
	let sideBCount = 0;
	allTakes.forEach((t) => {
	  if (t.fields.propSide === 'A') sideACount++;
	  if (t.fields.propSide === 'B') sideBCount++;
	});

	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const propSideAPct = Math.round((sideAwithOffset / total) * 100);
	const propSideBPct = Math.round((sideBwithOffset / total) * 100);

	return res.json({
	  success: true,
	  propID,
	  ...pf,
	  createdAt,
	  subjectLogoUrl,
	  contentImageUrl,
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
// POST /api/take
// --------------------------------------
app.post('/api/take', async (req, res) => {
  const { takeMobile, propID, propSide } = req.body;
  if (!takeMobile || !propID || !propSide) {
	return res
	  .status(400)
	  .json({ error: 'Missing required fields (takeMobile, propID, propSide).' });
  }

  try {
	const propsFound = await base('Props')
	  .select({ filterByFormula: `{propID}="${propID}"`, maxRecords: 1 })
	  .all();

	if (propsFound.length === 0) {
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

	const allTakes = await base('Takes')
	  .select({
		filterByFormula: `AND({propID}="${propID}", {takeStatus} != "overwritten")`,
		maxRecords: 5000,
	  })
	  .all();

	let sideACount = 0;
	let sideBCount = 0;
	allTakes.forEach((t) => {
	  if (t.fields.propSide === 'A') sideACount++;
	  if (t.fields.propSide === 'B') sideBCount++;
	});

	const sideAwithOffset = sideACount + 1;
	const sideBwithOffset = sideBCount + 1;
	const total = sideAwithOffset + sideBwithOffset;
	const sideAPct = Math.round((sideAwithOffset / total) * 100);
	const sideBPct = Math.round((sideBwithOffset / total) * 100);
	const takePopularity = propSide === 'A' ? sideAPct : sideBPct;

	let e164 = takeMobile;
	if (!e164.startsWith('+')) {
	  e164 = '+1' + e164.replace(/\D/g, '');
	}

	const profile = await ensureProfileRecord(e164);

	// Overwrite older takes
	const existingMatches = await base('Takes')
	  .select({ filterByFormula: `AND({propID}="${propID}", {takeMobile}="${e164}")` })
	  .all();

	if (existingMatches.length > 0) {
	  const updates = existingMatches.map((rec) => ({
		id: rec.id,
		fields: { takeStatus: 'overwritten' },
	  }));
	  await base('Takes').update(updates);
	}

	// Create the new take
	const created = await base('Takes').create([
	  {
		fields: {
		  takeMobile: e164,
		  propID,
		  propSide,
		  takePopularity,
		  Profile: [profile.airtableId],
		  takeStatus: 'latest',
		  Prop: [propRec.id],
		},
	  },
	]);
	const newRec = created[0];
	const newTakeID = newRec.fields.TakeID || newRec.id;

	// Recount after the new take
	const updatedTakes = await base('Takes')
	  .select({
		filterByFormula: `AND({propID}="${propID}", {takeStatus} != "overwritten")`,
		maxRecords: 5000,
	  })
	  .all();

	let newSideACount = 0;
	let newSideBCount = 0;
	updatedTakes.forEach((t) => {
	  if (t.fields.propSide === 'A') newSideACount++;
	  if (t.fields.propSide === 'B') newSideBCount++;
	});

	res.json({
	  success: true,
	  newTakeID,
	  sideACount: newSideACount,
	  sideBCount: newSideBCount,
	});

	// Optional SMS confirmation
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
	return res.status(500).json({ error: 'Server error creating take' });
  }
});

// --------------------------------------
// GET /api/takes/:takeID
// --------------------------------------
app.get('/api/takes/:takeID', async (req, res) => {
  const { takeID } = req.params;
  try {
	const found = await base('Takes')
	  .select({ filterByFormula: `{TakeID}="${takeID}"`, maxRecords: 1 })
	  .all();

	if (found.length === 0) {
	  return res.status(404).json({ error: 'Take not found' });
	}

	const takeRec = found[0];
	const tf = takeRec.fields;
	const takeData = {
	  airtableRecordId: takeRec.id,
	  takeID: tf.TakeID || takeRec.id,
	  propID: tf.propID,
	  propSide: tf.propSide,
	  takeMobile: tf.takeMobile,
	  takePopularity: tf.takePopularity || 0,
	  createdTime: takeRec._rawJson.createdTime,
	  takeStatus: tf.takeStatus || '',
	  propTitle: tf.propTitle || '',
	  subjectTitle: tf.subjectTitle || '',
	  propSideAShort: tf.propSideAShort || 'Side A',
	  propSideBShort: tf.propSideBShort || 'Side B',
	};

	let propData = null;
	let contentData = [];

	if (tf.propID) {
	  const propsFound = await base('Props')
		.select({
		  filterByFormula: `{propID} = "${tf.propID}"`,
		  maxRecords: 1,
		})
		.all();

	  if (propsFound.length > 0) {
		const p = propsFound[0];
		const pf = p.fields;

		propData = {
		  airtableRecordId: p.id,
		  propID: pf.propID,
		  propShort: pf.propShort || '',
		  PropSideAShort: pf.PropSideAShort || 'Side A',
		  PropSideBShort: pf.PropSideBShort || 'Side B',
		  propStatus: pf.propStatus || 'open',
		  propSubjectID: pf.propSubjectID || '',
		  propTitle: pf.propTitle || '',
		  propLong: pf.propLong || '',
		};

		const contentTitles = pf.contentTitles || [];
		const contentURLs = pf.contentURLs || [];
		contentData = contentTitles.map((title, i) => ({
		  contentTitle: title,
		  contentURL: contentURLs[i] || '',
		}));
	  }
	}

	res.json({
	  success: true,
	  take: takeData,
	  prop: propData,
	  content: contentData,
	});
  } catch (err) {
	console.error('[api/takes/:takeID] Error:', err);
	return res
	  .status(500)
	  .json({ error: 'Could not fetch take data. Please try again later.' });
  }
});

// --------------------------------------
// GET /api/leaderboard
// --------------------------------------
app.get('/api/leaderboard', async (req, res) => {
  try {
	const allProfiles = await base('Profiles').select({ maxRecords: 5000 }).all();
	const phoneToProfileID = new Map();
	allProfiles.forEach((p) => {
	  const pf = p.fields;
	  if (pf.profileMobile && pf.profileID) {
		phoneToProfileID.set(pf.profileMobile, pf.profileID);
	  }
	});

	let allTakes = await base('Takes')
	  .select({
		maxRecords: 5000,
		filterByFormula: '{takeStatus} != "overwritten"',
	  })
	  .all();

	const subjectID = req.query.subjectID || null;
	if (subjectID) {
	  allTakes = allTakes.filter((t) => {
		const propSubj = t.fields.propSubjectID || [];
		return Array.isArray(propSubj)
		  ? propSubj.includes(subjectID)
		  : propSubj === subjectID;
	  });
	}

	const phoneStats = new Map();
	allTakes.forEach((t) => {
	  const ph = t.fields.takeMobile || 'Unknown';
	  const pts = t.fields.takePTS || 0;
	  const current = phoneStats.get(ph) || { takes: 0, points: 0 };
	  current.takes += 1;
	  current.points += pts;
	  phoneStats.set(ph, current);
	});

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
// GET /api/subjectIDs
// --------------------------------------
app.get('/api/subjectIDs', async (req, res) => {
  try {
	const takeRecords = await base('Takes').select({
	  filterByFormula: '{takeStatus} != "overwritten"',
	  maxRecords: 5000,
	}).all();

	const subjectSet = new Set();
	takeRecords.forEach((t) => {
	  const subjField = t.fields.propSubjectID || [];
	  if (Array.isArray(subjField)) {
		subjField.forEach((val) => subjectSet.add(val));
	  } else if (typeof subjField === 'string') {
		subjectSet.add(subjField);
	  }
	});

	const subjectIDs = Array.from(subjectSet);
	res.json({ success: true, subjectIDs });
  } catch (err) {
	console.error('[GET /api/subjectIDs] Error:', err);
	res.status(500).json({ success: false, error: 'Server error' });
  }
});

// --------------------------------------
// GET /api/related-prop
// --------------------------------------
app.get('/api/related-prop', async (req, res) => {
  const { subjectID, profileID } = req.query;
  console.log('[GET /api/related-prop] Received subjectID:', subjectID, 'and profileID:', profileID);

  if (!subjectID) {
	console.log('[GET /api/related-prop] Missing subjectID');
	return res.status(400).json({ success: false, error: 'Missing subjectID' });
  }

  try {
	console.log('[GET /api/related-prop] Querying Props table with propSubjectID =', subjectID);
	const propsFound = await base('Props')
	  .select({
		filterByFormula: `{propSubjectID}="${subjectID}"`,
		maxRecords: 100,
	  })
	  .all();
	console.log('[GET /api/related-prop] Found', propsFound.length, 'props for subjectID:', subjectID);

	if (propsFound.length === 0) {
	  console.log('[GET /api/related-prop] No props found for subjectID:', subjectID);
	  return res.json({ success: false, error: 'No props found for this subject' });
	}

	if (!profileID) {
	  console.log('[GET /api/related-prop] No profileID provided; returning first available prop');
	  return res.json({ success: true, prop: propsFound[0].fields });
	}

	console.log('[GET /api/related-prop] Querying Profiles table with profileID =', profileID);
	const profileRecords = await base('Profiles')
	  .select({
		filterByFormula: `{profileID}="${profileID}"`,
		maxRecords: 1,
	  })
	  .all();
	if (profileRecords.length === 0) {
	  console.log('[GET /api/related-prop] No profile found for profileID:', profileID);
	  return res.json({ success: true, prop: propsFound[0].fields });
	}
	const profRec = profileRecords[0];
	console.log('[GET /api/related-prop] Found profile:', profRec.fields);

	let takenPropIDs = [];
	if (Array.isArray(profRec.fields.Takes) && profRec.fields.Takes.length > 0) {
	  console.log('[GET /api/related-prop] Profile has Takes linked:', profRec.fields.Takes);
	  const recordIds = profRec.fields.Takes;
	  const orClauses = recordIds.map((id) => `RECORD_ID()="${id}"`).join(',');
	  const filterByFormula = `OR(${orClauses})`;
	  console.log('[GET /api/related-prop] Querying Takes table with filter:', filterByFormula);
	  const takeRecords = await base('Takes')
		.select({
		  filterByFormula,
		  maxRecords: 5000,
		})
		.all();
	  takenPropIDs = takeRecords
		.map((t) => t.fields.propID)
		.filter(Boolean);
	  takenPropIDs = [...new Set(takenPropIDs)];
	  console.log('[GET /api/related-prop] Found taken prop IDs:', takenPropIDs);
	} else {
	  console.log('[GET /api/related-prop] No Takes linked in profile.');
	}

	const availableProps = propsFound.filter((propRec) => {
	  const pf = propRec.fields;
	  return !takenPropIDs.includes(pf.propID);
	});
	console.log('[GET /api/related-prop] Available props count:', availableProps.length);

	if (availableProps.length > 0) {
	  console.log('[GET /api/related-prop] Returning available prop with propID:', availableProps[0].fields.propID);
	  return res.json({ success: true, prop: availableProps[0].fields });
	} else if (propsFound.length > 0) {
	  console.log('[GET /api/related-prop] Props exist for subject, but user has taken all.');
	  return res.json({
		success: true,
		prop: null,
		message: 'No more props available, good job!',
	  });
	} else {
	  console.log('[GET /api/related-prop] No props found at all.');
	  return res.json({ success: false, error: 'No prop found' });
	}
  } catch (err) {
	console.error('[GET /api/related-prop] Error:', err);
	return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// --------------------------------------
// GET /api/profile/:profileID
// --------------------------------------
app.get('/api/profile/:profileID', async (req, res) => {
  const { profileID } = req.params;
  try {
	const found = await base('Profiles')
	  .select({ filterByFormula: `{profileID}="${profileID}"`, maxRecords: 1 })
	  .all();

	if (found.length === 0) {
	  return res.status(404).json({ error: 'Profile not found' });
	}

	const profRec = found[0];
	const pf = profRec.fields;

	let userTakes = [];
	if (Array.isArray(pf.Takes) && pf.Takes.length > 0) {
	  const filterByFormula = `OR(${pf.Takes.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
	  const takeRecords = await base('Takes')
		.select({ filterByFormula, maxRecords: 5000 })
		.all();

	  userTakes = takeRecords
		.filter((t) => t.fields.takeStatus !== 'overwritten')
		.map((t) => {
		  const tf = t.fields;
		  return {
			airtableRecordId: t.id,
			takeID: tf.TakeID || t.id,
			propID: tf.propID || '',
			propSide: tf.propSide || null,
			propTitle: tf.propTitle || '',
			subjectTitle: tf.subjectTitle || '',
			takePopularity: tf.takePopularity || 0,
			createdTime: t._rawJson.createdTime,
			takeStatus: tf.takeStatus || '',
		  };
		});
	}

	const profileData = {
	  airtableRecordId: profRec.id,
	  profileID: pf.profileID,
	  profileMobile: pf.profileMobile,
	  profileUsername: pf.profileUsername || '',
	  createdTime: profRec._rawJson.createdTime,
	};

	return res.json({
	  success: true,
	  profile: profileData,
	  totalTakes: userTakes.length,
	  userTakes,
	});
  } catch (err) {
	console.error('[GET /api/profile/:profileID] Error:', err);
	return res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// --------------------------------------
// GET /api/feed
// --------------------------------------
app.get('/api/feed', async (req, res) => {
  try {
	const takeRecords = await base('Takes')
	  .select({ maxRecords: 20, sort: [{ field: 'Created', direction: 'desc' }] })
	  .all();

	const feed = takeRecords.map((t) => ({
	  takeID: t.fields.TakeID || t.id,
	  propID: t.fields.propID,
	  propSide: t.fields.propSide,
	  createdTime: t._rawJson.createdTime,
	  takePopularity: t.fields.takePopularity || 0,
	}));

	return res.json({ success: true, feed });
  } catch (err) {
	console.error('[api/feed] error:', err);
	return res.status(500).json({ success: false, error: 'Server error fetching feed' });
  }
});

// --------------------------------------
// GET /api/takes
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

	return res.json({ success: true, takes: allTakes });
  } catch (err) {
	console.error('[GET /api/takes] Error:', err);
	return res.status(500).json({ success: false, error: 'Server error fetching takes' });
  }
});

// --------------------------------------
// GET /api/props
// --------------------------------------
app.get('/api/props', async (req, res) => {
  try {
	const propsRecords = await base('Props')
	  .select({ view: 'Grid view', maxRecords: 100 })
	  .all();

	const propsData = propsRecords.map((propRec) => {
	  const f = propRec.fields;
	  const createdAt = propRec._rawJson.createdTime;

	  const subjectLogoUrls = Array.isArray(f.subjectLogo)
		? f.subjectLogo.map((item) => item.url)
		: [];
	  const contentImageUrls = Array.isArray(f.contentImage)
		? f.contentImage.map((item) => item.url)
		: [];

	  const contentTitles = f.contentTitles || [];
	  const contentURLs = f.contentURLs || [];
	  const content = contentTitles.map((title, i) => ({
		contentTitle: title,
		contentURL: contentURLs[i] || '',
	  }));

	  return {
		...f,
		createdAt,
		subjectLogoUrls,
		contentImageUrls,
		content,
	  };
	});

	return res.json({ success: true, props: propsData });
  } catch (err) {
	console.error('[api/props] Error:', err);
	return res.status(500).json({
	  success: false,
	  error: 'Server error fetching props',
	});
  }
});

// --------------------------------------
// New Endpoint: /api/prop-cover/:propID
// Generates OR serves a local PNG for this prop
// --------------------------------------
app.get('/api/prop-cover/:propID', async (req, res) => {
  const { propID } = req.params;
  console.log(`[prop-cover] Starting for propID=${propID}`);

  try {
	// Path where we'll store the screenshot
	const screenshotsDir = path.join(__dirname, 'screenshots');
	await fs.promises.mkdir(screenshotsDir, { recursive: true });

	const filePath = path.join(screenshotsDir, `prop-cover-${propID}.png`);

	// 1) If we already have a PNG on disk, serve it immediately
	if (fs.existsSync(filePath)) {
	  console.log(`[prop-cover] Found existing screenshot, serving from disk: ${filePath}`);
	  return res.sendFile(filePath);
	}

	// 2) Otherwise, fetch the prop from Airtable
	console.log('[prop-cover] Querying Airtable for that prop...');
	const propRecords = await base('Props')
	  .select({ filterByFormula: `{propID}="${propID}"`, maxRecords: 1 })
	  .all();

	console.log(`[prop-cover] Prop records found: ${propRecords.length}`);
	if (!propRecords.length) {
	  console.log('[prop-cover] No matching prop found, returning 404.');
	  return res.status(404).send('Prop not found');
	}

	const propFields = propRecords[0].fields;
	const { propTitle, propSummary, subjectTitle, contentImage } = propFields;

	let contentImageUrl = '';
	if (Array.isArray(contentImage) && contentImage.length > 0) {
	  contentImageUrl = contentImage[0].url;
	  console.log(`[prop-cover] Found contentImage: ${contentImageUrl}`);
	} else {
	  console.log('[prop-cover] No contentImage found.');
	}

	// 3) Construct HTML for Puppeteer (1200x630 recommended)
	console.log('[prop-cover] Constructing HTML content...');
	const htmlContent = `
	  <!DOCTYPE html>
	  <html lang="en">
	  <head>
		<meta charset="UTF-8" />
		<title>Cover for Prop ${propID}</title>
		<style>
		  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@600&display=swap');
		  * {
			box-sizing: border-box; margin: 0; padding: 0;
		  }
		  html, body {
			width: 1200px; height: 630px;
			margin: 0; padding: 0;
			font-family: 'Open Sans', sans-serif;
		  }
		  .container {
			width: 1200px; height: 630px;
			display: flex; flex-direction: column;
			align-items: center; justify-content: center;
			text-align: center;
			background: #333; color: #fff;
			padding: 40px;
		  }
		  h1 { font-size: 48px; margin-bottom: 20px; }
		  h2 { font-size: 28px; margin-bottom: 10px; }
		  p  { font-size: 24px; margin-bottom: 20px; }
		  .image-container {
			margin: 20px 0;
		  }
		  .image-container img {
			max-width: 500px;
			max-height: 300px;
			object-fit: cover;
		  }
		</style>
	  </head>
	  <body>
		<div class="container">
		  <h1>${propTitle || 'Untitled Prop'}</h1>
		  <h2>${subjectTitle || ''}</h2>
		  <p>${propSummary || ''}</p>
		  <div class="image-container">
			${contentImageUrl ? `<img src="${contentImageUrl}" alt="Prop Image" />` : ''}
		  </div>
		</div>
	  </body>
	  </html>
	`;

	// 4) Launch Puppeteer & screenshot
	console.log('[prop-cover] Launching Puppeteer...');
	const browser = await puppeteer.launch({
	  headless: true,
	  args: ['--no-sandbox', '--disable-setuid-sandbox'],
	  executablePath: process.env.CHROME_BIN // if needed on some hosts
	});
	const page = await browser.newPage();
	console.log('[prop-cover] Puppeteer newPage() created. Setting viewport...');
	await page.setViewport({ width: 1200, height: 630 });
	console.log('[prop-cover] Navigating to data: URL...');
	await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, {
	  waitUntil: 'networkidle0',
	});
	console.log('[prop-cover] HTML loaded, taking screenshot...');

	const screenshotBuffer = await page.screenshot({ type: 'png' });
	console.log(`[prop-cover] Screenshot done. Buffer length=${screenshotBuffer.length}`);

	await browser.close();
	console.log('[prop-cover] Puppeteer closed browser.');

	// 5) Save the PNG locally & serve
	await fs.promises.writeFile(filePath, screenshotBuffer);
	console.log(`[prop-cover] Screenshot saved locally at: ${filePath}`);

	res.setHeader('Content-Type', 'image/png');
	console.log('[prop-cover] Sending screenshot to client...');
	res.send(screenshotBuffer);

  } catch (err) {
	console.error('[prop-cover] Error generating prop cover:', err);
	res.status(500).send('Error generating image');
  }
});

// --------------------------------------
// Catch-all => serve index.html
// --------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// --------------------------------------
// Start server
// --------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [server] Running on port ${PORT}`);
});
