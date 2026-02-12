const { tabletAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/music/preferences/:residentId
// Returns music preferences from questionnaire + generates personalised playlists
router.get('/preferences/:residentId', tabletAuth, async function(req, res) {
  try {
    var profile = await prisma.residentProfile.findFirst({
      where: { residentId: req.params.residentId },
      select: {
        favouriteMusic: true,
        favouriteRadio: true,
        traditionalSongs: true,
        culturalBackground: true,
        faithType: true,
        denomination: true,
        resident: { select: { firstName: true, preferredName: true } }
      }
    });

    if (!profile) {
      return res.json({ success: true, preferences: null, playlists: getDefaultPlaylists() });
    }

    var name = profile.resident?.preferredName || profile.resident?.firstName || 'Friend';
    var musicPref = profile.favouriteMusic || '';
    var culture = profile.culturalBackground || '';
    var faith = profile.faithType || '';
    var traditionalSongs = profile.traditionalSongs || [];
    var radio = profile.favouriteRadio || '';

    // Build personalised playlists based on questionnaire data
    var playlists = [];
    var introText = name + ', I picked some music just for you.';

    // Parse music preferences into keywords
    var musicLower = musicPref.toLowerCase();

    // Personalised playlist from questionnaire
    if (musicPref) {
      var personalTracks = musicPref.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      playlists.push({
        id: 'personal',
        name: 'Your Favourites',
        icon: '\u2764\uFE0F',
        color: 'from-rose-100 to-rose-200',
        border: 'border-rose-300',
        tracks: personalTracks.map(function(t) { return { title: t, source: 'youtube', query: t + ' music' }; }),
        intro: name + ', here is some of the music you love.'
      });
    }

    // Cultural playlist
    if (culture.toLowerCase().includes('morocc') || culture.toLowerCase().includes('arab') || culture.toLowerCase().includes('amazigh')) {
      playlists.push({
        id: 'cultural',
        name: 'Moroccan Heritage',
        icon: '\uD83C\uDDF2\uD83C\uDDE6',
        color: 'from-red-100 to-red-200',
        border: 'border-red-300',
        tracks: [
          { title: 'Andalusian Classical Music', source: 'youtube', query: 'andalusian classical music morocco' },
          { title: 'Amazigh Traditional Songs', source: 'youtube', query: 'amazigh traditional music' },
          { title: 'Moroccan Chaabi', source: 'youtube', query: 'moroccan chaabi music traditional' },
          { title: 'Gnawa Music', source: 'youtube', query: 'gnawa music morocco' }
        ],
        intro: name + ', let me play some beautiful music from your Moroccan heritage.'
      });
    }

    if (culture.toLowerCase().includes('scottish') || culture.toLowerCase().includes('scotland')) {
      playlists.push({
        id: 'scottish',
        name: 'Scottish Songs',
        icon: '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F',
        color: 'from-blue-100 to-blue-200',
        border: 'border-blue-300',
        tracks: [
          { title: 'Loch Lomond', source: 'youtube', query: 'loch lomond scottish song' },
          { title: 'Flower of Scotland', source: 'youtube', query: 'flower of scotland' },
          { title: 'Auld Lang Syne', source: 'youtube', query: 'auld lang syne scottish' },
          { title: 'Caledonia', source: 'youtube', query: 'caledonia dougie maclean' },
          { title: 'Wild Mountain Thyme', source: 'youtube', query: 'wild mountain thyme scottish' }
        ],
        intro: name + ', how about some lovely Scottish tunes?'
      });
    }

    // Fairuz special (detected from preferences)
    if (musicLower.includes('fairuz') || musicLower.includes('fairouz')) {
      playlists.push({
        id: 'fairuz',
        name: 'Fairuz',
        icon: '\uD83C\uDFB5',
        color: 'from-purple-100 to-purple-200',
        border: 'border-purple-300',
        tracks: [
          { title: 'Fairuz - Nassam Alayna El Hawa', source: 'youtube', query: 'fairuz nassam alayna el hawa' },
          { title: 'Fairuz - Li Beirut', source: 'youtube', query: 'fairuz li beirut' },
          { title: 'Fairuz - Kifak Inta', source: 'youtube', query: 'fairuz kifak inta' },
          { title: 'Fairuz - Bhibbak Ya Libnan', source: 'youtube', query: 'fairuz bhibbak ya libnan' }
        ],
        intro: name + ', I know you love Fairuz. Such beautiful music.'
      });
    }

    // Faith-based playlist
    if (faith.toLowerCase().includes('islam') || faith.toLowerCase().includes('muslim')) {
      playlists.push({
        id: 'faith',
        name: 'Peaceful Nasheeds',
        icon: '\uD83C\uDD4A\uFE0F',
        color: 'from-green-100 to-green-200',
        border: 'border-green-300',
        tracks: [
          { title: 'Tala Al Badru Alayna', source: 'youtube', query: 'tala al badru alayna nasheed' },
          { title: 'Maher Zain - Insha Allah', source: 'youtube', query: 'maher zain insha allah' },
          { title: 'Peaceful Quran Recitation', source: 'youtube', query: 'peaceful quran recitation relaxing' },
          { title: 'Sami Yusuf - Hasbi Rabbi', source: 'youtube', query: 'sami yusuf hasbi rabbi' }
        ],
        intro: name + ', here are some peaceful nasheeds and recitations for your soul.'
      });
    } else if (faith.toLowerCase().includes('christian') || faith.toLowerCase().includes('church')) {
      playlists.push({
        id: 'faith',
        name: 'Hymns & Faith',
        icon: '\u26EA',
        color: 'from-green-100 to-green-200',
        border: 'border-green-300',
        tracks: [
          { title: 'Amazing Grace', source: 'youtube', query: 'amazing grace hymn' },
          { title: 'How Great Thou Art', source: 'youtube', query: 'how great thou art hymn' },
          { title: 'Be Still My Soul', source: 'youtube', query: 'be still my soul hymn' },
          { title: 'Abide With Me', source: 'youtube', query: 'abide with me hymn' }
        ],
        intro: name + ', let me play some beautiful hymns for you.'
      });
    }

    // Traditional songs from questionnaire
    if (traditionalSongs && traditionalSongs.length > 0) {
      playlists.push({
        id: 'traditional',
        name: 'Traditional Songs',
        icon: '\uD83C\uDFB6',
        color: 'from-amber-100 to-amber-200',
        border: 'border-amber-300',
        tracks: traditionalSongs.map(function(s) { return { title: s, source: 'youtube', query: s + ' traditional song' }; }),
        intro: name + ', here are some traditional songs you enjoy.'
      });
    }

    // Always include relaxation
    playlists.push({
      id: 'relaxing',
      name: 'Relaxing Sounds',
      icon: '\uD83C\uDF3F',
      color: 'from-teal-100 to-teal-200',
      border: 'border-teal-300',
      tracks: [
        { title: 'Gentle Rainfall', source: 'youtube', query: 'gentle rain sounds relaxing 1 hour' },
        { title: 'Ocean Waves', source: 'youtube', query: 'ocean waves sounds relaxing sleep' },
        { title: 'Forest Birds', source: 'youtube', query: 'forest bird sounds nature relaxing' },
        { title: 'Soft Piano', source: 'youtube', query: 'soft piano relaxing music elderly' }
      ],
      intro: name + ', how about some relaxing sounds to help you feel peaceful?'
    });

    // Golden classics always available
    playlists.push({
      id: 'classics',
      name: 'Golden Classics',
      icon: '\uD83C\uDFB7',
      color: 'from-amber-100 to-amber-200',
      border: 'border-amber-300',
      tracks: [
        { title: 'Frank Sinatra - My Way', source: 'youtube', query: 'frank sinatra my way' },
        { title: 'Nat King Cole - Unforgettable', source: 'youtube', query: 'nat king cole unforgettable' },
        { title: 'Dean Martin - Thats Amore', source: 'youtube', query: 'dean martin thats amore' },
        { title: 'Ella Fitzgerald - Dream a Little Dream', source: 'youtube', query: 'ella fitzgerald dream a little dream' }
      ],
      intro: name + ', how about some golden classics? Timeless music.'
    });

    if (musicPref) {
      introText = name + ', I know you love ' + musicPref.split(',')[0].trim() + '. I have picked playlists just for you.';
    }

    res.json({
      success: true,
      preferences: {
        favouriteMusic: musicPref,
        culturalBackground: culture,
        faithType: faith,
        traditionalSongs: traditionalSongs,
        radio: radio
      },
      playlists: playlists,
      introText: introText,
      residentName: name
    });
  } catch (err) {
    console.error('Music preferences error:', err);
    res.status(500).json({ success: false, error: 'Failed to load music preferences' });
  }
});

function getDefaultPlaylists() {
  return [
    { id: 'classics', name: 'Golden Classics', icon: '\uD83C\uDFB7', color: 'from-amber-100 to-amber-200', border: 'border-amber-300',
      tracks: [
        { title: 'Frank Sinatra - My Way', source: 'youtube', query: 'frank sinatra my way' },
        { title: 'Nat King Cole - Unforgettable', source: 'youtube', query: 'nat king cole unforgettable' },
        { title: 'Dean Martin - Thats Amore', source: 'youtube', query: 'dean martin thats amore' }
      ], intro: 'Here are some golden classics for you.' },
    { id: 'relaxing', name: 'Relaxing Sounds', icon: '\uD83C\uDF3F', color: 'from-teal-100 to-teal-200', border: 'border-teal-300',
      tracks: [
        { title: 'Gentle Rainfall', source: 'youtube', query: 'gentle rain sounds relaxing' },
        { title: 'Ocean Waves', source: 'youtube', query: 'ocean waves sounds relaxing' },
        { title: 'Forest Birds', source: 'youtube', query: 'forest bird sounds nature' }
      ], intro: 'Some relaxing sounds to help you feel peaceful.' }
  ];
}

module.exports = router;
