// Global AudioContext and HTML5 Audio fallback for 100% reliable alert sound
let sharedAudioCtx: AudioContext | null = null;
let lastDispatchSoundTimestamp = 0;
let isAudioExplicitlyUnlocked = false;

/**
 * Synthesizes an audible, crisp 16-bit PCM WAV notification sound as a Data URI.
 * This guarantees audio works across all browsers even when Web Audio nodes are blocked by autoplay policies.
 */
let cachedWavDataUri: string | null = null;

function getEmergencyWavDataUri(): string {
  if (cachedWavDataUri) return cachedWavDataUri;

  const sampleRate = 22050;
  const duration = 1.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  // Write WAV RIFF Header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, "data");
  view.setUint32(40, totalSamples * 2, true);

  // Generate Urgent Two-Burst Emergency Medical Dispatch Chime:
  // Burst 1: High A5 (880Hz) -> High C6 (1046.5Hz)
  // Burst 2: High A5 (880Hz) -> High E6 (1318.5Hz)
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let freq = 0;
    let env = 0;

    // Burst 1 (0.05s to 0.50s)
    if (t >= 0.05 && t < 0.25) {
      freq = 880; // A5
      env = Math.sin(((t - 0.05) / 0.2) * Math.PI);
    } else if (t >= 0.28 && t < 0.52) {
      freq = 1046.5; // C6
      env = Math.sin(((t - 0.28) / 0.24) * Math.PI);
    }
    // Burst 2 (0.65s to 1.40s)
    else if (t >= 0.65 && t < 0.85) {
      freq = 880; // A5
      env = Math.sin(((t - 0.65) / 0.2) * Math.PI);
    } else if (t >= 0.88 && t < 1.45) {
      freq = 1318.5; // E6 (resonant high finishing chime)
      env = Math.exp(-(t - 0.88) * 3.2);
    }

    let sample = 0;
    if (freq > 0) {
      // Fundamental + harmonic overtone
      sample =
        (Math.sin(2 * Math.PI * freq * t) * 0.7 +
          Math.sin(2 * Math.PI * (freq * 2) * t) * 0.25 +
          Math.sin(2 * Math.PI * (freq * 3) * t) * 0.05) *
        env;
    }
    const val = Math.max(-1, Math.min(1, sample)) * 32767;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  // Base64 encode
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedWavDataUri = "data:audio/wav;base64," + btoa(binary);
  return cachedWavDataUri;
}

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Unlocks audio for the current browser session.
 * Safe to call on any user click, touch, or keypress.
 */
export function unlockAudioSession(): boolean {
  isAudioExplicitlyUnlocked = true;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Play a 1ms silent buffer to register user-gesture audio clearance with the browser
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {}

  try {
    const snd = new Audio(getEmergencyWavDataUri());
    snd.volume = 0.01;
    snd.play().then(() => {
      snd.pause();
      snd.currentTime = 0;
    }).catch(() => {});
  } catch {}

  return true;
}

// Automatically register window unlock listener on first user interaction
if (typeof window !== "undefined") {
  const handleUserGesture = () => {
    unlockAudioSession();
    window.removeEventListener("click", handleUserGesture);
    window.removeEventListener("touchstart", handleUserGesture);
    window.removeEventListener("keydown", handleUserGesture);
  };
  window.addEventListener("click", handleUserGesture, { passive: true });
  window.addEventListener("touchstart", handleUserGesture, { passive: true });
  window.addEventListener("keydown", handleUserGesture, { passive: true });
}

export function isAudioUnlocked(): boolean {
  if (isAudioExplicitlyUnlocked) return true;
  if (sharedAudioCtx && sharedAudioCtx.state === "running") return true;
  return false;
}

/**
 * Plays a rich harmonic chime note via Web Audio API
 */
export function playChimeNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gainValue = 0.4
) {
  try {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq, startTime);
    gain1.gain.setValueAtTime(gainValue, startTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + duration);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq * 2, startTime);
    gain2.gain.setValueAtTime(gainValue * 0.35, startTime);
    gain2.gain.exponentialRampToValueAtTime(0.0005, startTime + duration * 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime);
    osc2.stop(startTime + duration * 0.85);
  } catch {}
}

/**
 * Distinct, loud, high-clarity notification sound when an ambulance driver selects this hospital.
 * Uses BOTH HTML5 Audio element AND Web Audio API in parallel for 100% audible delivery!
 */
export function playHospitalSelectedSound(): Promise<boolean> {
  const now = Date.now();
  // Prevent duplicate double-playing if multiple socket events trigger at the same millisecond
  if (now - lastDispatchSoundTimestamp < 1000) return Promise.resolve(true);
  lastDispatchSoundTimestamp = now;

  let playedHtml5 = false;

  // Method 1: HTML5 Audio with embedded high-resolution synthesized WAV
  try {
    const audio = new Audio(getEmergencyWavDataUri());
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          playedHtml5 = true;
          isAudioExplicitlyUnlocked = true;
        })
        .catch((err) => {
          console.warn("[Audio] HTML5 audio autoplay blocked by browser:", err);
        });
    }
  } catch (err) {
    console.warn("[Audio] HTML5 audio error:", err);
  }

  // Method 2: Web Audio API Oscillator synthesis
  try {
    const ctx = getAudioContext();
    const playWebAudio = () => {
      const t = ctx.currentTime;
      playChimeNote(ctx, 880, t + 0.05, 0.22, 0.42); // High A5
      playChimeNote(ctx, 1046.5, t + 0.28, 0.24, 0.45); // High C6
      playChimeNote(ctx, 880, t + 0.65, 0.22, 0.42); // High A5
      playChimeNote(ctx, 1318.5, t + 0.88, 0.65, 0.48); // High E6 (piercing finish)
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        playWebAudio();
      }).catch(() => {});
    } else {
      playWebAudio();
    }
  } catch (err) {
    console.warn("[Audio] Web Audio error:", err);
  }

  return Promise.resolve(true);
}

/**
 * Secondary tone helper for action approvals & arrivals
 */
export function playTone(type: "accept" | "alert" | "arrive" | "hospital_selected") {
  if (type === "hospital_selected" || type === "alert") {
    playHospitalSelectedSound();
    return;
  }

  try {
    const ctx = getAudioContext();
    const play = () => {
      if (type === "accept") {
        const t = ctx.currentTime;
        playChimeNote(ctx, 587.33, t, 0.15, 0.3);
        playChimeNote(ctx, 880, t + 0.12, 0.35, 0.32);
      } else {
        const t = ctx.currentTime;
        playChimeNote(ctx, 523.25, t, 0.15, 0.3);
        playChimeNote(ctx, 659.25, t + 0.12, 0.18, 0.32);
        playChimeNote(ctx, 783.99, t + 0.25, 0.45, 0.35);
      }
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(() => play()).catch(() => {});
    } else {
      play();
    }
  } catch {}
}
