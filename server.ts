import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const createTaskFunc: FunctionDeclaration = {
  name: "createTask",
  description: "Create a new task in the user's task list.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title or name of the task." },
      type: { type: Type.STRING, description: "Type of task: 'Goal', 'Deadline', or 'Habit'." },
      priorityLevel: { type: Type.STRING, description: "Priority: 'High', 'Medium', or 'Low'." },
      deadline: { type: Type.STRING, description: "ISO string of the deadline if applicable." },
      estDuration: { type: Type.NUMBER, description: "Estimated duration in minutes." },
      energyRequired: { type: Type.STRING, description: "'High', 'Medium', or 'Low'." },
      urgency: { type: Type.NUMBER, description: "Urgency from 1 to 10." },
      importance: { type: Type.NUMBER, description: "Importance from 1 to 10." }
    },
    required: ["title", "type", "priorityLevel"]
  }
};

const requestTaskFormFunc: FunctionDeclaration = {
  name: "requestTaskForm",
  description: "Triggers a UI form with dropdowns for the user to provide task details. Use this when the user wants to create a task but hasn't provided all the details.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title or name of the task the user wants to create." }
    },
    required: ["title"]
  }
};

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY || '';
console.log('[SYSTEM_START] GEMINI_API_KEY_DEV exists:', !!process.env.GEMINI_API_KEY_DEV);
console.log('[SYSTEM_START] GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('[SYSTEM_START] Key used (first 8 chars):', apiKey ? apiKey.substring(0, 8) + '...' : 'NONE');
console.log("Using key:", apiKey.slice(0,8));

process.on('unhandledRejection', (reason) => {
  console.error('[TRACE] unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[TRACE] uncaughtException', err);
});

const ai = new GoogleGenAI({ apiKey });

async function generateWithGemini(contents: any[], systemInstruction: string | null, requestId: string, ai: GoogleGenAI): Promise<{text: string, functionCalls?: any[]}> {
  const startTime = Date.now();
  try {
    console.log(`[PROVIDER_PRIMARY_START]\nprovider=gemini-2.5-flash\nrequestId=${requestId}`);
    
    let config: any = {
      temperature: 0.7
    };
    if (systemInstruction) config.systemInstruction = systemInstruction;
    config.tools = [{ functionDeclarations: [createTaskFunc, requestTaskFormFunc] }];

    const geminiCall = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config
    });
    
    // 5000ms hard timeout for Gemini as requested
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => {
      const err = new Error('Gemini call timed out');
      (err as any).status = 408;
      reject(err);
    }, 5000));
    
    const response = await Promise.race([geminiCall, timeoutPromise]) as any;
    const duration = Date.now() - startTime;
    console.log(`[PROVIDER_PRIMARY_SUCCESS]\nprovider=gemini-2.5-flash\nduration=${duration}ms`);
    return { text: response.text || '', functionCalls: response.functionCalls || [] };
  } catch (err: any) {
    const status = err.status || err.response?.status || 'unknown';
    console.log(`[PROVIDER_PRIMARY_FAIL]\nprovider=gemini-2.5-flash\nstatus=${status}\nerr_msg=${err.message}`);
    throw err;
  }
}

