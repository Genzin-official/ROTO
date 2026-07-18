export async function clientMagicMask(
  apiKey: string,
  imageBase64: string,
  clickX: number | undefined,
  clickY: number | undefined,
  mode: 'click' | 'subject',
  cognitiveMemory: any
): Promise<{ points: Array<{ x: number; y: number }> }> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  
  let targetDensity = 35;
  let learningBonus = '';
  if (cognitiveMemory) {
    targetDensity = cognitiveMemory.densityPreference || 35;
    learningBonus = ` [COGNITIVE REINFORCEMENT LEARNING]: Based on active training history (User Session Execution Count: ${cognitiveMemory.executionsCount || 1}), the user prefers vectors with about ${targetDensity} coordinates. Align your contour output density tightly with this preference.`;
  }

  let prompt = '';
  if (mode === 'subject' || clickX === undefined || clickY === undefined) {
    prompt = `Analyze the primary foreground subject, character, or main focal element of interest in this video frame. Generate a high-end vector silhouette/mask outline to separate it from the background (essentially performing a professional green-screen/background-removal cutout). Output between 30 and 45 sequential closed polygon coordinates tracing this boundary perfectly. Ensure coordinates x and y are percentage offsets from 0 to 100.${learningBonus}`;
  } else {
    prompt = `The user has clicked specifically at coordinate x=${clickX.toFixed(1)}%, y=${clickY.toFixed(1)}% inside this image. Identify the discrete object, entity, or distinct visual element situated at or enclosing this coordinate. Generate a high-end closed polygon contour tracing its precise shape boundary to separate/mask it from the background and surrounding elements. Output between 30 and 45 sequential points. Ensure coordinates x and y are percentage offsets from 0 to 100.${learningBonus}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            description: 'A sequential list of points representing the closed polygon mask contour path.',
            items: {
              type: 'OBJECT',
              properties: {
                x: {
                  type: 'NUMBER',
                  description: 'Horizontal coordinate as a percentage from 0 (left) to 100 (right)',
                },
                y: {
                  type: 'NUMBER',
                  description: 'Vertical coordinate as a percentage from 0 (top) to 100 (bottom)',
                },
              },
              required: ['x', 'y'],
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Empty response from Gemini client-side Magic Mask generator');
  }

  const points = JSON.parse(textOutput.trim());
  return { points };
}

export async function clientAutoTrace(
  apiKey: string,
  imageBase64: string,
  cognitiveMemory: any
): Promise<{ points: Array<{ x: number; y: number }> }> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  let targetDensity = 35;
  let learningBonus = '';
  if (cognitiveMemory) {
    targetDensity = cognitiveMemory.densityPreference || 35;
    learningBonus = ` [COGNITIVE REINFORCEMENT LEARNING]: Based on active training history (User Session Execution Count: ${cognitiveMemory.executionsCount || 1}), the user prefers vectors with about ${targetDensity} coordinates. Align your contour output density tightly with this preference.`;
  }

  const prompt = `Analyze the primary moving subject, foreground actor, dancer, or main central figure in this video frame. Generate a continuous boundary curve tracing its outer silhouette contour. Output between 25 and 45 sequential vector points that draw this contour smoothly. Ensure coordinates x and y are percentage offsets from 0 to 100.${learningBonus}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            description: 'A sequential list of points representing the rotoscope trace contour path.',
            items: {
              type: 'OBJECT',
              properties: {
                x: {
                  type: 'NUMBER',
                  description: 'Horizontal coordinate as a percentage from 0 (left) to 100 (right)',
                },
                y: {
                  type: 'NUMBER',
                  description: 'Vertical coordinate as a percentage from 0 (top) to 100 (bottom)',
                },
              },
              required: ['x', 'y'],
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Empty response from Gemini client-side auto-trace');
  }

  const points = JSON.parse(textOutput.trim());
  return { points };
}

export async function clientDescribeFrame(
  apiKey: string,
  imageBase64: string
): Promise<{ advice: string }> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = 'Describe the main subject, lighting, and movement in this frame. Give highly practical advice on what key outlines or paths an animator should trace to capture the energy and motion of the shot (e.g. limb sweep, clothing highlights, path of action). Keep it concise, creative, and inspiring. Under 3 bullet points.';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const advice = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!advice) {
    throw new Error('Empty response from Gemini client-side frame describer');
  }

  return { advice };
}
