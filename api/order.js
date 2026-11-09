const { PHONE, fail, clean, cors, parseOrder, hash } = require('./_lib');

const SITE = 'https://dostavkiradnevo.com/';
const PI = 'https://api.stripe.com/v1/payment_intents/';

async function telegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, 4000) }),
  });
  if (!r.ok) throw fail('Telegram error', 502);
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    const o = parseOrder(b);
    const name = clean(b.name, 80), phone = clean(b.phone, 30), address = clean(b.address, 200), note = clean(b.note, 300);
    const store = clean(b.store, 20), storeLabel = clean(b.storeLabel, 40);
    if (!name || !address || !PHONE.test(phone)) throw fail('Попълнете всички полета');

    const card = b.method === 'card';
    let piId = '';
    if (card) {
      piId = clean(b.paymentIntentId, 80);
      if (!/^pi_[A-Za-z0-9]+$/.test(piId)) throw fail('Невалидно плащане');
      const auth = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
      const r = await fetch(PI + piId, { headers: auth });
      const pi = await r.json();
      // Only a really paid intent, with the exact amount and the same cart, produces a notification
      if (!r.ok || pi.status !== 'succeeded' || pi.currency !== 'eur' || pi.amount !== o.cents || !pi.metadata || pi.metadata.h !== hash(o)) throw fail('Плащането не е потвърдено', 402);
      if (pi.metadata.notified === '1') return res.status(200).json({ ok: true, duplicate: true });
    } else if (b.method !== 'cash' || !['kaufland', 'kuche'].includes(store) || o.subtotal > 40) {
      throw fail('Плащане при доставка не е налично за тази поръчка');   // same rule as the page
    }

    const eur = n => '€' + n.toFixed(2);
    let msg = card ? '🛒 НОВА ПОРЪЧКА 💳\n\n' : '🛒 НОВА ПОРЪЧКА\n\n';
    msg += `🏪 Магазин: ${storeLabel}\n👤 Име: ${name}\n📞 Телефон: ${phone}\n📍 ${o.village}, ${address}\n`;
    if (note) msg += `📝 Бележка: ${note}\n`;
    msg += '\n📦 Продукти:\n';
    o.items.forEach(i => { msg += `• ${i.name} x${i.qty} — ${eur(i.price * i.qty)}${i.image ? ' [🖼](' + i.image + ')' : ''}\n`; });
    msg += `\n💰 Продукти: ${eur(o.subtotal)}\n🔧 Услуга: ${eur(o.service)}\n🚚 Доставка до ${o.village}: ${eur(o.fee)}\n✅ Общо: ${eur(o.total)}`;
    if (card) msg += '\n💳 Платено онлайн';

    const e = encodeURIComponent, n2 = n => n.toFixed(2);
    let link;
    if (/^[a-z]{2,12}$/.test(store) && o.items.every(i => i.pid)) {
      // Short link: product keys + quantities only; the checklist page looks names and photos up in its own catalog
      const k = o.items.map(i => i.pid + (i.qty > 1 ? '*' + i.qty : '') + (i.suffix ? '!' + e(e(i.suffix)) : '')).join(',');
      link = SITE + '?k=' + k + '&st=' + store + '&n=' + e(name) + '&p=' + e(phone) + '&l=' + e(o.village) + '&a=' + e(address)
        + '&s=' + n2(o.subtotal) + '&sf=' + n2(o.service) + '&f=' + n2(o.fee) + '&t=' + n2(o.total) + (note ? '&w=' + e(note) : '');
    } else {
      const names = [];
      o.items.forEach(i => { for (let q = 0; q < i.qty; q++) names.push(i.name + '|IMG|' + i.image); });
      link = SITE + '?checklist=' + e(names.join('||')) + '&n=' + e(name) + '&p=' + e(phone) + '&l=' + e(o.village) + '&a=' + e(address)
        + '&s=' + e(eur(o.subtotal)) + '&sf=' + e(eur(o.service)) + '&f=' + e(eur(o.fee)) + '&t=' + e(eur(o.total)) + '&w=' + e(note);
    }

    await telegram(msg);
    await telegram('🛒 Списък за магазина:\n' + link);

    if (card) {   // remember this payment was already announced
      await fetch(PI + piId, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'metadata[notified]=1',
      }).catch(() => {});
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
};
