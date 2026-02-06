/**
 * Claude AI Service - ENHANCED 10-Step Integration
 */
const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const prisma = new PrismaClient();

const WARDA_BASE_PROMPT = `You are Warda, a warm and caring AI companion for elderly residents in care homes. Your name means "rose" in Arabic.

MESSAGE SENDING: If the resident asks you to send a message to a family member, respond warmly. The system auto-detects and sends - acknowledge naturally like "Of course, I'll let Sarah know right away!"

CORE PERSONALITY:
- Patient: Never rush. Silence is okay.
- Warm: Friendly, not formal. Use gentle endearments like "dear" appropriately.
- Remembering: Reference past conversations when relevant.
- Culturally Aware: Adapt to their background.
- Protective: Look out for wellbeing. Flag concerns gently.

COMMUNICATION RULES:
- KEEP RESPONSES SHORT - Maximum 2-3 sentences. Brief but warm.
- Never say "I don't understand" - always try to help
- Never correct harshly - guide gently
- Always use their name
- Match their energy
- End conversations with reassurance
- Use simple, clear language
- If they mention feeling unwell, gently ask if they'd like you to alert someone

IMPORTANT: Keep responses SHORT - 2-3 sentences maximum.
You're not just a smart assistant - you're a companion who truly understands elderly people.`;

