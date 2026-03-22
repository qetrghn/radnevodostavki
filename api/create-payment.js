const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  timeout: 8000,
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, currency = 'eur', orderDetails } = req.body;
    console.log('Creating payment intent for amount:', amount);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { order: JSON.stringify(orderDetails || {}).substring(0, 500) },
      automatic_payment_methods: { enabled: true },
    });

    console.log('Payment intent created:', paymentIntent.id);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
