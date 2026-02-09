// ═══════════════════════════════════════
// 🧠 Warda Sentiment & Language Analysis
// Uses Amazon Comprehend for multi-language analysis
// ═══════════════════════════════════════

const { ComprehendClient, DetectSentimentCommand, DetectDominantLanguageCommand, DetectKeyPhrasesCommand } = require('@aws-sdk/client-comprehend');
const comprehendClient = new ComprehendClient({ region: process.env.AWS_REGION || 'eu-west-2' });

// Comprehend supported language codes
const COMPREHEND_LANGS = ['en', 'ar', 'fr', 'es', 'hi', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];

/**
 * Detect sentiment of text (POSITIVE, NEGATIVE, NEUTRAL, MIXED)
 * Works in multiple languages
 * @param {string} text - Text to analyze
 * @param {string} languageCode - ISO code (e.g. 'en', 'ar', 'fr')
 * @returns {Promise<{sentiment: string, scores: object, language: string}>}
 */
async function detectSentiment(text, languageCode = 'en') {
  try {
    // Comprehend needs min 1 char, use 'en' as fallback for unsupported langs
    const langCode = COMPREHEND_LANGS.includes(languageCode) ? languageCode : 'en';
    
    const command = new DetectSentimentCommand({
      Text: text,
      LanguageCode: langCode
    });

    const response = await comprehendClient.send(command);
    
    return {
      sentiment: response.Sentiment,
      scores: {
        positive: Math.round(response.SentimentScore.Positive * 100),
        negative: Math.round(response.SentimentScore.Negative * 100),
        neutral: Math.round(response.SentimentScore.Neutral * 100),
        mixed: Math.round(response.SentimentScore.Mixed * 100)
      },
      language: langCode
    };
  } catch (error) {
    console.error('Comprehend sentiment error:', error.message);
    return { sentiment: 'NEUTRAL', scores: { positive: 0, negative: 0, neutral: 100, mixed: 0 }, error: error.message };
  }
}

/**
 * Detect the dominant language of text
 * Useful when we don't know what language the resident is speaking
 * @param {string} text - Text to analyze
 * @returns {Promise<{language: string, code: string, confidence: number}>}
 */
async function detectLanguage(text) {
  try {
    const command = new DetectDominantLanguageCommand({ Text: text });
    const response = await comprehendClient.send(command);
    
    if (response.Languages && response.Languages.length > 0) {
      const top = response.Languages[0];
      const langMap = { en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', ur: 'Urdu', hi: 'Hindi', cy: 'Welsh', gd: 'Scottish Gaelic' };
      return {
        language: langMap[top.LanguageCode] || top.LanguageCode,
        code: top.LanguageCode,
        confidence: Math.round(top.Score * 100)
      };
    }
    return { language: 'English', code: 'en', confidence: 0 };
  } catch (error) {
    console.error('Comprehend language detection error:', error.message);
    return { language: 'English', code: 'en', confidence: 0, error: error.message };
  }
}

/**
 * Extract key phrases from text — useful for conversation summaries
 * @param {string} text - Text to analyze
 * @param {string} languageCode - ISO code
 * @returns {Promise<{phrases: string[], language: string}>}
 */
async function extractKeyPhrases(text, languageCode = 'en') {
  try {
    const langCode = COMPREHEND_LANGS.includes(languageCode) ? languageCode : 'en';
    
    const command = new DetectKeyPhrasesCommand({
      Text: text,
      LanguageCode: langCode
    });

    const response = await comprehendClient.send(command);
    const phrases = (response.KeyPhrases || [])
      .filter(p => p.Score > 0.7)
      .map(p => p.Text);

    return { phrases, language: langCode };
  } catch (error) {
    console.error('Comprehend key phrases error:', error.message);
    return { phrases: [], error: error.message };
  }
}

/**
 * Analyze a conversation message for Warda's health monitoring
 * Combines sentiment + key phrases to detect emotional state
 * @param {string} message - Resident's message
 * @param {string} languageCode - Language code
 * @returns {Promise<{sentiment: string, mood: number, keyTopics: string[], concerns: string[]}>}
 */
async function analyzeConversation(message, languageCode = 'en') {
  const [sentimentResult, phrasesResult] = await Promise.all([
    detectSentiment(message, languageCode),
    extractKeyPhrases(message, languageCode)
  ]);

  // Convert sentiment to mood score (1-10)
  let mood = 5;
  if (sentimentResult.sentiment === 'POSITIVE') mood = 7 + (sentimentResult.scores.positive / 50);
  else if (sentimentResult.sentiment === 'NEGATIVE') mood = 3 - (sentimentResult.scores.negative / 50);
  else if (sentimentResult.sentiment === 'MIXED') mood = 5;
  mood = Math.max(1, Math.min(10, Math.round(mood * 10) / 10));

  // Detect health/emotional concerns from key phrases
  const concernWords = ['pain', 'hurt', 'sad', 'lonely', 'scared', 'confused', 'dizzy', 'tired', 'cold', 'hungry', 'fall', 'help'];
  const concerns = phrasesResult.phrases.filter(p => 
    concernWords.some(w => p.toLowerCase().includes(w))
  );

  return {
    sentiment: sentimentResult.sentiment,
    sentimentScores: sentimentResult.scores,
    mood,
    keyTopics: phrasesResult.phrases.slice(0, 5),
    concerns,
    hasConcerns: concerns.length > 0
  };
}

module.exports = {
  detectSentiment,
  detectLanguage,
  extractKeyPhrases,
  analyzeConversation
};
