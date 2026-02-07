// ============================================================
// WARDA — AWS Transcribe Speech-to-Text Service
// Converts webm/opus → PCM via ffmpeg, then streams to AWS
// ============================================================
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// ─── Convert any audio to PCM using ffmpeg ──────────────────
function convertToPCM(inputBuffer, inputFormat = 'webm') {
  const tmpIn = path.join(os.tmpdir(), `warda_in_${Date.now()}.${inputFormat}`);
  const tmpOut = path.join(os.tmpdir(), `warda_out_${Date.now()}.pcm`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    execSync(`ffmpeg -i ${tmpIn} -f s16le -ar 16000 -ac 1 -acodec pcm_s16le ${tmpOut} -y 2>/dev/null`);
    const pcmBuffer = fs.readFileSync(tmpOut);
    return pcmBuffer;
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// ─── Transcribe PCM audio buffer ────────────────────────────
async function transcribeAudio(audioBuffer, options = {}) {
  const {
    languageCode = 'en-GB',
    mediaSampleRate = 16000,
    mediaEncoding = 'pcm',
  } = options;

  try {
    const audioStream = async function* () {
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
    console.error('Transcribe error:', error.Message || error.message);
    return { success: false, error: error.Message || error.message, transcript: '', confidence: 0 };
  }
}

// ─── Transcribe from base64 audio ───────────────────────────
async function transcribeBase64(base64Audio, options = {}) {
  try {
    let audioBuffer = Buffer.from(base64Audio, 'base64');
    const format = options.mediaEncoding || 'pcm';

    // If not already PCM, convert via ffmpeg
    if (format !== 'pcm') {
      const ext = format === 'ogg-opus' ? 'webm' : format;
      console.log(`Converting ${format} audio (${audioBuffer.length} bytes) to PCM...`);
      audioBuffer = convertToPCM(audioBuffer, ext);
      console.log(`Converted to PCM: ${audioBuffer.length} bytes`);
      // Override to PCM for Transcribe
      options.mediaEncoding = 'pcm';
    }

    return await transcribeAudio(audioBuffer, options);
  } catch (error) {
    console.error('Base64 transcribe error:', error.message);
    return { success: false, error: error.message, transcript: '' };
  }
}

module.exports = { transcribeAudio, transcribeBase64 };
