// File: src/PropDetailPage.js
import React from 'react';
import { useParams } from 'react-router-dom';
import VerificationWidget from './VerificationWidget';

export default function PropDetailPage() {
  const { propID } = useParams();

  return (
	<div style={{ padding: '2rem' }}>
	  <h2>Prop Detail for: {propID}</h2>
	  
	  {/* Render the VerificationWidget, telling it which prop to load */}
	  <VerificationWidget embeddedPropID={propID} />
	</div>
  );
}
