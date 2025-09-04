import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], stream = true } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  try {
    if (!stream) {
      const c = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7
      });
      return res.status(200).json({ message: c.choices?.[0]?.message?.content ?? '' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const s = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      temperature: 0.7
    });

    for await (const chunk of s) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) res.write(`event: message\ndata:${JSON.stringify({ content: delta })}\n\n`);
    }
    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`event: error\ndata:${JSON.stringify({ error: e?.message || String(e) })}\n\n`);
    res.end();
  }
}
