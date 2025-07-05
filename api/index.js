// Load dotenv at the very top, before any other code that might use environment variables
// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // This is good now with node-fetch@2.6.7
const app = express();

const PORT = process.env.PORT || 4000;

const cors = require('cors');
app.use(cors());

// Check if the environment variable exists AFTER dotenv has loaded
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error("Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
}

// Parse the JSON string from the environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize Firebase Admin with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Parse JSON request body
app.use(bodyParser.json());

// ✅ Add a simple GET route for the root URL
app.get('/', (req, res) => {
  res.status(200).send("ChatterJoy's Push Notification Server is running!");
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


// ✅ Route to generate AI reply based on message emotion
app.post('/generate-reply', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required in request body" });
  }

  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  // --- NEW: Get Gemini API Key from environment variable ---
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


  if (!HF_API_KEY) {
    console.error("Hugging Face API key is not set in environment.");
    return res.status(500).json({ error: "Hugging Face API key is not configured." });
  }

  // --- NEW: Check for Gemini API Key ---
  if (!GEMINI_API_KEY) {
    console.error("Gemini API key is not set in environment.");
    return res.status(500).json({ error: "Gemini API key is not configured." });
  }

  // --- DEBUGGING: Log the API key (REMOVE THIS IN PRODUCTION!) ---
  console.log("Using Hugging Face API Key (first 5 chars):", HF_API_KEY.substring(0, 5) + "...");
  console.log("Using Gemini API Key (first 5 chars):", GEMINI_API_KEY.substring(0, 5) + "...");


  try {
    // Step 1: Emotion Detection (Still using Hugging Face)
    const emotionRes = await fetch('https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: message }),
    });

    // Check if the emotion detection API call was successful
    if (!emotionRes.ok) {
        const errorText = await emotionRes.text();
        console.error(`❌ Hugging Face Emotion API Error (${emotionRes.status}): ${errorText}`);
        return res.status(emotionRes.status).json({ error: `Hugging Face Emotion API Error: ${errorText}` });
    }

    const emotionData = await emotionRes.json();
    const topEmotion = emotionData[0]?.label || "neutral";
    console.log(`Detected emotion: ${topEmotion}`); // Log detected emotion

    // Step 2: Generate Reply (Now using Google Gemini API)
    const prompt = `Message: "${message}"\nEmotion: ${topEmotion}\nGenerate a short, empathetic reply.`;

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    // --- UPDATED: Use GEMINI_API_KEY from environment variable ---
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const replyRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    // Check if the Gemini API call was successful
    if (!replyRes.ok) {
        const errorText = await replyRes.text();
        console.error(`❌ Gemini API Reply Error (${replyRes.status}): ${errorText}`);
        return res.status(replyRes.status).json({ error: `Gemini API Reply Error: ${errorText}` });
    }

    const result = await replyRes.json();
    let reply = "Thanks for sharing that."; // Default reply

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      reply = result.candidates[0].content.parts[0].text;
    } else {
      console.warn("Gemini API response structure unexpected or content missing.");
    }

    console.log(`Generated reply: ${reply}`); // Log generated reply

    return res.status(200).json({ reply, emotion: topEmotion });
  } catch (error) {
    // Catch-all for network errors or unexpected issues
    console.error("❌ Error in /generate-reply:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});


// ✅ Crucial for Vercel Serverless Functions: export the app
module.exports = app;

// ✅ Start the server only if not in a serverless environment (e.g., local development)
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development') {
  app.listen(PORT, () => {
    console.log(`🚀 ChatterJoy Push Notification Server running on http://localhost:${PORT}`);
  });
}
