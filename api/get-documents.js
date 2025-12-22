// api/get-documents.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const stored = await kv.get('allDocuments');
  const documents = stored ? JSON.parse(stored) : [];
  res.status(200).json({ documents });
}
