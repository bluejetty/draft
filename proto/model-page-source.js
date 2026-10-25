// MODEL.html'S CODE AS ONE TEXT, for the harnesses that read it: the page
// and its script parts (model/*.js, stage 2 of the split) in the order the
// page loads them. A check that asks "does MODEL say X" asks the whole page,
// wherever in its parts X now lives.
const fs = require('fs');
const path = require('path');

function modelPageParts(root) {
  const html = fs.readFileSync(path.join(root, 'MODEL.html'), 'utf8');
  const parts = [...html.matchAll(/<script src="\.\/(model\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
  return ['MODEL.html', ...parts];
}
function modelPageSource(root) {
  return modelPageParts(root).map(rel => fs.readFileSync(path.join(root, rel), 'utf8')).join('\n');
}
module.exports = { modelPageParts, modelPageSource };