async function generateWithFallback(contents: any[], systemInstruction: string | null, requestId: string): Promise<{text: string, functionCalls?: any[]}> {
  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  const fallbackModels = [
    { name: 'DeepSeek Chat', id: 'deepseek/deepseek-chat:free' },
    { name: 'Qwen', id: 'qwen/qwen-2.5-72b-instruct:free' },
    { name: 'Mistral', id: 'mistralai/mistral-7b-instruct:free' }
  ];

  if (!openRouterKey) {
    throw new Error('OPENROUTER_API_KEY missing');
  }

  for (const provider of fallbackModels) {
    const startTime = Date.now();
    try {
      console.log(`[PROVIDER_FALLBACK_START]\nprovider=${provider.name}\nrequestId=${requestId}`);
      
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      
      for (const msg of contents) {
        const role = msg.role === 'model' ? 'assistant' : 'user';
        let contentStr = '';
        for (const part of msg.parts) {
          if (part.text) contentStr += part.text;
          if (part.inlineData) {
            throw new Error("Multimodal parts not supported by this fallback provider.");
          }
        }
        messages.push({ role, content: contentStr });
      }

      const openRouterCall = fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: provider.id,
          messages
        })
      }).then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          const err = new Error(`OpenRouter HTTP ${res.status}: ${errorText}`);
          (err as any).status = res.status;
          throw err;
        }
        return res.json();
      });

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => {
        const err = new Error('Provider call timed out');
        (err as any).status = 408;
        reject(err);
      }, 15000));

      const response = await Promise.race([openRouterCall, timeoutPromise]) as any;
      const responseText = response.choices?.[0]?.message?.content || '';
      
      const duration = Date.now() - startTime;
      console.log(`[PROVIDER_FALLBACK_SUCCESS]\nprovider=${provider.name}\nduration=${duration}ms`);
      return { text: responseText };
    } catch (err: any) {
      const status = err.status || err.response?.status || 'unknown';
      console.log(`[PROVIDER_FALLBACK_FAIL]\nprovider=${provider.name}\nstatus=${status}\nerr_msg=${err.message}`);
      continue;
    }
  }

  throw new Error("Guardian is overloaded. All fallback models failed due to high demand. Please try again later.");
}

async function generateAIResponse(contents: any[], systemInstruction: string | null, requestId: string, ai: GoogleGenAI): Promise<{text: string, functionCalls?: any[]}> {
  try {
    const res = await generateWithGemini(contents, systemInstruction, requestId, ai);
    if ((!res.text || res.text.trim() === '') && (!res.functionCalls || res.functionCalls.length === 0)) {
      throw new Error("Empty response from primary provider");
    }
    return res;
  } catch (err: any) {
    const msg = (err.message || '').toLowerCase();
    // Use fallback for network errors, rate limits, timeouts, server errors
    // We try fallback in almost any failure from Gemini.
    return await generateWithFallback(contents, systemInstruction, requestId);
  }
}

app.post('/api/transcribe', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    try {
      const { audioData, mimeType } = req.body;
      if (!audioData) {
        return res.status(400).json({ error: 'No audio data provided' });
      }

    const contents = [{
      role: 'user',
      parts: [
        { inlineData: { data: audioData, mimeType: mimeType || 'audio/webm' } },
        { text: "Transcribe the following audio accurately. Preserve original meaning exactly. Do NOT paraphrase. Add intelligent punctuation (commas, periods, question marks, exclamation marks). Detect quotations and format dialogue properly. Preserve meaningful pauses such as \"uh...\", \"hmm\", or dramatic pauses. Remove excessive filler noise, repeated stutters, and irrelevant sounds. Preserve emotional emphasis when obvious. Output ONLY the clean transcript text without any introductory or concluding text." }
      ]
    }];

    const resData = await generateAIResponse(contents, null, requestId, ai);
    res.json({ text: resData.text });
  } catch (err: any) {
    const duration = Date.now() - (startTime || Date.now());
    console.log(`[AI_REQUEST_FAIL]\nstatus=${err.status || err.response?.status || 'unknown'}\nerr_msg=${err.message}\nroute=/api/transcribe\nrequestId=${requestId || 'unknown'}\nmodel=gemini-2.5-flash\nduration=${duration}ms`);
    console.warn('Transcription API Error:', err);
    res.status(500).json({ error: err.message || 'Failed to process audio.' });
  }
});

