import React from 'react';
import './App.css'; // Optional if you're using external CSS

function Choice({ 
  label, 
  percentage, 
  isSelected, 
  showResults, 
  onSelect 
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  // If we haven't revealed results, the fill is 0% width.
  // Otherwise, fill it to `percentage`.
  const fillWidth = showResults ? `${percentage}%` : '0%';

  // Light/darker gray hover effect
  const baseBackground = '#f3f3f3';
  const hoverBackground = '#e0e0e0';
  const backgroundColor = isHovered ? hoverBackground : baseBackground;

  /**
   * Opacity logic for the fill bar:
   * - showResults === false => fillOpacity = 0 (width=0% anyway)
   * - showResults === true & isSelected => 1
   * - showResults === true & !isSelected => 0.4
   */
  const fillOpacity = showResults
    ? (isSelected ? 1 : 0.4)
    : 0;

  // Convert #dbeafe to RGBA with dynamic opacity
  const fillColor = `rgba(219, 234, 254, ${fillOpacity})`; // #dbeafe

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
        textAlign: 'left', // left-align our text
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

      {/* Label on top (left-aligned). 
          We split label and (xx%) so the label doesn't jump if showResults toggles. */}
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

function PollChoices({ selectedChoice, resultsRevealed, onSelectChoice }) {
  const choices = [
    { value: 'yes', label: 'Yes', percentage: 44 },
    { value: 'no',  label: 'Not Happening', percentage: 56 },
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

function PhoneNumberForm({ phoneNumber, onSubmit }) {
  const [localPhone, setLocalPhone] = React.useState(phoneNumber);

  const handleSend = () => {
    // In a real app, you'd call a backend or Twilio here.
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
          style={{ flex: '1' }}
        />
        <button onClick={handleSend}>Send Verification Code</button>
      </div>
    </div>
  );
}

function VerificationForm({ phoneNumber, verificationCode, onSubmit, onResend }) {
  const [localCode, setLocalCode] = React.useState(verificationCode);

  const handleVerify = () => {
    // In a real app, you'd call your backend or Twilio to verify the code.
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

function VerificationWidget() {
  const [currentStep, setCurrentStep] = React.useState('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');

  // Which choice? 'yes', 'no', or '' if none selected
  const [selectedChoice, setSelectedChoice] = React.useState('');

  // Hide results until a choice is selected
  const [resultsRevealed, setResultsRevealed] = React.useState(false);

  // Clicking the same choice again resets back to unselected
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

  const handleCodeSubmit = (code) => {
    setVerificationCode(code);
    console.log(`Verifying code "${code}" for phone "${phoneNumber}"`);
    console.log(`User selected choice: "${selectedChoice}"`);
    // Potentially show success or move to next step
  };

  const handleResend = () => {
    console.log(`Resending code to "${phoneNumber}"`);
  };

  // 
  // NOTE the updated container style: maxWidth + margin: '0 auto'
  //
  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '600px',       // limit overall width
        margin: '0 auto',        // center horizontally if there's extra space
      }}
    >
      <h2>Make The Take</h2>
      <p>Do the Lakers win the 2020 Championship?</p>

      <PollChoices
        selectedChoice={selectedChoice}
        resultsRevealed={resultsRevealed}
        onSelectChoice={handleSelectChoice}
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

function App() {
  return (
    <div className="App">
      <VerificationWidget />
    </div>
  );
}

export default App;
