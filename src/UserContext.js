// File: src/UserContext.js
import React, { createContext, useState, useEffect } from 'react';

export const UserContext = createContext();

export function UserProvider({ children }) {
  const [loggedInUser, setLoggedInUser] = useState(null);

  // On first load (or page refresh), check whether there's an existing session
  useEffect(() => {
	fetch('/api/me', { credentials: 'include' })
	  .then((res) => res.json())
	  .then((data) => {
		if (data.loggedIn) {
		  // data.user might be { phone: '+1...', profileID: 'abc123' }
		  setLoggedInUser(data.user);
		}
	  })
	  .catch((err) => {
		console.error('[UserContext] Error calling /api/me:', err);
	  });
  }, []);

  return (
	<UserContext.Provider value={{ loggedInUser, setLoggedInUser }}>
	  {children}
	</UserContext.Provider>
  );
}