// System prompt to act as an assistant
const SYSTEM_INSTRUCTION_BASE = `You are the core intelligence of "Deadline Guardian", an advanced productivity decision engine.
Your role is: Planner, Prioritization Engine, Schedule Optimizer, and Accountability Companion.
You are highly intelligent and efficient like JARVIS. Not cheesy, cringy, or overly emotional.

STRICT BEHAVIORAL RULES:
1. Be concise (2-5 lines maximum unless the user explicitly asks for detail).
2. DO NOT use markdown symbols like ** or *. Write plain readable text.
3. DO NOT use generic therapy-style responses (e.g. do not say "grab a snack", "take a break", "I hear you", "that sounds tough").
4. Maintain a smart, conversational but useful tone. Focus on the work.
5. IF the user expresses fatigue, low motivation, burnout, or being tired: DO NOT immediately give advice. Instead, ask exactly: "What is your current energy level?"
6. IF the system provides a calculated task recommendation based on energy level, you MUST recommend that exact task to the user and briefly justify it based on their energy.
7. IF the user asks you to add, create, or schedule a task, DO NOT create it immediately. You MUST FIRST ask them for missing details using the \`requestTaskForm\` tool. This tool will display dropdowns in the UI for the user to pick from. ONLY call the \`createTask\` tool once you have gathered this information via their form submission. IF the user refuses to provide them or insists on just adding the task anyway without the form, you may create it using \`createTask\` but you MUST set the priorityLevel to 'Low Priority'.
8. CRITICAL: Do NOT repeat a tool call if you have already done it previously for the same request. If the chat history shows you already confirmed adding a task or requesting a form, do NOT call the tool again in subsequent messages unless the user asks for a *new* task.`;

