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
  const run = load('a02-pi-context(已废弃)');
  const a = run('sceneFor(parseState("#step=7&base=default"))');
  const b = run('sceneFor(parseState("#step=7&base=custom"))');
  assert.deepEqual(a.supplements, b.supplements);
  assert.notEqual(a.base, b.base);
  assert.equal(run('sceneFor(parseState("#step=12")).skillBody'), false);
  assert.equal(run('sceneFor(parseState("#step=13")).skillBody'), true);
  assert.equal(run('sceneFor(parseState("#step=16")).summarized'), true);
  assert.deepEqual(run('sceneFor(parseState("#step=14&theme=dark")).messages'), run('sceneFor(parseState("#step=14&theme=light")).messages'));
});
test('A03: six eras expand AI ownership while goal and acceptance remain human', () => {
  const run = load('a03-e2e-loops');
  const owners = Array.from({length:6}, (_,step)=>run(`sceneFor(parseState('#step=${step}')).owners`));
  assert.deepEqual(owners.map(row=>row.filter(x=>x==='ai').length), [1,2,3,6,7,8]);
  owners.forEach(row=>{assert.equal(row.length,10);assert.equal(row[0],'human');assert.equal(row[9],'human');});
  assert.equal(run('nextState(parseState("#step=5"))'),null);
  assert.equal(run('prevState(defaults())'),null);
});
test('A03: agent removes manual transport and separates writing from running tests', () => {
  const run = load('a03-e2e-loops');
  for(let step=0;step<6;step++){
    const cards=run(`sceneFor(parseState('#step=${step}')).cards`);
    assert.ok(Array.isArray(cards),'scene exposes the actual ordered workflow');
    assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
    assert.equal(cards[0].id,'goal');assert.equal(cards.at(-1).id,'accept');
    const owner=id=>cards.find(c=>c.id===id)?.owner;
    for(const id of ['paste','copy','adjust'])assert.equal(owner(id),step<3?'human':undefined);
    assert.equal(owner('implement'),step<3?undefined:'ai');
    assert.equal(owner('write-tests'),step<3?'human':'ai');
    assert.equal(owner('unit-tests'),step<4?'human':'ai');
    assert.equal(owner('browser'),step<5?'human':'ai');
    assert.equal(cards.filter(c=>c.owner==='human').length,[11,10,9,4,3,2][step]);
    if(step<3){
      assert.ok(cards.findIndex(c=>c.id==='paste')<cards.findIndex(c=>c.id==='design'));
      assert.ok(cards.findIndex(c=>c.id==='copy')>cards.findIndex(c=>c.id==='design'));
    }
  }
});
test('A03: default legacy fields normalize; obsolete branches and decisions reset', () => {
  const run=load('a03-e2e-loops');
  assert.deepEqual(run('parseState("#step=2&branch=main&decision=none&human=none&sub=0&motion=reduced")'),{step:2,motion:'reduced'});
  for(const hash of ['#step=6','#step=2&branch=fail','#step=2&decision=accept','#step=2&human=stop','#step=2&sub=1','#step=2&unknown=x'])
    assert.equal(run(`parseState(${JSON.stringify(hash)}).step`),0);
});
for (const folder of ['a01-react-loop','a02-pi-context(已废弃)','a03-e2e-loops']) {
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
  const p=player('a02-pi-context(已废弃)','#step=13');
  p.run('$("custom").onchange({target:{checked:true}})');
  assert.match(p.markup(),/默认基础/);p.tick(1300);
  assert.match(p.markup(),/自定义基础/);assert.match(p.markup(),/SKILL.md 正文/);
  p.event('resize');assert.equal(p.run('!!playing'),false);
  assert.match(p.markup(),/APPEND/);assert.match(p.markup(),/技能目录/);
});
test('A03: each advance changes one era and fast advance only settles animation',()=>{
  const p=player('a03-e2e-loops');
  for(let step=1;step<=5;step++){
    p.key('ArrowRight');assert.equal(p.run('state.step'),step);
    assert.equal(p.run('!!playing'),true);
    p.key(' ');assert.equal(p.run('state.step'),step);
    assert.equal(p.run('!!playing'),false);
    p.tick(2000);assert.equal(p.run('state.step'),step);
  }
  p.key('ArrowRight');assert.equal(p.run('state.step'),5);
});
test('A03: agent transition settles to the new workflow and replay repeats that transition',()=>{
  const p=player('a03-e2e-loops','#step=2');
  p.run('forward()');p.tick(199);assert.match(p.markup(),/id="card-paste"/);
  p.tick(701);assert.doesNotMatch(p.markup(),/id="card-paste"/);
  assert.match(p.markup(),/id="card-implement"/);
  p.tick(300);assert.equal(p.run('!!playing'),false);
  p.key('p');assert.equal(p.run('state.step'),3);assert.equal(p.run('!!playing'),true);
  p.tick(1200);assert.doesNotMatch(p.markup(),/id="card-copy"/);
});
test('A03: backward, reset, jumps and hash changes cancel pending playback',()=>{
  const p=player('a03-e2e-loops','#step=2');
  p.run('forward()');p.tick(400);p.key('ArrowLeft');p.tick(2000);
  assert.equal(p.run('state.step'),2);assert.match(p.markup(),/id="card-paste"/);
  p.run('forward()');p.tick(100);p.run('jump(5)');p.tick(2000);
  assert.equal(p.run('state.step'),5);assert.doesNotMatch(p.markup(),/id="card-copy"/);
  p.run('replay()');p.tick(400);p.run('location.hash="#step=1&motion=reduced"');p.event('hashchange');p.tick(2000);
  assert.equal(p.run('state.step'),1);assert.equal(p.run('!!playing'),false);
  p.run('forward()');assert.equal(p.run('state.step'),2);assert.equal(p.run('!!playing'),false);
  p.key('r');assert.equal(p.run('state.step'),0);assert.equal(p.run('state.motion'),'reduced');
  p.run('navigate(parseState("#step=2"))');p.run('forward()');p.tick(400);p.run('reset()');p.tick(2000);
  assert.equal(p.run('state.step'),0);assert.match(p.markup(),/id="card-paste"/);
});
test('A03: all settled layouts fit, and workflow routes avoid cards and shared handoff ports',()=>{
  const html=fs.readFileSync(path.join(__dirname,'a03-e2e-loops/index.html'),'utf8');
  const ctx=vm.createContext({URLSearchParams});
  for(const id of ['scene-model','scene-art'])vm.runInContext(html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`))[1],ctx);
  for(let step=0;step<6;step++){
    const {cards,edges}=JSON.parse(vm.runInContext(`JSON.stringify((()=>{const cards=layoutCards(sceneFor(parseState('#step=${step}')).cards);return {cards,edges:connections(cards)};})())`,ctx));
    assert.equal(edges.length,cards.length-1);
    cards.forEach((card,i)=>{
      assert.ok(card.y>=366&&card.y+44<=970);
      assert.ok(card.x>=64&&card.x+736<=1856);
      for(const other of cards.slice(i+1))assert.ok(card.x+736<=other.x||other.x+736<=card.x||card.y+44<=other.y||other.y+44<=card.y);
    });
    for(const edge of edges){
      edge.points.slice(1).forEach(([bx,by],i)=>{
        const [ax,ay]=edge.points[i];
        for(const card of cards){
          const vertical=ax===bx&&ax>card.x&&ax<card.x+736&&Math.max(ay,by)>card.y&&Math.min(ay,by)<card.y+44;
          const horizontal=ay===by&&ay>card.y&&ay<card.y+44&&Math.max(ax,bx)>card.x&&Math.min(ax,bx)<card.x+736;
          assert.equal(vertical||horizontal,false,`${step}: ${edge.from} → ${edge.to} crosses ${card.id}`);
        }
      });
    }
    const handoffs=edges.filter(edge=>edge.cross);
    assert.equal(handoffs.length,2);
    if(handoffs[0].to===handoffs[1].from)assert.notDeepEqual(handoffs[0].points.at(-1),handoffs[1].points[0],'input and output arrows must remain distinguishable');
  }
});
