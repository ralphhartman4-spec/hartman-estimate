// api/save-push-token.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token' });

  await kv.set('expo_push_token', token);
  res.status(200).json({ success: true });
}
