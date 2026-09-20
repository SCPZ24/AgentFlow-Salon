// Run with: node --test PPTs/EP3/animations.test.cjs
// Pure scene/state tests. They do not launch or control a browser.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(folder) {
  const html = fs.readFileSync(path.join(__dirname, folder, 'index.html'), 'utf8');
  const source = html.match(/<script id="scene-model">([\s\S]*?)<\/script>/);
  assert.ok(source, 'The animation must expose its deterministic scene model');
  const ctx = vm.createContext({URLSearchParams});
  vm.runInContext(source[1], ctx);
  return expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, ctx));
}
test('A01: each advance appends one chunk and evidence arrives only after its tool', () => {
  const run = load('a01-react-loop');
  assert.deepEqual(run('sceneFor(defaults()).chunks.map(c => c.kind)'), ['system prompt','tools','user prompt']);
  const expected = ['thinking','tool','observation','thinking','tool','observation','thinking','tool','observation','thinking','tool','observation','thinking','final'];
  expected.forEach((kind, i) => {
    const scene = run(`sceneFor(parseState('#step=${i+1}'))`);
    assert.equal(scene.chunks.length, i+4);
    assert.equal(scene.current.kind, kind);
  });
  assert.equal(run('sceneFor(parseState("#step=2")).tool.result'), null);
  assert.match(run('sceneFor(parseState("#step=3")).tool.result'), /预期 5，实际 -1/);
  assert.equal(run('sceneFor(parseState("#step=5")).tool.result'), null);
  assert.match(run('sceneFor(parseState("#step=6")).tool.result'), /a - b/);
  assert.equal(run('sceneFor(parseState("#step=8")).tool.result'), null);
  assert.equal(run('sceneFor(parseState("#step=9")).tool.result'), '修改已应用。');
  assert.doesNotMatch(run('JSON.stringify(sceneFor(parseState("#step=11")))'), /1 passed/);
  assert.match(run('sceneFor(parseState("#step=12")).tool.result'), /1 passed/);
  assert.equal(run('sceneFor(parseState("#step=14")).phase'), 'final');
  assert.equal(run('nextState(parseState("#step=14"))'), null);
});
test('A01: legacy main links work, obsolete failure and out-of-range steps reset', () => {
  const run = load('a01-react-loop');
  assert.equal(run('parseState("#step=3&branch=main&motion=full").step'), 3);
  for (const hash of ['#branch=fail&step=3','#step=15','#step=19','#step=Infinity','#unknown=yes']) {
    assert.equal(run(`parseState(${JSON.stringify(hash)}).step`), 0);
  }
  assert.equal(run('prevState(defaults())'), null);
});
test('A01: rendered tool output keeps code operators and test status words intact', () => {
  const html=fs.readFileSync(path.join(__dirname,'a01-react-loop/index.html'),'utf8');
  const ctx=vm.createContext({URLSearchParams});
  for(const id of ['scene-model','scene-art'])vm.runInContext(html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`))[1],ctx);
  const read=vm.runInContext('drawScene(sceneFor(parseState("#step=6")))',ctx);
  const pass=vm.runInContext('drawScene(sceneFor(parseState("#step=12")))',ctx);
  const toolPanel=svg=>svg.slice(svg.indexOf('id="tool-panel"'));
  assert.match(toolPanel(read), /=&gt;/);
  assert.doesNotMatch(toolPanel(read), /<\/text><text[^>]*>&gt;/);
  assert.match(toolPanel(pass), /passed<\/text>/);
});
test('A02: custom base preserves supplements, skill text arrives only after read, theme does not affect input', () => {
  const run = load('a02-pi-context');
  const a = run('sceneFor(parseState("#step=7&base=default"))');
  const b = run('sceneFor(parseState("#step=7&base=custom"))');
  assert.deepEqual(a.supplements, b.supplements);
  assert.notEqual(a.base, b.base);
  assert.equal(run('sceneFor(parseState("#step=12")).skillBody'), false);
  assert.equal(run('sceneFor(parseState("#step=13")).skillBody'), true);
  assert.equal(run('sceneFor(parseState("#step=16")).summarized'), true);
  assert.deepEqual(run('sceneFor(parseState("#step=14&theme=dark")).messages'), run('sceneFor(parseState("#step=14&theme=light")).messages'));
});
test('A03: responsibilities migrate one at a time; direct legacy links show the complete stage', () => {
  const run = load('a03-e2e-loops');
  assert.equal(run('nextState(parseState("#step=9")).sub'), 1);
  assert.deepEqual(run('sceneFor(parseState("#step=10&sub=1")).owners'), ['human','harness','model','harness','human','human']);
  assert.deepEqual(run('sceneFor(parseState("#step=10")).owners'), ['human','harness','model','harness','model','human']);
  assert.equal(run('nextState(parseState("#step=10&sub=1")).step'), 10);
  assert.equal(run('nextState(parseState("#step=10&sub=1")).sub'), 0);
  assert.equal(run('prevState(parseState("#step=10")).sub'), 1);
});
test('A03: final requires an explicit decision and authorization still goes through verification', () => {
  const run = load('a03-e2e-loops');
  assert.equal(run('nextState(parseState("#step=18"))'), null);
  assert.equal(run('sceneFor(parseState("#step=18")).verdict'), 'candidate');
  assert.equal(run('sceneFor(parseState("#step=19&decision=accept")).verdict'), 'accepted');
  assert.equal(run('parseState("#step=19").step'), 0);
  assert.equal(run('nextState(parseState("#branch=fail&step=3"))'), null);
  assert.equal(run('sceneFor(parseState("#branch=fail&step=9&decision=budget&human=authorize")).verdict'), 'none');
  assert.equal(run('nextState(parseState("#branch=fail&step=11&decision=budget&human=authorize")).step'), 15);
});
for (const folder of ['a01-react-loop','a02-pi-context','a03-e2e-loops']) {
  test(folder + ': malformed state falls back safely and valid state round trips', () => {
    const run = load(folder);
    for (const hash of ['#step=-1','#step=999','#step=NaN','#step=2&step=3','#motion=oops','#branch=bad']) {
      assert.equal(run(`parseState(${JSON.stringify(hash)}).step`), 0, hash);
    }
    assert.deepEqual(run('parseState(serializeState(parseState("#step=2&motion=reduced")))'), run('parseState("#step=2&motion=reduced")'));
  });
}

// The browser's clock and DOM API are substituted only for player scheduling.
// Scene rendering, navigation and event handlers execute the actual inline code.
function player(folder, hash='') {
  const html=fs.readFileSync(path.join(__dirname,folder,'index.html'),'utf8');
  const elements=new Map(), listeners=new Map(), timers=new Map();
  let now=0, timerId=0;
  class Element {
    constructor(id) {this.id=id;this.style={};this.attrs={};this.open=false;this._html='';this.listeners={};}
    set innerHTML(value){this._html=value;register(value);}
    get innerHTML(){return this._html;}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){this.listeners[k]=fn;}
    querySelector(selector){return selector==='svg'?elements.get('svg'):new Element(selector);}
    insertAdjacentHTML(_,value){register(value);}
    append(){}
    focus(){}
    animate(){return {cancel(){}};}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.close?.();}
  }
  function register(markup){for(const match of markup.matchAll(/\bid="([^"]+)"/g))elements.set(match[1],new Element(match[1]));}
  register(html);elements.set('svg',new Element('svg'));
  const location={hash};
  const ctx=vm.createContext({URLSearchParams,location,matchMedia:()=>({matches:false,addEventListener(){}}),
    document:{getElementById:id=>elements.get(id),addEventListener:(k,fn)=>listeners.set('document:'+k,fn)},
    window:{history:{replaceState:(_,__,value)=>{location.hash=value;}}},
    addEventListener:(k,fn)=>listeners.set(k,fn),
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},
    clearTimeout:id=>timers.delete(id)});
  for(const id of ['scene-model','scene-art','player'])vm.runInContext(html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`))[1],ctx);
  return {
    run:expr=>vm.runInContext(expr,ctx),
    markup:()=>elements.get('stage').innerHTML,
    tick(ms){const end=now+ms;while(true){const first=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].fn();}now=end;},
    event:name=>listeners.get(name)?.(),
    key(key,closest=()=>null){let prevented=false;listeners.get('document:keydown')({key,target:{closest},preventDefault(){prevented=true;}});return prevented;},
  };
}
test('player: observation lands after return animation; another advance finishes without skipping',()=>{
  const p=player('a01-react-loop','#step=5');
  p.run('forward()');
  assert.equal(p.run('state.step'),6);
  assert.doesNotMatch(p.markup(),/id="chunk-8"/);
  p.tick(649);assert.doesNotMatch(p.markup(),/id="chunk-8"/);
  p.tick(1);assert.match(p.markup(),/id="chunk-8"/);
  assert.equal(p.run('!!playing'),true);
  p.run('forward()');assert.equal(p.run('state.step'),6);
  assert.equal(p.run('!!playing'),false);
  p.tick(3000);assert.equal(p.run('state.step'),6);
  p.run('forward()');p.tick(1000);assert.equal(p.run('state.step'),7);
  assert.match(p.markup(),/id="chunk-9"/);
});
test('player: reset cancels pending commits, replay repeats the same step, reduced motion settles immediately',()=>{
  const p=player('a01-react-loop','#step=5');
  p.run('forward()');p.tick(700);p.run('reset()');p.tick(4000);
  assert.equal(p.run('state.step'),0);assert.doesNotMatch(p.markup(),/id="chunk-8"/);
  p.run('navigate(parseState("#step=6"))');p.run('replay()');
  assert.doesNotMatch(p.markup(),/id="chunk-8"/);p.tick(1000);
  assert.equal(p.run('state.step'),6);assert.match(p.markup(),/id="chunk-8"/);
  p.run('navigate(parseState("#step=5&motion=reduced"))');p.run('forward()');
  assert.equal(p.run('!!playing'),false);assert.match(p.markup(),/id="chunk-8"/);
});
test('A01: scrolling preserves history, advancing follows latest, and backward cancels playback',()=>{
  const p=player('a01-react-loop','#step=12');
  const bottom=p.run('scrollOffset');
  assert.ok(bottom>0);
  p.run('scrollContext(-10000)');assert.equal(p.run('scrollOffset'),0);
  assert.match(p.markup(),/id="chunk-0"/);
  assert.match(p.markup(),/id="chunk-14"/);
  p.run('forward()');p.tick(1000);assert.ok(p.run('scrollOffset')>bottom);
  p.run('forward()');p.tick(200);p.run('backward()');p.tick(2000);
  assert.equal(p.run('state.step'),13);
  assert.doesNotMatch(p.markup(),/id="chunk-16"/);
  p.event('resize');assert.equal(p.run('!!playing'),false);
});
test('A01: keyboard navigation, replay and reset work without visible transport buttons',()=>{
  const p=player('a01-react-loop','#step=13');
  p.key('ArrowRight');
  assert.equal(p.run('!!playing'),true);
  p.key(' ');
  assert.equal(p.run('state.step'),14);
  assert.equal(p.run('!!playing'),false);
  p.key('ArrowRight');assert.equal(p.run('state.step'),14);
  p.key('ArrowLeft');assert.equal(p.run('state.step'),13);
  p.key('p');assert.equal(p.run('!!playing'),true);
  p.tick(1000);assert.equal(p.run('state.step'),13);
  p.key('r');assert.equal(p.run('state.step'),0);
});
test('A01: hash navigation and stage jumps cancel old timers and restore the selected history',()=>{
  const p=player('a01-react-loop','#step=11');
  p.run('forward()');p.tick(300);
  p.run('location.hash="#step=3&motion=reduced"');p.event('hashchange');p.tick(2000);
  assert.equal(p.run('state.step'),3);
  assert.match(p.markup(),/预期 5/);
  assert.doesNotMatch(p.markup(),/1 passed/);
  p.run('jump(10)');
  assert.equal(p.run('state.step'),10);
  assert.match(p.markup(),/修改已应用/);
  assert.doesNotMatch(p.markup(),/1 passed/);
});
test('player: A02 base replacement preserves later messages and resize settles the pending scene',()=>{
  const p=player('a02-pi-context','#step=13');
  p.run('$("custom").onchange({target:{checked:true}})');
  assert.match(p.markup(),/默认基础/);p.tick(1300);
  assert.match(p.markup(),/自定义基础/);assert.match(p.markup(),/SKILL.md 正文/);
  p.event('resize');assert.equal(p.run('!!playing'),false);
  assert.match(p.markup(),/APPEND/);assert.match(p.markup(),/技能目录/);
});
test('player: A03 advances migration substates one at a time and preserves decision gates',()=>{
  const p=player('a03-e2e-loops','#step=9');
  p.key(' ');assert.equal(p.run('state.sub'),1);
  p.tick(1800);assert.match(p.markup(),/id="responsibility-3" data-owner="harness"/);
  assert.match(p.markup(),/id="responsibility-4" data-owner="human"/);
  p.key('ArrowRight');p.tick(1800);
  assert.equal(p.run('state.step'),10);assert.equal(p.run('state.sub'),0);
  assert.match(p.markup(),/id="responsibility-4" data-owner="model"/);
  p.run('navigate(parseState("#step=18"))');p.key('ArrowRight');
  assert.equal(p.run('state.step'),18);
  p.run('dispatch("decide:accept")');p.tick(1800);assert.match(p.markup(),/已接受/);
});
