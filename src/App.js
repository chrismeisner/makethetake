// File: src/App.js
import React from 'react';
import InputMask from 'react-input-mask';
import './App.css'; // optional if you have global CSS

// 1) React Router imports
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// We'll import TakePage from a separate file
import TakePage from './TakePage';

// ----------------------
// Choice Component
// ----------------------
function Choice({ label, percentage, isSelected, showResults, onSelect }) {
  const [isHovered, setIsHovered] = React.useState(false);

  const fillWidth = showResults ? `${percentage}%` : '0%';

  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        border: '1px solid #ddd',
        marginBottom: '0.5rem',
        padding: '1rem',
        cursor: 'pointer',
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        overflow: 'hidden',
        backgroundColor,
        transition: 'background-color 0.2s ease',
        textAlign: 'left',
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
        <span>{label}</span>
        <span
          style={{
            visibility: showResults ? 'visible' : 'hidden',
            marginLeft: '6px',
          }}
        >
          ({percentage}%)
        </span>
      </div>
    </div>
  );
}

// ----------------------
// PropChoices Component
// ----------------------
function PropChoices({
  selectedChoice,
  resultsRevealed,
  onSelectChoice,
  propSideAPct,
  propSideBPct,
  sideALabel,
  sideBLabel
}) {
  const choices = [
    { value: 'A', label: sideALabel, percentage: propSideAPct },
    { value: 'B', label: sideBLabel, percentage: propSideBPct },
  ];

  return (
    <div style={{ marginBottom: '1rem' }}>
      {choices.map((choice) => (
        <Choice
          key={choice.value}
          label={choice.label}
          percentage={choice.percentage}
          isSelected={selectedChoice === choice.value}
          showResults={resultsRevealed}
          onSelect={() => onSelectChoice(choice.value)}
        />
      ))}
    </div>
  );
}

// ----------------------
// PhoneNumberForm Component
// ----------------------
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

// ----------------------
// VerificationForm Component
// ----------------------
function VerificationForm({
  phoneNumber,
  selectedChoice,
  propID,
  onComplete
}) {
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

      // Grab the newTakeID from the server response
      const { newTakeID } = takeData;

      // 3) done => notify the parent of newTakeID
      onComplete(newTakeID);
    } catch (err) {
      console.error('[VerificationForm] Error verifying code:', err);
      alert('Error verifying code. Please try again.');
    }
  }

  function handleResend() {
    console.log(`Resending code to "${phoneNumber}"...`);
    // optional: call /api/sendCode again with phoneNumber
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

// ----------------------
// CompleteStep Component
// ----------------------
function CompleteStep({ takeID }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>Thanks!</h3>
      <p>Your take was logged successfully.</p>

      {takeID && (
        <p>
          {/* Link to the newly created takeID */}
          <a href={`/takes/${takeID}`} target="_blank" rel="noreferrer">
            View your new take here
          </a>
        </p>
      )}
    </div>
  );
}

// ----------------------
// VerificationWidget Component
// ----------------------
function VerificationWidget() {
  const [currentStep, setCurrentStep] = React.useState('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [selectedChoice, setSelectedChoice] = React.useState('');
  const [resultsRevealed, setResultsRevealed] = React.useState(false);

  const [propData, setPropData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // We'll store the newly created takeID (once the take is saved)
  const [takeID, setTakeID] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const propID = params.get('propID') || 'defaultProp';

    fetch(`/api/prop?propID=${propID}`)
      .then(res => res.json())
      .then(data => {
        setPropData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('[VerificationWidget] Error fetching prop:', err);
        setLoading(false);
      });
  }, []);

  function handleSelectChoice(choiceValue) {
    if (choiceValue === selectedChoice) {
      setSelectedChoice('');
      setResultsRevealed(false);
    } else {
      setSelectedChoice(choiceValue);
      setResultsRevealed(true);
    }
  }

  function handlePhoneSubmit(phone) {
    setPhoneNumber(phone);
    setCurrentStep('code');
  }

  // Called when user has fully completed verification + creation
  function handleComplete(newTakeID) {
    // Store the newly created takeID, so we can display a link in the final step
    setTakeID(newTakeID);
    setCurrentStep('complete');
  }

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

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Make The Take</h2>
      <p>{propData.propShort}</p>

      <PropChoices
        selectedChoice={selectedChoice}
        resultsRevealed={resultsRevealed}
        onSelectChoice={handleSelectChoice}
        propSideAPct={propData.propSideAPct}
        propSideBPct={propData.propSideBPct}
        sideALabel={propData.PropSideAShort}
        sideBLabel={propData.PropSideBShort}
      />

      {currentStep === 'phone' && (
        <PhoneNumberForm
          phoneNumber={phoneNumber}
          onSubmit={handlePhoneSubmit}
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

      {currentStep === 'complete' && <CompleteStep takeID={takeID} />}
    </div>
  );
}

// ----------------------
// App Component w/ Router
// ----------------------
function App() {
  return (
    <Router>
      <Routes>
        {/* Root path => Show the VerificationWidget */}
        <Route path="/" element={<VerificationWidget />} />

        {/* New route => "/takes/:takeID" => Show the TakePage */}
        <Route path="/takes/:takeID" element={<TakePage />} />
      </Routes>
    </Router>
  );
}

export default App;
