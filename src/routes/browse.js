const { requireAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();

// Whitelist of safe domains for elderly browsing
const ALLOWED_DOMAINS = [
  // News
  'bbc.co.uk', 'bbc.com', 'news.bbc.co.uk',
  'theguardian.com',
  'dailymail.co.uk',
  'scotsman.com', 'heraldscotland.com',
  'sky.com/news',
  // Weather
  'metoffice.gov.uk', 'bbc.co.uk/weather',
  'weather.com',
  // Entertainment
  'youtube.com', 'www.youtube.com',
  // Shopping
  'amazon.co.uk', 'amazon.com',
  'tesco.com', 'sainsburys.co.uk',
  // Reference
  'wikipedia.org', 'en.wikipedia.org',
  'nhs.uk',
  // Faith
  'biblegateway.com', 'quran.com',
  'churchofscotland.org.uk',
  // Nostalgia / Culture
  'britishnewspaperarchive.co.uk',
  'historic-uk.com',
  'nationalgeographic.com',
  // Google (search)
  'google.com', 'google.co.uk',
];

// Blocked keywords in URLs and content
const BLOCKED_KEYWORDS = [
  'gambling', 'casino', 'betting', 'poker', 'slots',
  'adult', 'xxx', 'porn', 'nsfw', 'escort',
  'drugs', 'cannabis', 'weed', 'cocaine',
  'weapons', 'guns', 'firearms',
  'scam', 'phishing', 'lottery-winner',
  'dating', 'hookup', 'tinder',
  'crypto', 'bitcoin', 'forex-trading',
  'malware', 'download-free', 'crack',
];

// Check if URL is safe
function isUrlSafe(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    
    // Check blocked keywords in full URL
    const lowerUrl = url.toLowerCase();
    for (const keyword of BLOCKED_KEYWORDS) {
      if (lowerUrl.includes(keyword)) {
        return { safe: false, reason: 'blocked_content', keyword };
      }
    }

    // Check if domain is in whitelist
    const isWhitelisted = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    if (!isWhitelisted) {
      return { safe: false, reason: 'domain_not_whitelisted', domain: hostname };
    }

    return { safe: true };
  } catch (e) {
    return { safe: false, reason: 'invalid_url' };
  }
}

// Sanitize Google search to enforce safe search
function sanitizeSearchUrl(query) {
  const encoded = encodeURIComponent(query);
  // Force SafeSearch on
  return `https://www.google.co.uk/search?q=${encoded}&safe=active`;
}

// POST /api/browse/check - Check if URL is safe
router.post('/check', requireAuth, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const result = isUrlSafe(url);
  res.json(result);
});

// POST /api/browse/search - Safe Google search
router.post('/search', requireAuth, (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });
  
  // Check for blocked keywords in search query
  const lowerQuery = query.toLowerCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lowerQuery.includes(keyword)) {
      return res.json({ safe: false, reason: 'blocked_search', url: null });
    }
  }

  const url = sanitizeSearchUrl(query);
  res.json({ safe: true, url });
});

// GET /api/browse/shortcuts - Get safe bookmark shortcuts
router.get('/shortcuts', requireAuth, (req, res) => {
  res.json({
    shortcuts: [
      { id: 'bbc', icon: '📺', name: 'BBC News', url: 'https://www.bbc.co.uk/news', color: '#dc2626' },
      { id: 'weather', icon: '🌤️', name: 'Weather', url: 'https://www.bbc.co.uk/weather', color: '#2563eb' },
      { id: 'daily', icon: '📰', name: 'Daily Mail', url: 'https://www.dailymail.co.uk', color: '#6b7280' },
      { id: 'youtube', icon: '🎬', name: 'YouTube', url: 'https://www.youtube.com', color: '#ef4444' },
      { id: 'amazon', icon: '🛒', name: 'Amazon', url: 'https://www.amazon.co.uk', color: '#f59e0b' },
      { id: 'nhs', icon: '🏥', name: 'NHS', url: 'https://www.nhs.uk', color: '#0891b2' },
      { id: 'wikipedia', icon: '📚', name: 'Wikipedia', url: 'https://en.wikipedia.org', color: '#6b7280' },
      { id: 'scotsman', icon: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', name: 'The Scotsman', url: 'https://www.scotsman.com', color: '#1e40af' },
      { id: 'natgeo', icon: '🌍', name: 'Nat Geo', url: 'https://www.nationalgeographic.com', color: '#eab308' },
    ]
  });
});

// GET /api/browse/whitelist - Admin view of allowed domains
router.get('/whitelist', requireAuth, (req, res) => {
  res.json({ domains: ALLOWED_DOMAINS, blockedKeywords: BLOCKED_KEYWORDS });
});

module.exports = router;
