import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { Sandbox } from '@e2b/code-interpreter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// ==========================================
// 1. E2B Sandbox Management
// ==========================================
const activeSandboxes = new Map();

async function getSandbox(id) {
  if (!activeSandboxes.has(id)) {
    console.log(`Creating new E2B sandbox for session: ${id}`);
    const sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY });
    activeSandboxes.set(id, sandbox);
  }
  return activeSandboxes.get(id);
}

app.post('/api/sandbox', async (req, res) => {
  try {
    const { action, params, sandboxId = 'default' } = req.body;
    const sandbox = await getSandbox(sandboxId);
    let result;

    switch (action) {
      case 'execute_command':
        const cmd = await sandbox.commands.run(params.cmd);
        result = { stdout: cmd.stdout, stderr: cmd.stderr, exitCode: cmd.exitCode };
        break;
      case 'read_file':
        result = await sandbox.files.read(params.path);
        break;
      case 'write_file':
        await sandbox.files.write(params.path, params.content);
        result = { success: true };
        break;
      case 'list_files':
        result = await sandbox.files.list(params.dir || '/home/user');
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ success: true, result });
  } catch (error) {
    console.error('E2B Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. Gemini API Route (Updated for Tools)
// ==========================================
app.post('/api/chat/gemini', async (req, res) => {
  try {
    const { model, messages, systemInstruction, temperature, tools } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const config = {
      systemInstruction: systemInstruction,
      temperature: temperature || 0.1,
    };
    
    // AI-কে টুলগুলো পাস করা হচ্ছে
    if (tools) {
      config.tools = tools;
    }

    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents: messages, 
      config: config
    });

    // AI যদি কোনো টুল কল করে (যেমন: read_file বা execute_command)
    if (response.functionCalls && response.functionCalls.length > 0) {
      return res.json({ success: true, functionCalls: response.functionCalls });
    }

    // সাধারণ টেক্সট রেসপন্স
    res.json({ success: true, content: response.text });
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ error: 'Gemini API Error', details: error.message });
  }
});

// ==========================================
// 3. OpenRouter API Route
// ==========================================
app.post('/api/chat/openrouter', async (req, res) => {
  try {
    const { model, messages, systemInstruction, temperature } = req.body;
    
    // Extract only the text content for OpenRouter to avoid format issues
    const lastMessage = messages[messages.length - 1]?.parts?.[0]?.text || "";
    
    const formattedMessages = [];
    if (systemInstruction) formattedMessages.push({ role: 'system', content: systemInstruction });
    formattedMessages.push({ role: 'user', content: lastMessage });

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
