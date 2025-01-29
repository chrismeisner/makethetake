// File: src/LoginPage.js

import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from './UserContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setLoggedInUser } = useContext(UserContext);

  const [step, setStep] = useState('phone'); // "phone" or "code"
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function handleSendCode() {
	// Basic validation: check that phone has ~10 digits
	const numeric = phone.replace(/\D/g, '');
	if (numeric.length !== 10) {
	  setError('Please enter a valid 10-digit phone number');
	  return;
	}
	setError('');

	try {
	  const resp = await fetch('/api/sendCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone })
	  });
	  const data = await resp.json();
	  if (!resp.ok || data.error) {
		setError(data.error || 'Error sending code');
	  } else {
		// Success
		setStep('code');
	  }
	} catch (err) {
	  setError('Error: ' + err.message);
	}
  }

  async function handleVerifyCode() {
	const numeric = code.replace(/\D/g, '');
	if (numeric.length !== 6) {
	  setError('Please enter the 6-digit code');
	  return;
	}
	setError('');

	try {
	  // Verify the code with Twilio
	  const resp = await fetch('/api/verifyCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone, code: numeric })
	  });
	  const data = await resp.json();
	  if (!resp.ok || data.error || !data.success) {
		// The code was invalid or some other error
		setError(data.error || 'Invalid verification code');
		return;
	  }

	  // If code was approved, we have a session now.
	  // Let's fetch /api/me to confirm logged in user details
	  const meResp = await fetch('/api/me', { credentials: 'include' });
	  const meData = await meResp.json();
	  if (meData.loggedIn && meData.user) {
		// Save to context
		setLoggedInUser(meData.user);
		// Redirect to the user's profile page
		navigate(`/profile/${meData.user.profileID}`);
	  } else {
		setError('Could not confirm login session.');
	  }
	} catch (err) {
	  setError('Error: ' + err.message);
	}
  }

  return (
	<div style={{ maxWidth: '400px', margin: '2rem auto' }}>
	  <h2 className="text-2xl font-bold mb-4">Login with Phone</h2>
	  
	  {error && (
		<div style={{ marginBottom: '1rem', color: 'red' }}>
		  {error}
		</div>
	  )}

	  {step === 'phone' && (
		<>
		  <label className="block mb-2">Enter your phone number:</label>
		  <input
			type="tel"
			placeholder="(555) 555-1234"
			value={phone}
			onChange={(e) => setPhone(e.target.value)}
			className="border p-2 mb-4 w-full"
		  />
		  <button
			onClick={handleSendCode}
			className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
		  >
			Send Code
		  </button>
		</>
	  )}

	  {step === 'code' && (
		<>
		  <label className="block mb-2">Enter the 6-digit verification code:</label>
		  <input
			type="text"
			placeholder="123456"
			value={code}
			onChange={(e) => setCode(e.target.value)}
			className="border p-2 mb-4 w-full"
		  />
		  <button
			onClick={handleVerifyCode}
			className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
		  >
			Verify Code
		  </button>
		</>
	  )}
	</div>
  );
}
