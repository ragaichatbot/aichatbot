// ══════════════════════════════════════════════════════════
// BAAP Website Scraper — FULLY DYNAMIC via sitemap.xml
// v2.2: Sitemap index support + lastmod capture per page
// ══════════════════════════════════════════════════════════

const https = require('https');
const http  = require('http');
const fs    = require('fs');

const BASE_URL = 'https://aerospaceparkbengalis.in';
const SITEMAP  = BASE_URL + '/sitemap.xml';

const SKIP_PATTERNS = [
  '/wp-', '/feed', '/xmlrpc', '/wp-json', '/embed',
  '/tag/', '/author/', '/page/', '/attachment/',
  '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.webp',
  '?', '#'
];

const TAG_MAP = [
  { re: /holi|dol/i,               tags: ['holi','dol','colour','spring','festival','2026'] },
  { re: /saraswati|saraswathi/i,   tags: ['saraswati','puja','pujo','goddess','education','vidya'] },
  { re: /durga|durgotsav/i,        tags: ['durga','durgotsav','puja','pujo','festival','navratri'] },
  { re: /lakshmi|laxmi|lokkhi|kojagori/i, tags: ['lakshmi','lokkhi','puja','pujo','kojagori'] },
  { re: /barshiki/i,               tags: ['barshiki','magazine','annual','souvenir','publication'] },
  { re: /gallery|media|photo/i,    tags: ['gallery','photos','media','pictures'] },
  { re: /kids.game|game/i,         tags: ['games','kids','play','fun','children','activity'] },
  { re: /sangit|music/i,           tags: ['sangit','music','certificate','classical'] },
  { re: /member|membership/i,      tags: ['membership','fee','join','register','fees'] },
  { re: /about/i,                  tags: ['about','history','info','association','formed'] },
  { re: /contact/i,                tags: ['contact','phone','email','address','reach'] },
  { re: /flyer|poster/i,           tags: ['flyer','poster','invitation','design'] },
  { re: /greeting/i,               tags: ['greetings','wishes','greeting','card'] },
  { re: /mascot|rosogolla/i,       tags: ['mascot','roso','golla','rosogolla'] },
  { re: /acknowledgement/i,        tags: ['acknowledgement','thanks','sponsor','credit'] },
  { re: /interesting|link/i,       tags: ['links','resources','interesting','useful'] },
  { re: /chatbot|ai/i,             tags: ['chatbot','ai','bot','assistant'] },
  { re: /2025/,                    tags: ['2025'] },
  { re: /2026/,                    tags: ['2026'] },
];

const MONTHS = {
  jan:0,january:0,feb:1,february:1,mar:2,march:2,
  apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,
  aug:7,august:7,sep:8,september:8,oct:9,october:9,
  nov:10,november:10,dec:11,december:11
};

// ── FETCH ──
function fetchUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    try {
      const req = lib.get(url, { headers: { 'User-Agent': 'BAAP-Chatbot-Scraper/2.2' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location : BASE_URL + res.headers.location;
          resolve(fetchUrl(loc)); return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', () => resolve(''));
      req.setTimeout(15000, () => { req.destroy(); resolve(''); });
    } catch(e) { resolve(''); }
  });
}

// ── DETECT SITEMAP INDEX ──
function isSitemapIndex(xml) {
  return /<sitemapindex/i.test(xml) || (/<sitemap>/i.test(xml) && !/<urlset/i.test(xml));
}

// ── PARSE SITEMAP ENTRIES — returns [{url, lastmod}], skipping XML/image files ──
function parseSitemapEntries(xml) {
  const entries = [];
  // Match full <url> blocks to pair loc with lastmod reliably
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  urlBlocks.forEach(block => {
    const locMatch  = block.match(/<loc>(https?:\/\/[^<]+)<\/loc>/i);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/i);
    if (!locMatch) return;
    const url = locMatch[1].trim();
    const lastmod = lastmodMatch ? lastmodMatch[1].trim() : null;
    if (!url.match(/\.(jpg|jpeg|png|gif|webp|pdf|zip|xml)/i) && !shouldSkip(url)) {
      entries.push({ url, lastmod });
    }
  });
  // Deduplicate by URL
  const seen = {};
  return entries.filter(e => { if (seen[e.url]) return false; seen[e.url]=true; return true; });
}

// ── PARSE SITEMAP INDEX — returns sub-sitemap URLs ──
function parseSubSitemapUrls(xml) {
  const urls = [];
  const re = /<loc>(https?:\/\/[^<]+\.xml[^<]*)<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const url = m[1].trim();
    if (!url.includes('image-sitemap')) urls.push(url);
  }
  return [...new Set(urls)];
}

function shouldSkip(url) {
  return SKIP_PATTERNS.some(p => url.includes(p));
}

function tagsFromUrl(url) {
  const slug = url.replace(BASE_URL, '').toLowerCase();
  const tags = ['baap', 'bengali', 'aerospace', 'park'];
  TAG_MAP.forEach(({ re, tags: t }) => { if (re.test(slug)) tags.push(...t); });
  const yearMatch = slug.match(/\/(20\d\d)\//);
  if (yearMatch && !tags.includes(yearMatch[1])) tags.push(yearMatch[1]);
  return [...new Set(tags)];
}

function titleFromUrl(url) {
  const slug = url.replace(BASE_URL, '').replace(/\//g, ' ').replace(/-/g, ' ').trim();
  return slug.replace(/\b20\d\d\b \d\d \d\d /g, '').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'BAAP Home';
}

function extractText(html) {
  if (!html) return '';
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  html = html.replace(/<header[\s\S]*?<\/header>/gi, '');
  let text = html.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'');
  text = text.replace(/\s+/g, ' ').trim();
  return text.substring(0, 8000);
}

function extractDates(text) {
  const patterns = [
    /(\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]\d{4})/gi,
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/gi,
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g,
  ];
  const dates = [];
  patterns.forEach(p => { const m = text.match(p) || []; dates.push(...m); });
  return [...new Set(dates)].slice(0, 8);
}

