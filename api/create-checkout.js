import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { amount, invoiceId, customerName, customerEmail, connectedAccountId } = req.body;

    // Basic validation
    if (!amount || amount <= 0 || !invoiceId) {
      return res.status(400).json({ error: 'Missing or invalid amount/invoiceId' });
    }

    // Build base session params
    const sessionParams = {
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
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://hartman-estimate.vercel.app/success',
      cancel_url: 'https://hartman-estimate.vercel.app/cancel',
      metadata: {
        app_invoice_id: invoiceId,
      },
    };

    let session;

    // === STRIPE CONNECT LOGIC ===
    if (connectedAccountId) {
      // Connected account exists → use Connect + take your cut
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        payment_intent_data: {
          application_fee_amount: Math.round(amount * 100 * 0.03), // 3% platform fee (adjust as needed)
          transfer_data: {
            destination: connectedAccountId,
          },
        },
      }, {
        stripeAccount: connectedAccountId, // Critical: process on behalf of contractor
      });
    } else {
      // No connected account → fall back to direct charge (money goes to YOU)
      session = await stripe.checkout.sessions.create(sessionParams);
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ 
      error: 'Failed to create payment link',
      details: err.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
