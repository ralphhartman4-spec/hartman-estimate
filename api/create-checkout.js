import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const { amount, invoiceId, customerName, customerEmail } = req.body;

    if (!amount || !invoiceId) {
      return res.status(400).json({ error: 'Missing amount or invoiceId' });
    }
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  customer_email: customerEmail || undefined,
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Invoice #${invoiceId}`,
          description: customerName ? `Hartman Estimate - ${customerName}` : 'Hartman Estimate Invoice',
        },
        unit_amount: Math.round(amount * 100), // amount in cents
      },
      quantity: 1,
    },
  ],
  mode: 'payment',
  success_url: 'https://yourapp.com/success', // Or a page in your app
  cancel_url: 'https://yourapp.com/cancel',

  // === STRIPE CONNECT CHANGES START HERE ===
  payment_intent_data: {
    application_fee_amount: Math.round(amount * 100 * 0.01), // fee
    transfer_data: {
      destination: connectedStripeAccountId, // The contractor's Stripe account ID
    },
  },
  // This tells Stripe to process on behalf of the connected account
}, {
  stripeAccount: connectedStripeAccountId, // Required header for Connect
});
// === END CHANGES ===

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message || 'Payment failed' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
