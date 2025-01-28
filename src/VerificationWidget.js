// File: src/VerificationWidget.js

import React, { useContext, useState, useEffect } from 'react';
import InputMask from 'react-input-mask';
import { UserContext } from './UserContext';

// --------------------------------------
// Choice & PropChoices (unchanged)
// --------------------------------------
function Choice({
  label,
  percentage,
  sideValue,
  isSelected,
  showResults,
  onSelect,
  propStatus
}) {
  const [isHovered, setIsHovered] = useState(false);

  const fillWidth = showResults ? `${percentage}%` : '0%';
  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  let correctnessIcon = null;
  if (propStatus === 'gradedA') {
	correctnessIcon = sideValue === 'A' ? '✅' : '❌';
  } else if (propStatus === 'gradedB') {
	correctnessIcon = sideValue === 'B' ? '✅' : '❌';
  }

  const clickable = propStatus === 'open';
  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`;

  return (
	<div
	  onClick={clickable ? onSelect : undefined}
	  onMouseEnter={() => clickable && setIsHovered(true)}
	  onMouseLeave={() => clickable && setIsHovered(false)}
	  style={{
		position: 'relative',
		border: '1px solid #ddd',
		marginBottom: '0.5rem',
		padding: '1rem',
		cursor: clickable ? 'pointer' : 'default',
		outline: isSelected ? '2px solid #3b82f6' : 'none',
		overflow: 'hidden',
		backgroundColor,
		transition: 'background-color 0.2s ease',
		textAlign: 'left',
		opacity: clickable ? 1 : 0.8
	  }}
	>
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
		<span>
		  {label} {correctnessIcon && <strong>{correctnessIcon}</strong>}
		</span>
		<span
		  style={{
			visibility: showResults ? 'visible' : 'hidden',
			marginLeft: '6px'
		  }}
		>
		  ({percentage}%)
		</span>
	  </div>
	</div>
  );
}

function PropChoices({
  selectedChoice,
  resultsRevealed,
  onSelectChoice,
  propSideAPct,
  propSideBPct,
  sideALabel,
  sideBLabel,
  propStatus
}) {
  const choices = [
	{ value: 'A', label: sideALabel, percentage: propSideAPct },
	{ value: 'B', label: sideBLabel, percentage: propSideBPct }
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
			showResults={resultsRevealed}
			onSelect={() => onSelectChoice(choice.value)}
			propStatus={propStatus}
		  />
		);
	  })}
	</div>
  );
}

// --------------------------------------
// PhoneNumberForm & VerificationForm
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
		alert('Failed to send verification code');
		return;
	  }
	  onSubmit(localPhone);
	} catch (err) {
	  console.error('[PhoneNumberForm] Error sending code:', err);
	  alert('Error sending code. Please try again.');
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
			  style={{ flex: 1 }}
			/>
		  )}
		</InputMask>
		<button onClick={handleSend} disabled={isDisabled}>
		  Send Verification Code
		</button>
	  </div>
	  {!hasSide && (
		<div style={{ color: 'red' }}>Please select a side above.</div>
	  )}
	  {!isPhoneValid && (
		<div style={{ color: 'red' }}>Enter a 10-digit phone number.</div>
	  )}
	</div>
  );
}

function VerificationForm({ phoneNumber, selectedChoice, propID, onComplete }) {
  const [localCode, setLocalCode] = useState('');
  const { setLoggedInUser } = useContext(UserContext);

  async function handleVerify() {
	const numeric = localCode.replace(/\D/g, '');
	if (numeric.length !== 6) {
	  alert('Please enter a valid 6-digit code.');
	  return;
	}

	try {
	  // 1) verify the code
	  const verifyResp = await fetch('/api/verifyCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone: phoneNumber, code: numeric })
	  });
	  const verifyData = await verifyResp.json();
	  if (!verifyData.success) {
		alert(verifyData.error || 'Invalid code');
		return;
	  }

	  // 1.5) fetch /api/me to update context => user is logged in
	  const meResp = await fetch('/api/me', { credentials: 'include' });
	  const meData = await meResp.json();
	  if (meData.loggedIn && meData.user) {
		setLoggedInUser(meData.user);
	  }

	  // 2) create the "take"
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
		alert('Failed to log the take');
		return;
	  }

	  const takeData = await takeResp.json();
	  if (!takeData.success) {
		alert('Failed to create the take');
		return;
	  }

	  // 3) done => notify parent
	  onComplete(takeData.newTakeID);
	} catch (err) {
	  console.error('[VerificationForm] Error verifying code:', err);
	  alert('Error verifying code. Please try again.');
	}
  }

  function handleResend() {
	console.log(`Resending code to "${phoneNumber}"...`);
	// Optional: call /api/sendCode again with phoneNumber
  }

  return (
	<div style={{ marginBottom: '1rem' }}>
	  <label>Enter Your 6-Digit Verification Code</label>
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
			style={{ display: 'block', margin: '0.5rem 0' }}
		  />
		)}
	  </InputMask>

	  <button onClick={handleVerify}>Verify</button>

	  <p>
		Verification code sent to <strong>{phoneNumber}</strong>
	  </p>

	  <button onClick={handleResend} style={{ marginTop: '0.5rem' }}>
		Resend it
	  </button>
	</div>
  );
}

// --------------------------------------
// MakeTakeButton (logged-in flow)
// --------------------------------------
function MakeTakeButton({ selectedChoice, propID, onTakeComplete, loggedInUser }) {
  const [confirming, setConfirming] = useState(false);
  const disabled = !selectedChoice;
  const buttonText = confirming ? 'Tap to Confirm' : 'Make Take';

  async function handleClick() {
	if (!confirming) {
	  setConfirming(true);
	  return;
	}

	// Second click => /api/take with loggedInUser.phone
	try {
	  const body = {
		takeMobile: loggedInUser.phone, // e.g. "+16023802793"
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
		alert('Failed to create take');
		setConfirming(false);
		return;
	  }

	  const data = await resp.json();
	  if (!data.success) {
		alert(data.error || 'Failed to create take');
		setConfirming(false);
		return;
	  }

	  onTakeComplete(data.newTakeID);
	} catch (error) {
	  console.error('[MakeTakeButton] Error:', error);
	  alert('Error creating take. Please try again.');
	  setConfirming(false);
	}
  }

  return (
	<div style={{ margin: '1rem 0' }}>
	  <button
		onClick={handleClick}
		disabled={disabled}
		style={{
		  backgroundColor: disabled ? '#ccc' : '#3b82f6',
		  color: 'white',
		  padding: '0.5rem 1rem',
		  borderRadius: '4px',
		  cursor: disabled ? 'not-allowed' : 'pointer',
		  marginRight: '1rem'
		}}
	  >
		{buttonText}
	  </button>
	  {confirming && !disabled && (
		<span style={{ color: 'blue' }}>
		  Click again to confirm your take on side "{selectedChoice}"!
		</span>
	  )}
	</div>
  );
}

// --------------------------------------
// CompleteStep
// --------------------------------------
function CompleteStep({ takeID }) {
  return (
	<div style={{ marginTop: '1rem' }}>
	  <h3>Thanks!</h3>
	  <p>Your take was logged successfully.</p>
	  {takeID && (
		<p>
		  <a href={`/takes/${takeID}`} target="_blank" rel="noreferrer">
			View your new take here
		  </a>
		</p>
	  )}
	</div>
  );
}

// --------------------------------------
// MAIN VerificationWidget
// --------------------------------------
export default function VerificationWidget({ embeddedPropID }) {
  const { loggedInUser } = useContext(UserContext);
  const [currentStep, setCurrentStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedChoice, setSelectedChoice] = useState('');
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [propData, setPropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [takeID, setTakeID] = useState(null);

  // NEW: track userTakes + whether they've already taken this prop
  const [userTakes, setUserTakes] = useState([]);
  const [alreadyTookTakeID, setAlreadyTookTakeID] = useState(null);

  // 1) Load the prop data
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
	  })
	  .catch((err) => {
		console.error('[VerificationWidget] Error fetching prop:', err);
		setLoading(false);
	  });
  }, [embeddedPropID]);

  // 2) If user is logged in, fetch their profile/takes
  useEffect(() => {
	if (loggedInUser && loggedInUser.profileID) {
	  fetch(`/api/profile/${loggedInUser.profileID}`)
		.then((res) => res.json())
		.then((data) => {
		  if (data.success && data.userTakes) {
			setUserTakes(data.userTakes);
		  }
		})
		.catch((err) =>
		  console.error('[VerificationWidget] /api/profile fetch error:', err)
		);
	}
  }, [loggedInUser]);

  // 3) Check if userTakes includes a take for this prop
  useEffect(() => {
	if (!propData || !propData.propID) return;
	const existing = userTakes.find((t) => t.propID === propData.propID);
	if (existing) {
	  setAlreadyTookTakeID(existing.takeID);
	}
  }, [propData, userTakes]);

  if (loading) {
	return <div style={{ padding: '2rem' }}>Loading proposition...</div>;
  }

  if (!propData || propData.error) {
	return (
	  <div style={{ padding: '2rem' }}>
		{propData?.error || 'Error loading proposition'}
	  </div>
	);
  }

  // If prop is not open, just show a message
  const propStatus = propData.propStatus || 'open';
  if (propStatus !== 'open') {
	return (
	  <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
		<h2>Make The Take</h2>
		<p>{propData.propShort}</p>
		<p style={{ color: 'red', fontWeight: 'bold' }}>
		  This prop is '{propStatus}'. You cannot vote anymore.
		</p>
		<p>Current A/B counts: {propData.propSideAPct}% vs. {propData.propSideBPct}%</p>
	  </div>
	);
  }

  // If the user is logged in and has already taken this prop
  if (alreadyTookTakeID) {
	return (
	  <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
		<h2>You’ve Already Made This Take</h2>
		<p>
		  <a href={`/takes/${alreadyTookTakeID}`} target="_blank" rel="noreferrer">
			View your existing take here
		  </a>
		</p>
		<p>Current side counts: A = {propData.propSideAPct}%, B = {propData.propSideBPct}%</p>
	  </div>
	);
  }

  // Otherwise, let the user pick a side, then either phone flow or direct MakeTake
  const forcedResults = propStatus !== 'open';
  const effectiveResultsRevealed = forcedResults || resultsRevealed;

  function handleSelectChoice(choiceValue) {
	if (!forcedResults) {
	  if (choiceValue === selectedChoice) {
		setSelectedChoice('');
		setResultsRevealed(false);
	  } else {
		setSelectedChoice(choiceValue);
		setResultsRevealed(true);
	  }
	}
  }

  function handleComplete(newTakeID) {
	setTakeID(newTakeID);
	setCurrentStep('complete');
  }

  return (
	<div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
	  <h2>Make The Take</h2>
	  <p>{propData.propShort}</p>

	  <PropChoices
		selectedChoice={selectedChoice}
		resultsRevealed={effectiveResultsRevealed}
		onSelectChoice={handleSelectChoice}
		propSideAPct={propData.propSideAPct}
		propSideBPct={propData.propSideBPct}
		sideALabel={propData.PropSideAShort}
		sideBLabel={propData.PropSideBShort}
		propStatus={propStatus}
	  />

	  {currentStep === 'complete' && <CompleteStep takeID={takeID} />}

	  {currentStep !== 'complete' && (
		<>
		  {loggedInUser ? (
			// Logged in => MakeTakeButton
			<MakeTakeButton
			  selectedChoice={selectedChoice}
			  propID={propData.propID}
			  onTakeComplete={handleComplete}
			  loggedInUser={loggedInUser}
			/>
		  ) : (
			// Not logged in => phone + code flow
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
		</>
	  )}
	</div>
  );
}
