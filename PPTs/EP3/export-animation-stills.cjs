// Exports the exact SVG scene used by each HTML. No browser is launched.
// NODE_PATH=/path/to/node_modules node PPTs/EP3/export-animation-stills.cjs [a01-react-loop]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require('sharp');
const frames = {
  'a01-react-loop': [['01-start', '#step=0'], ['02-context-grows', '#step=6'], ['03-complete', '#step=14'], ['04-failure', '#step=3'], ['05-edit', '#step=8'], ['06-verified', '#step=12']],
  'a02-pi-context': [['01-start', '#step=0'], ['02-skill-loaded', '#step=13'], ['03-summary', '#step=16']],
  'a03-e2e-loops': [['01-start', '#step=0'], ['02-harness', '#step=10'], ['03-human-decision', '#step=18'], ['04-rejected', '#step=2&branch=fail']],
};
async function main() {
  const requested = process.argv.slice(2);
  for (const folder of requested) {
    if (!Object.hasOwn(frames, folder)) throw new Error(`Unknown animation: ${folder}`);
  }
  for (const [folder, snapshots] of Object.entries(frames)) {
    if (requested.length && !requested.includes(folder)) continue;
    const html = fs.readFileSync(path.join(__dirname, folder, 'index.html'), 'utf8');
    const ctx = vm.createContext({URLSearchParams});
    for (const id of ['scene-model', 'scene-art']) {
      const source = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
      if (!source) throw new Error(`${folder}: missing ${id}`);
      vm.runInContext(source[1], ctx);
    }
    const out = path.join(__dirname, folder, 'stills');
    fs.mkdirSync(out, {recursive:true});
    for (const [name, hash] of snapshots) {
      const svg = vm.runInContext(`drawScene(sceneFor(parseState(${JSON.stringify(hash)})))`, ctx);
      await sharp(Buffer.from(svg)).png().toFile(path.join(out, name+'.png'));
      console.log(`${folder}/stills/${name}.png`);
    }
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
