const test=require('node:test');
const assert=require('node:assert/strict');
const notes=require('../js/grammarNotes.js');
const relations=require('../js/grammarRelations.js');
const visualizer=require('../js/grammarVisualizer.js');

const original='The city is close to the world-famous Niagara Falls, which stretches along the border between the U.S. and Canada.';

test('Semantic arrows attach to the authored grammatical head, not the nearest unrelated clause word',()=>{
  const note=notes.forSentence(8,original)[0];
  const hints=relations.anchorRanges(original,note);
  assert.equal(hints.curated,true);
  assert.equal(original.slice(hints.focus.start,hints.focus.end),'which');
  assert.equal(original.slice(hints.target.start,hints.target.end),'Falls');
  assert.ok(hints.focus.start>hints.target.end);
  assert.equal(relations.anchorRanges(original,{...note,focusAnchor:'imaginary'}),null);
  const law='The Fugitive Slave Law of 1850, which prohibited anyone from helping escaping slaves, was very cruel.';
  const n=notes.forSentence(8,law).find(p=>p.tag.includes('関係代名詞'));
  assert.ok(n);
  const h=relations.anchorRanges(law,n);
  assert.equal(law.slice(h.target.start,h.target.end),'Law','link law, not the unrelated year 1850');
});
test('Every manually curated anchor is contained in its own evidence phrase, and passive vs infinitive remain distinct',()=>{
  const withAnchors=notes.entries.filter(n=>n.focusAnchor||n.targetAnchor);
  assert.ok(withAnchors.length>=33);
  for(const note of withAnchors){
    assert.ok(note.focusAnchor&&note.targetAnchor,note.match);
    const text=note.focus+' | '+note.target;
    const anchors=relations.anchorRanges(text,note);
    assert.ok(anchors?.curated,note.match);
    assert.equal(text.slice(anchors.focus.start,anchors.focus.end).toLowerCase(),note.focusAnchor.toLowerCase());
    assert.equal(text.slice(anchors.target.start,anchors.target.end).toLowerCase(),note.targetAnchor.toLowerCase());
  }
  const passive=notes.entries.find(n=>n.match==='a plaque was unveiled in the chapel'&&n.tag==='受動態 be unveiled');
  const purpose=notes.entries.find(n=>n.match==='a plaque was unveiled in the chapel'&&n.tag==='目的を表す不定詞');
  assert.ok(passive&&purpose);
  assert.equal(relations.classify(passive).kind,'relation');
  assert.equal(relations.classify(purpose).kind,'purpose');
});
test('Teacher-guided reveal follows read, discover, link, explain without leaking answers at the first step',()=>{
  const previous=global.PowerOnGrammarNotes;
  global.PowerOnGrammarNotes=notes;
  try{
    const selected={};
    function mockNode(name='div'){
      return {
        name,textContent:'',hidden:false,disabled:false,attrs:{},style:{},children:[],listeners:{},className:'',
        setAttribute(k,v){this.attrs[k]=String(v)},
        getAttribute(k){return this.attrs[k]||null},
        addEventListener(k,fn){this.listeners[k]=fn},
        removeEventListener(){},
        appendChild(child){this.children.push(child);return child},
        replaceChildren(...values){this.children=values},
        focus(){this.focused=true},
        remove(){this.removed=true},
        click(){this.listeners.click?.()}
      };
    }
    const doc={
      createElement:name=>{
        const node=mockNode(name);
        node.classList={toggle(){}};
        node.querySelector=s=>selected[s]||(selected[s]=mockNode(s));
        if(name==='mark'){
          node.getClientRects=()=>[node.textContent==='Falls'?{left:170,right:235,top:90,bottom:120}:{left:350,right:410,top:90,bottom:120}];
        }
        return node;
      },
      createTextNode:text=>({textContent:text})
    };
    const root=mockNode('root'),stage=mockNode('stage'),trigger=mockNode('button');
    root.ownerDocument=doc;root.classList={toggle(){}};
    selected['.po-grammar-sentence-map']=mockNode('map');
    selected['.po-grammar-sentence-map'].getBoundingClientRect=()=>({left:0,top:0,right:820,bottom:230,width:820,height:230});
    stage.getBoundingClientRect=()=>({left:0,top:0,width:820,height:560});
    let pauses=0;
    const grammar=visualizer.mount({root,stage,button:trigger,lesson:8,getScene:()=>null,onOpen:()=>pauses++});
    grammar.update({sentences:[original],english:original});
    grammar.open();
    assert.equal(pauses,1);
    assert.equal(grammar.getState().revealMode,false);
    assert.equal(selected['.po-grammar-comment'].hidden,false,'default stays fully visible');
    selected['[data-grammar="toggleReveal"]'].click();
    assert.equal(grammar.getState().revealStep,0);
    assert.equal(selected['.po-grammar-sentence'].children.length,1,'show plain sentence only');
    assert.equal(selected['.po-grammar-comment'].hidden,true,'no premature answer text');
    assert.equal(selected['.po-grammar-links'].hidden,true);
    selected['[data-grammar="advanceReveal"]'].click();
    assert.equal(grammar.getState().revealStep,1);
    assert.ok(selected['.po-grammar-sentence'].children.some(w=>w.name==='mark'),'identify color-coded candidates');
    assert.equal(selected['.po-grammar-links'].hidden,true);
    selected['[data-grammar="advanceReveal"]'].click();
    assert.equal(grammar.getState().revealStep,2);
    assert.equal(selected['.po-grammar-relation'].hidden,false);
    assert.equal(selected['.po-grammar-links'].hidden,false,'the curve now reveals the relationship');
    assert.equal(selected['.po-grammar-comment'].hidden,true);
    selected['[data-grammar="advanceReveal"]'].click();
    assert.equal(grammar.getState().revealStep,3);
    assert.equal(selected['.po-grammar-comment'].hidden,false);
    assert.equal(selected['[data-grammar="advanceReveal"]'].disabled,true);
    selected['[data-grammar="toggleReveal"]'].click();
    assert.equal(grammar.getState().revealMode,false);
    assert.equal(selected['.po-grammar-comment'].hidden,false);
    grammar.destroy();
  }finally{if(previous===undefined)delete global.PowerOnGrammarNotes;else global.PowerOnGrammarNotes=previous;}
});
