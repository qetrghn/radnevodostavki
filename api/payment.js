const { fail, clean, cors, parseOrder, hash } = require('./_lib');

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    const o = parseOrder(b);                       // amount is computed here, the page's "amount" is ignored
    const d = b.orderDetails || {};
    const params = new URLSearchParams({
      amount: String(o.cents),
      currency: 'eur',
      'automatic_payment_methods[enabled]': 'true',
      'metadata[h]': hash(o),
      'metadata[village]': o.village,
      'metadata[name]': clean(d.name, 80),
      'metadata[phone]': clean(d.phone, 30),
    });
    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const pi = await r.json();
    if (!r.ok) throw fail((pi.error && pi.error.message) || 'Stripe error');
    res.status(200).json({ clientSecret: pi.client_secret });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' });
  }
};
