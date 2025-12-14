export default function handler(req, res) {
  res.status(200).json({ message: "API working! No Stripe needed." });
}

export const config = {
  api: {
    bodyParser: true,
  },
};

console.log('Key status:', process.env.STRIPE_SECRET_KEY ? 'set' : 'MISSING');
