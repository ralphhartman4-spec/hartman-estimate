// api/save-documents.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { documents } = req.body;

  if (!documents) return res.status(400).json({ error: 'No documents' });

  await kv.set('allDocuments', JSON.stringify(documents));
  res.status(200).json({ success: true });
}
