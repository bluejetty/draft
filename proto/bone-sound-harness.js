#!/usr/bin/env node
// THE BONE'S VOICE — the two crunches and the announcement, measured off
// bone-sound.js through a recording WebAudio and a recording speech engine.
//
// WHY IT EXISTS. Devin's audit, 28 Sep: bone-sound.js is the one module in the
// repo with NO witness of any kind -- `DraftBoneSound` appears in no test and
// no harness. It is also the module hardest to notice losing: everything in it
// fails silently on purpose, so a crunch that stopped being scheduled and a
// crunch blocked by an autoplay policy look exactly alike from the page. The
// only way to tell them apart is to hand it an audio engine that writes down
// what it was asked to do, which is what this harness is.
//
// WHAT "FAILS SILENTLY" HAS TO MEAN. Two halves, and both are checked, because
// keeping only one is how the rule rots:
//   - blocked audio never reaches the press. No AudioContext, a constructor
//     that throws, a speech engine that throws -- none of them may throw out
//     of crunch() or announce(). The press already happened; the sound is
//     decoration on a spend.
//   - silence is not success. When the engine IS there, the schedule has to
//     arrive: two bites for the small bone, five for the big one, at the
//     offsets and levels the file states. A harness that only checked "it did
//     not throw" would pass against a crunch() emptied out to `return`.
//
// Run: node proto/bone-sound-harness.js
//      node proto/bone-sound-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

// ── A WEBAUDIO THAT KEEPS THE RECEIPTS ──────────────────────────────────
// Only what bone-sound.js actually touches, and every call recorded. The
// sample rate is deliberately small: the noise buffer is filled a sample at a
// time, and 48000 frames per bite is a slow harness for no extra truth.
function recordingAudio({ missing = false, throwsOnNew = false, state = 'running' } = {}) {
  const log = { bites: [], resumes: 0, contexts: 0 };
  if (missing) return { log, Ctx: undefined };
  function Ctx() {
    log.contexts += 1;
    if (throwsOnNew) throw new Error('autoplay policy');
    this.sampleRate = 400;
    this.currentTime = 10;
    this.state = state;
    this.destination = { name: 'destination' };
    this.resume = () => { log.resumes += 1; return Promise.resolve(); };
    this.createBuffer = (channels, frames) => {
      const data = new Float32Array(frames);
      return { length: frames, getChannelData: () => data };
    };
    this.createBufferSource = () => {
      const bite = { kind: 'source', start: null, stop: null, buffer: null, chain: [] };
      log.bites.push(bite);
      return {
        set buffer(value) { bite.buffer = value; },
        get buffer() { return bite.buffer; },
        start(at) { bite.start = at; },
        stop(at) { bite.stop = at; },
        connect(node) { bite.chain.push(node.tag || 'unknown'); node.owner = bite; return node; },
      };
    };
    const param = (node, name) => ({
      set value(v) { node[`${name}Value`] = v; },
      setValueAtTime(v, at) { node[`${name}At`] = { v, at }; },
      exponentialRampToValueAtTime(v, at) { node[`${name}Ramp`] = { v, at }; },
    });
    this.createBiquadFilter = () => {
      const node = { tag: 'band' };
      node.frequency = param(node, 'frequency');
      node.Q = param(node, 'Q');
      node.connect = next => {
        if (node.owner) { node.owner.band = node; node.owner.chain.push(next.tag || 'destination'); }
        next.owner = node.owner;
        return next;
      };
      return node;
    };
    this.createGain = () => {
      const node = { tag: 'gain' };
      node.gain = param(node, 'gain');
      node.connect = next => {
        if (node.owner) { node.owner.gain = node; node.owner.chain.push(next.name || 'destination'); }
        return next;
      };
      return node;
    };
  }
  return { log, Ctx };
}

// ── A SPEECH ENGINE THAT KEEPS THE RECEIPTS ─────────────────────────────
function recordingSpeech({ missing = false, throwsOnSpeak = false } = {}) {
  const log = { spoken: [], cancels: 0, order: [] };
  if (missing) return { log, speech: undefined, Utterance: undefined };
  function Utterance(text) { this.text = text; }
  const speech = {
    cancel() { log.cancels += 1; log.order.push('cancel'); },
    speak(line) {
      log.order.push('speak');
      if (throwsOnSpeak) throw new Error('not allowed');
      log.spoken.push(line);
    },
  };
  return { log, speech, Utterance };
}

