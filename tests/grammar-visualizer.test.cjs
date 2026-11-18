const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../js/practiceCore.js');
const notes=require('../js/grammarNotes.js');
const visualizer=require('../js/grammarVisualizer.js');
const rootPath=path.join(__dirname,'..');
function corpus(){
  const source=fs.readFileSync(path.join(rootPath,'lessons/lessonData.js'),'utf8');
  const seen=new Set(),rows=[];
  for(const line of source.split('\n')){
    const m=line.match(/^\s*(L0[89]_P\d+_p\d+):\s*("(?:\\.|[^"\\])*"),?\s*$/);
    if(!m||seen.has(m[1]))continue;
    seen.add(m[1]);
    for(const text of core.splitSentences(JSON.parse(m[2])))rows.push({lesson:Number(m[1].slice(1,3)),text,paragraph:m[1]});
  }
  return rows;
}
test('Every Lesson 8/9 sentence has a sentence-matched draft explanation',()=>{
  const sentences=corpus();
  assert.ok(sentences.length>=100);
  assert.ok(notes.entries.length>=100);
  for(const s of sentences){
    const points=notes.forSentence(s.lesson,s.text);
    assert.ok(points.length,s.paragraph+': '+s.text);
    for(const point of points){
      assert.ok(s.text.toLowerCase().includes(point.focus.toLowerCase()));
      assert.ok(s.text.toLowerCase().includes(point.target.toLowerCase()));
      assert.ok(point.explain.length>=12);
    }
  }
  for(const point of notes.entries){
    assert.ok(sentences.some(s=>s.lesson===point.lesson&&notes.forSentence(s.lesson,s.text).includes(point)),point.match);
  }
  assert.deepEqual(notes.forSentence(1,sentences[0].text),[]);
  assert.deepEqual(notes.forSentence(8,'This sentence was made up.'),[]);
});
function fakeNode(name='div'){
  return {
    name,textContent:'',title:'',hidden:false,disabled:false,children:[],attrs:{},listeners:{},className:'',
    setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,fn){this.listeners[k]=fn;},
    appendChild(child){this.children.push(child);return child;},
    replaceChildren(...children){this.children=children;},
    focus(){this.focused=true;},
    click(){this.listeners.click?.();}
  };
}
test('Grammar overlay navigation, highlights, and close are independent of narration',()=>{
  const previous=global.PowerOnGrammarNotes;
  global.PowerOnGrammarNotes=notes;
  try{
    const selectors={};
    const doc={createElement:name=>{const node=fakeNode(name);node.querySelector=s=>selectors[s]||(selectors[s]=fakeNode(s));return node;},createTextNode:text=>({textContent:text})};
    const root=fakeNode('root');root.ownerDocument=doc;
    const classes=new Set();root.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name)};
    const stage=fakeNode('stage'),button=fakeNode('button');
    let pauses=0;
    const grammar=visualizer.mount({root,stage,button,lesson:8,splitSentences:core.splitSentences,getScene:()=>null,onOpen:()=>pauses++});
    assert.ok(grammar);
    const scene={sentences:['The city is close to the world-famous Niagara Falls, which stretches along the border between the U.S. and Canada.','St. Catharines is a small city along the shore of Lake Ontario.'],english:''};
    grammar.update(scene);assert.equal(grammar.getState().sentences,2);
    button.click();assert.equal(grammar.isOpen(),true);assert.equal(pauses,1);
    assert.equal(button.attrs['aria-pressed'],'true');
    assert.ok(selectors['.po-grammar-explain'].textContent.includes('Niagara Falls'));
    assert.ok(selectors['.po-grammar-sentence'].children.some(c=>c.name==='mark'));
    selectors['[data-grammar="nextSentence"]'].click();
    assert.equal(grammar.getState().sentenceIndex,1);
    assert.ok(selectors['.po-grammar-explain'].textContent.includes('主語'));
    grammar.update({sentences:['She hid by day.'],english:'She hid by day.'});
    assert.equal(grammar.getState().sentenceIndex,0);
    assert.equal(grammar.close(),true);assert.equal(grammar.close(),false);
    assert.equal(button.attrs['aria-pressed'],'false');assert.equal(classes.has('po-grammar-on'),false);
  }finally{if(previous===undefined)delete global.PowerOnGrammarNotes;else global.PowerOnGrammarNotes=previous;}
});
test('Assets load in order and Story Theater passes exact sentence metadata',()=>{
  const index=fs.readFileSync(path.join(rootPath,'index.html'),'utf8');
  const practice=fs.readFileSync(path.join(rootPath,'js/practice.js'),'utf8');
  const theater=fs.readFileSync(path.join(rootPath,'js/storyTheater.js'),'utf8');
  assert.ok(index.includes('css/grammarVisualizer.css'));
  assert.ok(index.indexOf('js/grammarNotes.js')<index.indexOf('js/grammarVisualizer.js'));
  assert.ok(index.indexOf('js/grammarVisualizer.js')<index.indexOf('js/storyTheater.js'));
  assert.match(practice,/lesson:Number\(currentLesson\),grammarEnabled:currentLevel==='standard'/);
  assert.match(practice,/splitSentences:core\.splitSentences/);
  assert.match(practice,/sentences:scene\.sentences/);
  assert.match(theater,/grammar\?\.update\(s\.scene\)/);
  assert.match(theater,/if\(!grammar\?\.close\?\.\(\)\)session\.close\('back'\)/);
});


