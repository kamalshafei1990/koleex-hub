/* Mochi sounds — off unless the user turns them on in Settings → Koleex AI
   ("Mochi sounds"). The store in ../orb-sound.ts owns the choice and writes
   it here; the 28 wavs live in /orb-lab-sounds/. */
const cache = new Map<string, HTMLAudioElement>();
let enabled = false;
export function setMochiSoundEnabled(v: boolean) { enabled = v; }
export const Sound = {
  play(name: string) {
    if (!enabled || typeof window === "undefined") return;
    let a = cache.get(name);
    if (!a) { a = new Audio(`/orb-lab-sounds/${name}.wav`); cache.set(name, a); }
    a.currentTime = 0;
    void a.play().catch(() => {});
  },
};
