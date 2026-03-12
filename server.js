import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Setup - Allow your frontend domains
app.use(cors({
    origin: '*', // প্রোডাকশনে যাওয়ার পর এখানে আপনার Vercel/Frontend URL দিয়ে দেবেন
    methods: ['GET', 'POST']
}));
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.send('OneClick Studio Backend is Running Perfectly! 🚀');
});

// Gemini API Route
app.post('/api/chat/gemini', async (req, res) => {
  try {
    const { model, messages, systemInstruction, temperature } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const lastMessage = messages[messages.length - 1].content;

    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents: lastMessage,
      config: {
        systemInstruction: systemInstruction,
        temperature: temperature || 0.1,
      }
    });

    res.json({ success: true, content: response.text });
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Gemini API Error', details: error.message });
  }
});

// OpenRouter API Route
app.post('/api/chat/openrouter', async (req, res) => {
  try {
    const { model, messages, systemInstruction, temperature } = req.body;
    
    const formattedMessages = [];
    if (systemInstruction) formattedMessages.push({ role: 'system', content: systemInstruction });
    formattedMessages.push(...messages);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://oneclick-studio.vercel.app",
        "X-Title": "OneClick Studio",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        temperature: temperature || 0.1
      })
    });

    const data = await response.json();
    res.json({ success: true, content: data.choices[0].message.content });
  } catch (error) {
    console.error('OpenRouter Error:', error);
    res.status(500).json({ error: 'OpenRouter API Error', details: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