function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;
  const m1 = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})/i);
  if (m1) { const mo = MONTHS[m1[2].toLowerCase().slice(0,3)]; if (mo !== undefined) return new Date(parseInt(m1[3]), mo, parseInt(m1[1])); }
  const m2 = str.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m2) { const mo = MONTHS[m2[1].toLowerCase().slice(0,3)]; if (mo !== undefined) return new Date(parseInt(m2[3]), mo, parseInt(m2[2])); }
  const m3 = str.match(/(\d{1,2})[\s\-]([a-z]+)[\s\-](\d{4})/i);
  if (m3) { const mo = MONTHS[m3[2].toLowerCase().slice(0,3)]; if (mo !== undefined) return new Date(parseInt(m3[3]), mo, parseInt(m3[1])); }
  return null;
}

function getEventStatus(url, text, now) {
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rawDates = extractDates(text);
  const parsed = rawDates.map(parseDate).filter(Boolean);
  if (parsed.length > 0) {
    if (parsed.some(d => d >= nowDay)) return 'upcoming';
    if (parsed.every(d => d < nowDay)) return 'past';
  }
  const urlYear  = parseInt((url.match(/\/(20\d\d)\//) || [])[1]);
  const urlMonth = parseInt((url.match(/\/20\d\d\/(\d\d)\//) || [])[1]);
  if (!urlYear) return 'info';
  const urlDate = urlMonth ? new Date(urlYear, urlMonth - 1, 1) : new Date(urlYear, 0, 1);
  return urlDate >= nowDay ? 'upcoming' : 'past';
}

// ── COLLECT ALL PAGE ENTRIES [{url, lastmod}] handling sitemap index ──
async function collectAllPageEntries() {
  console.log('Reading sitemap: ' + SITEMAP);
  const sitemapXml = await fetchUrl(SITEMAP);
  if (!sitemapXml) { console.error('ERROR: Could not fetch sitemap.'); process.exit(1); }

  let allEntries = [];

  if (isSitemapIndex(sitemapXml)) {
    console.log('Sitemap index detected — fetching sub-sitemaps...');
    const subUrls = parseSubSitemapUrls(sitemapXml);
    console.log('Sub-sitemaps: ' + subUrls.join(', '));
    for (const subUrl of subUrls) {
      process.stdout.write('  Reading: ' + subUrl + ' ... ');
      const subXml = await fetchUrl(subUrl);
      if (subXml) {
        const entries = parseSitemapEntries(subXml);
        console.log(entries.length + ' pages');
        allEntries.push(...entries);
      } else { console.log('FAILED (skipping)'); }
      await new Promise(r => setTimeout(r, 500));
    }
  } else {
    console.log('Regular sitemap detected...');
    allEntries = parseSitemapEntries(sitemapXml);
  }

  // Deduplicate by URL
  const seen = {};
  allEntries = allEntries.filter(e => { if (seen[e.url]) return false; seen[e.url]=true; return true; });

  // Ensure homepage
  const home = BASE_URL + '/';
  if (!allEntries.find(e => e.url === home)) allEntries.push({ url: home, lastmod: null });

  console.log('\nTotal unique pages: ' + allEntries.length + '\n');
  return allEntries;
}

// ── MAIN ──
async function scrape() {
  console.log('BAAP Scraper v2.2 starting...\n');
  const now = new Date();

  const allEntries = await collectAllPageEntries();

  const data = {
    scraped_at: now.toISOString(),
    scraper_version: '2.2',
    association: {
      name: 'Bengali Association of Aerospace Park (BAAP)',
      website: BASE_URL + '/',
      email: 'bengaliassnaerospacepark@gmail.com',
      youtube: 'https://m.youtube.com/@aerospaceparkbengalis',
      instagram: 'https://www.instagram.com/bengaliassnaerospacepark',
      facebook: 'https://www.facebook.com/share/15aXFRQPr8N/',
      location: 'Aerospace Park, North Bangalore, Karnataka, India',
      reg_no: 'DRB1/SOR/220/2025-2026'
    },
    pages: []
  };

  for (const { url, lastmod } of allEntries) {
    const title = titleFromUrl(url);
    process.stdout.write('Scraping: ' + url + ' ... ');
    try {
      const html   = await fetchUrl(url);
      const text   = extractText(html);
      const dates  = extractDates(text);
      const status = getEventStatus(url, text, now);
      const tags   = tagsFromUrl(url);
      // lastmod from sitemap = when the page was last edited on the website
      data.pages.push({ url, title, tags, status, dates, lastmod, content: text });
      console.log('OK (' + status + ', ' + text.length + ' chars' + (lastmod ? ', lastmod: ' + lastmod : '') + ')');
      await new Promise(r => setTimeout(r, 700));
    } catch(e) {
      console.log('FAILED: ' + e.message);
      data.pages.push({ url, title, tags: tagsFromUrl(url), status: 'unknown', dates: [], lastmod, content: '' });
    }
  }

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log('\n✓ Done! ' + data.pages.length + ' pages saved to data.json');
  console.log('✓ Each page now includes lastmod date from sitemap for provenance tracking.');
}

scrape().catch(console.error);
