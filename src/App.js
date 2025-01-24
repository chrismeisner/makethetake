// src/App.js
import React from 'react';
import './App.css'; // Optional if you have external/global CSS

/**
 * A single clickable "Side" (A/B) with a fill meter.
 */
function Choice({ label, percentage, isSelected, showResults, onSelect }) {
  const [isHovered, setIsHovered] = React.useState(false);

  // If results aren't revealed yet, fill is 0%. Otherwise, fill to `percentage`.
  const fillWidth = showResults ? `${percentage}%` : '0%';

  // Gray hover effect
  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  /**
   * Fill opacity logic:
   * - No results => fillOpacity = 0
   * - Results + selected => 1.0
   * - Results + not selected => 0.4
   */
  const fillOpacity = showResults ? (isSelected ? 1 : 0.4) : 0;

  // Convert #dbeafe (light blue) to RGBA w/ dynamic opacity
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
      {/* Meter fill */}
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

      {/* Label on top (split out so the label doesn't jump when percentages show) */}
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
 * The container for "Side A" and "Side B."
 * We pass in "propSideAPct", "propSideBPct" from the parent.
 */
function PropChoices({
  selectedChoice,
  resultsRevealed,
  onSelectChoice,
  propSideAPct,
  propSideBPct
}) {
  // We'll have 2 choices: "Side A" and "Side B"
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
 * Phone number form: side-by-side input & button
 */
function PhoneNumberForm({ phoneNumber, onSubmit }) {
  const [localPhone, setLocalPhone] = React.useState(phoneNumber);

  const handleSend = () => {
    // In a real app, you'd call your server/Twilio here.
    onSubmit(localPhone);
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem' }}>
        Phone Number
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="tel"
          value={localPhone}
          onChange={(e) => setLocalPhone(e.target.value)}
          placeholder="(602) 380-2794"
          style={{ flex: 1 }}
        />
        <button onClick={handleSend}>Send Verification Code</button>
      </div>
    </div>
  );
}

/**
 * Verification code form
 */
function VerificationForm({ phoneNumber, verificationCode, onSubmit, onResend }) {
  const [localCode, setLocalCode] = React.useState(verificationCode);

  const handleVerify = () => {
    // In a real app, you'd verify with Twilio.
    onSubmit(localCode);
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label>Your Verification Code</label>
      <input
        type="tel"
        value={localCode}
        onChange={(e) => setLocalCode(e.target.value)}
        placeholder="123-456"
        style={{ display: 'block', margin: '0.5rem 0' }}
      />
      <button onClick={handleVerify}>Verify</button>

      <p>
        Verification code sent to <strong>{phoneNumber}</strong>
      </p>

      <button onClick={onResend} style={{ marginTop: '0.5rem' }}>
        Resend it
      </button>
    </div>
  );
}

/**
 * Main widget that loads "Prop" data from /api/prop?propID=xxx
 * Toggling logic for Side A/B, plus phone verification steps
 */
function VerificationWidget() {
  const [currentStep, setCurrentStep] = React.useState('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');

  // Which side is selected? 'A', 'B', or '' if none
  const [selectedChoice, setSelectedChoice] = React.useState('');
  // If no choice is selected yet, we hide results. Once user picks, we show partial fill, etc.
  const [resultsRevealed, setResultsRevealed] = React.useState(false);

  // Data from the server about this prop
  const [propData, setPropData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // On mount, parse ?propID from the URL, fetch data
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
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSelectChoice = (choiceValue) => {
    if (choiceValue === selectedChoice) {
      // Clicking the same choice again -> reset
      setSelectedChoice('');
      setResultsRevealed(false);
    } else {
      // Otherwise select and reveal results
      setSelectedChoice(choiceValue);
      setResultsRevealed(true);
    }
  };

  const handlePhoneSubmit = (phone) => {
    setPhoneNumber(phone);
    setCurrentStep('code');
  };

  const handleCodeSubmit = (code) => {
    setVerificationCode(code);
    console.log(`Verifying code "${code}" for phone "${phoneNumber}"`);
    console.log(`User selected side: "${selectedChoice}"`);
    // Possibly show success or do something else
  };

  const handleResend = () => {
    console.log(`Resending code to "${phoneNumber}"`);
  };

  // If still loading or we got an error
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
    <div
      style={{
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto', // center horizontally
      }}
    >
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
        />
      )}

      {currentStep === 'code' && (
        <VerificationForm
          phoneNumber={phoneNumber}
          verificationCode={verificationCode}
          onSubmit={handleCodeSubmit}
          onResend={handleResend}
        />
      )}
    </div>
  );
}

/**
 * Root App
 */
function App() {
  return (
    <div className="App">
      <VerificationWidget />
    </div>
  );
}

export default App;
