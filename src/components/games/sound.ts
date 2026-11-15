export type TacticalSoundType = 'start' | 'success' | 'error' | 'alert' | 'victory';

let audioCtx: AudioContext | null = null;

export function playTacticalSound(type: TacticalSoundType, muted: boolean): void {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const playTone = (freq: number, start: number, duration: number, wave: OscillatorType = 'sine') => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    if (type === 'start') {
      playTone(440, now, 0.1, 'triangle');
      playTone(660, now + 0.09, 0.14, 'triangle');
    } else if (type === 'success') {
      playTone(587.33, now, 0.08, 'sine');
      playTone(880, now + 0.07, 0.14, 'sine');
    } else if (type === 'error') {
      playTone(220, now, 0.14, 'sawtooth');
    } else if (type === 'alert') {
      playTone(392, now, 0.1, 'square');
      playTone(330, now + 0.11, 0.12, 'square');
    } else if (type === 'victory') {
      playTone(523.25, now, 0.1, 'triangle');
      playTone(659.25, now + 0.09, 0.1, 'triangle');
      playTone(783.99, now + 0.18, 0.22, 'triangle');
    }
  } catch {
    // Web Audio API restricted or unsupported
  }
}
