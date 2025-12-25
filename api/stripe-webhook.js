import { createClient } from 'redis';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const DOCUMENTS_KEY = 'documents:all';
const PUSH_TOKEN_KEY = 'expo-push-token';

export async function POST(request) {
  const rawBody = await request.text();  // ← Raw body for signature verification
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    console.error('No stripe-signature header');
    return new Response('No signature', { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoiceId;

    if (!invoiceId) {
      console.log('No invoiceId in metadata');
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    console.log(`Payment succeeded for invoice #${invoiceId}`);

    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis Error', err));

    try {
      await client.connect();

      const data = await client.get(DOCUMENTS_KEY);
      if (data) {
        let docs = JSON.parse(data);
        docs = docs.map(doc =>
          doc.invoiceNumber === invoiceId && doc.type === 'invoice'
            ? { ...doc, status: 'paid', paidAt: new Date().toISOString() }
            : doc
        );
        await client.set(DOCUMENTS_KEY, JSON.stringify(docs));
        console.log(`Invoice #${invoiceId} marked as paid`);
      }

      // Push notification
      const token = await client.get(PUSH_TOKEN_KEY);
      if (token) {
        const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: token,
            title: 'Payment Received! 🎉',
            body: `Invoice #${invoiceId} has been paid`,
            sound: 'default',
          }),
        });

        if (pushResponse.ok) {
          console.log('Push notification sent');
        } else {
          console.error('Push failed:', await pushResponse.text());
        }
      }

      await client.disconnect();
    } catch (err) {
      console.error('Redis operation failed:', err);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