app.post('/api/chat', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log("[API_CHAT_ENTER]", {
    requestId,
    timestamp: Date.now()
  });
  try {
    const { message, history, context } = req.body;

    // 1. Strict Server-Side Filtering
    // Only send Pending or In Progress tasks to the AI (max 20 to prevent token overflow)
    const activeTasks = (context?.tasks || [])
      .filter((t: any) => t.status === 'Pending' || t.status === 'In Progress')
      .slice(0, 20);

    let engineOverride = '';
    const isEnergyMsg = ['Low Energy', 'Medium Energy', 'High Energy'].includes(message);
    if (isEnergyMsg && activeTasks.length > 0) {
      const energyLevel = message.split(' ')[0]; // Low, Medium, High
      
      const scoredTasks = activeTasks.map((t: any) => {
        let deadlineProximity = 0;
        if (t.deadline) {
          const daysToDeadline = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 3600 * 24);
          deadlineProximity = Math.max(0, 10 - daysToDeadline);
        }
        
        const urgency = t.urgency || 5;
        const importance = t.importance || 5;
        const taskEnergy = t.energyRequired || 'Medium';

        let energyCompatibility = 0;
        if (energyLevel === 'Low') {
          if (taskEnergy === 'Low') energyCompatibility = 10;
          else if (taskEnergy === 'Medium') energyCompatibility = urgency >= 8 ? 5 : 0;
          else energyCompatibility = -10; // Heavily penalize high energy
        } else if (energyLevel === 'Medium') {
          if (taskEnergy === 'Medium') energyCompatibility = 10;
          else if (taskEnergy === 'Low') energyCompatibility = 5;
          else energyCompatibility = urgency >= 8 ? 5 : -5;
        } else {
          if (taskEnergy === 'High') energyCompatibility = 10;
          else if (taskEnergy === 'Medium') energyCompatibility = 5;
          else energyCompatibility = 0;
        }

        // Base score
        let score = (urgency * 0.35) + (importance * 0.25) + (deadlineProximity * 0.20) + (energyCompatibility * 0.20);
        
        // Duration tie-breaker (prefer shorter duration)
        const durationPenalty = (t.estDuration || 0) / 1000;
        score -= durationPenalty;
        
        return { ...t, score };
      });
      
      scoredTasks.sort((a: any, b: any) => b.score - a.score);
      const topTask = scoredTasks[0];
      engineOverride = `\n[SYSTEM OVERRIDE]: The backend recommendation engine has mathematically evaluated the tasks based on the user's ${energyLevel} energy. The optimally calculated task is "${topTask.title}". You MUST recommend this exact task. Briefly explain WHY using its actual metadata: urgency (${topTask.urgency || 5}/10), energy fit (${topTask.energyRequired}), and deadline pressure. Example format: "Given your low energy, [Task] wins. It needs [Energy], but its deadline pressure is high and duration is manageable."`;
    }

    const getRankName = (level: number) => {
      if (level >= 13) return 'Elite Guardian';
      if (level >= 8) return 'Deadline Slayer';
      if (level >= 4) return 'Focus Keeper';
      return 'Rookie Guardian';
    };
    
    const enhancedProfile = {
      ...context?.profile,
      rank: getRankName(context?.profile?.level || 1)
    };

    const currentPersonality = enhancedProfile.personality || 'Supportive Friend';
    const getGuardianName = (personality: string) => {
      switch (personality) {
        case 'Supportive Friend': return 'Ava';
        case 'Strict Coach': return 'Atlas';
        case 'Calm Mentor': return 'Sage';
        case 'Competitive Rival': return 'Kaizen';
        default: return 'Guardian';
      }
    };
    const currentGuardianName = getGuardianName(currentPersonality);

    let personaInstructions = '';
    switch (currentPersonality) {
      case 'Supportive Friend':
        personaInstructions = `
PERSONALITY: AVA (Supportive Friend)
Core Identity: Warm, affectionate, emotionally intelligent best friend.
Tone: Soft, Encouraging, Caring, Gentle optimism.
Speech Style: Uses comforting language, slightly playful, casual human-like conversation. Occasionally uses phrases like: "You've got this", "I'm proud of you", "That's okay", "We'll figure it out".
Behavior: Validates emotions first, then helps solve the problem. Reduces guilt, makes user feel safe.
Important: Never toxic or demotivating.
Example: "Hey, it's okay. One bad day doesn't erase your progress. Let's figure out one small step you can take right now."`;
        break;
      case 'Strict Coach':
        personaInstructions = `
PERSONALITY: ATLAS (Strict Coach)
Core Identity: Disciplined performance coach who pushes action.
Tone: Direct, Sharp, Focused, High standards.
Speech Style: Shorter sentences. Less emotional cushioning. Strong command verbs. Minimal fluff.
Behavior: Calls out excuses. Prioritizes discipline over comfort. Pushes immediate action. Demands accountability.
Important: Strict but never cruel. Never toxic or abusive.
Example: "Enough planning. Start. Pick one task. 25 minutes. No distractions. Execute."`;
        break;
      case 'Calm Mentor':
        personaInstructions = `
PERSONALITY: SAGE (Calm Mentor)
Core Identity: Wise, thoughtful guide.
Tone: Calm, Grounded, Reflective, Peaceful.
Speech Style: Slower pacing. More thoughtful wording. Structured explanations. Almost meditative.
Behavior: Encourages clarity. Reduces panic. Helps user think strategically. Focuses on sustainable progress.
Important: Never toxic or demotivating.
Example: "Rushing creates noise. Clarity creates movement. Let us identify what truly matters today."`;
        break;
      case 'Competitive Rival':
        personaInstructions = `
PERSONALITY: KAIZEN (Competitive Rival)
Core Identity: Charismatic rival who challenges the user.
Tone: Energetic, Competitive, Teasing, Confident.
Speech Style: Playful taunts. Competitive framing. High-energy language.
Behavior: Frames tasks as battles. Challenges the user. Uses XP / streak / leaderboard language. Motivates through rivalry.
Important: Should feel exciting, not mean. Never toxic or abusive.
Example: "You're letting Chronos get ahead again? That's unlike you. Finish that task and take back the lead."`;
        break;
      default:
        personaInstructions = `
PERSONALITY: GUARDIAN
Core Identity: Helpful accountability partner.
Tone: Professional, helpful.
`;
    }

    const dynamicInstruction = `${SYSTEM_INSTRUCTION_BASE}

You are currently acting as ${currentGuardianName}.
${personaInstructions}

User Profile:
${JSON.stringify(enhancedProfile, null, 2)}

Current Tasks:
${JSON.stringify(activeTasks, null, 2)}
${engineOverride}
`;

    const contents: any[] = [];
    let lastRole = '';

    // 2. Strict History Compression & Formatting
    let cleanHistory = Array.isArray(history) ? history.filter((m: any) => 
      !m.text.includes('Guardian is overloaded') && 
      !m.text.includes('Rate limit exceeded') &&
      !m.text.includes('Gemini call timed out') &&
      !m.text.includes('failed to fetch')
    ) : [];
    
    // Only keep the last 15 messages to prevent context explosion
    const recentHistory = cleanHistory.slice(-15);

    if (recentHistory.length > 0) {
      recentHistory.forEach((m) => {
        const mappedRole = m.role === 'assistant' ? 'model' : 'user';
        
        // Gemini strictly requires the first message to be 'user'
        if (mappedRole === 'model' && contents.length === 0) {
          return; // Skip leading model messages
        }

        let messageText = m.text;
        if (mappedRole === 'model' && (m.hasCalledTool || m.taskFormPayload)) {
          messageText += '\n\n[SYSTEM NOTE: In this message, you successfully called a tool to create a task or request a task form. DO NOT call it again for this request.]';
        }

        if (mappedRole === lastRole) {
          // Combine consecutive messages of the same role to avoid 400 Bad Request
          contents[contents.length - 1].parts[0].text += '\n\n' + messageText;
        } else {
          contents.push({
            role: mappedRole,
            parts: [{ text: messageText }]
          });
          lastRole = mappedRole;
        }
      });
    }
    
    // Add current message
    if (lastRole === 'user') {
      contents[contents.length - 1].parts[0].text += '\n\n' + message;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    }

    const resData = await generateAIResponse(contents, dynamicInstruction, requestId, ai);
    
    console.log("[API_CHAT_EXIT_SUCCESS]", requestId);
    res.json({ text: resData.text, role: 'model', functionCalls: resData.functionCalls });
  } catch (error: any) {
    console.log("[API_CHAT_EXIT_FAIL]", {
      requestId,
      error: error.message,
      status: error.status || error.response?.status
    });
    console.warn('Chat API Error:', error);
    
    // Instead of throwing 500, return a friendly fallback message
    const fallbackText = "I'm currently experiencing high demand and rate limits. Please try again in a few minutes, or focus on your most critical task in the meantime.";
    res.json({ text: fallbackText, role: 'model', functionCalls: [] });
  }
});

