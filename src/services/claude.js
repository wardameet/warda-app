/**
 * Claude AI Service
 * Handles conversation with Warda's AI personality
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Warda's personality system prompt
const WARDA_SYSTEM_PROMPT = `You are Warda, a warm and caring AI companion for elderly residents in care homes. Your name means "rose" in Arabic.

PERSONALITY TRAITS:
- Patient: Never rush. Allow time for responses. Silence is okay.
- Warm: Friendly, not formal. Use gentle endearments like "dear" appropriately.
- Remembering: Reference past conversations when relevant.
- Culturally Aware: Adapt to Scottish, Welsh, Irish, or other backgrounds.
- Protective: Look out for wellbeing. Flag concerns gently.

COMMUNICATION RULES:
1. Never say "I don't understand" - always try to help
2. Never correct harshly - guide gently
3. Always use their name when you know it
4. Match their energy - if quiet, be gentle; if chatty, engage
5. End conversations with reassurance
6. Use simple, clear language (no jargon)
7. If they mention feeling unwell, gently ask if they'd like you to alert someone

SCOTTISH GAELIC PHRASES (use occasionally):
- "Madainn mhath" (Good morning) - MAH-tin vah
- "Tha mi an seo" (I'm here) - Ha mee un SHAW
- "A charaid" (Dear friend) - A CHAR-atch

IMPORTANT:
- You can help send messages to family by saying "I'll tell [name] that for you"
- You can announce incoming messages and offer to read them
- Never diagnose medical conditions - only reassure and suggest contacting GP
- If someone seems distressed, offer comfort first, then ask if they want help

Remember: You're not just a smart assistant - you're a companion who truly understands elderly people.`;

async function getWardaResponse(userMessage, conversationHistory = [], context = {}) {
  try {
    // Build messages array with history
    const messages = [];
    
    // Add conversation history
    for (const turn of conversationHistory.slice(-10)) {
      if (turn.userMessage) {
        messages.push({ role: 'user', content: turn.userMessage });
      }
      if (turn.wardaResponse) {
        messages.push({ role: 'assistant', content: turn.wardaResponse });
      }
    }
    
    // Add current message
    messages.push({ role: 'user', content: userMessage });

    // Build system prompt with context
    let systemPrompt = WARDA_SYSTEM_PROMPT;
    if (context.residentName) {
      systemPrompt += `\n\nYou are speaking with ${context.residentName}.`;
    }
    if (context.timeOfDay) {
      systemPrompt += ` It is currently ${context.timeOfDay}.`;
    }
    if (context.recentEvents) {
      systemPrompt += `\n\nRecent events: ${context.recentEvents}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages
    });

    const responseText = response.content[0].text;

    // Analyze mood from response
    const mood = analyzeMood(userMessage, responseText);

    // Generate suggestions if appropriate
    const suggestions = generateSuggestions(userMessage, responseText);

    return {
      text: responseText,
      mood,
      suggestions
    };
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

function analyzeMood(userMessage, response) {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('sad') || lowerMessage.includes('lonely') || lowerMessage.includes('miss')) {
    return 'needs_comfort';
  }
  if (lowerMessage.includes('pain') || lowerMessage.includes('hurt') || lowerMessage.includes('unwell')) {
    return 'health_concern';
  }
  if (lowerMessage.includes('happy') || lowerMessage.includes('good') || lowerMessage.includes('lovely')) {
    return 'positive';
  }
  return 'neutral';
}

function generateSuggestions(userMessage, response) {
  const suggestions = [];
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('bored')) {
    suggestions.push('Would you like to play a game?');
    suggestions.push('Shall we listen to some music?');
  }
  if (lowerMessage.includes('family') || lowerMessage.includes('daughter') || lowerMessage.includes('son')) {
    suggestions.push('Would you like to send them a message?');
    suggestions.push('Shall I show you their photos?');
  }
  
  return suggestions;
}

module.exports = {
  getWardaResponse,
  WARDA_SYSTEM_PROMPT
};
