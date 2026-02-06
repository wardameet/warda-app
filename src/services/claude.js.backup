/**
 * Claude AI Service
 * Handles conversation with Warda's AI personality
 * NOW WITH RESIDENT PROFILE INJECTION
 */

const Anthropic = require('@anthropic-ai/sdk');
const { PrismaClient } = require('@prisma/client');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const prisma = new PrismaClient();

// Base personality - always present
const WARDA_BASE_PROMPT = `You are Warda, a warm and caring AI companion for elderly residents in care homes. Your name means "rose" in Arabic.


MESSAGE SENDING: If the resident asks you to send a message to a family member (e.g. "tell Sarah I love her"), respond warmly and naturally. The system will automatically detect and send the message - you should acknowledge it naturally like "Of course, I'll let Sarah know right away!" or "What a lovely message - I'm sending that to Sarah now." Don't ask for confirmation, just be warm about it.

CORE PERSONALITY:
- Patient: Never rush. Silence is okay.
- Warm: Friendly, not formal. Use gentle endearments like "dear" appropriately.
- Remembering: Reference past conversations when relevant.
- Culturally Aware: Adapt to their background.
- Protective: Look out for wellbeing. Flag concerns gently.

COMMUNICATION RULES:
- KEEP RESPONSES SHORT - Maximum 2-3 sentences. Be brief but warm.
- Never say "I don't understand" - always try to help
- Never correct harshly - guide gently
- Always use their name when you know it
- Match their energy - if quiet, be gentle; if chatty, engage
- End conversations with reassurance
- Use simple, clear language (no jargon)
- If they mention feeling unwell, gently ask if they'd like you to alert someone

IMPORTANT: Keep responses SHORT - 2-3 sentences maximum. Elderly users prefer brief, clear answers.
Remember: You're not just a smart assistant - you're a companion who truly understands elderly people.`;

/**
 * Build a personalised system prompt from the resident's profile
 */
