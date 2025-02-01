// File: src/VerificationWidget.js
import React, { useContext, useState, useEffect } from 'react';
import InputMask from 'react-input-mask';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from './UserContext';

// --------------------------------------
// 1) Helper to compute side A/B percentages (with +1 offset)
// --------------------------------------
function computeSidePercents(aCount, bCount) {
  const aWithOffset = aCount + 1;
  const bWithOffset = bCount + 1;
  const total = aWithOffset + bWithOffset;
  const aPct = Math.round((aWithOffset / total) * 100);
  const bPct = Math.round((bWithOffset / total) * 100);
  return { aPct, bPct };
}

// --------------------------------------
// 2) Choice component
// --------------------------------------
function Choice({
  label,
  percentage,
  sideValue,
  gradedSide,
  isSelected,
  anySideSelected,
  showResults,
  propStatus,
  onSelect,
  highlightUser = false,
  userSide = '',      // The user's verified side (if any)
  selectedChoice = '' // The user's current selection
}) {
  const [isHovered, setIsHovered] = useState(false);

  // If the user has a verified side, check if this is that side
  const isVerifiedSide = userSide && sideValue === userSide;
  // The contrarian side is whenever selectedChoice != userSide
  const hasSelectedContrarian = userSide && selectedChoice && selectedChoice !== userSide;

  // Decide if we allow clicking:
  // - Only open props are clickable.
  // - If user has no verified side => both sides are clickable
  // - If this side is the verified side => clickable only if user has "selected contrarian" (so we can flip back)
  // - If it's the contrarian side => always clickable if open
  let clickable = false;
  if (propStatus === 'open') {
	if (!userSide) {
	  clickable = true; // no verified side => everything is clickable
	} else if (isVerifiedSide) {
	  clickable = hasSelectedContrarian; // only clickable if user is currently messing with contrarian
	} else {
	  // contrarian side => always clickable if open
	  clickable = true;
	}
  }

  const backgroundColor = !anySideSelected ? '#f9f9f9' : '#ffffff';
  const outlineStyle = isSelected ? '2px solid #3b82f6' : 'none';
  const baseBorder = '1px solid #ddd';
  const hoverBorder = '1px solid #aaa';

  // For the fill bar
  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`;
  const fillWidth = showResults ? `${percentage}%` : '0%';

  // If gradedSide is "A" or "B", prepend ✅ or ❌
  let displayedLabel = label;
  if (gradedSide) {
	if (sideValue === gradedSide) {
	  displayedLabel = '✅ ' + displayedLabel;
	} else {
	  displayedLabel = '❌ ' + displayedLabel;
	}
  }

  // If highlightUser => prepend "🏴‍☠️"
  if (highlightUser) {
	displayedLabel = '🏴‍☠️ ' + displayedLabel;
  }

  return (
	<div
	  onClick={clickable ? onSelect : undefined}
	  onMouseEnter={() => clickable && setIsHovered(true)}
	  onMouseLeave={() => clickable && setIsHovered(false)}
	  style={{
		position: 'relative',
		marginBottom: '0.5rem',
		padding: '1rem',
		cursor: clickable ? 'pointer' : 'default',
		backgroundColor,
		border: isHovered && clickable ? hoverBorder : baseBorder,
		outline: outlineStyle,
		overflow: 'hidden',
		textAlign: 'left',
		opacity: clickable ? 1 : 0.8,
		transition: 'border-color 0.2s ease'
	  }}
	>
	  {/* Fill bar for results */}
	  <div
		style={{
		  position: 'absolute',
		  top: 0,
		  left: 0,
		  width: fillWidth,
		  height: '100%',
		  backgroundColor: fillColor,
		  zIndex: 0,
		  transition: 'width 0.4s ease'
		}}
	  />
	  <div style={{ position: 'relative', zIndex: 1 }}>
		<span>{displayedLabel}</span>
		{showResults && <span style={{ marginLeft: 6 }}>({percentage}%)</span>}
	  </div>
	</div>
  );
}

// --------------------------------------
// 3) PropChoices
// --------------------------------------
function PropChoices({
  propStatus,
  gradedSide = '',
  selectedChoice,
  resultsRevealed,
  onSelectChoice,
  sideAPct,
  sideBPct,
  sideALabel,
  sideBLabel,
  userSide = ''
}) {
  const anySideSelected = selectedChoice !== '';
  const choices = [
	{ value: 'A', label: sideALabel, percentage: sideAPct },
	{ value: 'B', label: sideBLabel, percentage: sideBPct }
  ];

  return (
	<div style={{ marginBottom: '1rem' }}>
	  {choices.map((choice) => {
		const isSelected = selectedChoice === choice.value;
		const highlightUser = userSide === choice.value;

		return (
		  <Choice
			key={choice.value}
			label={choice.label}
			sideValue={choice.value}
			percentage={choice.percentage}
			gradedSide={gradedSide}
			isSelected={isSelected}
			anySideSelected={anySideSelected}
			showResults={resultsRevealed}
			propStatus={propStatus}
			onSelect={() => onSelectChoice(choice.value)}
			highlightUser={highlightUser}
			userSide={userSide}           
			selectedChoice={selectedChoice}
		  />
		);
	  })}
	</div>
  );
}

// --------------------------------------
// 4) PhoneNumberForm
// --------------------------------------
function PhoneNumberForm({ phoneNumber, onSubmit, selectedChoice }) {
  const [localPhone, setLocalPhone] = useState(phoneNumber);
  const numericPhone = localPhone.replace(/\D/g, '');
  const isPhoneValid = numericPhone.length === 10;
  const hasSide = selectedChoice !== '';
  const isDisabled = !isPhoneValid || !hasSide;

  async function handleSend() {
	try {
	  const resp = await fetch('/api/sendCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone: localPhone })
	  });
	  if (!resp.ok) {
		console.error('Failed to send verification code');
		return;
	  }
	  onSubmit(localPhone);
	} catch (err) {
	  console.error('[PhoneNumberForm] Error sending code:', err);
	}
  }

  return (
	<div style={{ marginBottom: '1rem' }}>
	  <label style={{ display: 'block', marginBottom: '0.5rem' }}>
		Phone Number
	  </label>
	  <div style={{ display: 'flex', gap: '0.5rem' }}>
		<InputMask
		  mask="(999) 999-9999"
		  value={localPhone}
		  onChange={(e) => setLocalPhone(e.target.value)}
		>
		  {() => (
			<input
			  type="tel"
			  placeholder="(555) 555-1234"
			  style={{ flex: 1, backgroundColor: '#f5f5f5' }}
			/>
		  )}
		</InputMask>
		<button
		  onClick={handleSend}
		  disabled={isDisabled}
		  className={
			isDisabled
			  ? 'bg-blue-500 text-white px-4 py-2 rounded opacity-50 cursor-not-allowed'
			  : 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
		  }
		>
		  Send Verification Code
		</button>
	  </div>
	</div>
  );
}

// --------------------------------------
// 5) VerificationForm
// --------------------------------------
function VerificationForm({ phoneNumber, selectedChoice, propID, onComplete }) {
  const [localCode, setLocalCode] = useState('');
  const { setLoggedInUser } = useContext(UserContext);

  async function handleVerify() {
	const numeric = localCode.replace(/\D/g, '');
	if (numeric.length !== 6) {
	  console.log('Invalid code length');
	  return;
	}
	try {
	  // 1) Verify the code
	  const verifyResp = await fetch('/api/verifyCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone: phoneNumber, code: numeric })
	  });
	  const verifyData = await verifyResp.json();
	  if (!verifyData.success) {
		console.error('Code verification failed');
		return;
	  }

	  // 2) If verified, fetch /api/me
	  const meResp = await fetch('/api/me', { credentials: 'include' });
	  const meData = await meResp.json();
	  if (meData.loggedIn && meData.user) {
		setLoggedInUser(meData.user);
	  }

	  // 3) Create the take
	  const takeBody = {
		takeMobile: phoneNumber,
		propID,
		propSide: selectedChoice
	  };
	  const takeResp = await fetch('/api/take', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(takeBody)
	  });
	  if (!takeResp.ok) {
		console.error('Failed to log the take');
		return;
	  }
	  const takeData = await takeResp.json();
	  if (!takeData.success) {
		console.error('Failed to create the take');
		return;
	  }

	  // 4) Fire parent callback
	  onComplete(takeData.newTakeID, {
		success: true,
		sideACount: takeData.sideACount,
		sideBCount: takeData.sideBCount
	  });
	} catch (err) {
	  console.error('[VerificationForm] Error verifying code:', err);
	}
  }

  function handleResend() {
	console.log(`[VerificationForm] Resending code to "${phoneNumber}"...`);
  }

  return (
	<div style={{ marginBottom: '1rem' }}>
	  <label style={{ display: 'block', marginBottom: '0.5rem' }}>
		Enter Your 6-Digit Verification Code
	  </label>
	  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
		<InputMask
		  mask="999999"
		  maskPlaceholder=""
		  value={localCode}
		  onChange={(e) => setLocalCode(e.target.value)}
		>
		  {() => (
			<input
			  type="tel"
			  placeholder="123456"
			  style={{ flex: 1, backgroundColor: '#f5f5f5' }}
			/>
		  )}
		</InputMask>
		<button
		  onClick={handleVerify}
		  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
		>
		  Verify
		</button>
		<button
		  onClick={handleResend}
		  className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
		>
		  Resend It
		</button>
	  </div>
	</div>
  );
}

// --------------------------------------
// 6) MakeTakeButton
// --------------------------------------
function MakeTakeButton({
  selectedChoice,
  propID,
  onTakeComplete,
  loggedInUser,
  alreadyTookSide
}) {
  const [confirming, setConfirming] = useState(false);

  // If user has no selection or is picking the same verified side => disabled
  const userHasExistingTake = !!alreadyTookSide;
  const isSameSideAsVerified = userHasExistingTake && selectedChoice === alreadyTookSide;
  const disabled = !selectedChoice || isSameSideAsVerified;

  // Conditionally set the button label
  const buttonLabel = userHasExistingTake ? 'Update Take' : 'Make The Take';

  async function handleClick() {
	// First click => set "confirming"
	if (!confirming) {
	  setConfirming(true);
	  return;
	}

	// Second click => perform the take or update
	try {
	  const body = {
		takeMobile: loggedInUser.phone,
		propID,
		propSide: selectedChoice
	  };
	  const resp = await fetch('/api/take', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body)
	  });
	  if (!resp.ok) {
		console.error('Failed to create/update take');
		setConfirming(false);
		return;
	  }
	  const data = await resp.json();
	  if (!data.success) {
		console.error('Backend error creating take');
		setConfirming(false);
		return;
	  }

	  // Fire callback
	  onTakeComplete(data.newTakeID, {
		success: true,
		sideACount: data.sideACount,
		sideBCount: data.sideBCount
	  });
	  setConfirming(false);
	} catch (error) {
	  console.error('[MakeTakeButton] Error:', error);
	  setConfirming(false);
	}
  }

  return (
	<div style={{ margin: '1rem 0' }}>
	  <button
		onClick={handleClick}
		disabled={disabled}
		className={
		  disabled
			? 'bg-blue-500 text-white px-4 py-2 rounded opacity-50 cursor-not-allowed'
			: 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
		}
	  >
		{buttonLabel}
	  </button>
	  {confirming && !disabled && (
		<span style={{ color: 'blue', marginLeft: '0.5rem' }}>
		  Click again to confirm your take on side "{selectedChoice}"!
		</span>
	  )}
	</div>
  );
}

// --------------------------------------
// 7) CompleteStep
// --------------------------------------
function CompleteStep({ takeID }) {
  if (!takeID) return null;
  const takeUrl = window.location.origin + '/takes/' + takeID;
  const tweetText = `I just made my take! Check it out:\n\n${takeUrl} #MakeTheTake`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  return (
	<div style={{ marginTop: '1rem' }}>
	  <h3>Thanks!</h3>
	  <p>Your take was logged successfully.</p>
	  <p>
		<a href={`/takes/${takeID}`} target="_blank" rel="noreferrer">
		  View your new take here
		</a>
	  </p>
	  <p>
		<a
		  href={tweetHref}
		  target="_blank"
		  rel="noreferrer"
		  style={{ color: '#1DA1F2', textDecoration: 'underline' }}
		>
		  Tweet this take
		</a>
	  </p>
	</div>
  );
}

