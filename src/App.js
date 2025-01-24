// src/App.js
import React from 'react';
import InputMask from 'react-input-mask';
import './App.css'; // optional if you have global CSS

/**
 * Choice: a single side (A/B) with partial fill meter, hover effect
 */
function Choice({ label, percentage, isSelected, showResults, onSelect }) {
  const [isHovered, setIsHovered] = React.useState(false);

  // If not revealed => 0%, else => `${percentage}%`
  const fillWidth = showResults ? `${percentage}%` : '0%';

  // Gray hover effect
  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  /**
   * fillOpacity = 0 if not revealed
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
 *  - does NOT log the take => only transitions to code step
 */
function PhoneNumberForm({ phoneNumber, onSubmit, selectedChoice }) {
  const [localPhone, setLocalPhone] = React.useState(phoneNumber);

  // numericPhone => 10 digits
  const numericPhone = localPhone.replace(/\D/g, '');
  const isPhoneValid = numericPhone.length === 10;
  const hasSide = selectedChoice !== '';
  const isDisabled = !isPhoneValid || !hasSide;

  const handleSend = () => {
    onSubmit(localPhone);
  };

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
      {!hasSide && <div style={{ color: 'red' }}>Please select a side above.</div>}
      {!isPhoneValid && <div style={{ color: 'red' }}>Enter a 10-digit phone number.</div>}
    </div>
  );
}

/**
 * VerificationForm:
 *  - uses react-input-mask for EXACT 6 digits
 *  - on "Verify", logs the take => proceed to "complete"
 */
function VerificationForm({
  phoneNumber,
  selectedChoice,
  propID,
  onComplete
}) {
  const [localCode, setLocalCode] = React.useState('');

  const handleVerify = async () => {
    const numeric = localCode.replace(/\D/g, '');
    if (numeric.length !== 6) {
      alert('Please enter a valid 6-digit code.');
      return;
    }

    // Code "verified" => log the take
    try {
      const body = {
        takeMobile: phoneNumber,
        propID: propID,
        propSide: selectedChoice,
      };
      console.log('[VerificationForm] Logging take:', body);

      const resp = await fetch('/api/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        console.error('[VerificationForm] Logging take failed:', resp.status);
        alert('Failed to log the take. Please try again.');
        return;
      }

      // If success => move to "complete"
      onComplete();
    } catch (err) {
      console.error('[VerificationForm] Error logging take:', err);
      alert('Error logging take. Please try again.');
    }
  };

  const handleResend = () => {
    console.log(`Resending code to "${phoneNumber}" (in a real scenario => Twilio, etc.)`);
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label>Enter Your 6-Digit Verification Code</label>
      <InputMask
        mask="999999"        // exactly 6 digits
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
 *  - phone => code => logs take => complete
 */
function VerificationWidget() {
  const [currentStep, setCurrentStep] = React.useState('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [selectedChoice, setSelectedChoice] = React.useState('');
  const [resultsRevealed, setResultsRevealed] = React.useState(false);

  const [propData, setPropData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

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

  const handleSelectChoice = (choiceValue) => {
    if (choiceValue === selectedChoice) {
      setSelectedChoice('');
      setResultsRevealed(false);
    } else {
      setSelectedChoice(choiceValue);
      setResultsRevealed(true);
    }
  };

  const handlePhoneSubmit = (phone) => {
    setPhoneNumber(phone);
    setCurrentStep('code');
  };

  const handleComplete = () => {
    setCurrentStep('complete');
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading proposition...</div>;
  }
  if (!propData || propData.error) {
    return (
      <div style={{ padding: '2rem' }}>
        {propData && propData.error ? propData.error : 'Error loading proposition'}
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
