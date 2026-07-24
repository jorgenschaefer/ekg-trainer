// Thin adapter over the Web Audio API for the defibrillator tones. This is an
// external boundary: it holds no logic worth unit-testing (the hook decides when to
// play each tone), and it degrades to a no-op where Web Audio is absent (jsdom, or
// an unsupported browser).
export interface DefiAudio {
  // Create/resume the AudioContext. MUST be called synchronously inside the user
  // gesture (the Laden tap) — WebKit/iOS only unlocks audio from the gesture's own
  // call stack, so the later tone (played from an effect) would stay muted otherwise.
  unlock(): void;
  // Rising tone while charging.
  charge(): void;
  // Steady continuous tone while armed and ready to shock.
  ready(): void;
  // Silence — used on shock, cancel, and teardown.
  stop(): void;
}

const CHARGE_SECONDS = 5.5;
const START_HZ = 440;
const READY_HZ = 1200;

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

export function createDefiAudio(): DefiAudio {
  const ctor = getAudioContextCtor();
  if (!ctor) {
    return { unlock() {}, charge() {}, ready() {}, stop() {} };
  }
  const AudioCtor: AudioContextCtor = ctor;

  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;

  function ensureCtx(): AudioContext {
    if (!ctx) ctx = new AudioCtor();
    void ctx.resume();
    return ctx;
  }

  function silence(): void {
    if (osc) {
      osc.stop();
      osc.disconnect();
      osc = null;
    }
    if (gain) {
      gain.disconnect();
      gain = null;
    }
  }

  function play(configure: (osc: OscillatorNode, now: number) => void): void {
    const c = ensureCtx();
    silence();
    gain = c.createGain();
    gain.gain.value = 0.05;
    osc = c.createOscillator();
    osc.type = "sine";
    configure(osc, c.currentTime);
    osc.connect(gain).connect(c.destination);
    osc.start();
  }

  return {
    unlock() {
      ensureCtx();
    },
    charge() {
      play((o, now) => {
        o.frequency.setValueAtTime(START_HZ, now);
        o.frequency.linearRampToValueAtTime(READY_HZ, now + CHARGE_SECONDS);
      });
    },
    ready() {
      play((o) => {
        o.frequency.value = READY_HZ;
      });
    },
    stop: silence,
  };
}