function loadBone(audioOpts, speechOpts) {
  const audio = recordingAudio(audioOpts || {});
  const voice = recordingSpeech(speechOpts || {});
  const win = {
    AudioContext: audio.Ctx,
    speechSynthesis: voice.speech,
    SpeechSynthesisUtterance: voice.Utterance,
  };
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    Float32Array, Promise, Error, JSON, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('bone-sound.js'), sandbox, { filename: 'bone-sound.js' });
  if (!win.DraftBoneSound) throw new Error('bone-sound.js did not publish DraftBoneSound');
  return { bone: win.DraftBoneSound, audio: audio.log, voice: voice.log };
}

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

function runChecks() {
  passed = 0; failures = [];

  // ── THE TWO SCHEDULES, AS WRITTEN ────────────────────────────────────
  const { bone } = loadBone();
  check('the small bone is two bites', bone.SOFT.length === 2, `got ${bone.SOFT.length}`);
  check('the big bone is five', bone.BIG.length === 5, `got ${bone.BIG.length}`);
  check('both schedules are frozen against a 2am edit',
    Object.isFrozen(bone.SOFT) && Object.isFrozen(bone.BIG)
      && bone.SOFT.every(Object.isFrozen) && bone.BIG.every(Object.isFrozen));
  check('the exported voice is frozen', Object.isFrozen(bone));

  // The character of each bone, not just its length: THE BIG ONE IS DEEPER,
  // LOUDER AND LONGER, and that is the whole difference the file describes.
  const span = parts => parts[parts.length - 1].at + parts[parts.length - 1].duration;
  check('the big bone runs about half a second, the small one a fifth',
    near(span(bone.BIG), 0.71) && near(span(bone.SOFT), 0.19),
    `big ${span(bone.BIG)}, soft ${span(bone.SOFT)}`);
  check('the big bone is louder throughout',
    Math.max(...bone.BIG.map(p => p.level)) > Math.max(...bone.SOFT.map(p => p.level)));
  check('the big bone goes deeper than the small one',
    Math.min(...bone.BIG.map(p => p.freq)) < Math.min(...bone.SOFT.map(p => p.freq)));
  check('every bite falls in pitch through the bite list',
    bone.BIG.every((p, i) => i === 0 || p.freq < bone.BIG[i - 1].freq),
    'a bone being gone through drops in pitch, it does not wander');
  check('the last big bite hangs on longest',
    bone.BIG[4].duration > Math.max(...bone.BIG.slice(0, 4).map(p => p.duration)));
  check('the bites run in time order and never overlap backwards',
    bone.BIG.every((p, i) => i === 0 || p.at > bone.BIG[i - 1].at));

  // ── THE SMALL CRUNCH ARRIVES ─────────────────────────────────────────
  const soft = loadBone();
  soft.bone.crunch();
  check('the small crunch schedules both its bites', soft.audio.bites.length === 2,
    `${soft.audio.bites.length} bites reached the engine`);
  check('each bite is started at the context clock plus its offset',
    soft.audio.bites.every((bite, i) => near(bite.start, 10 + soft.bone.SOFT[i].at)),
    `starts ${soft.audio.bites.map(b => b.start)}`);
  check('each bite is stopped after its own duration',
    soft.audio.bites.every((bite, i) =>
      near(bite.stop - bite.start, soft.bone.SOFT[i].duration)));
  check('each bite runs noise through a bandpass into a gain into the output',
    soft.audio.bites.every(bite => bite.chain.join('>') === 'band>gain>destination'),
    `chain ${soft.audio.bites[0] && soft.audio.bites[0].chain.join('>')}`);
  check('the band FALLS through the bite — that is what makes it a crunch',
    soft.audio.bites.every((bite, i) =>
      near(bite.band.frequencyRamp.v, soft.bone.SOFT[i].freq * 0.4)
        && bite.band.frequencyRamp.v < bite.band.frequencyAt.v));
  check('the gain fades to nothing rather than being cut off',
    soft.audio.bites.every(bite => bite.gain.gainRamp.v < 0.01
      && near(bite.gain.gainRamp.at, bite.stop)));
  check('the noise is a decaying envelope, not a flat hiss',
    (() => {
      const data = soft.audio.bites[0].buffer.getChannelData(0);
      const head = Math.max(...Array.from(data.slice(0, 5)).map(Math.abs));
      const tail = Math.max(...Array.from(data.slice(-5)).map(Math.abs));
      return tail < head * 0.2;
    })(), 'the tail of the buffer is as loud as its head');

  // ── THE BIG CRUNCH IS THE OTHER ONE ──────────────────────────────────
  const big = loadBone();
  big.bone.crunch({ big: true });
  check('the big crunch schedules five bites', big.audio.bites.length === 5,
    `${big.audio.bites.length} bites reached the engine`);
  check('the big crunch is the BIG schedule, not the small one repeated',
    big.audio.bites.every((bite, i) => near(bite.start, 10 + big.bone.BIG[i].at)));
  check('asking for the small bone does not get the big one',
    soft.audio.bites.length !== big.audio.bites.length);

  // ── ONE CONTEXT, NOT ONE PER PRESS ───────────────────────────────────
  // The bone gets pressed over and over while somebody works. A context per
  // press is a page that eventually refuses to make another one.
  const repeat = loadBone();
  repeat.bone.crunch();
  repeat.bone.crunch();
  repeat.bone.crunch();
  check('the audio context is made once and reused', repeat.audio.contexts === 1,
    `${repeat.audio.contexts} contexts for three presses`);
  check('every press still schedules its bites', repeat.audio.bites.length === 6);

  const asleep = loadBone({ state: 'suspended' });
  asleep.bone.crunch();
  check('a suspended context is woken before it is used', asleep.audio.resumes >= 1);

  // ── BLOCKED AUDIO NEVER REACHES THE PRESS ────────────────────────────
  const none = loadBone({ missing: true });
  let threw = null;
  try { none.bone.crunch(); none.bone.crunch({ big: true }); } catch (err) { threw = err; }
  check('with no WebAudio at all the crunch is a no-op, not a throw', threw === null,
    threw && threw.message);
  check('and nothing was scheduled', none.audio.bites.length === 0);

  const blocked = loadBone({ throwsOnNew: true });
  threw = null;
  try { blocked.bone.crunch(); } catch (err) { threw = err; }
  check('a context that refuses to be built is swallowed', threw === null,
    threw && threw.message);

  // ── THE ANNOUNCEMENT ─────────────────────────────────────────────────
  const said = loadBone();
  const spoke = said.bone.announce();
  check('the announcement is spoken', spoke === true && said.voice.spoken.length === 1);
  check('it says the line the file states',
    said.voice.spoken[0].text === said.bone.ANNOUNCEMENT
      && /would you like to build your first house plan/i.test(said.bone.ANNOUNCEMENT));
  check('it announces rather than reads — slower and lower',
    near(said.voice.spoken[0].rate, 0.82) && near(said.voice.spoken[0].pitch, 0.75),
    `rate ${said.voice.spoken[0].rate}, pitch ${said.voice.spoken[0].pitch}`);
  check('it arrives as an offer, not an ambush: well under half volume',
    said.voice.spoken[0].volume < 0.5,
    `volume ${said.voice.spoken[0].volume}`);
  check('whatever was mid-sentence is cancelled BEFORE the new line',
    said.voice.order.join('>') === 'cancel>speak', said.voice.order.join('>'));

  const custom = loadBone();
  custom.bone.announce('THE GARAGE IS DETACHED');
  check('a caller may say something else',
    custom.voice.spoken[0].text === 'THE GARAGE IS DETACHED');

  const mute = loadBone({}, { missing: true });
  threw = null;
  let answer = null;
  try { answer = mute.bone.announce(); } catch (err) { threw = err; }
  check('with no speech engine it answers false rather than throwing',
    threw === null && answer === false, threw ? threw.message : `answered ${answer}`);

  const refused = loadBone({}, { throwsOnSpeak: true });
  threw = null; answer = null;
  try { answer = refused.bone.announce(); } catch (err) { threw = err; }
  check('a speech engine that refuses is swallowed and reported as false',
    threw === null && answer === false, threw ? threw.message : `answered ${answer}`);

  const hushed = loadBone();
  hushed.bone.announce();
  hushed.bone.hush();
  check('hush stops the line', hushed.voice.cancels === 2);
  const hushMute = loadBone({}, { missing: true });
  threw = null;
  try { hushMute.bone.hush(); } catch (err) { threw = err; }
  check('hush with no engine to stop is quiet about it', threw === null);
}

