// ============================================================
// WARDA — AWS Transcribe Speech-to-Text Service
// Reliable cloud STT replacing browser Web Speech API
// ============================================================

const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
const { Readable } = require('stream');

const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// ─── Transcribe audio buffer (single shot) ──────────────────
// For when tablet sends complete audio chunk
async function transcribeAudio(audioBuffer, options = {}) {
  const {
    languageCode = 'en-GB',       // British English default
    mediaSampleRate = 16000,       // 16kHz standard
    mediaEncoding = 'pcm',         // PCM audio
  } = options;

  try {
    // Create audio stream from buffer
    const audioStream = async function* () {
      // Split buffer into chunks for streaming
      const chunkSize = 4096;
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        yield { AudioEvent: { AudioChunk: audioBuffer.slice(i, i + chunkSize) } };
      }
    };

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: languageCode,
      MediaSampleRateHertz: mediaSampleRate,
      MediaEncoding: mediaEncoding,
      AudioStream: audioStream(),
    });

    const response = await transcribeClient.send(command);

    // Collect all transcript results
    let fullTranscript = '';
    let confidence = 0;
    let resultCount = 0;

    for await (const event of response.TranscriptResultStream) {
      if (event.TranscriptEvent) {
        const results = event.TranscriptEvent.Transcript.Results;
        for (const result of results) {
          if (!result.IsPartial && result.Alternatives.length > 0) {
            const alt = result.Alternatives[0];
            fullTranscript += alt.Transcript + ' ';
            confidence += alt.Items?.reduce((sum, item) => sum + (item.Confidence || 0), 0) / (alt.Items?.length || 1);
            resultCount++;
          }
        }
      }
    }

    const avgConfidence = resultCount > 0 ? confidence / resultCount : 0;

    return {
      success: true,
      transcript: fullTranscript.trim(),
      confidence: avgConfidence,
      languageCode
    };
  } catch (error) {
    console.error('Transcribe error:', error);
    return {
      success: false,
      error: error.message,
      transcript: '',
      confidence: 0
    };
  }
}

// ─── Transcribe from base64 audio ───────────────────────────
// For when tablet sends base64-encoded audio
async function transcribeBase64(base64Audio, options = {}) {
  try {
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    return await transcribeAudio(audioBuffer, options);
  } catch (error) {
    console.error('Base64 transcribe error:', error);
    return { success: false, error: error.message, transcript: '' };
  }
}

// ─── Simple text fallback for testing ───────────────────────
// Used when Transcribe is not configured or for development
function mockTranscribe(text) {
  return {
    success: true,
    transcript: text,
    confidence: 1.0,
    languageCode: 'en-GB',
    mock: true
  };
}

module.exports = {
  transcribeAudio,
  transcribeBase64,
  mockTranscribe
};
