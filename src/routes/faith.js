const { tabletAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Curated faith content library
var FAITH_CONTENT = {
  Islam: {
    icon: '\u262A\uFE0F',
    color: 'from-green-50 to-emerald-100',
    border: 'border-green-300',
    greeting: 'Assalamu Alaikum',
    sections: [
      { id: 'quran', name: 'Quran Verses', icon: '\uD83D\uDCD6', items: [
        { title: 'Ayat al-Kursi (2:255)', text: 'Allah - there is no deity except Him, the Ever-Living, the Self-Sustaining. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth.', arabic: '\u0627\u0644\u0644\u0647 \u0644\u0627 \u0625\u0644\u0647 \u0625\u0644\u0627 \u0647\u0648 \u0627\u0644\u062D\u064A \u0627\u0644\u0642\u064A\u0648\u0645' },
        { title: 'Surah Al-Fatiha (1:1-7)', text: 'In the name of Allah, the Most Gracious, the Most Merciful. All praise is due to Allah, Lord of all the worlds. The Most Gracious, the Most Merciful. Master of the Day of Judgement. You alone we worship, and You alone we ask for help.', arabic: '\u0628\u0633\u0645 \u0627\u0644\u0644\u0647 \u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0631\u062D\u064A\u0645' },
        { title: 'Surah Ar-Rahman (55:13)', text: 'So which of the favours of your Lord would you deny? He created man from clay like that of pottery. And He created the jinn from a smokeless flame of fire.', arabic: '\u0641\u0628\u0623\u064A \u0622\u0644\u0627\u0621 \u0631\u0628\u0643\u0645\u0627 \u062A\u0643\u0630\u0628\u0627\u0646' },
        { title: 'Surah Al-Ikhlas (112:1-4)', text: 'Say: He is Allah, the One. Allah, the Eternal Refuge. He neither begets nor is born. Nor is there to Him any equivalent.', arabic: '\u0642\u0644 \u0647\u0648 \u0627\u0644\u0644\u0647 \u0623\u062D\u062F' },
        { title: 'Surah Al-Falaq (113:1-5)', text: 'Say: I seek refuge in the Lord of daybreak, from the evil of that which He created, and from the evil of darkness when it settles.', arabic: '\u0642\u0644 \u0623\u0639\u0648\u0630 \u0628\u0631\u0628 \u0627\u0644\u0641\u0644\u0642' }
      ]},
      { id: 'duas', name: 'Daily Duas', icon: '\uD83E\uDD32', items: [
        { title: 'Morning Dua', text: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the final return. Allahumma bika asbahna wa bika amsayna.' },
        { title: 'Evening Dua', text: 'O Allah, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the resurrection.' },
        { title: 'Before Sleep', text: 'In Your name, O Allah, I die and I live. Bismika Allahumma amutu wa ahya.' },
        { title: 'For Patience', text: 'Our Lord, pour upon us patience and let us die as Muslims. Rabbana afrigh alayna sabran wa tawaffana muslimeen.' },
        { title: 'For Gratitude', text: 'All praise is due to Allah who has fed us and given us drink, and made us Muslims. Alhamdulillahilladhi at-amana wa saqana wa ja-alana muslimeen.' }
      ]},
      { id: 'names', name: '99 Names of Allah', icon: '\u2728', items: [
        { title: 'Ar-Rahman', text: 'The Most Gracious. Allah encompasses all things in mercy and grace.' },
        { title: 'Ar-Raheem', text: 'The Most Merciful. His mercy is for the believers especially on the Day of Judgement.' },
        { title: 'Al-Malik', text: 'The King. The Sovereign Lord who owns and rules all that exists.' },
        { title: 'As-Salam', text: 'The Source of Peace. He is free from all imperfections.' },
        { title: 'Al-Ghaffar', text: 'The All-Forgiving. He forgives sins again and again.' }
      ]}
    ]
  },
  Christianity: {
    icon: '\u271D\uFE0F',
    color: 'from-blue-50 to-blue-100',
    border: 'border-blue-300',
    greeting: 'God bless you',
    sections: [
      { id: 'bible', name: 'Bible Verses', icon: '\uD83D\uDCD6', items: [
        { title: 'Psalm 23:1-4', text: 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.' },
        { title: 'Philippians 4:6-7', text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.' },
        { title: 'Isaiah 41:10', text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.' },
        { title: 'Romans 8:28', text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
        { title: 'Matthew 11:28', text: 'Come to me, all you who are weary and burdened, and I will give you rest.' }
      ]},
      { id: 'prayers', name: 'Prayers', icon: '\uD83D\uDE4F', items: [
        { title: 'The Lords Prayer', text: 'Our Father, who art in heaven, hallowed be thy Name. Thy kingdom come, thy will be done, on earth as it is in heaven. Give us this day our daily bread and forgive us our trespasses.' },
        { title: 'Morning Prayer', text: 'Lord, thank you for this new day. Guide my steps, guard my heart, and help me be a light to those around me. Amen.' },
        { title: 'Evening Prayer', text: 'As this day ends, I thank you Lord for your blessings. Watch over me through the night and grant me peaceful rest. Amen.' },
        { title: 'Prayer for Peace', text: 'Lord, make me an instrument of your peace. Where there is hatred, let me sow love. Where there is despair, hope. Amen.' }
      ]},
      { id: 'hymns', name: 'Hymn Words', icon: '\uD83C\uDFB5', items: [
        { title: 'Amazing Grace', text: 'Amazing grace, how sweet the sound, that saved a wretch like me. I once was lost, but now am found, was blind but now I see.' },
        { title: 'How Great Thou Art', text: 'O Lord my God, when I in awesome wonder consider all the worlds thy hands have made. Then sings my soul, my Saviour God, to thee: How great thou art.' },
        { title: 'Abide With Me', text: 'Abide with me, fast falls the eventide. The darkness deepens, Lord with me abide. When other helpers fail and comforts flee, help of the helpless, O abide with me.' }
      ]}
    ]
  },
  Judaism: {
    icon: '\u2721\uFE0F',
    color: 'from-amber-50 to-amber-100',
    border: 'border-amber-300',
    greeting: 'Shalom',
    sections: [
      { id: 'torah', name: 'Torah & Psalms', icon: '\uD83D\uDCD6', items: [
        { title: 'Psalm 23', text: 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.' },
        { title: 'Shema Yisrael', text: 'Hear, O Israel: The Lord our God, the Lord is One. You shall love the Lord your God with all your heart and with all your soul and with all your might.' },
        { title: 'Psalm 121', text: 'I lift up my eyes to the mountains. From where does my help come? My help comes from the Lord, who made heaven and earth.' }
      ]},
      { id: 'prayers', name: 'Prayers', icon: '\uD83D\uDE4F', items: [
        { title: 'Modeh Ani (Morning)', text: 'I gratefully thank You, living and enduring King, for You have faithfully restored my soul. Great is Your faithfulness.' },
        { title: 'Shabbat Blessing', text: 'Blessed are You, Lord our God, King of the universe, who has sanctified us with His commandments and commanded us to kindle the Sabbath lights.' }
      ]}
    ]
  },
  Sikhism: {
    icon: '\uD83E\uDD32',
    color: 'from-orange-50 to-orange-100',
    border: 'border-orange-300',
    greeting: 'Sat Sri Akal',
    sections: [
      { id: 'gurbani', name: 'Gurbani', icon: '\uD83D\uDCD6', items: [
        { title: 'Mool Mantar', text: 'There is One God, whose name is Truth. He is the Creator, without fear, without enmity. He is timeless, unborn, self-existent.' },
        { title: 'Japji Sahib (Opening)', text: 'By thinking, He cannot be reduced to thought, even by thinking hundreds of thousands of times.' }
      ]},
      { id: 'prayers', name: 'Ardas', icon: '\uD83D\uDE4F', items: [
        { title: 'Morning Ardas', text: 'Wonderful Lord, wonderful are Your deeds. You are the treasure of virtue, the formless Lord. May Your will be done.' }
      ]}
    ]
  },
  Secular: {
    icon: '\uD83C\uDF3F',
    color: 'from-teal-50 to-teal-100',
    border: 'border-teal-300',
    greeting: 'Welcome',
    sections: [
      { id: 'mindfulness', name: 'Mindfulness', icon: '\uD83E\uDDD8', items: [
        { title: 'Breathing Exercise', text: 'Close your eyes gently. Breathe in slowly for four counts. Hold for four counts. Breathe out slowly for four counts. Feel the calm wash over you.' },
        { title: 'Body Scan', text: 'Starting from your toes, gently notice each part of your body. Release any tension you find. Move slowly upward, feeling relaxed and at peace.' },
        { title: 'Gratitude Moment', text: 'Think of three things you are grateful for today. They can be small or large. Hold each one in your mind and feel the warmth it brings.' }
      ]},
      { id: 'affirmations', name: 'Affirmations', icon: '\u2728', items: [
        { title: 'I Am Enough', text: 'I am worthy of love and kindness. I have lived a full life and I continue to grow. Each day brings new possibilities.' },
        { title: 'Peace Within', text: 'I choose peace today. I release what I cannot control and embrace what brings me joy.' },
        { title: 'Strength', text: 'I have overcome many challenges in my life. I am strong, resilient, and capable of handling whatever comes my way.' }
      ]}
    ]
  }
};

router.get('/content/:residentId', tabletAuth, async function(req, res) {
  try {
    var profile = await prisma.residentProfile.findFirst({
      where: { residentId: req.params.residentId },
      select: {
        faithType: true, denomination: true, faithComfort: true,
        prayerReminders: true, prayerTimes: true, favouriteScriptures: true,
        religiousCelebrations: true, useReligious: true, faithPhrases: true,
        resident: { select: { firstName: true, preferredName: true } }
      }
    });

    var name = profile?.resident?.preferredName || profile?.resident?.firstName || 'Friend';
    var faith = profile?.faithType || '';
    var faithKey = 'Secular';

    if (faith.toLowerCase().includes('islam') || faith.toLowerCase().includes('muslim')) faithKey = 'Islam';
    else if (faith.toLowerCase().includes('christian') || faith.toLowerCase().includes('church') || faith.toLowerCase().includes('catholic') || faith.toLowerCase().includes('protestant')) faithKey = 'Christianity';
    else if (faith.toLowerCase().includes('jew') || faith.toLowerCase().includes('judai')) faithKey = 'Judaism';
    else if (faith.toLowerCase().includes('sikh')) faithKey = 'Sikhism';
    else if (faith && faith.toLowerCase() !== 'none' && faith.toLowerCase() !== 'secular') faithKey = 'Secular';

    var content = FAITH_CONTENT[faithKey];
    var prayerTimes = null;
    try { prayerTimes = profile?.prayerTimes ? JSON.parse(profile.prayerTimes) : null; } catch(e) {}

    // Personalise: highlight favourite scriptures
    var favourites = (profile?.favouriteScriptures || '').split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
    if (favourites.length > 0 && content.sections) {
      content.sections.forEach(function(section) {
        section.items.forEach(function(item) {
          item.isFavourite = favourites.some(function(f) { return item.title.toLowerCase().includes(f) || item.text.toLowerCase().includes(f); });
        });
      });
    }

    var introText = content.greeting + ', ' + name + '.';
    if (faithKey === 'Islam') introText = 'Assalamu Alaikum, ' + name + '. May peace be upon you.';
    else if (faithKey === 'Christianity') introText = 'God bless you, ' + name + '. Let us find comfort in His word.';
    else if (faithKey === 'Secular') introText = name + ', let us take a peaceful moment together.';

    res.json({
      success: true,
      residentName: name,
      faithKey: faithKey,
      faithType: faith,
      denomination: profile?.denomination || '',
      content: content,
      prayerTimes: prayerTimes,
      prayerReminders: profile?.prayerReminders || false,
      faithPhrases: profile?.faithPhrases || [],
      favouriteScriptures: profile?.favouriteScriptures || '',
      introText: introText
    });
  } catch (err) {
    console.error('Faith content error:', err);
    res.status(500).json({ success: false, error: 'Failed to load faith content' });
  }
});

module.exports = router;
