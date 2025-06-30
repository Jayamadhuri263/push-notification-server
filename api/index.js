
const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const app = express();
// Vercel manages the port for serverless functions, so this line is no longer strictly needed
// const PORT = process.env.PORT || 4000;
const cors = require('cors');
app.use(cors());

// Check if the environment variable exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    // In a serverless function, exiting might not be ideal; it's better to throw an error or return a specific response
    // For now, let's keep it but be aware it might not behave exactly as `process.exit(1)` in serverless context
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
}

// Parse the JSON string from the environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize Firebase Admin with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Parse JSON request body
app.use(bodyParser.json());

// ✅ Add a simple GET route for the root URL
app.get('/', (req, res) => {
  res.status(200).send(" ChatterJoy's Push Notification Server is running!");
});

// ✅ Route to send push notification
app.post('/send-push', async (req, res) => {
  const { token, title, body } = req.body;

  const message = {
    notification: {
      title,
      body,
    },
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ ChatterJoy Successfully sent message:', response);
    res.status(200).send({ success: true, response });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).send({ success: false, error });
  }
});

// ✅ Crucial for Vercel Serverless Functions: export the app
module.exports = app;

// ✅ REMOVE THE app.listen() CALL from here
// app.listen(PORT, () => {
//   console.log(`Server listening on port ${PORT}`);
// });