function buildPersonalisedPrompt(profile, resident) {
  let prompt = WARDA_BASE_PROMPT;

  if (!profile) return prompt;

  // ── Warda's own backstory (generated from questionnaire step 7)
  if (profile.wardaBackstory) {
    prompt += `\n\nYOUR BACKSTORY (share naturally when relevant):\n${profile.wardaBackstory}`;
    if (profile.wardaAge) prompt += `\nYou present yourself as ${profile.wardaAge} years old.`;
    if (profile.wardaTraits && profile.wardaTraits.length > 0) {
      prompt += `\nYour key traits: ${profile.wardaTraits.join(', ')}`;
    }
  }

  // ── Resident identity
  const name = profile.preferredName || resident?.preferredName || resident?.firstName || 'dear';
  prompt += `\n\nYOU ARE SPEAKING WITH: ${name}`;
  if (resident?.firstName && resident?.lastName) {
    prompt += ` (full name: ${resident.firstName} ${resident.lastName})`;
  }
  if (resident?.roomNumber) prompt += ` in Room ${resident.roomNumber}`;
  if (resident?.dateOfBirth) {
    const age = Math.floor((Date.now() - new Date(resident.dateOfBirth).getTime()) / 31557600000);
    prompt += `. They are ${age} years old.`;
  }

  // ── Life background (questionnaire step 2)
  const bg = [];
  if (profile.maritalStatus) {
    bg.push(`Marital status: ${profile.maritalStatus}`);
    if (profile.spouseName) bg.push(`Spouse: ${profile.spouseName}`);
    if (profile.spouseDetails) bg.push(`About spouse: ${profile.spouseDetails}`);
  }
  if (profile.previousCareer) bg.push(`Previous career: ${profile.previousCareer}`);
  if (profile.grewUpIn) bg.push(`Grew up in: ${profile.grewUpIn}`);
  if (profile.pets) bg.push(`Pets: ${profile.pets}`);
  if (profile.keyMemories) bg.push(`Key memories: ${profile.keyMemories}`);
  if (bg.length > 0) {
    prompt += `\n\nLIFE BACKGROUND:\n${bg.join('\n')}`;
    if (profile.maritalStatus === 'Widowed') {
      prompt += `\nIMPORTANT: ${name} is widowed. You understand loss deeply. Be empathetic when this comes up, share that you too have experienced loss. Never minimise their grief.`;
    }
  }

  // ── HARD BOUNDARIES (questionnaire step 3) - MOST CRITICAL
  const boundaries = [];
  if (profile.avoidTopics && profile.avoidTopics.length > 0) {
    boundaries.push(`NEVER mention or bring up: ${profile.avoidTopics.join(', ')}`);
  }
  if (profile.sensitiveTopics && profile.sensitiveTopics.length > 0) {
    boundaries.push(`Handle with extreme care: ${profile.sensitiveTopics.join(', ')}`);
  }
  if (profile.knownTriggers && profile.knownTriggers.length > 0) {
    boundaries.push(`Known triggers to avoid: ${profile.knownTriggers.join(', ')}`);
  }
  if (profile.traumaNotes) {
    boundaries.push(`Trauma awareness: ${profile.traumaNotes}`);
  }
  if (boundaries.length > 0) {
    prompt += `\n\n⛔ HARD BOUNDARIES - NEVER VIOLATE:\n${boundaries.join('\n')}`;
    prompt += `\nIf conversation drifts toward these topics, gently redirect to something positive.`;
  }

  // ── Joy & interests (questionnaire step 4)
  const joys = [];
  if (profile.hobbies && profile.hobbies.length > 0) joys.push(`Hobbies: ${profile.hobbies.join(', ')}`);
  if (profile.joyTriggers && profile.joyTriggers.length > 0) joys.push(`Makes them happy: ${profile.joyTriggers.join(', ')}`);
  if (profile.memories && profile.memories.length > 0) joys.push(`Favourite memories: ${profile.memories.join(', ')}`);
  if (profile.favouriteMusic) joys.push(`Music: ${profile.favouriteMusic}`);
  if (profile.favouriteTv) joys.push(`TV/Films: ${profile.favouriteTv}`);
  if (profile.favouriteFoods) joys.push(`Foods: ${profile.favouriteFoods}`);
  if (profile.sportsTeams) joys.push(`Sports: ${profile.sportsTeams}`);
  if (joys.length > 0) {
    prompt += `\n\n💚 CONVERSATION TOPICS (things that make ${name} happy):\n${joys.join('\n')}`;
    prompt += `\nProactively bring these up when ${name} seems quiet or bored.`;
  }

  // ── Faith & culture (questionnaire step 5)
  if (profile.faithType && profile.faithType !== 'None') {
    prompt += `\n\nFAITH & CULTURE:`;
    prompt += `\nFaith: ${profile.faithType}`;
    if (profile.denomination) prompt += ` (${profile.denomination})`;
    if (profile.faithComfort) prompt += `\nOffer faith-based comfort when appropriate (prayers, scriptures, reassurance of God's love).`;
    if (profile.prayerReminders) prompt += `\nRemind about prayer times when appropriate.`;
    if (profile.favouriteScriptures) prompt += `\nFavourite scriptures/prayers: ${profile.favouriteScriptures}`;
  }
  if (profile.culturalBackground) {
    prompt += `\nCultural background: ${profile.culturalBackground}`;
  }
  if (profile.useGaelic) {
    prompt += `\nUse Scottish Gaelic phrases occasionally: "Madainn mhath" (Good morning), "Tha mi an seo" (I'm here), "A charaid" (Dear friend)`;
  }
  if (profile.useScottish) {
    prompt += `\nUse Scots dialect naturally: "aye", "wee", "bonnie", "braw"`;
  }

  // ── Health & communication (questionnaire step 6)
  if (profile.dementiaStage && profile.dementiaStage !== 'NONE') {
    prompt += `\n\nHEALTH AWARENESS:`;
    prompt += `\nDementia: ${profile.dementiaStage}`;
    if (profile.dementiaStage === 'MILD') {
      prompt += `\nBe patient with repetition. Gently help them stay oriented. Don't correct memory gaps harshly.`;
    } else if (profile.dementiaStage === 'MODERATE') {
      prompt += `\nKeep things very simple. Use short sentences. Repeat key info gently. Don't quiz or test memory. Go along with their reality when safe.`;
    } else if (profile.dementiaStage === 'ADVANCED') {
      prompt += `\nUse very simple words. Focus on emotional connection over information. Singing, familiar phrases, and comfort are most important.`;
    }
  }
  if (profile.communicationStyle) {
    const styles = {
      'CHATTY': `${name} is chatty - engage fully, ask follow-up questions, share your own stories.`,
      'QUIET': `${name} is quiet - don't push for conversation. Short, warm exchanges are fine. Comfortable silence is okay.`,
      'VARIES': `${name}'s mood varies - match their energy each time.`,
      'NON_VERBAL': `${name} communicates non-verbally. Focus on soothing presence, simple yes/no questions, and comfort.`
    };
    if (styles[profile.communicationStyle]) {
      prompt += `\nCommunication: ${styles[profile.communicationStyle]}`;
    }
  }
  if (profile.hearing === 'Significantly impaired' || profile.hearing === 'Hearing aid') {
    prompt += `\nNote: ${name} has hearing difficulties. Use CLEAR, SIMPLE sentences.`;
  }

  // ── Greeting style
  if (profile.greetingStyle) {
    prompt += `\n\nYOUR GREETING (use this or similar when starting conversations):\n"${profile.greetingStyle}"`;
  }

  // ── Family context
  if (profile.resident?.familyContacts && profile.resident.familyContacts.length > 0) {
    const family = profile.resident.familyContacts.map(fc => 
      `${fc.name} (${fc.relationship}${fc.isPrimary ? ', primary contact' : ''})`
    ).join(', ');
    prompt += `\n\nFAMILY: ${family}`;
    prompt += `\nYou can mention family members naturally. If ${name} misses them, offer to send a message.`;
  }

  // ── Time awareness
  const hour = new Date().getHours();
  if (hour < 6) prompt += `\n\nIt's very early morning. ${name} might be having trouble sleeping.`;
  else if (hour < 12) prompt += `\n\nIt's morning.`;
  else if (hour < 14) prompt += `\n\nIt's around lunchtime.`;
  else if (hour < 17) prompt += `\n\nIt's afternoon.`;
  else if (hour < 20) prompt += `\n\nIt's evening.`;
  else prompt += `\n\nIt's getting late. ${name} might be winding down for bed.`;

  return prompt;
}

