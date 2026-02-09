// ═══════════════════════════════════════
// 🌍 Warda Translation Service
// Supports: Arabic, French, Spanish, Urdu, Hindi + English
// Uses AWS Translate for real-time translation
// ═══════════════════════════════════════

const { TranslateClient, TranslateTextCommand, ListLanguagesCommand } = require('@aws-sdk/client-translate');

const translateClient = new TranslateClient({ region: process.env.AWS_REGION || 'eu-west-2' });

// Supported languages with AWS codes and display names
const SUPPORTED_LANGUAGES = {
  'English':  { code: 'en', direction: 'ltr', nativeName: 'English',   greeting: 'Hello' },
  'Arabic':   { code: 'ar', direction: 'rtl', nativeName: 'العربية',    greeting: 'مرحبا' },
  'French':   { code: 'fr', direction: 'ltr', nativeName: 'Français',   greeting: 'Bonjour' },
  'Spanish':  { code: 'es', direction: 'ltr', nativeName: 'Español',    greeting: 'Hola' },
  'Urdu':     { code: 'ur', direction: 'rtl', nativeName: 'اردو',       greeting: 'سلام' },
  'Hindi':    { code: 'hi', direction: 'ltr', nativeName: 'हिन्दी',       greeting: 'नमस्ते' },
  'Welsh':    { code: 'cy', direction: 'ltr', nativeName: 'Cymraeg',    greeting: 'Bore da' },
  'Scottish Gaelic': { code: 'gd', direction: 'ltr', nativeName: 'Gàidhlig', greeting: 'Madainn mhath', useClaude: true }
};

/**
 * Translate text from one language to another
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language name (e.g. 'Arabic', 'French')
 * @param {string} sourceLang - Source language name (default: 'English')
 * @returns {Promise<{translatedText: string, sourceLanguage: string, targetLanguage: string}>}
 */
async function translateText(text, targetLang, sourceLang = 'English') {
  try {
    // If same language or target not supported, return original
    if (targetLang === sourceLang || !SUPPORTED_LANGUAGES[targetLang]) {
      return { translatedText: text, sourceLanguage: sourceLang, targetLanguage: targetLang };
    }

    const sourceCode = SUPPORTED_LANGUAGES[sourceLang]?.code || 'en';
    const targetCode = SUPPORTED_LANGUAGES[targetLang]?.code;

    if (!targetCode) {
      console.warn(`Unsupported target language: ${targetLang}`);
      return { translatedText: text, sourceLanguage: sourceLang, targetLanguage: targetLang };
    }

    const command = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceCode,
      TargetLanguageCode: targetCode
    });

    const response = await translateClient.send(command);
    
    return {
      translatedText: response.TranslatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      sourceCode,
      targetCode
    };
  } catch (error) {
    // If AWS Translate fails (e.g. Scottish Gaelic), try Claude fallback
    if (SUPPORTED_LANGUAGES[targetLang]?.useClaude) {
      try {
        const claudeFallback = await translateWithClaude(text, targetLang, sourceLang);
        return claudeFallback;
      } catch (cErr) {
        console.error('Claude translation fallback also failed:', cErr.message);
      }
    }
    console.error('Translation error:', error.message);
    return { translatedText: text, sourceLanguage: sourceLang, targetLanguage: targetLang, error: error.message };
  }
}

/**
 * Translate Warda's response to the resident's preferred language
 * Used in the conversation engine after Claude generates a response
 * @param {string} wardaResponse - Warda's response in English
 * @param {object} residentProfile - Resident profile with languagePreference
 * @returns {Promise<{original: string, translated: string, language: string, direction: string}>}
 */
async function translateWardaResponse(wardaResponse, residentProfile) {
  const preferredLang = residentProfile?.languagePreference || 'English';
  
  if (preferredLang === 'English') {
    return {
      original: wardaResponse,
      translated: wardaResponse,
      language: 'English',
      direction: 'ltr'
    };
  }

  const result = await translateText(wardaResponse, preferredLang);
  const langInfo = SUPPORTED_LANGUAGES[preferredLang] || {};

  return {
    original: wardaResponse,
    translated: result.translatedText,
    language: preferredLang,
    direction: langInfo.direction || 'ltr',
    nativeName: langInfo.nativeName
  };
}

/**
 * Translate incoming resident speech/text to English for Claude
 * @param {string} residentText - Text in resident's language
 * @param {string} sourceLang - Source language name
 * @returns {Promise<{original: string, english: string}>}
 */
async function translateToEnglish(residentText, sourceLang) {
  if (sourceLang === 'English' || !sourceLang) {
    return { original: residentText, english: residentText };
  }

  const result = await translateText(residentText, 'English', sourceLang);
  return {
    original: residentText,
    english: result.translatedText
  };
}

/**
 * Translate a family message for the resident
 * @param {string} message - Family message
 * @param {string} fromLang - Family member's language
 * @param {string} toLang - Resident's preferred language
 * @returns {Promise<{original: string, translated: string}>}
 */
async function translateFamilyMessage(message, fromLang = 'English', toLang = 'English') {
  if (fromLang === toLang) {
    return { original: message, translated: message };
  }

  const result = await translateText(message, toLang, fromLang);
  return {
    original: message,
    translated: result.translatedText
  };
}

/**
 * Get greeting in resident's preferred language
 * @param {string} language - Language name
 * @returns {string}
 */
function getGreeting(language) {
  return SUPPORTED_LANGUAGES[language]?.greeting || 'Hello';
}

/**
 * Get text direction for a language (for UI rendering)
 * @param {string} language - Language name
 * @returns {string} 'ltr' or 'rtl'
 */
function getTextDirection(language) {
  return SUPPORTED_LANGUAGES[language]?.direction || 'ltr';
}

/**
 * Fallback translation using Claude for languages not supported by AWS Translate
 * Currently used for Scottish Gaelic
 */
async function translateWithClaude(text, targetLang, sourceLang) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a translator. Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translated text, nothing else.`,
      messages: [{ role: 'user', content: text }]
    });
    return {
      translatedText: response.content[0].text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      method: 'claude'
    };
  } catch (error) {
    throw new Error('Claude translation failed: ' + error.message);
  }
}

module.exports = {
  translateText,
  translateWardaResponse,
  translateToEnglish,
  translateFamilyMessage,
  getGreeting,
  getTextDirection,
  SUPPORTED_LANGUAGES
};
