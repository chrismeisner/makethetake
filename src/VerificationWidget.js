// File: src/VerificationWidget.js
import React, { useContext, useState, useEffect } from 'react';
import InputMask from 'react-input-mask';
import { UserContext } from './UserContext';

// --------------------------------------
// Choice & PropChoices
// --------------------------------------
function Choice({
  label,
  percentage,
  sideValue,
  isSelected,
  anySideSelected,
  showResults,
  onSelect,
  propStatus
}) {
  const [isHovered, setIsHovered] = useState(false);

  let backgroundColor = !anySideSelected ? '#f9f9f9' : '#ffffff'; // no side => gray, else => white
  const outlineStyle = isSelected ? '2px solid #3b82f6' : 'none';

  const baseBorder = '1px solid #ddd';
  const hoverBorder = '1px solid #aaa';

  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`;
  const fillWidth = showResults ? `${percentage}%` : '0%';

  let correctnessIcon = null;
  if (propStatus === 'gradedA') {
	correctnessIcon = sideValue === 'A' ? '✅' : '❌';
  } else if (propStatus === 'gradedB') {
	correctnessIcon = sideValue === 'B' ? '✅' : '❌';
  }

  const clickable = propStatus === 'open';

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
  const anySideSelected = selectedChoice !== '';

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
			anySideSelected={anySideSelected}
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
	  // Verify code
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

	  // If success, fetch /api/me
	  const meResp = await fetch('/api/me', { credentials: 'include' });
	  const meData = await meResp.json();
	  if (meData.loggedIn && meData.user) {
		setLoggedInUser(meData.user);
	  }

	  // Create the "take"
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

	  onComplete(takeData.newTakeID);
	} catch (err) {
	  console.error('[VerificationForm] Error verifying code:', err);
	}
  }

  function handleResend() {
	console.log(`[VerificationForm] Resending code to "${phoneNumber}"...`);
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

	  <div style={{ display: 'flex', gap: '0.5rem' }}>
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

	  onTakeComplete(data.newTakeID);
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

  const [userTakes, setUserTakes] = useState([]);
  const [alreadyTookTakeID, setAlreadyTookTakeID] = useState(null);

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

  useEffect(() => {
	if (loggedInUser && loggedInUser.profileID) {
	  fetch(`/api/profile/${loggedInUser.profileID}`)
		.then((res) => res.json())
		.then((data) => {
		  if (data.success && data.userTakes) {
			setUserTakes(data.userTakes);
		  }
		})
		.catch((err) => console.error('[VerificationWidget] /api/profile error:', err));
	}
  }, [loggedInUser]);

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
	return <div style={{ padding: '2rem' }}>Prop not found or error loading prop.</div>;
  }

  const propStatus = propData.propStatus || 'open';
  if (propStatus !== 'open') {
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
		  <p>
			Current side counts: A = {propData.propSideAPct}%, B ={' '}
			{propData.propSideBPct}%
		  </p>
		</div>
	  </div>
	);
  }

  if (alreadyTookTakeID) {
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
			<a href={`/takes/${alreadyTookTakeID}`} target="_blank" rel="noreferrer">
			  View your existing take here
			</a>
		  </p>
		  <p>
			Current side counts: A = {propData.propSideAPct}%, B ={' '}
			{propData.propSideBPct}%
		  </p>
		</div>
	  </div>
	);
  }

  // If it's open and user hasn't voted => show the poll inside a subtle white box
  if (currentStep === 'complete') {
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
		</div>
	  </div>
	);
  }

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
	  {/* The subtle white "card" with drop shadow */}
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
		  selectedChoice={selectedChoice}
		  resultsRevealed={effectiveResultsRevealed}
		  onSelectChoice={handleSelectChoice}
		  propSideAPct={propData.propSideAPct}
		  propSideBPct={propData.propSideBPct}
		  sideALabel={propData.PropSideAShort}
		  sideBLabel={propData.PropSideBShort}
		  propStatus={propStatus}
		/>

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
	  </div>
	</div>
  );
}
