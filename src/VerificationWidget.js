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
  userSide = '',
  selectedChoice = '',
}) {
  const [isHovered, setIsHovered] = useState(false);

  const isVerifiedSide = userSide && sideValue === userSide;
  const hasSelectedContrarian = userSide && selectedChoice && selectedChoice !== userSide;

  let clickable = false;
  if (propStatus === 'open') {
	if (!userSide) {
	  clickable = true;
	} else if (isVerifiedSide) {
	  clickable = hasSelectedContrarian;
	} else {
	  clickable = true;
	}
  }

  const backgroundColor = !anySideSelected ? '#f9f9f9' : '#ffffff';
  const outlineStyle = isSelected ? '2px solid #3b82f6' : 'none';
  const baseBorder = '1px solid #ddd';
  const hoverBorder = '1px solid #aaa';

  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`;
  const fillWidth = showResults ? `${percentage}%` : '0%';

  let displayedLabel = label;
  if (gradedSide) {
	displayedLabel = sideValue === gradedSide ? '✅ ' + displayedLabel : '❌ ' + displayedLabel;
  }
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
		transition: 'border-color 0.2s ease',
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
		  transition: 'width 0.4s ease',
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
  userSide = '',
}) {
  const anySideSelected = selectedChoice !== '';
  const choices = [
	{ value: 'A', label: sideALabel, percentage: sideAPct },
	{ value: 'B', label: sideBLabel, percentage: sideBPct },
  ];

  return (
	<div className="mb-4">
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
// 4) PhoneNumberForm (Updated)
// --------------------------------------
// Now, the button is active as long as the phone number is valid,
// regardless of whether a side is selected.
function PhoneNumberForm({ phoneNumber, onSubmit }) {
  const [localPhone, setLocalPhone] = useState(phoneNumber);
  const numericPhone = localPhone.replace(/\D/g, '');
  const isPhoneValid = numericPhone.length === 10;
  const isDisabled = !isPhoneValid;

  async function handleSend() {
	try {
	  const resp = await fetch('/api/sendCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone: localPhone }),
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
	<div className="mb-4">
	  <label className="block mb-2">Phone Number</label>
	  <div className="flex flex-col sm:flex-row w-full gap-2">
		<InputMask
		  mask="(999) 999-9999"
		  value={localPhone}
		  onChange={(e) => setLocalPhone(e.target.value)}
		>
		  {() => (
			<input
			  type="tel"
			  placeholder="(555) 555-1234"
			  className="w-full flex-1 bg-gray-100 px-2 py-2"
			/>
		  )}
		</InputMask>
		<button
		  onClick={handleSend}
		  disabled={isDisabled}
		  className={
			isDisabled
			  ? 'w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded opacity-50 cursor-not-allowed'
			  : 'w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
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
	  // Verify the code
	  const verifyResp = await fetch('/api/verifyCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone: phoneNumber, code: numeric }),
	  });
	  const verifyData = await verifyResp.json();
	  if (!verifyData.success) {
		console.error('Code verification failed');
		return;
	  }
	  // Fetch the logged-in user info
	  const meResp = await fetch('/api/me', { credentials: 'include' });
	  const meData = await meResp.json();
	  if (meData.loggedIn && meData.user) {
		setLoggedInUser(meData.user);
	  }
	  // Create the take
	  const takeBody = {
		takeMobile: phoneNumber,
		propID,
		propSide: selectedChoice,
	  };
	  const takeResp = await fetch('/api/take', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(takeBody),
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
		sideBCount: takeData.sideBCount,
	  });
	} catch (err) {
	  console.error('[VerificationForm] Error verifying code:', err);
	}
  }

  function handleResend() {
	console.log(`[VerificationForm] Resending code to "${phoneNumber}"...`);
	// Optionally implement a resend call here
  }

  return (
	<div className="mb-4">
	  <label className="block mb-2">Enter Your 6-Digit Verification Code</label>
	  <div className="flex gap-2 items-center">
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
			  className="flex-1 bg-gray-100 px-2 py-2"
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
function MakeTakeButton({ selectedChoice, propID, onTakeComplete, loggedInUser, alreadyTookSide }) {
  const [confirming, setConfirming] = useState(false);
  const userHasExistingTake = !!alreadyTookSide;
  const isSameSideAsVerified = userHasExistingTake && selectedChoice === alreadyTookSide;
  const disabled = !selectedChoice || isSameSideAsVerified;
  const buttonLabel = userHasExistingTake ? 'Update Take' : 'Make The Take';

  async function handleClick() {
	if (!confirming) {
	  setConfirming(true);
	  return;
	}
	try {
	  const body = {
		takeMobile: loggedInUser.phone,
		propID,
		propSide: selectedChoice,
	  };
	  const resp = await fetch('/api/take', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body),
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
	  onTakeComplete(data.newTakeID, {
		success: true,
		sideACount: data.sideACount,
		sideBCount: data.sideBCount,
	  });
	  setConfirming(false);
	} catch (error) {
	  console.error('[MakeTakeButton] Error:', error);
	  setConfirming(false);
	}
  }

  return (
	<div className="my-4">
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
		<span className="ml-2 text-blue-600">
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
  const takeUrl = `/takes/${takeID}`;
  const tweetText = `I just made my take! Check it out:\n\n${window.location.origin + takeUrl} #MakeTheTake`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  return (
	<div className="mt-4">
	  <h3 className="font-semibold">Thanks!</h3>
	  <p>Your take was logged successfully.</p>
	  <p>
		<Link to={takeUrl} className="text-blue-600 underline">
		  View your new take here
		</Link>
	  </p>
	  <p>
		<a
		  href={tweetHref}
		  target="_blank"
		  rel="noreferrer"
		  className="text-blue-600 underline"
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
export default function VerificationWidget({ embeddedPropID, redirectOnSuccess = false }) {
  const { loggedInUser } = useContext(UserContext);
  const navigate = useNavigate();
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

  // Persistent login status line
  const loginStatus = loggedInUser ? `Logged in as ${loggedInUser.phone}` : 'Not logged in';

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

  // Local selection
  function handleSelectChoice(choiceValue) {
	if (choiceValue === selectedChoice) {
	  setSelectedChoice('');
	  setResultsRevealed(false);
	} else {
	  setSelectedChoice(choiceValue);
	  setResultsRevealed(true);
	}
  }

  if (loading) {
	return <div className="p-4">Loading proposition...</div>;
  }
  if (!propData || propData.error) {
	return <div className="p-4">Prop not found or error loading prop.</div>;
  }

  const propStatus = propData.propStatus || 'open';
  const { aPct, bPct } = computeSidePercents(sideACount, sideBCount);
  const totalTakes = sideACount + sideBCount + 2;

  return (
	<div className="mx-auto w-full sm:max-w-md px-2 sm:px-4 py-2 sm:py-4">
	  <div className="bg-white shadow-md rounded p-2 sm:p-4">
		{/* Persistent Login Status */}
		<div className="mb-4 text-sm text-gray-600">{loginStatus}</div>

		{/* ------------------------------------------
			#1 Non-open scenario
		------------------------------------------ */}
		{((propStatus === 'gradedA' ||
		  propStatus === 'gradedB' ||
		  propStatus === 'closed') &&
		  currentStep !== 'complete') ? (
		  <NonOpenProp
			propData={propData}
			alreadyTookTakeID={alreadyTookTakeID}
			alreadyTookSide={alreadyTookSide}
			totalTakes={totalTakes}
			aPct={aPct}
			bPct={bPct}
			lastUpdated={lastUpdated}
		  />
		) : null}

		{/* ------------------------------------------
			#2 Already took a latest take, prop is open, not after new
		------------------------------------------ */}
		{(alreadyTookTakeID && propStatus === 'open' && currentStep !== 'complete') ? (
		  <AlreadyTookOpen
			propData={propData}
			sideACount={sideACount}
			sideBCount={sideBCount}
			selectedChoice={selectedChoice}
			handleSelectChoice={handleSelectChoice}
			loggedInUser={loggedInUser}
			alreadyTookTakeID={alreadyTookTakeID}
			alreadyTookSide={alreadyTookSide}
			handleComplete={handleComplete}
			lastUpdated={lastUpdated}
		  />
		) : null}

		{/* ------------------------------------------
			#3 If user just completed => final step
		------------------------------------------ */}
		{currentStep === 'complete' ? (
		  <CompleteStepLayout
			propData={propData}
			takeID={takeID}
			sideACount={sideACount}
			sideBCount={sideBCount}
			selectedChoice={selectedChoice}
			handleSelectChoice={handleSelectChoice}
			propStatus={propStatus}
			loggedInUser={loggedInUser}
			alreadyTookSide={alreadyTookSide}
			handleComplete={handleComplete}
			lastUpdated={lastUpdated}
		  />
		) : null}

		{/* ------------------------------------------
			#4 Normal open scenario (no existing "latest" take)
		------------------------------------------ */}
		{(!alreadyTookTakeID && propStatus === 'open' && currentStep !== 'complete') ? (
		  <NormalOpenLayout
			propData={propData}
			selectedChoice={selectedChoice}
			resultsRevealed={resultsRevealed}
			handleSelectChoice={handleSelectChoice}
			aPct={aPct}
			bPct={bPct}
			totalTakes={totalTakes}
			loggedInUser={loggedInUser}
			currentStep={currentStep}
			setCurrentStep={setCurrentStep}
			phoneNumber={phoneNumber}
			setPhoneNumber={setPhoneNumber}
			handleComplete={handleComplete}
			alreadyTookSide={alreadyTookSide}
			lastUpdated={lastUpdated}
		  />
		) : null}
	  </div>
	</div>
  );
}

// --------------------------------------
// Sub-components for each scenario
// --------------------------------------

function NonOpenProp({
  propData,
  alreadyTookTakeID,
  alreadyTookSide,
  totalTakes,
  aPct,
  bPct,
  lastUpdated,
}) {
  let gradedSide = '';
  let isClosed = false;
  if (propData.propStatus === 'gradedA') gradedSide = 'A';
  else if (propData.propStatus === 'gradedB') gradedSide = 'B';
  else if (propData.propStatus === 'closed') isClosed = true;

  const userSide = alreadyTookSide || '';
  const userTakeLink = alreadyTookTakeID ? `/takes/${alreadyTookTakeID}` : null;

  let statusMessage = 'No more voting. Here are the final results:';
  if (isClosed) {
	statusMessage =
	  'No more voting while we wait for a final result. Here’s the partial tally so far:';
  }

  return (
	<>
	  <h2 className="text-xl font-bold mb-2">
		<Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
		  {propData.propShort}
		</Link>
	  </h2>
	  <p>{statusMessage}</p>
	  {alreadyTookTakeID && (
		<p className="mt-2">
		  You’ve already made this take.{' '}
		  {userTakeLink && (
			<Link to={userTakeLink} className="text-blue-600 underline">
			  View your take here
			</Link>
		  )}
		  .
		</p>
	  )}
	  <p className="mt-4 font-bold">Total Takes: {totalTakes}</p>
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
	  <div className="text-sm text-gray-600 mt-4">
		Last Updated: {lastUpdated.toLocaleString()}
	  </div>
	</>
  );
}

function AlreadyTookOpen({
  propData,
  sideACount,
  sideBCount,
  selectedChoice,
  handleSelectChoice,
  loggedInUser,
  alreadyTookTakeID,
  alreadyTookSide,
  handleComplete,
  lastUpdated,
}) {
  const { aPct: existingA, bPct: existingB } = computeSidePercents(sideACount, sideBCount);
  const existingTotal = sideACount + sideBCount + 2;
  const takeUrl = alreadyTookTakeID ? `/takes/${alreadyTookTakeID}` : `/takes/${propData.propID}`;
  return (
	<>
	  <h2 className="text-xl font-bold mb-2">
		<Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
		  {propData.propShort}
		</Link>
	  </h2>
	  <p>You’ve Already Made This Take (the prop is open, so feel free to change):</p>
	  <p className="mt-2">
		<Link to={takeUrl} className="text-blue-600 underline">
		  View your existing take here
		</Link>
	  </p>
	  <p className="mt-4 font-bold">Total Takes: {existingTotal}</p>
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
	  <div className="text-sm text-gray-600 mt-4">
		Last Updated: {lastUpdated.toLocaleString()}
	  </div>
	</>
  );
}

function CompleteStepLayout({
  propData,
  takeID,
  sideACount,
  sideBCount,
  selectedChoice,
  handleSelectChoice,
  propStatus,
  loggedInUser,
  alreadyTookSide,
  handleComplete,
  lastUpdated,
}) {
  const { aPct: freshA, bPct: freshB } = computeSidePercents(sideACount, sideBCount);
  const freshTotal = sideACount + sideBCount + 2;
  return (
	<>
	  <h2 className="text-xl font-bold mb-2">
		<Link to={`/props/${propData.propID}`} className="text-blue-600 hover:underline">
		  {propData.propShort}
		</Link>
	  </h2>
	  <CompleteStep takeID={takeID} />
	  <p className="mt-4 font-bold">Total Takes: {freshTotal}</p>
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
		  alreadyTookSide={alreadyTookSide || selectedChoice}
		/>
	  )}
	  {!loggedInUser && (
		<p className="text-sm mt-4">
		  Please use the verification form above to log in.
		</p>
	  )}
	  <div className="text-sm text-gray-600 mt-4">
		Last Updated: {lastUpdated.toLocaleString()}
	  </div>
	</>
  );
}

function NormalOpenLayout({
  propData,
  selectedChoice,
  resultsRevealed,
  handleSelectChoice,
  aPct,
  bPct,
  totalTakes,
  loggedInUser,
  currentStep,
  setCurrentStep,
  phoneNumber,
  setPhoneNumber,
  handleComplete,
  alreadyTookSide,
  lastUpdated,
}) {
  return (
	<>
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
	  <div className="font-bold">Total Takes: {totalTakes}</div>
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
	  <div className="text-sm text-gray-600 mt-4">
		Last Updated: {lastUpdated.toLocaleString()}
	  </div>
	</>
  );
}
