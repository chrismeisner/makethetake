// File: src/PropDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import VerificationWidget from './VerificationWidget';

export default function PropDetailPage() {
  const { propID } = useParams();
  const [propData, setPropData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
	fetch(`/api/prop?propID=${encodeURIComponent(propID)}`)
	  .then((res) => res.json())
	  .then((data) => {
		if (!data.success) {
		  setError(data.error || 'Error loading prop.');
		} else {
		  setPropData(data);
		}
		setLoading(false);
	  })
	  .catch((err) => {
		console.error('[PropDetailPage] Error:', err);
		setError('Could not load prop data.');
		setLoading(false);
	  });
  }, [propID]);

  if (loading) {
	return <div className="p-4">Loading prop...</div>;
  }

  if (error) {
	return <div className="p-4 text-red-600">{error}</div>;
  }

  if (!propData) {
	return <div className="p-4">Prop not found.</div>;
  }

  return (
	<div className="p-4 max-w-3xl mx-auto">
	  {/* 1) Prop Title (Tailwind "h1") */}
	  <h1 className="text-3xl font-bold mb-2">{propData.propTitle}</h1>

	  {/* 2) Subject Logo (small square) */}
	  {propData.subjectLogoUrl && (
		<img
		  src={propData.subjectLogoUrl}
		  alt={propData.subjectTitle || 'Subject Logo'}
		  className="w-16 h-16 object-cover rounded mb-2"
		/>
	  )}

	  {/* 3) Subject Title and Created At */}
	  <div className="text-sm text-gray-700 mb-4">
		{propData.subjectTitle && (
		  <p className="mb-1">Subject: {propData.subjectTitle}</p>
		)}
		<p>Created: {propData.createdAt}</p>
	  </div>

	  {/* 4) Prop Summary */}
	  <p className="mt-2 text-lg">{propData.propSummary}</p>

	  {/* 5) VerificationWidget for voting */}
	  <div className="my-8">
		<VerificationWidget embeddedPropID={propData.propID} />
	  </div>

	  {/* 6) Related Content (if any) */}
	  {propData.content && propData.content.length > 0 && (
		<section className="mt-8">
		  <h3 className="text-xl font-semibold mb-2">Related Content</h3>
		  <ul className="pl-4">
			{propData.content.map((item, idx) => (
			  <li
				key={idx}
				className="mb-2 flex items-center"
			  >
				{/* Optional content image */}
				{item.contentImageUrl && (
				  <img
					src={item.contentImageUrl}
					alt={item.contentTitle || 'content image'}
					className="w-12 h-12 object-cover rounded border border-gray-300 mr-3"
				  />
				)}
				<a
				  href={item.contentURL}
				  target="_blank"
				  rel="noopener noreferrer"
				  className="text-blue-600 underline"
				>
				  {item.contentTitle || 'View Link'}
				</a>
			  </li>
			))}
		  </ul>
		</section>
	  )}
	</div>
  );
}
