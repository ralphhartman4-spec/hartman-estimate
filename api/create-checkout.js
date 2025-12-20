import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      amount,
      currency = 'USD', // ← Default to USD if not provided
      invoiceId,
      customerName,
      customerEmail,
      connectedAccountId,
    } = req.body;

    // Basic validation
    if (!amount || amount <= 0 || !invoiceId) {
      return res.status(400).json({ error: 'Missing or invalid amount/invoiceId' });
    }

    if (!currency) {
      return res.status(400).json({ error: 'Currency is required' });
    }

    // Build base session params
    const sessionParams = {
      payment_method_types: ['card'],
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(), // ← Dynamic currency from app
            product_data: {
              name: `Invoice #${invoiceId}`,
              description: customerName
                ? `Hartman Estimate - ${customerName}`
                : 'Hartman Estimate Invoice',
            },
            unit_amount: amount, // ← Already in smallest currency unit (cents) from app
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
      session = await stripe.checkout.sessions.create(
        {
          ...sessionParams,
          payment_intent_data: {
            application_fee_amount: Math.round(amount * 0.03), // 3% platform fee in smallest unit
            transfer_data: {
              destination: connectedAccountId,
            },
          },
        },
        {
          stripeAccount: connectedAccountId,
        }
      );
    } else {
      session = await stripe.checkout.sessions.create(sessionParams);
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({
      error: 'Failed to create payment link',
      details: err.message,
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
