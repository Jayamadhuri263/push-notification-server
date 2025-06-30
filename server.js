
// server.js

const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const app = express();
const PORT = 4000; // Or any available port
const cors = require('cors');
app.use(cors());

// ✅ Load your service account JSON file here:
const serviceAccount = require('./serviceAccountKey.json');

// ✅ Initialize Firebase Admin with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ✅ Parse JSON request body
app.use(bodyParser.json());

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
    console.log('✅ Successfully sent message:', response);
    res.status(200).send({ success: true, response });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).send({ success: false, error });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Push notification server running at http://localhost:${PORT}`);
});
