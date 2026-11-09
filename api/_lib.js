// Shared helpers. Files starting with "_" are not exposed as endpoints by Vercel.
const crypto = require('crypto');

// Delivery prices - the server is the source of truth, the page cannot change them.
const FEES = {
  'Раднево': 3, 'Знаменосец': 4, 'Пет могили': 6, 'Тополяне': 5, 'Диня': 6,
  'Сърнево': 10, 'Ковачево': 12, 'Бели Бряг': 5, 'Даскал Атанасово': 6, 'Любенова махала': 5,
};
const SERVICE_RATE = 0.03;
const ORIGINS = new Set([
  'https://dostavkiradnevo.com', 'https://www.dostavkiradnevo.com',
  'https://radnevodostavki.vercel.app', 'https://qetrghn.github.io',
]);
const PHONE = /^[+\d][\d\s\-()+]{5,24}$/;

function fail(message, status = 400) { const e = new Error(message); e.status = status; return e; }
function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }

function cors(req, res) {
  const o = req.headers.origin;
  if (ORIGINS.has(o)) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Validates the cart and recomputes every amount on the server (same maths as the page).
function parseOrder(b) {
  const village = clean(b.village, 40);
  if (!Object.prototype.hasOwnProperty.call(FEES, village)) throw fail('Невалидно населено място');
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 80) throw fail('Невалидна количка');
  const items = b.items.map(i => {
    const qty = Number(i && i.qty), price = Number(i && i.price);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50 || !Number.isFinite(price) || price <= 0 || price > 500) throw fail('Невалиден продукт');
    const image = /^https:\/\/\S{1,300}$/.test(String(i.image || '')) ? String(i.image) : '';
    const pid = /^[0-9a-z]{1,8}$/.test(String(i.pid || '')) ? String(i.pid) : '';
    return { name: clean(i.name, 120), qty, price, image, pid, suffix: clean(i.suffix, 80) };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = FEES[village];
  const service = Math.round(subtotal * SERVICE_RATE * 100) / 100;
  const total = subtotal + fee + service;
  const cents = Math.round(total * 100);
  if (cents < 300 || cents > 100000) throw fail('Невалидна сума');
  return { village, items, subtotal, fee, service, total, cents };
}

function hash(o) {
  return crypto.createHash('sha256')
    .update(JSON.stringify([o.village, o.items.map(i => [i.name, i.qty, i.price])])).digest('hex');
}

module.exports = { FEES, PHONE, fail, clean, cors, parseOrder, hash };
