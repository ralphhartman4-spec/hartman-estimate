import { buffer } from 'micro';
import { createClient } from 'redis';
import Stripe from 'stripe';  // ← ADD THIS LINE

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const DOCUMENTS_KEY = 'documents:all';
const PUSH_TOKEN_KEY = 'expo-push-token';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoiceId;

    if (!invoiceId) {
      console.log('No invoiceId in metadata');
      return res.status(200).json({ received: true });
    }

    console.log(`Payment succeeded for invoice #${invoiceId}`);

    const client = createClient({
      url: process.env.REDIS_URL,
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    try {
      await client.connect();

      // Update invoice status to paid
      const data = await client.get(DOCUMENTS_KEY);
      if (data) {
        let docs = JSON.parse(data);
        docs = docs.map(doc =>
          doc.invoiceNumber === invoiceId && doc.type === 'invoice'
            ? { ...doc, status: 'paid', paidAt: new Date().toISOString() }
            : doc
        );
        await client.set(DOCUMENTS_KEY, JSON.stringify(docs));
        console.log(`Invoice #${invoiceId} marked as paid in Redis`);
      }

      // Send push notification
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

  res.status(200).json({ received: true });
}
