const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 'eeb478e6-7a7b-4101-af32-bcc56fc589d6';
  
  // Check if profile exists
  const existing = await prisma.residentProfile.findUnique({
    where: { residentId: userId }
  });
  
  const profileData = {
    residentId: userId,
    
    // Step 1: Identity
    gender: 'Female',
    nationality: 'Moroccan-Scottish',
    languagesSpoken: ['English', 'Arabic', 'French'],
    
    // Step 2: Life Background
    maritalStatus: 'Widowed',
    spouseName: 'Youssef',
    spouseDetails: 'Married for 45 years, passed away in 2022. Was a fisherman in Essaouira before moving to Scotland.',
    children: JSON.stringify([
      { name: 'Abid', relationship: 'Son', details: 'Lives in Newmachar, visits every weekend. Works in technology.' },
      { name: 'Fatima', relationship: 'Daughter', details: 'Lives in Casablanca, Morocco. Teacher. Calls every Thursday.' }
    ]),
    grandchildren: JSON.stringify([
      { name: 'Yasmine', age: 8, parent: 'Abid' },
      { name: 'Omar', age: 5, parent: 'Abid' },
      { name: 'Leila', age: 12, parent: 'Fatima' }
    ]),
    previousCareer: 'Ran a small bakery in Essaouira for 20 years, then helped at a community centre in Aberdeen after moving to Scotland in 1995.',
    grewUpIn: 'Essaouira, Morocco — a beautiful coastal city. Moved to Aberdeen, Scotland in 1995 with Youssef.',
    keyMemories: 'The smell of the ocean in Essaouira. Baking msemen with her mother. The day she first saw snow in Scotland. Abid graduating from university.',
    pets: 'Had a ginger cat called Saffron for 12 years.',
    
    // Step 3: Sensitive Topics
    avoidTopics: ['Youssef\'s illness', 'leaving Morocco'],
    sensitiveTopics: ['missing home', 'loneliness'],
    bereavementStatus: 'Widowed 2022 — still grieves but finds comfort in memories and faith',
    knownTriggers: ['photos of Essaouira can make her emotional', 'anniversary of Youssef\'s passing in March'],
    
    // Step 4: Joy & Interests
    joyTopics: ['grandchildren', 'Moroccan cooking', 'Scottish nature', 'flowers', 'the sea'],
    hobbies: ['knitting', 'baking', 'watching nature programmes', 'listening to Andalusian music'],
    favouriteMusic: 'Andalusian classical music, Fairuz, Scottish folk songs',
    favouriteTv: 'Countryfile, The Great British Bake Off, nature documentaries',
    joyTriggers: ['talking about grandchildren', 'smelling spices', 'hearing Arabic music'],
    favouriteFoods: 'Couscous, tagine, msemen, shortbread, tablet (Scottish sweet)',
    sportsTeams: 'Aberdeen FC — Youssef loved them',
    memories: ['Wedding day in Essaouira', 'First snow in Aberdeen', 'Abid\'s graduation', 'Baking with grandmother'],
    
    // Step 5: Faith & Culture
    faithType: 'Islam',
    denomination: 'Sunni',
    faithComfort: true,
    prayerReminders: true,
    prayerTimes: JSON.stringify({ fajr: '06:30', dhuhr: '12:30', asr: '15:00', maghrib: '17:00', isha: '19:30' }),
    favouriteScriptures: 'Ayat al-Kursi, Surah Al-Fatiha, Surah Ar-Rahman',
    culturalBackground: 'Moroccan Amazigh heritage, strong connection to both Moroccan and Scottish culture',
    useGaelic: false,
    languagePreference: 'English',
    useReligious: true,
    useScottish: true,
    faithPhrases: ['Bismillah', 'Alhamdulillah', 'Inshallah', 'Masha\'Allah'],
    
    // Step 6: Health & Communication
    dementiaStage: 'MILD',
    mobilityLevel: 'WITH_AID',
    hearing: 'Slightly hard of hearing in left ear — speak clearly',
    vision: 'Wears reading glasses',
    communicationStyle: 'QUIET',
    bestTimeOfDay: ['morning', 'early_afternoon'],
    dietaryNeeds: 'Halal, no pork. Loves sweet mint tea.',
    
    // Step 7: Warda's Persona
    wardaBackstory: 'Warda is like a kind neighbour from the community who always has time for a chat and a cup of tea.',
    wardaAge: 'Middle-aged',
    wardaTraits: ['warm', 'patient', 'culturally aware', 'gentle humour', 'respectful of faith'],
    greetingStyle: 'Salaam Hafsa, habibti! How are you feeling today, dear?',
    conversationTopics: ['grandchildren', 'cooking recipes', 'memories of Morocco', 'Scottish weather', 'nature', 'faith'],
    hardBoundaries: ['Never dismiss her faith', 'Never rush her', 'Never talk about Youssef\'s final days'],
    therapyGoals: ['Reduce loneliness', 'Maintain cognitive engagement', 'Strengthen family connection', 'Preserve cultural identity'],
    familyDetails: JSON.stringify({
      son: { name: 'Abid', visits: 'Every weekend', relationship: 'Very close' },
      daughter: { name: 'Fatima', visits: 'Calls Thursday', relationship: 'Close but misses her' }
    }),
    
    questionnaireStep: 10,
    questionnaireComplete: true
  };

  if (existing) {
    await prisma.residentProfile.update({
      where: { residentId: userId },
      data: profileData
    });
    console.log('✅ Updated Hafsa\'s profile');
  } else {
    await prisma.residentProfile.create({ data: profileData });
    console.log('✅ Created Hafsa\'s profile');
  }
  
  // Verify
  const profile = await prisma.residentProfile.findUnique({
    where: { residentId: userId }
  });
  console.log('Profile complete:', profile.questionnaireComplete);
  console.log('Joy topics:', profile.joyTopics);
  console.log('Greeting:', profile.greetingStyle);
}

main().catch(console.error).finally(() => prisma.$disconnect());
