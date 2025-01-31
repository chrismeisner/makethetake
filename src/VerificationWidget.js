// File: src/VerificationWidget.js

import React, { useContext, useState, useEffect } from 'react';
import InputMask from 'react-input-mask';
import { UserContext } from './UserContext';

// A helper to compute local side percentages (with +1 offset for each side).
function computeSidePercents(aCount, bCount) {
  const aWithOffset = aCount + 1;
  const bWithOffset = bCount + 1;
  const total = aWithOffset + bWithOffset;
  const aPct = Math.round((aWithOffset / total) * 100);
  const bPct = Math.round((bWithOffset / total) * 100);
  return { aPct, bPct };
}

// Choice component
function Choice({
  label,
  percentage,
  sideValue,
  isSelected,
  anySideSelected,
  showResults,
  propStatus,
  onSelect
}) {
  const [isHovered, setIsHovered] = useState(false);
  const backgroundColor = !anySideSelected ? '#f9f9f9' : '#ffffff';
  const outlineStyle = isSelected ? '2px solid #3b82f6' : 'none';
  const baseBorder = '1px solid #ddd';
  const hoverBorder = '1px solid #aaa';
  const clickable = propStatus === 'open';
  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`;
  const fillWidth = showResults ? `${percentage}%` : '0%';

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
	  {/* The fill background for showing the percentage bar */}
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
		<span>{label}</span>
		{showResults && <span style={{ marginLeft: 6 }}>({percentage}%)</span>}
	  </div>
	</div>
  );
}

// PropChoices component
function PropChoices({
  propStatus,
  selectedChoice,
  resultsRevealed,
  onSelectChoice,
  sideAPct,
  sideBPct,
  sideALabel,
  sideBLabel
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
		return (
		  <Choice
			key={choice.value}
			label={choice.label}
			percentage={choice.percentage}
			sideValue={choice.value}
			isSelected={isSelected}
			anySideSelected={anySideSelected}
			showResults={resultsRevealed}
			propStatus={propStatus}
			onSelect={() => onSelectChoice(choice.value)}
		  />
		);
	  })}
	</div>
  );
}

// PhoneNumberForm
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
			  placeholder="(602) 380-2794"
			  style={{
				flex: 1,
				backgroundColor: '#f5f5f5'
			  }}
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

// VerificationForm
function VerificationForm({ phoneNumber, selectedChoice, propID, onComplete }) {
  const [localCode, setLocalCode] = useState('');
  const { setLoggedInUser } = React.useContext(UserContext);

  async function handleVerify() {
	const numeric = localCode.replace(/\D/g, '');
	if (numeric.length !== 6) {
	  console.log('Invalid code length');
	  return;
	}
	try {
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
	  const meResp = await fetch('/api/me', { credentials: 'include' });
	  const meData = await meResp.json();
	  if (meData.loggedIn && meData.user) {
		setLoggedInUser(meData.user);
	  }
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
			  style={{
				flex: 1,
				backgroundColor: '#f5f5f5'
			  }}
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

// MakeTakeButton
function MakeTakeButton({ selectedChoice, propID, onTakeComplete, loggedInUser }) {
  const [confirming, setConfirming] = useState(false);
  const disabled = !selectedChoice;
  const buttonText = confirming ? 'Tap to Confirm' : 'Make Take';

  async function handleClick() {
	if (!confirming) {
	  setConfirming(true);
	  return;
	}
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
		console.error('Failed to create take');
		setConfirming(false);
		return;
	  }
	  const data = await resp.json();
	  if (!data.success) {
		console.error('Backend error creating take');
		setConfirming(false);
		return;
	  }
	  onTakeComplete(data.newTakeID, {
		success: true,
		sideACount: data.sideACount,
		sideBCount: data.sideBCount
	  });
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
		{buttonText}
	  </button>
	  {confirming && !disabled && (
		<span style={{ color: 'blue', marginLeft: '0.5rem' }}>
		  Click again to confirm your take on side "{selectedChoice}"!
		</span>
	  )}
	</div>
  );
}

// CompleteStep for newly created take
function CompleteStep({ takeID }) {
  if (!takeID) {
	return null;
  }

  // The URL to the newly created take
  const takeUrl = window.location.origin + '/takes/' + takeID;

  // We'll embed the takeUrl in a tweet
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

export default function VerificationWidget({ embeddedPropID }) {
  const { loggedInUser } = useContext(UserContext);

  const [currentStep, setCurrentStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedChoice, setSelectedChoice] = useState('');
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [propData, setPropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [takeID, setTakeID] = useState(null);

  // side counts from the server
  const [sideACount, setSideACount] = useState(0);
  const [sideBCount, setSideBCount] = useState(0);

  // track user's existing “latest” take
  const [userTakes, setUserTakes] = useState([]);
  const [alreadyTookTakeID, setAlreadyTookTakeID] = useState(null);
  const [alreadyTookSide, setAlreadyTookSide] = useState(null);

  // "Last Updated" time stamp
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // 1) Load the prop data once
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

  // 2) If user is logged in => fetch /api/profile => userTakes
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
		.catch((err) =>
		  console.error('[VerificationWidget] /api/profile error:', err)
		);
	}
  }, [loggedInUser]);

  // 3) Pick the “latest” take for this user + prop
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

  function handleComplete(newTakeID, freshData) {
	// After the user actually creates/verifies a take
	setTakeID(newTakeID);
	if (freshData && freshData.success) {
	  setSideACount(freshData.sideACount || 0);
	  setSideBCount(freshData.sideBCount || 0);
	}
	setLastUpdated(new Date());
	setCurrentStep('complete');
  }

  // Open scenario user picks side => we do not increment or change the local counts.
  function handleSelectChoice(choiceValue) {
	if (choiceValue === selectedChoice) {
	  setSelectedChoice('');
	  setResultsRevealed(false);
	} else {
	  setSelectedChoice(choiceValue);
	  setResultsRevealed(true); // we show the existing distribution
	}
  }

  if (loading) {
	return <div style={{ padding: '2rem' }}>Loading proposition...</div>;
  }
  if (!propData || propData.error) {
	return (
	  <div style={{ padding: '2rem' }}>
		Prop not found or error loading prop.
	  </div>
	);
  }

  const propStatus = propData.propStatus || 'open';

  // If prop closed => no voting
  if (propStatus !== 'open') {
	const totalTakes = sideACount + sideBCount + 2;
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
		  <h2 className="text-xl font-bold mb-2">{propData.propShort}</h2>
		  <p>This prop is '{propStatus}'. You cannot vote anymore.</p>

		  <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>
			Total Takes: {totalTakes}
		  </p>

		  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
			Last Updated: {lastUpdated.toLocaleString()}
		  </div>
		</div>
	  </div>
	);
  }

  // If user already made a "latest" take => show read-only distribution
  if (alreadyTookTakeID) {
	const { aPct, bPct } = computeSidePercents(sideACount, sideBCount);
	const totalTakes = sideACount + sideBCount + 2;

	// Create “Tweet This Take” link for existing take
	const takeUrl = window.location.origin + '/takes/' + alreadyTookTakeID;
	const tweetText = `Check out my take here:\n\n${takeUrl} #MakeTheTake`;
	const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
	  tweetText
	)}`;

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
		  <h2 className="text-xl font-bold mb-2">{propData.propShort}</h2>
		  <p>You’ve Already Made This Take.</p>
		  <p>
			<a
			  href={`/takes/${alreadyTookTakeID}`}
			  target="_blank"
			  rel="noreferrer"
			>
			  View your existing take here
			</a>
		  </p>

		  {/* Tweet link for existing take */}
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
			Total Takes: {totalTakes}
		  </p>

		  <PropChoices
			propStatus="alreadyTook"
			selectedChoice={alreadyTookSide}
			resultsRevealed={true}
			onSelectChoice={() => {}}
			sideAPct={aPct}
			sideBPct={bPct}
			sideALabel={propData.PropSideAShort}
			sideBLabel={propData.PropSideBShort}
		  />

		  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
			Last Updated: {lastUpdated.toLocaleString()}
		  </div>
		</div>
	  </div>
	);
  }

  // If user completed => "thanks"
  if (currentStep === 'complete') {
	const freshA = sideACount;
	const freshB = sideBCount;
	const { aPct, bPct } = computeSidePercents(freshA, freshB);
	const totalTakes = freshA + freshB + 2;

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
		  <h2 className="text-xl font-bold mb-2">{propData.propShort}</h2>
		  <CompleteStep takeID={takeID} />

		  <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>
			Total Takes: {totalTakes}
		  </p>

		  {selectedChoice && (
			<PropChoices
			  propStatus="alreadyTook"
			  selectedChoice={selectedChoice}
			  resultsRevealed={true}
			  onSelectChoice={() => {}}
			  sideAPct={aPct}
			  sideBPct={bPct}
			  sideALabel={propData.PropSideAShort}
			  sideBLabel={propData.PropSideBShort}
			/>
		  )}

		  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
			Last Updated: {lastUpdated.toLocaleString()}
		  </div>
		</div>
	  </div>
	);
  }

  // Otherwise => normal "open" scenario
  const { aPct, bPct } = computeSidePercents(sideACount, sideBCount);
  const totalTakes = sideACount + sideBCount + 2;

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
		<h2 className="text-xl font-bold mb-2">{propData.propShort}</h2>

		<PropChoices
		  propStatus="open"
		  selectedChoice={selectedChoice}
		  resultsRevealed={resultsRevealed}
		  onSelectChoice={handleSelectChoice}
		  sideAPct={aPct}
		  sideBPct={bPct}
		  sideALabel={propData.PropSideAShort}
		  sideBLabel={propData.PropSideBShort}
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

		<div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
		  Last Updated: {lastUpdated.toLocaleString()}
		</div>
	  </div>
	</div>
  );
}