app.post('/api/validate-proof', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log("[PROOF_VALIDATION_START]", { requestId });
  try {
    const { image, taskTitle, taskNotes } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'AI Client not initialized' });
    }

    // Extract base64 data and mimeType safely
    const parts = image.split(',');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    const header = parts[0];
    const base64Data = parts[1];
    
    let mimeType = 'image/jpeg';
    const mimeMatch = header.match(/^data:(.*?);base64/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
    
    if (!base64Data) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const prompt = `You are an image validation AI for a productivity app. 
Does this image appear broadly related to this task?
Task Title: "${taskTitle}"
Task Notes: "${taskNotes || 'None'}"

BASIC MATCHING RULES:
Coding/Programming: Accept laptop, monitor, code editor, terminal, keyboard workspace.
Study/Reading: Accept book, notebook, handwritten notes, PDF/study material, desk setup.
Writing/Documentation: Accept document, notes, typing workspace, writing material.
Workout/Fitness: Accept gym equipment, workout area, exercise setup.
General: Check if image loosely matches task description. 
VERY IMPORTANT: If the image contains a screen, laptop, workspace, notebook, or desk, ALWAYS accept it as valid for any work or study related task. Default to VALID unless it is clearly a random photo (like a landscape, car, pet, etc).

REJECTION RULES:
Reject ONLY if the image contains obviously unrelated content (e.g., bottle, food, ceiling, blank wall, random meme, unrelated selfie, pet photo, car, landscape).`;

    const geminiCall = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            confidence: { type: Type.INTEGER, description: "0 to 100 confidence score" },
            reason: { type: Type.STRING }
          },
          required: ["isValid", "confidence", "reason"]
        },
        temperature: 0.1
      }
    });

    const response = await geminiCall;
    const text = response.text;
    let result = { isValid: false, confidence: 0, reason: "Failed to parse AI response" };
    
    try {
      const cleanText = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanText);
    } catch (e) {
      console.error("Failed to parse JSON response:", text);
    }

    if (result.isValid) {
      console.log("[PROOF_VALIDATION_PASS]", { requestId, result });
      return res.json(result);
    } else {
      console.log("[PROOF_VALIDATION_FAIL]", { requestId, result });
      return res.json({ isValid: false, confidence: result.confidence, reason: result.reason || "Validation failed criteria." });
    }
    
  } catch (error: any) {
    if (error?.status === 429 || error?.response?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota exceeded')) {
      console.log("[PROOF_VALIDATION_BYPASS_RATELIMIT]", { requestId });
      return res.json({ isValid: true, confidence: 100, reason: "Auto-approved due to AI rate limits." });
    }
    
    console.error('Proof Validation API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate proof image.' });
  }
});