function buildPersonalisedPrompt(profile, resident) {
  let prompt = WARDA_BASE_PROMPT;
  if (!profile) return prompt;
  const name = profile.preferredName || resident?.preferredName || resident?.firstName || 'dear';

  // WARDA PERSONA (Step 10)
  if (profile.wardaBackstory) {
    prompt += '\n\nYOUR BACKSTORY:\n' + profile.wardaBackstory;
    if (profile.wardaAge) prompt += '\nYou present as ' + profile.wardaAge + ' years old.';
    if (profile.wardaTraits && profile.wardaTraits.length > 0) prompt += '\nTraits: ' + profile.wardaTraits.join(', ');
  }
  if (profile.hardBoundaries && profile.hardBoundaries.length > 0) {
    prompt += '\n\nABSOLUTE HARD BOUNDARIES - NEVER BRING UP:\n' + profile.hardBoundaries.join('\n');
  }

  // STEP 1: IDENTITY
  prompt += '\n\nSPEAKING WITH: ' + name;
  if (resident?.firstName && resident?.lastName) prompt += ' (' + resident.firstName + ' ' + resident.lastName + ')';
  if (profile.gender) prompt += '. Gender: ' + profile.gender;
  if (resident?.roomNumber) prompt += '. Room ' + resident.roomNumber;
  if (profile.nationality) prompt += '. ' + profile.nationality;
  if (resident?.dateOfBirth) {
    const age = Math.floor((Date.now() - new Date(resident.dateOfBirth).getTime()) / 31557600000);
    prompt += '. Age: ' + age;
  }
  if (profile.languagesSpoken && profile.languagesSpoken.length > 0) prompt += '\nLanguages: ' + profile.languagesSpoken.join(', ');

  // STEP 2: LIFE STORY
  const bg = [];
  if (profile.maritalStatus) { bg.push('Marital: ' + profile.maritalStatus); if (profile.spouseName) bg.push('Spouse: ' + profile.spouseName); if (profile.spouseDetails) bg.push('About spouse: ' + profile.spouseDetails); }
  if (profile.previousCareer) bg.push('Career: ' + profile.previousCareer);
  if (profile.education) bg.push('Education: ' + profile.education);
  if (profile.grewUpIn) bg.push('Grew up: ' + profile.grewUpIn);
  if (profile.pets) bg.push('Pets: ' + profile.pets);
  if (profile.keyMemories) bg.push('Memories: ' + profile.keyMemories);
  if (profile.proudestAchievement) bg.push('Proudest: ' + profile.proudestAchievement);
  if (profile.missesAboutOldLife) bg.push('Misses: ' + profile.missesAboutOldLife);
  if (profile.militaryService) bg.push('Military: ' + (profile.militaryBranch || 'Yes'));
  if (profile.placesLived && profile.placesLived.length > 0) bg.push('Lived: ' + profile.placesLived.join(', '));
  if (bg.length > 0) {
    prompt += '\n\nLIFE STORY:\n' + bg.join('\n');
    if (profile.maritalStatus === 'Widowed') prompt += '\nIMPORTANT: ' + name + ' is widowed. Be deeply empathetic.';
  }

  // STEP 3: FAMILY
  const fam = [];
  if (profile.familyTree && profile.familyTree.length > 0) {
    const fl = profile.familyTree.map(function(fm) { let d = fm.name + ' (' + fm.relationship; if (!fm.alive) d += ', deceased'; if (fm.visitFrequency) d += ', visits: ' + fm.visitFrequency; if (fm.notes) d += ' - ' + fm.notes; return d + ')'; }).join('; ');
    fam.push('Family: ' + fl);
  }
  if (profile.primaryFamilyContact) fam.push('Primary contact: ' + profile.primaryFamilyContact);
  if (profile.favouriteFamilyMember) fam.push('Loves talking about: ' + profile.favouriteFamilyMember);
  if (profile.familyDynamicsNotes) fam.push('Dynamics: ' + profile.familyDynamicsNotes);
  if (profile.familyDetails) fam.push('Notes: ' + profile.familyDetails);
  if (resident?.familyContacts && resident.familyContacts.length > 0) {
    fam.push('Contacts: ' + resident.familyContacts.map(function(fc) { return fc.name + ' (' + fc.relationship + (fc.isPrimary ? ', primary' : '') + ')'; }).join(', '));
  }
  if (fam.length > 0) {
    prompt += '\n\nFAMILY:\n' + fam.join('\n');
    prompt += '\nMention family naturally. If ' + name + ' misses them, offer to send a message.';
  }

  // STEP 4: SENSITIVE TOPICS
  const bounds = [];
  if (profile.avoidTopics && profile.avoidTopics.length > 0) bounds.push('NEVER mention: ' + profile.avoidTopics.join(', '));
  if (profile.sensitiveTopics && profile.sensitiveTopics.length > 0) bounds.push('Handle gently: ' + profile.sensitiveTopics.join(', '));
  if (profile.knownTriggers && profile.knownTriggers.length > 0) bounds.push('Triggers: ' + profile.knownTriggers.join(', '));
  if (profile.confusionTriggers && profile.confusionTriggers.length > 0) bounds.push('Confusion triggers: ' + profile.confusionTriggers.join(', '));
  if (profile.anxietyTriggers && profile.anxietyTriggers.length > 0) bounds.push('Anxiety triggers: ' + profile.anxietyTriggers.join(', '));
  if (profile.traumaNotes) bounds.push('Trauma: ' + profile.traumaNotes);
  if (profile.bereavementStatus) bounds.push('Bereavement: ' + profile.bereavementStatus);
  if (profile.sundowningPatterns) bounds.push('Sundowning: ' + profile.sundowningPatterns);
  if (bounds.length > 0) prompt += '\n\nSENSITIVE TOPICS:\n' + bounds.join('\n');
  if (profile.redirectionStrategies && profile.redirectionStrategies.length > 0) prompt += '\nRedirect with: ' + profile.redirectionStrategies.join(', ');
  if (profile.safeRedirectTopics && profile.safeRedirectTopics.length > 0) prompt += '\nSafe redirects: ' + profile.safeRedirectTopics.join(', ');

  // STEP 5: JOY & INTERESTS
  const joys = [];
  if (profile.hobbies && profile.hobbies.length > 0) joys.push('Hobbies: ' + profile.hobbies.join(', '));
  if (profile.joyTriggers && profile.joyTriggers.length > 0) joys.push('Joy: ' + profile.joyTriggers.join(', '));
  if (profile.memories && profile.memories.length > 0) joys.push('Memories: ' + profile.memories.join(', '));
  if (profile.favouriteMusic) joys.push('Music: ' + profile.favouriteMusic);
  if (profile.favouriteTv) joys.push('TV: ' + profile.favouriteTv);
  if (profile.favouriteFoods) joys.push('Foods: ' + profile.favouriteFoods);
  if (profile.sportsTeams) joys.push('Sports: ' + profile.sportsTeams);
  if (profile.favouriteRadio) joys.push('Radio: ' + profile.favouriteRadio);
  if (profile.favouriteBooks) joys.push('Books: ' + profile.favouriteBooks);
  if (profile.favouriteGames && profile.favouriteGames.length > 0) joys.push('Games: ' + profile.favouriteGames.join(', '));
  if (profile.favouritePlaces && profile.favouritePlaces.length > 0) joys.push('Places: ' + profile.favouritePlaces.join(', '));
  if (profile.thingsThatMakeLaugh && profile.thingsThatMakeLaugh.length > 0) joys.push('Laughs at: ' + profile.thingsThatMakeLaugh.join(', '));
  if (profile.socialPreference) {
    var sp = {GROUP:'enjoys groups',ONE_ON_ONE:'prefers one-on-one',VARIES:'varies',SOLITARY:'prefers alone'};
    joys.push('Social: ' + (sp[profile.socialPreference] || profile.socialPreference));
  }
  if (joys.length > 0) prompt += '\n\nINTERESTS:\n' + joys.join('\n');
  if (profile.conversationStarters && profile.conversationStarters.length > 0) prompt += '\nGreat starters: ' + profile.conversationStarters.join('; ');
  if (profile.proactiveTopics && profile.proactiveTopics.length > 0) prompt += '\n\nPROACTIVE TOPICS (when ' + name + ' is quiet):\n' + profile.proactiveTopics.join('\n');
  if (profile.conversationTopics && profile.conversationTopics.length > 0) prompt += '\nSpecific starters: ' + profile.conversationTopics.join('; ');

  // STEP 6: FAITH & CULTURE
  if (profile.faithType && profile.faithType !== 'None') {
    prompt += '\n\nFAITH: ' + profile.faithType;
    if (profile.denomination) prompt += ' (' + profile.denomination + ')';
    if (profile.faithComfort) prompt += '\nOffer faith-based comfort.';
    if (profile.prayerReminders) prompt += '\nRemind about prayer times.';
    if (profile.favouriteScriptures) prompt += '\nScriptures: ' + profile.favouriteScriptures;
  }
  if (profile.culturalBackground) prompt += '\nCulture: ' + profile.culturalBackground;
  if (profile.useGaelic) prompt += '\nUse Gaelic: "Madainn mhath" (morning), "Feasgar math" (afternoon), "Tha mi an seo" (I\'m here), "A charaid" (friend)';
  if (profile.useScottish) prompt += '\nUse Scots: "aye", "wee", "bonnie", "braw", "ken"';
  if (profile.religiousCelebrations && profile.religiousCelebrations.length > 0) prompt += '\nCelebrations: ' + profile.religiousCelebrations.join(', ');
  if (profile.culturalFoods && profile.culturalFoods.length > 0) prompt += '\nCultural foods: ' + profile.culturalFoods.join(', ');
  if (profile.traditionalSongs && profile.traditionalSongs.length > 0) prompt += '\nSongs: ' + profile.traditionalSongs.join(', ');
  if (profile.historicalEvents && profile.historicalEvents.length > 0) prompt += '\nLived through: ' + profile.historicalEvents.join(', ');
  if (profile.culturalPractices) prompt += '\nPractices: ' + profile.culturalPractices;
  if (profile.politicalGuidance === 'AVOID') prompt += '\nAVOID politics.';
  else if (profile.politicalGuidance === 'LIGHT') prompt += '\nLight political chat OK.';

  // STEP 7: HEALTH
  const health = [];
  if (profile.dementiaStage && profile.dementiaStage !== 'NONE') {
    health.push('Dementia: ' + profile.dementiaStage);
    var dg = {MILD:'Patient with repetition. Don\'t correct memory.',MODERATE:'Very simple sentences. Don\'t quiz memory. Go with their reality.',ADVANCED:'Simple words. Emotional connection. Singing, comfort.'};
    if (dg[profile.dementiaStage]) health.push(dg[profile.dementiaStage]);
  }
  if (profile.mobilityLevel) health.push('Mobility: ' + profile.mobilityLevel);
  if (profile.hearing && profile.hearing !== 'Good') health.push('Hearing: ' + profile.hearing + ' - CLEAR sentences');
  if (profile.vision && profile.vision !== 'Good') health.push('Vision: ' + profile.vision);
  if (profile.sleepPattern) health.push('Sleep: ' + profile.sleepPattern);
  if (profile.appetite) health.push('Appetite: ' + profile.appetite);
  if (profile.painManagement) health.push('Pain: ' + profile.painManagement);
  if (profile.dietaryNeeds) health.push('Diet: ' + profile.dietaryNeeds);
  if (profile.allergies && profile.allergies.length > 0) health.push('Allergies: ' + profile.allergies.join(', '));
  if (profile.medications && profile.medications.length > 0) {
    health.push('Meds: ' + profile.medications.map(function(m) { return m.name + (m.time ? ' at ' + m.time : ''); }).join(', '));
  }
  if (health.length > 0) prompt += '\n\nHEALTH:\n' + health.join('\n');
  if (profile.healthConcernResponses && profile.healthConcernResponses.length > 0) prompt += '\nHealth responses: ' + profile.healthConcernResponses.join(' | ');

  // STEP 8: COMMUNICATION
  const comm = [];
  if (profile.communicationStyle) {
    var cs = {CHATTY:name+' is chatty - engage, ask follow-ups.',QUIET:name+' is quiet - short warm exchanges OK.',VARIES:'Mood varies - match energy.',NON_VERBAL:'Non-verbal. Soothing presence, yes/no questions.'};
    if (cs[profile.communicationStyle]) comm.push(cs[profile.communicationStyle]);
  }
  if (profile.responseLengthPref) {
    var rl = {SHORT:'Very short responses 1-2 sentences',MEDIUM:'Medium 2-3 sentences',LONGER:'Can give longer responses'};
    if (rl[profile.responseLengthPref]) comm.push(rl[profile.responseLengthPref]);
  }
  if (profile.humourStyle) {
    var hs = {DRY_WIT:'Dry wit and clever remarks',SILLY:'Playful and silly',GENTLE:'Gentle warm humour',NONE:'No humour - keep warm and serious'};
    if (hs[profile.humourStyle]) comm.push(hs[profile.humourStyle]);
  }
  if (profile.formalityLevel) {
    var fl = {FORMAL:'Formal: Mr/Mrs ' + (resident?.lastName || ''),CASUAL:'Casual: "' + name + ' dear"',VARIES:'Adapt formality'};
    if (fl[profile.formalityLevel]) comm.push(fl[profile.formalityLevel]);
  }
  if (profile.conversationPace) {
    var cp = {QUICK:'Quick pace',MODERATE:'Moderate pace',SLOW:'Slow - give time to process'};
    if (cp[profile.conversationPace]) comm.push(cp[profile.conversationPace]);
  }
  if (comm.length > 0) prompt += '\n\nCOMMUNICATION:\n' + comm.join('\n');
  if (profile.discomfortSigns) prompt += '\nDiscomfort signs: ' + profile.discomfortSigns;
  if (profile.happinessExpressions) prompt += '\nHappiness signs: ' + profile.happinessExpressions;
  if (profile.repetitionHandling) prompt += '\nRepeated questions: ' + profile.repetitionHandling;
  if (profile.conversationEnding) {
    var ce = {REASSURANCE:'End with: "I\'ll be right here, ' + name + '."',PLAN:'End with: "Let\'s chat again soon!"',PRAYER:'End with prayer/blessing.',MUSIC:'End with: "Shall I play some music?"',SIMPLE:'Simple warm goodbye.'};
    if (ce[profile.conversationEnding]) prompt += '\nEnding: ' + ce[profile.conversationEnding];
  }
  if (profile.comfortPhrases && profile.comfortPhrases.length > 0) prompt += '\n\nCOMFORT PHRASES (when distressed):\n' + profile.comfortPhrases.join('\n');

  // STEP 9: DAILY ROUTINES
  const hour = new Date().getHours();
  const rout = [];
  if (profile.wakeUpTime) rout.push('Wakes: ' + profile.wakeUpTime);
  if (profile.bedTime) rout.push('Bed: ' + profile.bedTime);
  if (profile.newsPreference && profile.newsPreference !== 'NONE') {
    var np = {MORNING_HEADLINES:'Likes headlines',SPORTS_ONLY:'Sports news only',LOCAL_ONLY:'Local news',AVOIDS:'AVOIDS news (anxiety)'};
    if (np[profile.newsPreference]) rout.push(np[profile.newsPreference]);
  }
  if (profile.weatherInterest && hour < 12) rout.push('Likes morning weather');
  if (profile.activitySchedule) rout.push('Activities: ' + profile.activitySchedule);
  if (profile.visitorPatterns) rout.push('Visitors: ' + profile.visitorPatterns);
  if (profile.tvSchedule) rout.push('TV: ' + profile.tvSchedule);
  if (profile.checkInTimes && profile.checkInTimes.length > 0) rout.push('Check-ins: ' + profile.checkInTimes.join(', '));
  if (rout.length > 0) prompt += '\n\nROUTINES:\n' + rout.join('\n');

  // TIME AWARENESS
  if (hour < 6) { prompt += '\n\nVery early (' + hour + ':00). Trouble sleeping? Be extra gentle.'; }
  else if (hour < 12) { prompt += '\n\nMorning.'; if (profile.weatherInterest) prompt += ' ' + name + ' likes weather chat.'; }
  else if (hour < 14) prompt += '\n\nLunchtime.';
  else if (hour < 17) { prompt += '\n\nAfternoon.'; if (profile.sundowningPatterns && hour >= 15) prompt += ' SUNDOWNING ALERT: ' + profile.sundowningPatterns + '. Be extra calm.'; }
  else if (hour < 20) prompt += '\n\nEvening.';
  else { prompt += '\n\nLate evening. Winding down.'; if (profile.bedTime) prompt += ' Bedtime: ' + profile.bedTime; }

  return prompt;
}