if (!MUTATE) {
  runChecks();
  console.log(`\nbone sound harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
//
// The rows that matter most are the ones that make the module SILENT, because
// silence is what this file is allowed to be when the browser says no. Each
// has to make a check above go red; a survivor is a way the bone could lose
// its voice with every test still green.
const MUTATIONS = [
  ['the big bone is dropped and every press gets the small crunch', 'bone-sound.js',
    c => c.replace('(big ? BIG : SOFT).forEach(part =>', '(SOFT).forEach(part =>')],

  ['the small bone is dropped and every press gets the big crunch', 'bone-sound.js',
    c => c.replace('(big ? BIG : SOFT).forEach(part =>', '(BIG).forEach(part =>')],

  ['crunch is emptied out — the press is silent and says nothing', 'bone-sound.js',
    c => c.replace('  const crunch = ({ big = false } = {}) => {\n    try {',
      '  const crunch = ({ big = false } = {}) => {\n    if (1) return;\n    try {')],

  ['only the first bite of a crunch is scheduled', 'bone-sound.js',
    c => c.replace('(big ? BIG : SOFT).forEach(part =>', '(big ? BIG : SOFT).slice(0, 1).forEach(part =>')],

  ['every bite starts at once, so a crunch becomes a thud', 'bone-sound.js',
    c => c.replace('bite(now + part.at, part.duration, part.freq, part.level));',
      'bite(now, part.duration, part.freq, part.level));')],

  ['the bites are scheduled from zero rather than the context clock', 'bone-sound.js',
    c => c.replace('const now = c.currentTime;', 'const now = 0;')],

  ['a bite is never stopped', 'bone-sound.js',
    c => c.replace('source.stop(at + duration);', 'source.stop(at + duration * 4);')],

  ['the band stops falling, so the bite loses its crunch', 'bone-sound.js',
    c => c.replace('band.frequency.exponentialRampToValueAtTime(freq * 0.4, at + duration);',
      'band.frequency.exponentialRampToValueAtTime(freq, at + duration);')],

  ['the gain is left up instead of fading out', 'bone-sound.js',
    c => c.replace('gain.gain.exponentialRampToValueAtTime(0.001, at + duration);',
      'gain.gain.exponentialRampToValueAtTime(level, at + duration);')],

  ['the noise loses its envelope and becomes a flat hiss', 'bone-sound.js',
    c => c.replace('data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;',
      'data[i] = (Math.random() * 2 - 1);')],

  ['the gain never reaches the output', 'bone-sound.js',
    c => c.replace('source.connect(band).connect(gain).connect(c.destination);',
      'source.connect(band).connect(gain);')],

  ['a fresh context is built for every press', 'bone-sound.js',
    c => c.replace('if (!ctx) ctx = new Ctx();', 'ctx = new Ctx();')],

  ['a suspended context is used without waking it', 'bone-sound.js',
    c => c.replace("if (ctx.state === 'suspended') ctx.resume().catch(() => {});", '')],

  // NOT A ROW, AND THE MEASUREMENT SAYS WHY. Deleting `if (!Ctx) return null;`
  // from audio() changes nothing observable: audio() is reached only from
  // inside crunch()'s try, so a browser with no WebAudio turns that guard's
  // early return into a TypeError the catch swallows on the same line, with
  // the same result -- no bites scheduled, no throw out of the press.
  // Measured by running this whole file with the guard removed: 36 of 36
  // checks green. It is belt and braces, deliberately, and a row that can only
  // print SURVIVED would say the harness is weak rather than the guard is
  // doubled. It becomes a real row the day anything calls audio() from outside
  // a try -- the resume path, say, or a meter reading the context.

  ['a blocked context escapes the press', 'bone-sound.js',
    c => c.replace('    } catch (err) { /* blocked — the press already happened */ }',
      '    } catch (err) { throw err; }')],

  ['the announcement is read at speaking pace, not announced', 'bone-sound.js',
    c => c.replace('line.rate = 0.82;', 'line.rate = 1;')],

  ['the announcer is pitched back up to a receptionist', 'bone-sound.js',
    c => c.replace('line.pitch = 0.75;', 'line.pitch = 1;')],

  ['the announcement arrives at full volume', 'bone-sound.js',
    c => c.replace('line.volume = 0.45;', 'line.volume = 1;')],

  ['a line already speaking is talked over instead of cancelled', 'bone-sound.js',
    c => c.replace('      speech.cancel();\n', '')],

  ['the announcement claims it spoke when there is no engine', 'bone-sound.js',
    c => c.replace("if (!speech || typeof window.SpeechSynthesisUtterance !== 'function') return false;",
      "if (!speech || typeof window.SpeechSynthesisUtterance !== 'function') return true;")],

  ['a refused announcement is reported as spoken', 'bone-sound.js',
    c => c.replace('    } catch (err) { return false; }\n  };\n\n  const hush',
      '    } catch (err) { return true; }\n  };\n\n  const hush')],

  ['hush throws when there is nothing to stop', 'bone-sound.js',
    c => c.replace("const hush = () => { try { window.speechSynthesis?.cancel(); } catch (err) { /* nothing to stop */ } };",
      'const hush = () => { window.speechSynthesis.cancel(); };')],

  ['the voice is left unfrozen for anything to rewrite', 'bone-sound.js',
    c => c.replace('window.DraftBoneSound = Object.freeze({ crunch, announce, hush, ANNOUNCEMENT, SOFT, BIG });',
      'window.DraftBoneSound = { crunch, announce, hush, ANNOUNCEMENT, SOFT, BIG };')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`bone-sound-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
