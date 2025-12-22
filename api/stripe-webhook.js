import Stripe from 'stripe';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

  // Handle events
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const invoiceId = session.client_reference_id;

        if (invoiceId) {
          console.log(`Payment succeeded for invoice: ${invoiceId}`);

          // === UPDATE SAVED DOCUMENTS ===
          const stored = await AsyncStorage.getItem('allDocuments');
          if (stored) {
            let docs = JSON.parse(stored);
            docs = docs.map(doc =>
              doc.invoiceNumber === invoiceId
                ? { ...doc, status: 'paid', paidAt: new Date().toISOString() }
                : doc
            );
            await AsyncStorage.setItem('allDocuments', JSON.stringify(docs));
            console.log(`Marked invoice ${invoiceId} as paid`);
          }
        }
        break;

      case 'checkout.session.expired':
        console.log('Checkout session expired:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Error processing webhook event:', err);
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
}