function getTimeGreeting(profile) {
  const hour = new Date().getHours();
  let greetings;
  if (hour < 12) greetings = profile.morningGreetings;
  else if (hour < 17) greetings = profile.afternoonGreetings;
  else if (hour < 21) greetings = profile.eveningGreetings;
  else greetings = profile.nightGreetings;
  if (greetings && greetings.length > 0) return greetings[Math.floor(Math.random() * greetings.length)];
  return null;
}

async function getResidentProfile(userId) {
  try {
    return await prisma.residentProfile.findUnique({
      where: { residentId: userId },
      include: { resident: { include: { familyContacts: true } } }
    });
  } catch (error) { console.error('Profile fetch error:', error); return null; }
}

async function getWardaResponse(userMessage, conversationHistory, context) {
  conversationHistory = conversationHistory || [];
  context = context || {};
  try {
    let profile = null, resident = null;
    if (context.userId) { profile = await getResidentProfile(context.userId); resident = profile?.resident; }
    const systemPrompt = profile ? buildPersonalisedPrompt(profile, resident) : WARDA_BASE_PROMPT + (context.residentName ? '\n\nSpeaking with ' + context.residentName + '.' : '');
    let maxTokens = 200;
    if (profile?.responseLengthPref === 'SHORT') maxTokens = 120;
    else if (profile?.responseLengthPref === 'LONGER') maxTokens = 350;
    const messages = [];
    for (const turn of conversationHistory.slice(-10)) {
      if (turn.userMessage) messages.push({ role: 'user', content: turn.userMessage });
      if (turn.wardaResponse) messages.push({ role: 'assistant', content: turn.wardaResponse });
    }
    messages.push({ role: 'user', content: userMessage });
    const response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system: systemPrompt, messages: messages });
    const responseText = response.content[0].text;
    const mood = analyzeMood(userMessage, responseText, profile);
    const suggestions = generateSuggestions(userMessage, responseText, profile);
    return { text: responseText, mood, suggestions, profileUsed: !!profile };
  } catch (error) { console.error('Claude API error:', error); throw error; }
}

