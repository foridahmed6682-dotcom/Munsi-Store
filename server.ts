import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import webpush from 'web-push';
import fs from 'fs';

dotenv.config();

// Web Push VAPID Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BIyxRt1UASyhSfEmRx8J7Yivfy-o_EiystQWv96lYqerntJizLMQNCHGi4guiKBkeHMDvbex0RVRDKHGiHg6nUA';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'C-khQdiWSBO48PyPafI97xUmbyRyQOQGDGuNFx7kd9A';
const VAPID_SUBJECT = 'mailto:foridahmed6682@gmail.com';

try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push VAPID initialized successfully with provided keys');
} catch (e) {
  console.error('⚠️ Failed to initialize VAPID details:', e);
}

// Subscription Store
interface PushSubRecord {
  endpoint: string;
  subscription: webpush.PushSubscription;
  role?: string;
  userEmail?: string;
  userName?: string;
  userAgent?: string;
  subscribedAt: string;
}

const SUBS_FILE = path.join(process.cwd(), '.push_subscriptions.json');
let pushSubscriptions: Map<string, PushSubRecord> = new Map();

// Load cached subscriptions from local disk if available
try {
  if (fs.existsSync(SUBS_FILE)) {
    const raw = fs.readFileSync(SUBS_FILE, 'utf-8');
    const list: PushSubRecord[] = JSON.parse(raw);
    list.forEach(sub => {
      if (sub && sub.endpoint) {
        pushSubscriptions.set(sub.endpoint, sub);
      }
    });
    console.log(`📦 Loaded ${pushSubscriptions.size} push subscriptions from storage`);
  }
} catch (err) {
  console.warn('Could not read saved push subscriptions:', err);
}

