/* Mochi sounds — off by default in the Hub until the behavior settings
   (plan phase 5) decide where sounds play. The 28 wavs live in
   /orb-lab-sounds/ ready to wire. */
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
