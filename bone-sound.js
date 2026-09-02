// THE BONE'S VOICE — the crunch, and the announcement.
//
// SYNTHESIZED, NOT SHIPPED. Every sound here is made at runtime out of
// WebAudio noise, so the entry page and the model share one small file and
// nothing is downloaded to hear it. This repo is served straight off the
// branch with no build step, so a few hundred kilobytes of audio would be paid
// for by every visitor before they had pressed anything.
//
// ── TWO BONES, TWO CRUNCHES ─────────────────────────────────────────────
//
// The BIG bone -- the one on the entry page and in Gruff's drive-thru -- is a
// louder, longer, crunchier bite. It is the one you press to start something.
//
// The MODEL bone is the small one on the build row, and it keeps the short
// soft crunch it already had: it gets pressed over and over while somebody
// works, and a sound that is right the first time is tiring the twentieth.
//
// EVERYTHING HERE FAILS SILENTLY. Audio is blocked in more situations than it
// plays -- a fresh visitor with no history on the domain, a muted tab, an
// autoplay policy -- and none of them may ever break the press. The crunch is
// decoration on a spend that already happened.
if (!window.DraftBoneSound) {
(() => {
  let ctx = null;
  const audio = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  // One bite: noise through a falling bandpass. Several of them in a row is
  // what makes a crunch rather than a thud.
  const bite = (at, duration, freq, level) => {
    const c = audio();
    if (!c) return;
    const frames = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(freq, at);
    band.frequency.exponentialRampToValueAtTime(freq * 0.4, at + duration);
    band.Q.value = 0.9;
    const gain = c.createGain();
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.connect(band).connect(gain).connect(c.destination);
    source.start(at);
    source.stop(at + duration);
  };

  // The small bone. Two quick bites: cr— —unch. Unchanged from what shipped.
  const SOFT = Object.freeze([
    Object.freeze({ at: 0,    duration: 0.07, freq: 900, level: 0.5 }),
    Object.freeze({ at: 0.08, duration: 0.11, freq: 500, level: 0.5 }),
  ]);

  // The big bone. Five bites over about half a second, deeper and louder, with
  // the last one hanging on -- a bone being properly gone through rather than
  // nipped.
  const BIG = Object.freeze([
    Object.freeze({ at: 0,    duration: 0.09, freq: 1100, level: 0.75 }),
    Object.freeze({ at: 0.07, duration: 0.10, freq: 760,  level: 0.80 }),
    Object.freeze({ at: 0.17, duration: 0.12, freq: 520,  level: 0.85 }),
    Object.freeze({ at: 0.30, duration: 0.14, freq: 340,  level: 0.80 }),
    Object.freeze({ at: 0.45, duration: 0.26, freq: 210,  level: 0.65 }),
  ]);

  const crunch = ({ big = false } = {}) => {
    try {
      const c = audio();
      if (!c) return;
      const now = c.currentTime;
      (big ? BIG : SOFT).forEach(part =>
        bite(now + part.at, part.duration, part.freq, part.level));
    } catch (err) { /* blocked — the press already happened */ }
  };

  // ── THE ANNOUNCEMENT ──────────────────────────────────────────────────
  //
  //   WOULD YOU LIKE TO BUILD YOUR FIRST HOUSE PLAN
  //
  // Said as the model space tints, over the bone that is still lit. A game
  // show, not a chime -- the one moment in the app that is allowed to be a bit
  // of a performance, because it is the only moment nobody has committed to
  // anything yet.
  //
  // The browser's own voice, pitched down and slowed to announce rather than
  // read. It is a stand-in and sounds like one: a recorded line is the real
  // answer and swaps in here, in one place, without anything else changing.
  //
  // QUIET ON PURPOSE. Volume well under half: a voice that arrives uninvited a
  // second after a page opens has to be an offer, not an ambush.
  const ANNOUNCEMENT = 'Would you like to build your first house plan?';
  const announce = (text = ANNOUNCEMENT) => {
    try {
      const speech = window.speechSynthesis;
      if (!speech || typeof window.SpeechSynthesisUtterance !== 'function') return false;
      speech.cancel();
      const line = new window.SpeechSynthesisUtterance(text);
      line.rate = 0.82;     // slower: an announcer lands on the words
      line.pitch = 0.75;    // lower: closer to a ringmaster than a receptionist
      line.volume = 0.45;   // not too loud
      speech.speak(line);
      return true;
    } catch (err) { return false; }
  };

  const hush = () => { try { window.speechSynthesis?.cancel(); } catch (err) { /* nothing to stop */ } };

  window.DraftBoneSound = Object.freeze({ crunch, announce, hush, ANNOUNCEMENT, SOFT, BIG });
})();
}