// --------------------------------------
// 8) Main VerificationWidget
// --------------------------------------
export default function VerificationWidget({
  embeddedPropID,
  redirectOnSuccess = false // determines whether we redirect or stay in widget
}) {
  const { loggedInUser } = useContext(UserContext);
  const navigate = useNavigate();

  // For building ?redirect=...
  const location = useLocation();
  const redirectPath = encodeURIComponent(location.pathname + location.search);

  const [currentStep, setCurrentStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedChoice, setSelectedChoice] = useState('');
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [propData, setPropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [takeID, setTakeID] = useState(null);

  const [sideACount, setSideACount] = useState(0);
  const [sideBCount, setSideBCount] = useState(0);

  const [userTakes, setUserTakes] = useState([]);
  const [alreadyTookTakeID, setAlreadyTookTakeID] = useState(null);
  const [alreadyTookSide, setAlreadyTookSide] = useState(null);

  const [lastUpdated, setLastUpdated] = useState(new Date());

  // (1) Load the prop data
  useEffect(() => {
	let finalPropID = embeddedPropID;
	if (!finalPropID) {
	  const params = new URLSearchParams(window.location.search);
	  finalPropID = params.get('propID') || 'defaultProp';
	}
	fetch(`/api/prop?propID=${finalPropID}`)
	  .then((res) => res.json())
	  .then((data) => {
		setPropData(data);
		setLoading(false);
		if (data.success) {
		  setSideACount(data.sideACount || 0);
		  setSideBCount(data.sideBCount || 0);
		}
		setLastUpdated(new Date());
	  })
	  .catch((err) => {
		console.error('[VerificationWidget] Error fetching prop:', err);
		setLoading(false);
	  });
  }, [embeddedPropID]);

  // (2) If user is logged in => fetch their profile => userTakes
  useEffect(() => {
	if (loggedInUser?.profileID) {
	  fetch(`/api/profile/${loggedInUser.profileID}`)
		.then((res) => res.json())
		.then((data) => {
		  if (data.success && data.userTakes) {
			setUserTakes(data.userTakes);
			setLastUpdated(new Date());
		  }
		})
		.catch((err) => {
		  console.error('[VerificationWidget] /api/profile error:', err);
		});
	}
  }, [loggedInUser]);

  // (3) Check if user has a "latest" take on this prop
  useEffect(() => {
	if (!propData?.propID) return;
	const latestTake = userTakes.find(
	  (t) => t.propID === propData.propID && t.takeStatus === 'latest'
	);
	if (latestTake) {
	  setAlreadyTookTakeID(latestTake.takeID);
	  setAlreadyTookSide(latestTake.propSide);
	}
  }, [propData, userTakes]);

  // Once a new take is created or updated
  function handleComplete(newTakeID, freshData) {
	if (freshData && freshData.success) {
	  setSideACount(freshData.sideACount || 0);
	  setSideBCount(freshData.sideBCount || 0);
	}

	if (redirectOnSuccess) {
	  navigate(`/takes/${newTakeID}`);
	} else {
	  setTakeID(newTakeID);
	  setCurrentStep('complete');
	}
  }

  // Local selection only
  function handleSelectChoice(choiceValue) {
	if (choiceValue === selectedChoice) {
	  // if user re-clicks same side => deselect
	  setSelectedChoice('');
	  setResultsRevealed(false);
	} else {
	  setSelectedChoice(choiceValue);
	  setResultsRevealed(true);
	}
  }

  // --------------------------------------
  // Rendering
  // --------------------------------------
  if (loading) {
	return <div style={{ padding: '2rem' }}>Loading proposition...</div>;
  }
  if (!propData || propData.error) {
	return <div style={{ padding: '2rem' }}>Prop not found or error loading prop.</div>;
  }

  const propStatus = propData.propStatus || 'open';
  const { aPct, bPct } = computeSidePercents(sideACount, sideBCount);
  const totalTakes = sideACount + sideBCount + 2;

  // #1 Non-open scenario (graded or closed) and not after new take
  //    => No more voting, just show final or partial results
  if (
	(propStatus === 'gradedA' ||
	 propStatus === 'gradedB' ||
	 propStatus === 'closed') &&
	currentStep !== 'complete'
  ) {
	let gradedSide = '';
	let isClosed = false;
	if (propStatus === 'gradedA') {
	  gradedSide = 'A';
	} else if (propStatus === 'gradedB') {
	  gradedSide = 'B';
	} else if (propStatus === 'closed') {
	  // "closed" means no picks, but not yet graded
	  isClosed = true;
	}

	let userSide = '';
	let userTakeLink = null;
	if (alreadyTookTakeID) {
	  userSide = alreadyTookSide;
	  userTakeLink = `${window.location.origin}/takes/${alreadyTookTakeID}`;
	}

	let tweetHref = null;
	if (userTakeLink) {
	  const tweetText = `Check out my take here:\n\n${userTakeLink} #MakeTheTake`;
	  tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
	}

	// Customized messaging for "closed" vs "graded"
	let statusMessage = 'No more voting. Here are the final results:';
	if (isClosed) {
	  statusMessage = 'No more voting while we wait for a final result. Here’s the partial tally so far:';
	}

	return (
	  <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
		<div
		  style={{
			backgroundColor: '#fff',
			boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
			borderRadius: '8px',
			padding: '1.5rem'
		  }}
		>
		  <h2 className="text-xl font-bold mb-2">
			<Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
			  {propData.propShort}
			</Link>
		  </h2>
		  <p>{statusMessage}</p>

		  {alreadyTookTakeID && (
			<>
			  <p style={{ marginTop: '0.5rem' }}>
				You’ve already made this take.{' '}
				<a href={`/takes/${alreadyTookTakeID}`} target="_blank" rel="noreferrer">
				  View your take here
				</a>.
			  </p>
			  {tweetHref && (
				<p>
				  <a
					href={tweetHref}
					target="_blank"
					rel="noreferrer"
					style={{ color: '#1DA1F2', textDecoration: 'underline' }}
				  >
					Tweet this take
				  </a>
				</p>
			  )}
			</>
		  )}

		  <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>
			Total Takes: {totalTakes}
		  </p>

		  <PropChoices
			propStatus={isClosed ? 'closed' : 'graded'}
			gradedSide={gradedSide}
			selectedChoice={userSide}
			resultsRevealed={true}
			onSelectChoice={() => {}}
			sideAPct={aPct}
			sideBPct={bPct}
			sideALabel={propData.PropSideAShort}
			sideBLabel={propData.PropSideBShort}
			userSide={userSide}
		  />

		  {/* No voting button or phone form for closed/graded states */}

		  {!loggedInUser && (
			<p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
			  Already made this take?{' '}
			  <Link to={`/login?redirect=${redirectPath}`} className="text-blue-600 underline">
				Log in to see it
			  </Link>
			</p>
		  )}

		  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
			Last Updated: {lastUpdated.toLocaleString()}
		  </div>
		</div>
	  </div>
	);
  }

  // #2 If user already took a "latest" take, prop is open, not after new
  if (alreadyTookTakeID && propStatus === 'open' && currentStep !== 'complete') {
	const { aPct: existingA, bPct: existingB } = computeSidePercents(sideACount, sideBCount);
	const existingTotal = sideACount + sideBCount + 2;
	const takeUrl = window.location.origin + '/takes/' + alreadyTookTakeID;
	const tweetText = `Check out my take here:\n\n${takeUrl} #MakeTheTake`;
	const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

	return (
	  <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
		<div
		  style={{
			backgroundColor: '#fff',
			boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
			borderRadius: '8px',
			padding: '1.5rem'
		  }}
		>
		  <h2 className="text-xl font-bold mb-2">
			<Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
			  {propData.propShort}
			</Link>
		  </h2>
		  <p>You’ve Already Made This Take (the prop is open, so feel free to change):</p>
		  <p>
			<a href={`/takes/${alreadyTookTakeID}`} target="_blank" rel="noreferrer">
			  View your existing take here
			</a>
		  </p>
		  <p>
			<a
			  href={tweetHref}
			  target="_blank"
			  rel="noreferrer"
			  style={{ color: '#1DA1F2', textDecoration: 'underline' }}
			>
			  Tweet this take
			</a>
		  </p>

		  <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>
			Total Takes: {existingTotal}
		  </p>

		  <PropChoices
			propStatus="open"
			selectedChoice={selectedChoice}
			resultsRevealed={true}
			onSelectChoice={handleSelectChoice}
			sideAPct={existingA}
			sideBPct={existingB}
			sideALabel={propData.PropSideAShort}
			sideBLabel={propData.PropSideBShort}
			userSide={alreadyTookSide}
		  />

		  {loggedInUser && (
			<MakeTakeButton
			  selectedChoice={selectedChoice}
			  propID={propData.propID}
			  onTakeComplete={handleComplete}
			  loggedInUser={loggedInUser}
			  alreadyTookSide={alreadyTookSide}
			/>
		  )}

		  {!loggedInUser && (
			<p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
			  Already made this take?{' '}
			  <Link to={`/login?redirect=${redirectPath}`} className="text-blue-600 underline">
				Log in to see it
			  </Link>
			</p>
		  )}

		  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
			Last Updated: {lastUpdated.toLocaleString()}
		  </div>
		</div>
	  </div>
	);
  }

  // #3 If user just completed => final step
  if (currentStep === 'complete') {
	const { aPct: freshA, bPct: freshB } = computeSidePercents(sideACount, sideBCount);
	const freshTotal = sideACount + sideBCount + 2;

	return (
	  <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
		<div
		  style={{
			backgroundColor: '#fff',
			boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
			borderRadius: '8px',
			padding: '1.5rem'
		  }}
		>
		  <h2 className="text-xl font-bold mb-2">
			<Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
			  {propData.propShort}
			</Link>
		  </h2>
		  <CompleteStep takeID={takeID} />
		  <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>
			Total Takes: {freshTotal}
		  </p>

		  {selectedChoice && (
			<PropChoices
			  propStatus={propStatus === 'open' ? 'open' : 'alreadyTook'}
			  gradedSide=""
			  selectedChoice={selectedChoice}
			  resultsRevealed={true}
			  onSelectChoice={propStatus === 'open' ? handleSelectChoice : () => {}}
			  sideAPct={freshA}
			  sideBPct={freshB}
			  sideALabel={propData.PropSideAShort}
			  sideBLabel={propData.PropSideBShort}
			  userSide={selectedChoice}
			/>
		  )}

		  {propStatus === 'open' && loggedInUser && (
			<MakeTakeButton
			  selectedChoice={selectedChoice}
			  propID={propData.propID}
			  onTakeComplete={handleComplete}
			  loggedInUser={loggedInUser}
			  alreadyTookSide={selectedChoice}
			/>
		  )}

		  {!loggedInUser && (
			<p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
			  Already made this take?{' '}
			  <Link to={`/login?redirect=${redirectPath}`} className="text-blue-600 underline">
				Log in to see it
			  </Link>
			</p>
		  )}

		  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
			Last Updated: {lastUpdated.toLocaleString()}
		  </div>
		</div>
	  </div>
	);
  }

  // #4 Otherwise => normal open scenario
  return (
	<div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
	  <div
		style={{
		  backgroundColor: '#fff',
		  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
		  borderRadius: '8px',
		  padding: '1.5rem'
		}}
	  >
		<h2 className="text-xl font-bold mb-2">
		  <Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
			{propData.propShort}
		  </Link>
		</h2>

		<PropChoices
		  propStatus="open"
		  gradedSide=""
		  selectedChoice={selectedChoice}
		  resultsRevealed={resultsRevealed}
		  onSelectChoice={handleSelectChoice}
		  sideAPct={aPct}
		  sideBPct={bPct}
		  sideALabel={propData.PropSideAShort}
		  sideBLabel={propData.PropSideBShort}
		  userSide=""
		/>

		<div style={{ marginTop: '1rem', fontWeight: 'bold' }}>
		  Total Takes: {totalTakes}
		</div>

		{loggedInUser ? (
		  <MakeTakeButton
			selectedChoice={selectedChoice}
			propID={propData.propID}
			onTakeComplete={handleComplete}
			loggedInUser={loggedInUser}
			alreadyTookSide={alreadyTookSide}
		  />
		) : (
		  <>
			{currentStep === 'phone' && (
			  <PhoneNumberForm
				phoneNumber={phoneNumber}
				onSubmit={(phone) => {
				  setPhoneNumber(phone);
				  setCurrentStep('code');
				}}
				selectedChoice={selectedChoice}
			  />
			)}
			{currentStep === 'code' && (
			  <VerificationForm
				phoneNumber={phoneNumber}
				selectedChoice={selectedChoice}
				propID={propData.propID}
				onComplete={handleComplete}
			  />
			)}
		  </>
		)}

		{!loggedInUser && (
		  <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
			Already made this take?{' '}
			<Link to={`/login?redirect=${redirectPath}`} className="text-blue-600 underline">
			  Log in to see it
			</Link>
		  </p>
		)}

		<div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
		  Last Updated: {lastUpdated.toLocaleString()}
		</div>
	  </div>
	</div>
  );
}