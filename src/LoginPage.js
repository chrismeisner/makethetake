// File: src/LoginPage.js

import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from './UserContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setLoggedInUser } = useContext(UserContext);

  // 1) Grab ?redirect=... from the query string if present
  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect') || null;
  console.log('[LoginPage] Reading redirect param:', redirectPath);

  const [step, setStep] = useState('phone'); // "phone" or "code"
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // Helper to request the code
  async function handleSendCode(e) {
	if (e) e.preventDefault(); // prevent the form from refreshing
	console.log('[LoginPage] Sending code to phone:', phone);
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
	  console.error('Error in handleSendCode:', err);
	  setError('Could not send code. Please try again later.');
	}
  }

  // Helper to verify the code
  async function handleVerifyCode(e) {
	if (e) e.preventDefault();
	console.log('[LoginPage] Verifying code for phone:', phone);
	const numeric = code.replace(/\D/g, '');
	if (numeric.length !== 6) {
	  setError('Please enter the 6-digit code');
	  return;
	}
	setError('');

	try {
	  const resp = await fetch('/api/verifyCode', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone, code: numeric })
	  });
	  const data = await resp.json();
	  if (!resp.ok || data.error || !data.success) {
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

		// If we have a ?redirect=..., go there; else go to the user's profile
		console.log('[LoginPage] Successful verify. redirectPath =>', redirectPath);
		if (redirectPath) {
		  navigate(redirectPath);
		} else {
		  navigate(`/profile/${meData.user.profileID}`);
		}
	  } else {
		setError('Could not confirm login session.');
	  }
	} catch (err) {
	  console.error('Error in handleVerifyCode:', err);
	  setError('Could not verify code. Please try again later.');
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
		<form onSubmit={handleSendCode}>
		  <label className="block mb-2">Enter your phone number:</label>
		  <input
			type="tel"
			placeholder="(555) 555-1234"
			value={phone}
			onChange={(e) => setPhone(e.target.value)}
			className="border p-2 mb-4 w-full"
		  />
		  <button
			type="submit"
			className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
		  >
			Send Code
		  </button>
		</form>
	  )}

	  {step === 'code' && (
		<form onSubmit={handleVerifyCode}>
		  <label className="block mb-2">Enter the 6-digit verification code:</label>
		  <input
			type="text"
			placeholder="123456"
			value={code}
			onChange={(e) => setCode(e.target.value)}
			className="border p-2 mb-4 w-full"
		  />
		  <button
			type="submit"
			className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
		  >
			Verify Code
		  </button>
		</form>
	  )}
	</div>
  );
}
