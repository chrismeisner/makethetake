// src/App.js
import React from 'react';
import InputMask from 'react-input-mask';
import './App.css'; // optional if you have global CSS

/**
 * Choice: a single side (A/B) with partial fill meter, hover effect
 */
function Choice({ label, percentage, isSelected, showResults, onSelect }) {
  const [isHovered, setIsHovered] = React.useState(false);

  // If results not revealed => 0%, else => `${percentage}%`.
  const fillWidth = showResults ? `${percentage}%` : '0%';

  // Gray hover effect
  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  /**
   * fillOpacity = 0 if results not revealed
   * else => isSelected ? 1 : 0.4
   */
  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`; // #dbeafe with variable opacity

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
      {/* Fill bar behind the text */}
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
      {/* Label on top (split so it doesn't jump on reveal) */}
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

/**
 * PropChoices: Two sides => A and B
 * We pass in propSideAPct / propSideBPct from the server's dynamic calculation
 */
function PropChoices({
  selectedChoice,
  resultsRevealed,
  onSelectChoice,
  propSideAPct,
  propSideBPct
}) {
  const choices = [
    { value: 'A', label: 'Side A', percentage: propSideAPct },
    { value: 'B', label: 'Side B', percentage: propSideBPct },
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

/**
 * PhoneNumberForm:
 *  - uses react-input-mask for (999) 999-9999
 *  - calls /api/sendCode with that phone
 *  - if success => onSubmit(localPhone) to move to code step
 */
function PhoneNumberForm({ phoneNumber, onSubmit, selectedChoice }) {
  const [localPhone, setLocalPhone] = React.useState(phoneNumber);

  // We check if user typed 10 digits + selected side => enable button
  const numericPhone = localPhone.replace(/\D/g, '');
  const isPhoneValid = numericPhone.length === 10;
  const hasSide = selectedChoice !== '';
  const isDisabled = !isPhoneValid || !hasSide;

  async function handleSend() {
    try {
      // 1) Call /api/sendCode with { phone: localPhone }
      const resp = await fetch('/api/sendCode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: localPhone })
      });
      if (!resp.ok) {
        alert('Failed to send verification code');
        return;
      }
      // 2) If success => go to code step
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

/**
 * VerificationForm:
 *  - uses react-input-mask for EXACT 6 digits
 *  - first calls /api/verifyCode => if success => call /api/take
 *  - then proceed to "complete"
 */
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
      // 1) Verify code with Twilio
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

      // 2) If code is valid => create the "take"
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

      // 3) Move to "complete" step
      onComplete();
    } catch (err) {
      console.error('[VerificationForm] Error verifying code:', err);
      alert('Error verifying code. Please try again.');
    }
  }

  function handleResend() {
    // If you want a "resend code" option, call /api/sendCode again
    console.log(`Resending code to "${phoneNumber}"...`);
    // Possibly do the same logic as handleSend in PhoneNumberForm
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

/**
 * Simple "complete" final step
 */
function CompleteStep() {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>Thanks!</h3>
      <p>Your take was logged successfully.</p>
    </div>
  );
}

/**
 * The main widget
 *  - loads Prop from /api/prop
 *  - toggles side A/B
 *  - phone => code => Twilio verify => if success => log take => complete
 */
function VerificationWidget() {
  const [currentStep, setCurrentStep] = React.useState('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [selectedChoice, setSelectedChoice] = React.useState('');
  const [resultsRevealed, setResultsRevealed] = React.useState(false);

  const [propData, setPropData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // Load the prop from /api/prop
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

  // user picks side
  function handleSelectChoice(choiceValue) {
    if (choiceValue === selectedChoice) {
      setSelectedChoice('');
      setResultsRevealed(false);
    } else {
      setSelectedChoice(choiceValue);
      setResultsRevealed(true);
    }
  }

  // Once phone is submitted (after we send code => success), go to code step
  function handlePhoneSubmit(phone) {
    setPhoneNumber(phone);
    setCurrentStep('code');
  }

  // Once everything is done, show the "complete" step
  function handleComplete() {
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

      {/* Display the dynamic side A/B with partial fill bars */}
      <PropChoices
        selectedChoice={selectedChoice}
        resultsRevealed={resultsRevealed}
        onSelectChoice={handleSelectChoice}
        propSideAPct={propData.propSideAPct}
        propSideBPct={propData.propSideBPct}
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

      {currentStep === 'complete' && <CompleteStep />}
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <VerificationWidget />
    </div>
  );
}

export default App;