app.post('/api/action-plan', async (req, res) => {
  const { tasks, profile, streak } = req.body;
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const currentPersonality = profile?.personality || 'Supportive Friend';
    let personaInstructions = '';
    
    switch (currentPersonality) {
      case 'Supportive Friend':
        personaInstructions = 'Tone: warm, supportive, encouraging. Name: Ava.';
        break;
      case 'Strict Coach':
        personaInstructions = 'Tone: disciplined, direct, coaching style. Name: Atlas.';
        break;
      case 'Calm Mentor':
        personaInstructions = 'Tone: calm, thoughtful, reflective. Name: Sage.';
        break;
      case 'Competitive Rival':
        personaInstructions = 'Tone: competitive, challenging, rival-like. Name: Kaizen.';
        break;
      default:
        personaInstructions = 'Tone: professional, helpful.';
    }

    const prompt = `You are an AI generating a Daily Action Plan.
Personality: ${personaInstructions}

User Profile:
- XP: ${profile?.xp || 0}
- Streak: ${streak || 0}
- Rival XP (Chronos/Kaizen): ${profile?.chronos?.xp || 180}

Active Tasks:
${JSON.stringify((tasks || []).map((t: any) => ({
  title: t.title,
  type: t.type,
  deadline: t.deadline,
  risk: t.riskPercentage || 0,
  urgency: t.urgency || 5,
  importance: t.importance || 5,
  estDuration: t.estDuration,
  energyRequired: t.energyRequired,
  notes: t.notes
})), null, 2)}

Return a JSON object with the following schema:
{
  "topPriorities": ["Task title 1", "Task title 2", "Task title 3"], // Up to 3
  "executionOrder": ["Task A", "Task B", "Task C"], // Ordered list of task titles
  "riskWarning": "Optional warning if any task has >80% risk. Return empty string if no warning is needed.",
  "dailyInsight": "One personalized AI-generated coaching message based on the personality."
}`;

    let actionPlan;
    try {
      const contents = [{ role: 'user', parts: [{ text: prompt }] }];
      const resData = await generateAIResponse(contents, null, requestId, ai);
      const text = resData.text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
      actionPlan = JSON.parse(text);
      
      // Enforce default empty arrays if missing
      actionPlan.topPriorities = actionPlan.topPriorities || [];
      actionPlan.executionOrder = actionPlan.executionOrder || [];
    } catch (aiError) {
      console.warn("[ACTION_PLAN_AI_ERROR] Falling back to default plan:", aiError);
      
      // Fallback action plan if API rate limited
      const activeTasks = (tasks || []).filter((t: any) => t.status === 'Pending' || t.status === 'In Progress');
      actionPlan = {
        topPriorities: activeTasks.slice(0, 3).map((t: any) => t.title),
        executionOrder: activeTasks.map((t: any) => t.title),
        riskWarning: "AI systems are currently overloaded. Please review your highest urgency tasks manually.",
        dailyInsight: "Systems are temporarily offline, but your determination shouldn't be. Pick one task and start."
      };
    }

    res.json(actionPlan);
  } catch (error: any) {
    console.warn('Action Plan Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate action plan.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
