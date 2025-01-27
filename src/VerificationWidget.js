// File: src/VerificationWidget.js
import React from 'react';
import InputMask from 'react-input-mask';

function Choice({
  label,
  percentage,
  sideValue,
  isSelected,
  showResults,
  onSelect,
  propStatus
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  const fillWidth = showResults ? `${percentage}%` : '0%';
  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  // If the prop is graded, figure out which side is correct
  let correctnessIcon = null;
  if (propStatus === 'gradedA') {
	correctnessIcon = sideValue === 'A' ? '✅' : '❌';
  } else if (propStatus === 'gradedB') {
	correctnessIcon = sideValue === 'B' ? '✅' : '❌';
  }

  // We'll disable onClick unless the prop is open
  const clickable = propStatus === 'open';

  // If showResults is true or the prop is not open, set fillOpacity
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

function PhoneNumberForm({ phoneNumber, onSubmit, selectedChoice }) {
  const [localPhone, setLocalPhone] = React.useState(phoneNumber);

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
  const [localCode, setLocalCode] = React.useState('');

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

	  // 2) if code is valid => create the "take"
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

	  // Grab the newTakeID
	  const { newTakeID } = takeData;

	  // 3) done => notify parent
	  onComplete(newTakeID);
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

/**
 * The main VerificationWidget, now extracted:
 *  - Accepts an optional "embeddedPropID" prop.
 *  - If not provided, falls back to checking for ?propID= in the URL, or "defaultProp".
 */
export default function VerificationWidget({ embeddedPropID }) {
  const [currentStep, setCurrentStep] = React.useState('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [selectedChoice, setSelectedChoice] = React.useState('');
  const [resultsRevealed, setResultsRevealed] = React.useState(false);
  const [propData, setPropData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [takeID, setTakeID] = React.useState(null);

  React.useEffect(() => {
	// If an embedded propID is passed, use it;
	// otherwise, check the URL query param.
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

  const propStatus = propData.propStatus || 'open';
  const forcedResults = propStatus !== 'open';
  const effectiveResultsRevealed = forcedResults || resultsRevealed;

  function handleSelectChoice(choiceValue) {
	if (!forcedResults) {
	  // Only allow changing the choice if prop is still open
	  if (choiceValue === selectedChoice) {
		setSelectedChoice('');
		setResultsRevealed(false);
	  } else {
		setSelectedChoice(choiceValue);
		setResultsRevealed(true);
	  }
	}
  }

  function handlePhoneSubmit(phone) {
	setPhoneNumber(phone);
	setCurrentStep('code');
  }

  function handleComplete(newTakeID) {
	setTakeID(newTakeID);
	setCurrentStep('complete');
  }

  return (
	<div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
	  <h2>Make The Take</h2>
	  <p>{propData.propShort}</p>

	  {propStatus === 'closed' && (
		<p style={{ color: 'blue', fontWeight: 'bold' }}>
		  This prop is closed. You cannot vote anymore.
		</p>
	  )}
	  {(propStatus === 'gradedA' || propStatus === 'gradedB') && (
		<p style={{ color: 'green', fontWeight: 'bold' }}>
		  This prop has been graded.&nbsp;
		  {propStatus === 'gradedA' ? 'Side A is correct.' : 'Side B is correct.'}
		</p>
	  )}

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

	  {/* Only allow phone + code steps if the prop is "open" */}
	  {propStatus === 'open' && currentStep === 'phone' && (
		<PhoneNumberForm
		  phoneNumber={phoneNumber}
		  onSubmit={handlePhoneSubmit}
		  selectedChoice={selectedChoice}
		/>
	  )}

	  {propStatus === 'open' && currentStep === 'code' && (
		<VerificationForm
		  phoneNumber={phoneNumber}
		  selectedChoice={selectedChoice}
		  propID={propData.propID}
		  onComplete={handleComplete}
		/>
	  )}

	  {currentStep === 'complete' && <CompleteStep takeID={takeID} />}
	</div>
  );
}
