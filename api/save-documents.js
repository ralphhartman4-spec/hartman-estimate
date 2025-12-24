import { kv } from '@vercel/kv';

const DOCUMENTS_KEY = 'documents:all';

export async function GET() {
  try {
    const documents = await kv.get(DOCUMENTS_KEY);
    return new Response(JSON.stringify({
      documents: Array.isArray(documents) ? documents : []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('KV GET error:', error);
    return new Response(JSON.stringify({ documents: [] }), { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { documents } = await request.json();

    if (!Array.isArray(documents)) {
      return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400 });
    }

    await kv.set(DOCUMENTS_KEY, documents);

    return new Response(JSON.stringify(documents), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('KV POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save' }), { status: 500 });
  }
}
