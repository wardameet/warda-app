/**
 * Voice Service
 * AWS Polly (text-to-speech) and Transcribe (speech-to-text)
 */

const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

const polly = new PollyClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Convert text to speech using AWS Polly
async function textToSpeech(text, voiceId = 'Amy') {
  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId,
      Engine: 'neural'
    });

    const response = await polly.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    
    return {
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg'
    };
  } catch (error) {
    console.error('Polly error:', error);
    throw error;
  }
}

// Available British voices for elderly-friendly speech
const VOICES = {
  female: 'Amy',      // British English female (neural)
  male: 'Brian',      // British English male (neural)
  welsh: 'Gwyneth',   // Welsh English female
};

module.exports = {
  textToSpeech,
  VOICES
};