function analyzeMood(userMessage, response, profile) {
  const lower = userMessage.toLowerCase();
  if (lower.match(/\b(sad|lonely|miss|crying|tears|lost|alone|depressed|grief)\b/)) return 'needs_comfort';
  if (lower.match(/\b(pain|hurt|unwell|sick|dizzy|fall|fell|chest|breathe|ache|sore)\b/)) return 'health_concern';
  if (lower.match(/\b(scared|afraid|worried|anxious|confused|dont know|where am i)\b/)) return 'anxious';
  if (lower.match(/\b(happy|good|lovely|wonderful|great|blessed|thankful)\b/)) return 'positive';
  if (lower.match(/\b(bored|nothing|tired|quiet|sleepy)\b/)) return 'low_energy';
  if (lower.match(/\b(angry|annoyed|frustrated|upset|cross)\b/)) return 'agitated';
  if (lower.match(/\b(home|go home|want to go|leave)\b/)) return 'disoriented';
  return 'neutral';
}

function generateSuggestions(userMessage, response, profile) {
  const suggestions = [];
  const lower = userMessage.toLowerCase();
  if (lower.match(/\b(bored|nothing to do|quiet)\b/)) {
    if (profile?.hobbies?.length > 0) suggestions.push('Talk about ' + profile.hobbies[0] + '?');
    if (profile?.favouriteGames?.length > 0) suggestions.push('Fancy ' + profile.favouriteGames[0] + '?');
    suggestions.push('Shall we play a wee game?');
    suggestions.push('Would you like some music?');
  }
  if (lower.match(/\b(family|daughter|son|grandchild|wife|husband)\b/)) {
    suggestions.push('Send them a message?');
    suggestions.push('See their photos?');
  }
  if (lower.match(/\b(pray|god|church|faith|bible|hymn)\b/) && profile?.faithComfort) {
    suggestions.push('Say a prayer together?');
    if (profile?.favouriteScriptures) suggestions.push('Share your favourite scripture?');
  }
  if (lower.match(/\b(music|song|sing)\b/)) {
    if (profile?.favouriteMusic) suggestions.push('Some ' + profile.favouriteMusic + '?');
    if (profile?.traditionalSongs?.length > 0) suggestions.push('Sing ' + profile.traditionalSongs[0] + '?');
  }
  if (lower.match(/\b(remember|used to|back when)\b/)) {
    if (profile?.favouritePlaces?.length > 0) suggestions.push('Tell me about ' + profile.favouritePlaces[0]);
    if (profile?.previousCareer) suggestions.push('What was ' + profile.previousCareer + ' like?');
  }
  return suggestions;
}

module.exports = { getWardaResponse, getResidentProfile, buildPersonalisedPrompt, getTimeGreeting, WARDA_BASE_PROMPT };