test('Compact layout collapses long explanations on small viewports, then restores them',()=>{
  const prev=global.PowerOnGrammarNotes;
  global.PowerOnGrammarNotes=notes;
  try{
    const selectors={};
    const doc={
      createElement:name=>{
        const node=fakeNode(name);
        node.classList={toggle(){}};
        node.remove=()=>{node.removed=true;};
        node.querySelector=s=>selectors[s]||(selectors[s]=fakeNode(s));
        return node;
      },
      createTextNode:text=>({textContent:text})
    };
    const root=fakeNode('root'),button=fakeNode('button'),stage=fakeNode('stage');
    root.ownerDocument=doc;root.classList={toggle(){}};
    let width=375,height=295;
    stage.getBoundingClientRect=()=>({width,height});
    const grammar=visualizer.mount({root,stage,button,lesson:9,splitSentences:core.splitSentences,getScene:()=>null});
    grammar.update({sentences:['English has a huge vocabulary.'],english:'English has a huge vocabulary.'});
    grammar.open();
    assert.equal(grammar.getState().compact,true);
    assert.equal(grammar.getState().explanationVisible,false);
    assert.equal(selectors['.po-grammar-comment'].hidden,true);
    selectors['[data-grammar="toggleExplain"]'].click();
    assert.equal(grammar.getState().explanationVisible,true);
    assert.equal(selectors['.po-grammar-comment'].hidden,false);
    assert.equal(selectors['[data-grammar="toggleExplain"]'].attrs['aria-expanded'],'true');
    grammar.close();
    grammar.open();
    assert.equal(grammar.getState().explanationVisible,true,'teacher preference survives reopening');
    grammar.destroy();
    assert.equal(stage.children[0].removed,true);
  }finally{if(prev===undefined)delete global.PowerOnGrammarNotes;else global.PowerOnGrammarNotes=prev;}
});
test('Compact classroom CSS preserves a fixed viewport and accessible fallback scroll',()=>{
  const css=fs.readFileSync(path.join(rootPath,'css/grammarVisualizer.css'),'utf8');
  const theater=fs.readFileSync(path.join(rootPath,'js/storyTheater.js'),'utf8');
  assert.match(css,/\.story-theater\.po-grammar-on\s*\{[^}]*height:100dvh/s);
  assert.match(css,/\.po-grammar-center\s*\{[^}]*overflow-y:auto/s);
  assert.match(css,/\.po-grammar-overlay\.is-compact/s);
  assert.match(theater,/grammar\?\.destroy\?\.\(\)/);
  assert.match(theater,/\.po-grammar-overlay button:not\(:disabled\)/);
});
