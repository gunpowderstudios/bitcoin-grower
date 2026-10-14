// Bitcoin Chatter — read-only, Bitcoin-specific public news. No accounts, secrets or trading.
const api = 'https://cryptocurrency.cv/api/bitcoin';
const grid = document.getElementById('chatter-grid');
const status = document.getElementById('chatter-status');
const button = document.getElementById('chatter-refresh');

function element(tag, content = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}
function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}
function cleanText(value) {
  const div = document.createElement('div');
  div.innerHTML = String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}
function publishedAt(article) {
  const date = new Date(article.pubDate || article.publishedAt || article.published || article.date || 0);
  return Number.isFinite(date.getTime()) && date.getFullYear() > 2010 ? date.getTime() : 0;
}
function bitcoinFocused(article) {
  const title = cleanText(article.title).toLowerCase();
  const summary = cleanText(article.description || article.summary).toLowerCase();
  const directlyAboutBitcoin = /\bbitcoin\b|\bbtc\b|\bxbt\b|\bsatoshi\b|\bbitcoin halving\b/.test(title);
  // A generic crypto headline that only mentions BTC in a tag or passing summary is not enough.
  if (!directlyAboutBitcoin) return false;
  // Exclude stories led by unrelated cryptocurrencies, even when Bitcoin is name-checked.
  const otherCoins = /\b(ethereum|ether|eth|solana|sol|xrp|ripple|dogecoin|doge|cardano|ada|bnb|altcoins?|meme coins?)\b/;
  if (otherCoins.test(title) && !/\bbitcoin\b/.test(title)) return false;
  // Reject obvious unrelated, multi-token price roundups.
  if (/\b(crypto prices today|top cryptocurrencies|altcoin roundup|market roundup)\b/.test(title)) return false;
  return Boolean(title && (summary || directlyAboutBitcoin));
}
function normalized(article) {
  const title = cleanText(article.title);
  const url = safeUrl(article.link || article.url);
  if (!url || !title || !bitcoinFocused(article)) return null;
  return { title, url, date: publishedAt(article), source: String(article.source || article.sourceName || new URL(url).hostname),
    summary: cleanText(article.description || article.summary).slice(0, 210) };
}
function uniqueLatest(items) {
  const seen = new Set();
  return items.map(normalized).filter(Boolean).sort((a, b) => b.date - a.date).filter(article => {
    const key = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 90);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}
function render(article) {
  const card = element('article', '', 'chatter-story');
  const heading = element('h3');
  const link = element('a', article.title);
  link.href = article.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  heading.append(link);
  card.append(heading);
  const date = article.date ? ' · ' + new Date(article.date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '';
  card.append(element('div', article.source + date, 'chatter-meta'));
  if (article.summary) card.append(element('p', article.summary));
  return card;
}
async function load() {
  button.disabled = true;
  status.textContent = 'Finding the latest Bitcoin stories…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(api, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('News service unavailable');
    const data = await response.json();
    const articles = Array.isArray(data) ? data : Array.isArray(data.articles) ? data.articles : Array.isArray(data.news) ? data.news : [];
    const latest = uniqueLatest(articles);
    if (!latest.length) throw new Error('No matching Bitcoin headlines');
    grid.replaceChildren(...latest.map(render));
    status.textContent = 'Showing ' + latest.length + ' Bitcoin-focused stories · Updated ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  } catch {
    status.textContent = 'Live Bitcoin headlines are temporarily unavailable.';
    if (!grid.querySelector('.chatter-story')) grid.replaceChildren(element('p', 'Please try Refresh Stories, or visit the publisher links below.'));
  } finally {
    clearTimeout(timer);
    button.disabled = false;
  }
}
button.addEventListener('click', load);
load();
