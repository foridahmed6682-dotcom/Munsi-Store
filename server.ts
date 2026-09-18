import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Deep AI Sales & Inventory Business Advisor (Uses gemini-3.1-pro-preview with HIGH thinking)
  app.post('/api/ai/deep-advisor', async (req, res) => {
    try {
      const { prompt, contextData } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const ai = getAIClient();
      const systemInstruction = `You are an expert Bangladeshi Field Sales & FMCG Distribution Consultant / Retail Business Strategist for "Munsi Store & DSR Order Booker".
You help sales reps (DSR/SR), distributors, and shopkeepers optimize shop visits, outstanding dues (বকেয়া/বাকী), stock replenishment, profit margins, and route planning.
Language: Respond naturally in polite, practical Bengali (বাংলা) with clear formatting, bullet points, numbers in Taka (৳), and English terms where common in Bangladesh trade (e.g., DSR, Trade Offer, Cash Discount, SKU, Due, Payment).
Think deeply before advising on credit risk, high velocity items, and sales conversion.`;

      const fullPrompt = `System Context:
${systemInstruction}

Current Business Data:
${JSON.stringify(contextData || {}, null, 2)}

User Question / Query:
${prompt}

Provide strategic, actionable advice.`;

      // Must use gemini-3.1-pro-preview with thinkingLevel HIGH and NO maxOutputTokens set
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: fullPrompt,
        config: {
          thinkingConfig: {
            thinkingLevel: 'HIGH' as any,
          },
        },
      });

      let textOutput = '';
      let thinkingOutput = '';

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) {
          thinkingOutput += (part as any).text || '';
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      if (!textOutput && response.text) {
        textOutput = response.text;
      }

      res.json({
        answer: textOutput,
        thoughts: thinkingOutput || null,
        model: 'gemini-3.1-pro-preview',
      });
    } catch (error: any) {
      console.error('Deep Advisor error:', error);
      res.status(500).json({
        error: error.message || 'Failed to generate AI advice',
        fallback: 'দুঃখিত, এআই অ্যানালাইসিসের সময় সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ ও সেটিংস চেক করুন।'
      });
    }
  });

  // Smart Order Parser: Extracts shop name, items, quantities, discounts from voice transcript or free text
  app.post('/api/ai/parse-order', async (req, res) => {
    try {
      const { textInput, shops, products } = req.body;
      if (!textInput) {
        return res.status(400).json({ error: 'Text input is required' });
      }

      const ai = getAIClient();
      const shopNames = (shops || []).map((s: any) => s.name).join(', ');
      const productList = (products || []).map((p: any) => `${p.name} (SKU: ${p.sku}, ৳${p.price}/${p.unit}, Stock: ${p.stock})`).join('\n');

      const prompt = `You are a fast AI voice & text order parser for a sales representative visiting retail grocery / FMCG shops in Bangladesh.
Convert the following spoken or typed order text into a structured JSON order.

Existing Registered Shops:
${shopNames || 'No pre-registered shops'}

Available Product Catalog:
${productList || 'No pre-loaded products'}

Order Text from user:
"${textInput}"

Match the shop name to the closest existing shop if mentioned, or extract the new shop name.
Match product names to the closest catalog product name. If units are mentioned (কার্টুন, পিস, ডজন, কেজি), record them.

Return ONLY a raw JSON object (no markdown, no backticks, no code fences):
{
  "shopName": "extracted shop name",
  "shopId": "matched shop id if found, else empty string",
  "paymentMethod": "CASH | DUE | PARTIAL | BKASH",
  "paidAmount": 0,
  "discountPercent": 0,
  "specialNotes": "notes or remarks",
  "items": [
    {
      "productName": "matched product name",
      "quantity": 10,
      "unit": "Pcs/Carton/Kg",
      "unitPrice": 150,
      "tradeOffer": "e.g., 1 free with 10 or none"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: 'HIGH' as any,
          },
          responseMimeType: 'application/json',
        },
      });

      let responseText = response.text?.trim() || '{}';
      // Clean possible fences if any
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(responseText);

      let thinkingOutput = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) {
          thinkingOutput += (part as any).text || '';
        }
      }

      res.json({
        parsedOrder: parsed,
        thoughts: thinkingOutput || null,
      });
    } catch (error: any) {
      console.error('Order parsing error:', error);
      res.status(500).json({
        error: error.message || 'Failed to parse order text',
      });
    }
  });

  // Vite middleware for development vs static build in production
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
    console.log(`Order Booker Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
