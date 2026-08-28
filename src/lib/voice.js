// On-device narration for RoadLore. Primary engine is Kokoro-82M (kokoro-js,
// Apache-2.0) running in the browser via WebGPU or WASM; if the model can't
// load (offline, unsupported browser) we fall back to the best available
// system voice. Tesla's in-car Grok assistant has no browser API, so a web
// page cannot hand narration off to it.

let kokoroPromise = null;
const audioUrlCache = new Map();

async function loadKokoro(onProgress) {
  if (!kokoroPromise) {
    kokoroPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js');
      const device = typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm';
      return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        device,
        progress_callback: (info) => {
          if (info.status === 'progress' && info.file?.endsWith('.onnx')) {
            onProgress?.(Math.round(info.progress || 0));
          }
        },
      });
    })().catch((error) => {
      kokoroPromise = null;
      throw error;
    });
  }
  return kokoroPromise;
}

export async function getNarrationUrl(key, text, onProgress) {
  if (audioUrlCache.has(key)) return audioUrlCache.get(key);
  const tts = await loadKokoro(onProgress);
  const audio = await tts.generate(text, { voice: 'af_heart' });
  const url = URL.createObjectURL(audio.toBlob());
  audioUrlCache.set(key, url);
  return url;
}

const VOICE_QUALITY_HINTS = ['natural', 'neural', 'premium', 'enhanced', 'samantha', 'ava', 'allison', 'google us english'];

export function pickBestSystemVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'));
  const pool = english.length ? english : voices;
  const scored = pool.map((voice) => {
    const name = voice.name.toLowerCase();
    let score = 0;
    VOICE_QUALITY_HINTS.forEach((hint, index) => {
      if (name.includes(hint)) score += VOICE_QUALITY_HINTS.length - index;
    });
    if (voice.lang?.toLowerCase() === 'en-us') score += 1;
    return { voice, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice || null;
}

export function speakWithSystemVoice(text, { onEnd } = {}) {
  if (!('speechSynthesis' in window)) return null;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickBestSystemVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return utterance;
}
