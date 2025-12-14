import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const { amount, invoiceId, customerName, customerEmail } = req.body;

    // Validate required fields
    if (!amount || !invoiceId) {
      return res.status(400).json({ error: 'Missing required fields' });
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
      success_url: 'https://your-success-page.com/success', // Change to your actual success page or app deep link
      cancel_url: 'https://your-cancel-page.com/cancel',   // Change to your cancel page
      metadata: {
        app_invoice_id: invoiceId,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