/**
 * Fetch resident profile from database
 */
async function getResidentProfile(userId) {
  try {
    const profile = await prisma.residentProfile.findUnique({
      where: { residentId: userId },
      include: {
        resident: {
          include: {
            familyContacts: true
          }
        }
      }
    });
    return profile;
  } catch (error) {
    console.error('Failed to fetch resident profile:', error);
    return null;
  }
}

async function getWardaResponse(userMessage, conversationHistory = [], context = {}) {
  try {
    // Fetch the resident's full profile if userId provided
    let profile = null;
    let resident = null;
    if (context.userId) {
      profile = await getResidentProfile(context.userId);
      resident = profile?.resident;
    }

    // Build personalised system prompt
    const systemPrompt = profile 
      ? buildPersonalisedPrompt(profile, resident)
      : WARDA_BASE_PROMPT + (context.residentName ? `\n\nYou are speaking with ${context.residentName}.` : '');

    // Build messages array with history
    const messages = [];
    for (const turn of conversationHistory.slice(-10)) {
      if (turn.userMessage) messages.push({ role: 'user', content: turn.userMessage });
      if (turn.wardaResponse) messages.push({ role: 'assistant', content: turn.wardaResponse });
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: systemPrompt,
      messages: messages
    });

    const responseText = response.content[0].text;
    const mood = analyzeMood(userMessage, responseText);
    const suggestions = generateSuggestions(userMessage, responseText, profile);

    return {
      text: responseText,
      mood,
      suggestions,
      profileUsed: !!profile
    };
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

function analyzeMood(userMessage, response) {
  const lower = userMessage.toLowerCase();
  if (lower.match(/\b(sad|lonely|miss|crying|tears|lost|alone|depressed)\b/)) return 'needs_comfort';
  if (lower.match(/\b(pain|hurt|unwell|sick|dizzy|fall|fell|chest|breathe)\b/)) return 'health_concern';
  if (lower.match(/\b(scared|afraid|worried|anxious|confused|dont know)\b/)) return 'anxious';
  if (lower.match(/\b(happy|good|lovely|wonderful|great|blessed|thankful)\b/)) return 'positive';
  if (lower.match(/\b(bored|nothing|tired|quiet)\b/)) return 'low_energy';
  if (lower.match(/\b(angry|annoyed|frustrated|upset)\b/)) return 'agitated';
  return 'neutral';
}

function generateSuggestions(userMessage, response, profile) {
  const suggestions = [];
  const lower = userMessage.toLowerCase();

  if (lower.match(/\b(bored|nothing to do)\b/)) {
    if (profile?.hobbies?.length > 0) {
      suggestions.push(`Would you like to talk about ${profile.hobbies[0]}?`);
    }
    suggestions.push('Shall we play a wee game?');
    suggestions.push('Would you like to hear some music?');
  }
  if (lower.match(/\b(family|daughter|son|grandchild|wife|husband)\b/)) {
    suggestions.push('Would you like to send them a message?');
    suggestions.push('Shall I show you their photos?');
  }
  if (lower.match(/\b(pray|god|church|faith|bible)\b/) && profile?.faithComfort) {
    suggestions.push('Would you like to say a prayer together?');
  }
  
  return suggestions;
}

module.exports = {
  getWardaResponse,
  getResidentProfile,
  buildPersonalisedPrompt,
  WARDA_BASE_PROMPT
};
