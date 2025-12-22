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

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const invoiceId = session.client_reference_id;

        if (invoiceId) {
          console.log(`Payment succeeded for invoice: ${invoiceId}`);

          // === MARK INVOICE AS PAID ===
          try {
            const stored = await AsyncStorage.getItem('allDocuments');
            if (stored) {
              let docs = JSON.parse(stored);
              const updated = docs.map(doc =>
                doc.invoiceNumber === invoiceId
                  ? { ...doc, status: 'paid', paidAt: new Date().toISOString() }
                  : doc
              );
              await AsyncStorage.setItem('allDocuments', JSON.stringify(updated));
              console.log(`Invoice ${invoiceId} marked as paid in storage`);
            }
          } catch (err) {
            console.error('Failed to update invoice status:', err);
          }

          // === SEND PUSH NOTIFICATION ===
          try {
            const token = await AsyncStorage.getItem('expoPushToken');
            if (token) {
              const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: token,
                  title: 'Payment Received! 🎉',
                  body: `Customer has paid invoice #${invoiceId}`,
                  sound: 'default',
                  badge: 1,
                }),
              });

              if (response.ok) {
                console.log('Push notification sent successfully');
              } else {
                console.error('Push failed:', await response.text());
              }
            }
          } catch (pushErr) {
            console.error('Push notification error:', pushErr);
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

  // Always acknowledge receipt
  res.status(200).json({ received: true });
}
