// server.js
const path = require('path');
const express = require('express');

const app = express();

// Serve static files from the React app's build folder
app.use(express.static(path.join(__dirname, 'build')));

// For any request that doesn't match a static file, 
// serve index.html so React's client-side routing can handle it.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// If Heroku sets a port, use it. Otherwise default to 3000 locally.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
