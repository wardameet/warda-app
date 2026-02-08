/**
 * Reminiscence & Life Story Service
 * P1 Item 9: Reminiscence & Life Story
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STORY_TRIGGERS = [
  /I\s+(used\s+to|remember|recall|once|back\s+in|when\s+I\s+was|in\s+my\s+day)/i,
  /\b(my\s+(late\s+)?(husband|wife|mother|father|dad|mum|brother|sister|son|daughter))\s+(used\s+to|always|would|loved)/i,
  /\b(during\s+the\s+war|after\s+the\s+war|in\s+the\s+(\d{2}s|\d{4}s?))\b/i,
  /\b(when\s+I\s+(worked|lived|moved|married|retired|started|grew\s+up))\b/i,
  /\b(my\s+first\s+(job|car|house|baby|dance|kiss|day\s+at))\b/i,
  /\b(the\s+old\s+(days|times|house|school|neighbourhood|street))\b/i,
  /\b(I\s+grew\s+up\s+in|we\s+lived\s+in|born\s+in|raised\s+in)\b/i,
];

function getSeasonalTopics() {
  const now = new Date();
  const month = now.getMonth();
  const seasonal = {
    0: ['New Year memories', 'winter weather when you were young', 'Burns Night celebrations'],
    1: ['Valentine memories', 'winter activities', 'pancake day traditions'],
    2: ['spring flowers', 'Mother Day memories', 'spring cleaning traditions'],
    3: ['Easter memories', 'spring outings', 'gardening memories'],
    4: ['summer plans when young', 'May Day celebrations', 'end of school year'],
    5: ['Father Day', 'summer holidays', 'longest day of the year'],
    6: ['summer holidays', 'childhood trips', 'seaside memories', 'picking berries'],
    7: ['summer memories', 'harvest time', 'back to school memories'],
    8: ['autumn colours', 'harvest festival', 'start of school memories'],
    9: ['Halloween memories', 'autumn walks', 'conker games'],
    10: ['Bonfire Night', 'Remembrance Day', 'early Christmas plans'],
    11: ['Christmas memories', 'winter traditions', 'Hogmanay'],
  };
  return seasonal[month] || ['your favourite memories'];
}

function getTimeBasedTopics(hour) {
  if (hour >= 6 && hour < 10) return ['What did breakfasts used to look like', 'Morning routines when you were working'];
  if (hour >= 10 && hour < 12) return ['What you used to do on mornings like this', 'Morning walks or errands'];
  if (hour >= 12 && hour < 14) return ['Favourite meals', 'Sunday dinners', 'Cooking memories'];
  if (hour >= 14 && hour < 17) return ['Afternoon tea traditions', 'Hobbies and pastimes'];
  if (hour >= 17 && hour < 20) return ['Evening routines', 'TV programmes from back in the day'];
  if (hour >= 20) return ['Bedtime stories from childhood', 'Evening walks'];
  return [];
}

function detectStory(userMessage) {
  for (const pattern of STORY_TRIGGERS) {
    if (pattern.test(userMessage)) return true;
  }
  return false;
}

function extractStoryTags(message) {
  const tags = [];
  const lower = message.toLowerCase();
  const eraMatch = lower.match(/\b(19\d{2}|20\d{2})\b/) || lower.match(/\b(the\s+)?(forties|fifties|sixties|seventies|eighties|nineties)\b/);
  if (eraMatch) tags.push('era:' + eraMatch[0].trim());
  if (lower.match(/\b(husband|wife|spouse|partner)\b/)) tags.push('family:spouse');
  if (lower.match(/\b(mother|mum|mam|mammy|ma)\b/)) tags.push('family:mother');
  if (lower.match(/\b(father|dad|daddy|da|papa)\b/)) tags.push('family:father');
  if (lower.match(/\b(son|daughter|child|children|kids|wee\s+ones|bairns)\b/)) tags.push('family:children');
  if (lower.match(/\b(brother|sister|sibling)\b/)) tags.push('family:sibling');
  if (lower.match(/\b(grandchild|grandchildren|grandkids|grandson|granddaughter)\b/)) tags.push('family:grandchildren');
  if (lower.match(/\b(work|job|career|office|factory|shop|nurse|teacher|builder)\b/)) tags.push('topic:work');
  if (lower.match(/\b(school|university|college|class|teacher|exam)\b/)) tags.push('topic:education');
  if (lower.match(/\b(war|army|navy|airforce|military|service)\b/)) tags.push('topic:military');
  if (lower.match(/\b(wedding|married|marriage|honeymoon|engagement)\b/)) tags.push('topic:marriage');
  if (lower.match(/\b(holiday|vacation|trip|travel|abroad|seaside|camping)\b/)) tags.push('topic:travel');
  if (lower.match(/\b(cook|bake|recipe|kitchen|dinner|meal|food)\b/)) tags.push('topic:food');
  if (lower.match(/\b(garden|flowers|plants|allotment|growing)\b/)) tags.push('topic:garden');
  if (lower.match(/\b(church|chapel|mosque|temple|faith|pray|minister|priest|imam)\b/)) tags.push('topic:faith');
  if (lower.match(/\b(music|dancing|sing|songs|band|concert|piano)\b/)) tags.push('topic:music');
  if (lower.match(/\b(football|cricket|rugby|tennis|swimming|sport|team)\b/)) tags.push('topic:sport');
  return tags;
}

async function storeLifeStory(userId, userMessage, wardaResponse) {
  try {
    if (!detectStory(userMessage)) return null;
    const tags = extractStoryTags(userMessage);
    const entry = await prisma.healthLog.create({
      data: {
        userId, type: 'LIFE_STORY', value: 'story_captured',
        notes: JSON.stringify({
          residentSaid: (userMessage || "").substring(0, 500),
          wardaResponse: !wardaResponse ? "" : typeof wardaResponse === "string" ? wardaResponse.substring(0, 300) : JSON.stringify(wardaResponse).substring(0, 300),
          tags, capturedAt: new Date().toISOString()
        }),
        recordedBy: 'warda-ai'
      }
    });
    console.log('Life story captured for ' + userId + ': ' + tags.join(', '));
    return entry;
  } catch (err) {
    console.error('Error storing life story:', err);
    return null;
  }
}

async function getLifeStories(userId, options = {}) {
  try {
    const where = { userId, type: 'LIFE_STORY' };
    if (options.tag) where.notes = { contains: options.tag };
    const stories = await prisma.healthLog.findMany({
      where, orderBy: { createdAt: 'desc' }, take: options.limit || 50
    });
    return stories.map(s => {
      const notes = s.notes ? JSON.parse(s.notes) : {};
      return {
        id: s.id, story: notes.residentSaid, wardaResponse: notes.wardaResponse,
        tags: notes.tags || [], capturedAt: notes.capturedAt || s.createdAt
      };
    });
  } catch (err) {
    console.error('Error getting life stories:', err);
    return [];
  }
}

async function generateReminiscencePrompt(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }, include: { profile: true }
    });
    if (!user) return null;
    const firstName = user.firstName || 'dear';
    const profile = user.profile;
    const hour = new Date().getHours();
    const pastStories = await getLifeStories(userId, { limit: 10 });
    if (pastStories.length > 0) {
      const story = pastStories[Math.floor(Math.random() * pastStories.length)];
      const tags = story.tags || [];
      const topicTag = tags.find(t => t.startsWith('topic:'));
      if (topicTag) {
        const topic = topicTag.split(':')[1];
        const followUps = {
          work: 'You told me about your work before, ' + firstName + '. What was the best part of your job?',
          education: 'I remember you mentioned school, ' + firstName + '. Who was your favourite teacher?',
          marriage: 'You shared such lovely memories about your wedding, ' + firstName + '. What was the music like?',
          travel: 'You mentioned travelling before, ' + firstName + '. Where was the best place you ever visited?',
          food: 'You told me about cooking, ' + firstName + '. What is your signature dish that everyone loved?',
          military: 'You mentioned your time in service, ' + firstName + '. What is a moment you will never forget?',
          music: 'I know you love music, ' + firstName + '. What song takes you right back to a special time?',
          garden: 'You mentioned your garden, ' + firstName + '. What flowers did you love growing most?',
          faith: 'You shared your faith with me, ' + firstName + '. What hymn or prayer means the most to you?',
          sport: 'I remember you talking about sports, ' + firstName + '. What is the best match you ever saw?'
        };
        if (followUps[topic]) return { prompt: followUps[topic], type: 'follow_up', basedOn: story.id };
      }
    }
    if (profile) {
      const prompts = [];
      const step1 = profile.step1Data;
      if (step1 && typeof step1 === 'object') {
        if (step1.birthplace) prompts.push(firstName + ', what was it like growing up in ' + step1.birthplace + '? I would love to hear about it.');
        if (step1.occupation || step1.previousOccupation) {
          const job = step1.occupation || step1.previousOccupation;
          prompts.push('Tell me about your time working as a ' + job + ', ' + firstName + '. What was a typical day like?');
        }
      }
      const step3 = profile.step3Data;
      if (step3 && typeof step3 === 'object' && step3.hobbies && Array.isArray(step3.hobbies)) {
        const hobby = step3.hobbies[Math.floor(Math.random() * step3.hobbies.length)];
        prompts.push('I know you enjoy ' + hobby + ', ' + firstName + '. How did you first get into that?');
      }
      if (prompts.length > 0) {
        return { prompt: prompts[Math.floor(Math.random() * prompts.length)], type: 'questionnaire_driven' };
      }
    }
    const seasonalTopics = getSeasonalTopics();
    const timeTopics = getTimeBasedTopics(hour);
    const allTopics = [...seasonalTopics, ...timeTopics];
    if (allTopics.length > 0) {
      const topic = allTopics[Math.floor(Math.random() * allTopics.length)];
      return { prompt: firstName + ', I was thinking about ' + topic + '. Do you have any memories of that?', type: 'seasonal' };
    }
    const generalPrompts = [
      firstName + ', what is a memory that always makes you smile?',
      'Tell me about something you are proud of, ' + firstName + '.',
      firstName + ', what was the happiest time of your life?',
      'Is there a place you have lived that you think about often, ' + firstName + '?',
    ];
    return { prompt: generalPrompts[Math.floor(Math.random() * generalPrompts.length)], type: 'general' };
  } catch (err) {
    console.error('Error generating reminiscence prompt:', err);
    return null;
  }
}

async function getLifeStoryContext(userId, maxEntries = 5) {
  try {
    const stories = await getLifeStories(userId, { limit: maxEntries });
    if (stories.length === 0) return '';
    let context = '\n\nPrevious life stories shared by this resident:\n';
    stories.forEach((s, i) => {
      context += '- ' + (s.story?.substring(0, 150) || 'Story recorded') + ' [Tags: ' + (s.tags || []).join(', ') + ']\n';
    });
    context += '\nYou can reference these stories naturally in conversation to show you remember and care.\n';
    return context;
  } catch (err) {
    console.error('Error building life story context:', err);
    return '';
  }
}

module.exports = {
  detectStory, extractStoryTags, storeLifeStory, getLifeStories,
  generateReminiscencePrompt, getLifeStoryContext, getSeasonalTopics, getTimeBasedTopics
};