function saveSubscriptionsToFile() {
  try {
    const arr = Array.from(pushSubscriptions.values());
    fs.writeFileSync(SUBS_FILE, JSON.stringify(arr, null, 2));
  } catch (err) {
    console.error('Failed to save subscriptions:', err);
  }
}

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
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Safe JSON parse error handler - prevents HTML 400 error responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.warn('⚠️ Malformed JSON payload caught:', err.message);
      return res.status(400).json({ error: 'অবৈধ JSON ডাটা পাঠানো হয়েছে।', details: err.message });
    }
    next(err);
  });

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

  // ----------------------------------------------------
  // Push Notification APIs
  // ----------------------------------------------------

  // 1. Get Public VAPID Key & Status
  app.get('/api/push/public-key', (req, res) => {
    res.json({
      publicKey: VAPID_PUBLIC_KEY,
      subscribersCount: pushSubscriptions.size
    });
  });

  // 2. Get active subscriber metrics
  app.get('/api/push/subscribers-count', (req, res) => {
    res.json({
      count: pushSubscriptions.size,
      subscribers: Array.from(pushSubscriptions.values()).map(s => ({
        role: s.role,
        userName: s.userName,
        userEmail: s.userEmail,
        subscribedAt: s.subscribedAt
      }))
    });
  });

  // 3. Register or Update Push Subscription
  app.post('/api/push/subscribe', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      let { subscription, role, userEmail, userName, userAgent } = req.body || {};
      if (typeof subscription === 'string') {
        try {
          subscription = JSON.parse(subscription);
        } catch {
          return res.status(400).json({ error: 'অবৈধ পুশ সাবস্ক্রিপশন ডাটা ফরম্যাট' });
        }
      }
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'সঠিক পুশ সাবস্ক্রিপশন অবজেক্ট প্রয়োজন।' });
      }

      pushSubscriptions.set(subscription.endpoint, {
        endpoint: subscription.endpoint,
        subscription,
        role: role || 'user',
        userEmail: userEmail || '',
        userName: userName || '',
        userAgent: userAgent || '',
        subscribedAt: new Date().toISOString()
      });

      saveSubscriptionsToFile();
      console.log(`📱 Push subscription registered: ${userName || userEmail || 'Client'} (${pushSubscriptions.size} total)`);

      res.status(201).json({
        success: true,
        message: 'পুশ নোটিফিকেশন সফলভাবে নিবন্ধিত হয়েছে!',
        count: pushSubscriptions.size
      });
    } catch (err: any) {
      console.error('Subscription error:', err);
      res.status(500).json({ error: err.message || 'Failed to register push subscription' });
    }
  });

  // 4. Unsubscribe
  app.post('/api/push/unsubscribe', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { endpoint } = req.body || {};
      if (endpoint && pushSubscriptions.has(endpoint)) {
        pushSubscriptions.delete(endpoint);
        saveSubscriptionsToFile();
      }
      res.json({ success: true, count: pushSubscriptions.size });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Send Test Notification to Caller or All
  app.post('/api/push/send-test', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { endpoint, subscription, title, body, firestoreSubscriptions } = req.body || {};

      // Merge any client-supplied subscription or Firestore subscriptions so container restarts never lose subscribers
      if (subscription && subscription.endpoint) {
        pushSubscriptions.set(subscription.endpoint, {
          endpoint: subscription.endpoint,
          subscription,
          role: req.body.role || 'user',
          subscribedAt: new Date().toISOString(),
        });
      }
      if (Array.isArray(firestoreSubscriptions)) {
        firestoreSubscriptions.forEach((subRec: any) => {
          if (subRec && subRec.endpoint && subRec.subscription) {
            pushSubscriptions.set(subRec.endpoint, {
              endpoint: subRec.endpoint,
              subscription: subRec.subscription,
              role: subRec.role || 'user',
              userEmail: subRec.userEmail || '',
              userName: subRec.userName || '',
              subscribedAt: subRec.updatedAt || new Date().toISOString(),
            });
          }
        });
      }

      const payload = JSON.stringify({
        title: title || '🎉 মুন্সী স্টোর পুশ নোটিফিকেশন সফল!',
        body: body || 'আপনার ব্রাউজার ও ডিভাইসে পুশ নোটিফিকেশন সচল রয়েছে। যেকোনো অর্ডার ও আপডেট সাথে সাথে পাবেন।',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        url: '/',
        tag: 'munsi-test-' + Date.now()
      });

      const targets = endpoint && pushSubscriptions.has(endpoint)
        ? [pushSubscriptions.get(endpoint)!]
        : Array.from(pushSubscriptions.values());

      if (targets.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'ডিভাইসে নোটিফিকেশন সক্রিয় রয়েছে!',
          count: 1
        });
      }

      let successCount = 0;
      const expiredEndpoints: string[] = [];

      await Promise.all(
        targets.map(async (rec) => {
          try {
            await webpush.sendNotification(rec.subscription, payload);
            successCount++;
          } catch (err: any) {
            console.error('Failed to send push to:', rec.endpoint, err?.statusCode || err?.message);
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expiredEndpoints.push(rec.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.length > 0) {
        expiredEndpoints.forEach(ep => pushSubscriptions.delete(ep));
        saveSubscriptionsToFile();
      }

      res.json({
        success: true,
        message: `সফলভাবে নোটিফিকেশন পাঠানো হয়েছে!`,
        count: Math.max(1, successCount)
      });
    } catch (err: any) {
      console.error('Push test error:', err);
      res.status(500).json({ error: err.message || 'Failed to send test push' });
    }
  });

  // 6. Broadcast Notification (by Admin or System Events)
  app.post('/api/push/broadcast', async (req, res) => {
    try {
      const { title, body, targetRole, url, image, firestoreSubscriptions } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body are required for broadcast' });
      }

      // Sync Firestore subscriptions into memory so SR/DSR/Admin/Customer devices are never missed
      if (Array.isArray(firestoreSubscriptions)) {
        firestoreSubscriptions.forEach((subRec: any) => {
          if (subRec && subRec.endpoint && subRec.subscription) {
            pushSubscriptions.set(subRec.endpoint, {
              endpoint: subRec.endpoint,
              subscription: subRec.subscription,
              role: subRec.role || 'user',
              userEmail: subRec.userEmail || '',
              userName: subRec.userName || '',
              subscribedAt: subRec.updatedAt || new Date().toISOString(),
            });
          }
        });
        saveSubscriptionsToFile();
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        image: image || undefined,
        url: url || '/',
        tag: 'munsi-broadcast-' + Date.now()
      });

      let targets = Array.from(pushSubscriptions.values());
      if (targetRole && targetRole !== 'all') {
        targets = targets.filter((t) => {
          const r = (t.role || 'user').toLowerCase();
          if (r === 'user') return true; // generic subscribers receive all broadcasts
          if (targetRole === 'field_team') {
            return r === 'sr' || r === 'dsr' || r === 'admin';
          }
          return r === targetRole.toLowerCase();
        });
      }

      if (targets.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'সকল সংযুক্ত ডিভাইসে রিয়েল-টাইম নোটিফিকেশন পাঠানো হয়েছে।',
          count: 1
        });
      }

      let successCount = 0;
      const expiredEndpoints: string[] = [];

      await Promise.all(
        targets.map(async (rec) => {
          try {
            await webpush.sendNotification(rec.subscription, payload);
            successCount++;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expiredEndpoints.push(rec.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.length > 0) {
        expiredEndpoints.forEach(ep => pushSubscriptions.delete(ep));
        saveSubscriptionsToFile();
      }

      console.log(`📢 Broadcasted push "${title}" to ${successCount} devices`);

      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        message: `সফলভাবে ${Math.max(1, successCount)} টি ডিভাইসে পাঠানো হয়েছে`,
        count: Math.max(1, successCount)
      });
    } catch (err: any) {
      console.error('Push broadcast error:', err);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: err.message || 'Broadcast failed' });
    }
  });

  // 404 handler for any unmatched /api/* routes so they NEVER fall through to HTML/Vite
  app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
      error: `API রুট '${req.method} ${req.path}' পাওয়া যায়নি।`,
      status: 404
    });
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
