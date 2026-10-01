// A MUTATED FILE FOR A HARNESS THAT NEVER ASKED harness-env.js FOR ONE.
//
// mutant-subprocess.js bends a source file, writes the bent text to the JSON
// file named by DRAFT_HARNESS_SOURCE_OVERRIDES, and runs the harness again as
// a child. harness-env.js honours that file -- but only for the modules ITS
// loader reads, and most harnesses do not go through it. They `require` the
// module, or `readFileSync` it and run it themselves. On 1 Oct that was every
// one of the twenty-four harnesses with no mutation engine, and it is most of
// the reason they had none: an engine could bend the file on disk and the
// harness would read the unbent one.
//
// SO THIS IS LOADED INTO THE CHILD WITH `node -r`, and answers both reads. A
// harness's own checks stay exactly as they are; it gains an engine by adding
// a table and two lines, not by being restructured around one.
//
// ABSENT, which is every run but a mutation run, it does nothing at all.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const at = process.env.DRAFT_HARNESS_SOURCE_OVERRIDES;
if (at) {
  const ROOT = path.join(__dirname, '..');
  const overrides = new Map(Object.entries(JSON.parse(fs.readFileSync(at, 'utf8')))
    .map(([file, text]) => [path.join(ROOT, file), text]));

  // A MUTANT THAT WILL NOT LOAD IS NOT A MUTANT CAUGHT -- harness-env.js's
  // rule, and exit 3 is its code for it. A harness that runs a module itself
  // would throw on a syntax error, exit 1, and the parent would score that
  // as caught. So every bent .js file is parsed here, before the harness
  // sees it. An .html file is not a script and is left to its harness.
  const unloadable = (file, err) => {
    console.error(`[mutant] ${path.relative(ROOT, file)}: ${err.message}`);
    console.error('[mutant] the mutated source did not load; the mutant proves nothing. Re-aim the row.');
    process.exit(3);
  };
  for (const [file, text] of overrides) {
    if (!file.endsWith('.js')) continue;
    try { new vm.Script(text, { filename: file }); } catch (err) { unloadable(file, err); }
  }

  // THE PLAIN READ, for a harness that reads the text and runs it itself.
  const readFileSync = fs.readFileSync;
  fs.readFileSync = function (file, options) {
    const full = typeof file === 'string' ? path.resolve(file) : null;
    if (full && overrides.has(full)) {
      const text = overrides.get(full);
      const encoding = typeof options === 'string' ? options : options?.encoding;
      return encoding ? text : Buffer.from(text, 'utf8');
    }
    return readFileSync.apply(this, arguments);
  };

  // AND `require`, which Node does not route through fs.readFileSync on
  // every version. The module is compiled from the bent text directly, and a
  // throw while it LOADS is the same non-answer as a parse error: the module
  // never finished defining what the checks read.
  const loadJs = Module._extensions['.js'];
  Module._extensions['.js'] = function (module, filename) {
    if (!overrides.has(filename)) return loadJs.call(this, module, filename);
    try { module._compile(overrides.get(filename), filename); }
    catch (err) { unloadable(filename, err); }
  };
}
