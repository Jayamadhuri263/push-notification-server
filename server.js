// server.js

// ✅ 1. Load environment variables FIRST if not in production
// This line should be at the very top of your file to ensure process.env
// is populated before any attempts to access environment variables.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const app = express();
const PORT = 4000; // Or any available port
const cors = require('cors');
app.use(cors());

// IMPORTANT: For local development in environments with SSL inspection (like some corporate networks),
// you might need to set NODE_TLS_REJECT_UNAUTHORIZED=0 in your .env file.
// This tells Node.js to ignore certificate validation.
// This is a SECURITY RISK and should NEVER be used in production.
// Vercel (your deployment environment) will not need this.
if (process.env.NODE_ENV !== 'production' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.warn('WARNING: NODE_TLS_REJECT_UNAUTHORIZED is set to 0. This is for development only! Do NOT use in production.');
}


// ✅ Check if the FIREBASE_SERVICE_ACCOUNT_KEY environment variable is set.
// This check occurs AFTER dotenv has had a chance to load from .env.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    // Exit the application if the critical environment variable is missing
    process.exit(1);
}

// Parse the JSON string from the environment variable
// This converts the string value from process.env into a JavaScript object
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);


// ✅ Initialize Firebase Admin with your service account credentials.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


// ✅ Parse JSON request body
// This middleware allows your Express app to read JSON data sent in the request body.
app.use(bodyParser.json());


// ✅ Add a simple GET route for the root URL
app.get('/', (req, res) => {
  res.status(200).send("ChatterJoy's Push Notification Server is running!");
});


// ✅ Route to send push notification
// This defines an API endpoint that can be called to send push notifications.
app.post('/send-push', async (req, res) => {
  const { token, title, body } = req.body; // Extract token, title, and body from the request

  // Construct the message object for Firebase Cloud Messaging
  const message = {
    notification: {
      title,
      body,
    },
    token, // The device token to send the notification to
  };

  try {
    // Attempt to send the message using Firebase Admin SDK
    const response = await admin.messaging().send(message);
    console.log('✅ Successfully sent message:', response);
    res.status(200).send({ success: true, response }); // Send success response
  } catch (error) {
    // Log and send error response if sending fails
    console.error('❌ Error sending message:', error);
    res.status(500).send({ success: false, error: error.message }); // Send error message
  }
});

// ✅ Start the server
// The application starts listening for incoming requests on the specified port.
app.listen(PORT, () => {
  console.log(`🚀 Push notification server running at http://localhost:${PORT}`);
});