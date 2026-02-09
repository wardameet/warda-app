// ═══════════════════════════════════════
// 🔊 Warda Text-to-Speech Service
// Multi-language voice output using Amazon Polly
// ═══════════════════════════════════════

const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'eu-west-2' });

// Voice mappings per language — Neural voices where available
const LANGUAGE_VOICES = {
  'English':  { voiceId: 'Amy',     engine: 'neural', code: 'en-GB' },
  'Arabic':   { voiceId: 'Zeina',   engine: 'standard', code: 'arb' },
  'French':   { voiceId: 'Lea',     engine: 'neural', code: 'fr-FR' },
  'Spanish':  { voiceId: 'Lucia',   engine: 'neural', code: 'es-ES' },
  'Urdu':     { voiceId: 'Zeina',   engine: 'standard', code: 'arb', fallback: true },
  'Hindi':    { voiceId: 'Kajal',   engine: 'neural', code: 'hi-IN' },
  'Welsh':    { voiceId: 'Gwyneth', engine: 'standard', code: 'cy-GB' },
  'Scottish Gaelic': { voiceId: 'Amy', engine: 'neural', code: 'en-GB', fallback: true }
};

/**
 * Convert text to speech audio
 * @param {string} text - Text to speak
 * @param {string} language - Language name (e.g. 'Arabic', 'French')
 * @param {object} options - Optional: { speed, volume }
 * @returns {Promise<{audioStream: Buffer, contentType: string, voiceId: string, language: string}>}
 */
async function textToSpeech(text, language = 'English', options = {}) {
  try {
    const voiceConfig = LANGUAGE_VOICES[language] || LANGUAGE_VOICES['English'];
    
    // For elderly users, slightly slower speech rate
    const speed = options.speed || 'slow';
    let ssmlText = text;
    if (speed === 'slow') {
      ssmlText = `<speak><prosody rate="90%">${escapeXml(text)}</prosody></speak>`;
    } else if (speed === 'very-slow') {
      ssmlText = `<speak><prosody rate="75%">${escapeXml(text)}</prosody></speak>`;
    } else {
      ssmlText = `<speak>${escapeXml(text)}</speak>`;
    }

    const command = new SynthesizeSpeechCommand({
      Text: ssmlText,
      TextType: 'ssml',
      OutputFormat: 'mp3',
      VoiceId: voiceConfig.voiceId,
      Engine: voiceConfig.engine,
      LanguageCode: voiceConfig.code
    });

    const response = await pollyClient.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    return {
      audioBuffer,
      contentType: 'audio/mpeg',
      voiceId: voiceConfig.voiceId,
      language,
      engine: voiceConfig.engine,
      isFallback: voiceConfig.fallback || false
    };
  } catch (error) {
    console.error('Polly TTS error:', error.message);
    throw error;
  }
}

/**
 * Get available voice for a language
 * @param {string} language - Language name
 * @returns {object} Voice configuration
 */
function getVoiceConfig(language) {
  return LANGUAGE_VOICES[language] || LANGUAGE_VOICES['English'];
}

/**
 * Escape XML special characters for SSML
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  textToSpeech,
  getVoiceConfig,
  LANGUAGE_VOICES
};
