/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsers with large limits for high-res base64 canvas screenshots
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Lazy initializer for Google GenAI client (prevents crash if key is missing)
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ==========================================
// API ROUTES
// ==========================================

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiApiKeyConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// AI Auto-Trace Outline generator (uses base64 screenshot of the video frame)
app.post('/api/auto-trace', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png', cognitiveMemory } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data' });
    }

    // Strip header prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const ai = getAiClient();

    // Setup input parts
    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    let targetDensity = 35;
    let learningBonus = '';
    if (cognitiveMemory) {
      targetDensity = cognitiveMemory.densityPreference || 35;
      learningBonus = ` [COGNITIVE REINFORCEMENT LEARNING]: Based on active training history (User Session Execution Count: ${cognitiveMemory.executionsCount || 1}), the user prefers vectors with about ${targetDensity} coordinates. Align your contour output density tightly with this preference.`;
    }

    const textPart = {
      text: `Analyze the primary moving subject, foreground actor, dancer, or main central figure in this video frame. Generate a continuous boundary curve tracing its outer silhouette contour. Output between 25 and 45 sequential vector points that draw this contour smoothly. Ensure coordinates x and y are percentage offsets from 0 to 100.${learningBonus}`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'A sequential list of points representing the rotoscope trace contour path.',
          items: {
            type: Type.OBJECT,
            properties: {
              x: {
                type: Type.NUMBER,
                description: 'Horizontal coordinate as a percentage from 0 (left) to 100 (right)',
              },
              y: {
                type: Type.NUMBER,
                description: 'Vertical coordinate as a percentage from 0 (top) to 100 (bottom)',
              },
            },
            required: ['x', 'y'],
          },
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Empty response from AI outliner');
    }

    const points = JSON.parse(textOutput.trim());
    return res.json({ points });
  } catch (error: any) {
    console.error('AI Auto-Trace Error:', error.message || error);
    return res.status(500).json({
      error: 'Failed to generate AI auto-trace.',
      message: error.message || 'Unknown backend error',
    });
  }
});

// AI Magic Mask / Background Removing Mask generator
app.post('/api/magic-mask', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png', clickX, clickY, mode = 'subject', cognitiveMemory } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data' });
    }

    // Strip header prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const ai = getAiClient();

    // Setup input parts
    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    let targetDensity = 35;
    let learningBonus = '';
    if (cognitiveMemory) {
      targetDensity = cognitiveMemory.densityPreference || 35;
      learningBonus = ` [COGNITIVE REINFORCEMENT LEARNING]: Based on active training history (User Session Execution Count: ${cognitiveMemory.executionsCount || 1}), the user prefers vectors with about ${targetDensity} coordinates. Align your contour output density tightly with this preference.`;
    }

    let prompt = '';
    if (mode === 'subject') {
      prompt = `Analyze the primary foreground subject, character, or main focal element of interest in this video frame. Generate a high-end vector silhouette/mask outline to separate it from the background (essentially performing a professional green-screen/background-removal cutout). Output between 30 and 45 sequential closed polygon coordinates tracing this boundary perfectly. Ensure coordinates x and y are percentage offsets from 0 to 100.${learningBonus}`;
    } else {
      prompt = `The user has clicked specifically at coordinate x=${clickX.toFixed(1)}%, y=${clickY.toFixed(1)}% inside this image. Identify the discrete object, entity, or distinct visual element situated at or enclosing this coordinate. Generate a high-end closed polygon contour tracing its precise shape boundary to separate/mask it from the background and surrounding elements. Output between 30 and 45 sequential points. Ensure coordinates x and y are percentage offsets from 0 to 100.${learningBonus}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'A sequential list of points representing the closed polygon mask contour path.',
          items: {
            type: Type.OBJECT,
            properties: {
              x: {
                type: Type.NUMBER,
                description: 'Horizontal coordinate as a percentage from 0 (left) to 100 (right)',
              },
              y: {
                type: Type.NUMBER,
                description: 'Vertical coordinate as a percentage from 0 (top) to 100 (bottom)',
              },
            },
            required: ['x', 'y'],
          },
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Empty response from AI Magic Mask generator');
    }

    const points = JSON.parse(textOutput.trim());
    return res.json({ points });
  } catch (error: any) {
    console.error('AI Magic Mask Error:', error.message || error);
    return res.status(500).json({
      error: 'Failed to generate Magic Mask cutout.',
      message: error.message || 'Unknown backend error',
    });
  }
});

// AI Creative Frame Describer (analyzes scene and gives professional rotoscope advice)
app.post('/api/describe-frame', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const ai = getAiClient();

    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: 'Describe the main subject, lighting, and movement in this frame. Give highly practical advice on what key outlines or paths an animator should trace to capture the energy and motion of the shot (e.g. limb sweep, clothing highlights, path of action). Keep it concise, creative, and inspiring. Under 3 bullet points.',
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: { parts: [imagePart, textPart] },
    });

    return res.json({ advice: response.text });
  } catch (error: any) {
    console.error('AI Describe-Frame Error:', error.message || error);
    return res.status(500).json({
      error: 'Failed to generate AI scene advice.',
      message: error.message || 'Unknown backend error',
    });
  }
});

// ==========================================
// VITE CLIENT INTEGRATION
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Let Vite handle asset rendering and HMR routing
    app.use(vite.middlewares);
  } else {
    // Serve static frontend files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Roto3D Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
