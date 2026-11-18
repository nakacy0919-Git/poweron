const test=require('node:test');
const assert=require('node:assert/strict');
const relations=require('../js/grammarRelations.js');
const notes=require('../js/grammarNotes.js');

const examples=[
  {lesson:8,text:'The city is close to the world-famous Niagara Falls, which stretches along the border between the U.S. and Canada.',focus:'which stretches along the border between the U.S. and Canada',target:'Niagara Falls'},
  {lesson:8,text:'For example, Quakers living in Philadelphia helped them because they strongly believed in human equality.',focus:'living in Philadelphia',target:'Quakers'},
  {lesson:9,text:'There are many ways that new words are created in English today from words that already exist.',focus:'that new words are created in English today',target:'many ways'}
];

test('Exact source range: relative clause and antecedent both match real Lesson 8 text',()=>{
  for(const {lesson,text,focus,target} of examples){
    const note=notes.forSentence(lesson,text).find(n=>n.focus===focus&&n.target===target);
    assert.ok(note,focus);
    const focusRange=relations.rangeOf(text,note.focus),targetRange=relations.rangeOf(text,note.target);
    assert.ok(focusRange&&targetRange);
    assert.equal(text.slice(focusRange.start,focusRange.end).toLowerCase(),focus.toLowerCase());
    assert.equal(text.slice(targetRange.start,targetRange.end).toLowerCase(),target.toLowerCase());
    const tokens=relations.pieces(text,note);
    assert.equal(tokens.map(t=>t.text).join(''),text,'must preserve punctuation and spaces verbatim');
    assert.ok(tokens.some(t=>t.focus&&!t.target));
    assert.ok(tokens.some(t=>t.target&&!t.focus));
  }
  assert.equal(relations.rangeOf('English is dynamic.','not in original'),null);
});
test('Only explicit grammar relationships are identified as modifier, relative, reason, or purpose',()=>{
  const relative=notes.forSentence(8,examples[0].text)[0];
  assert.equal(relations.classify(relative).kind,'relative');
  assert.equal(relations.classify(relative).targetLabel,'先行詞（説明される語）');
  assert.equal(relations.keyword(relative),'which');
  assert.equal(relations.classify({tag:'現在分詞の後置修飾'}).kind,'modifier');
  assert.equal(relations.classify({tag:'目的の so that'}).kind,'purpose');
  assert.equal(relations.classify({tag:'because による理由'}).kind,'context');
  assert.equal(relations.classify({tag:'SVO の文型'}).kind,'relation','SVO must not be mislabeled as a modifier');
});
test('SVOC role diagram is never mislabeled as a modification arrow',()=>{
  const template=notes.entries.find(n=>n.match==='English has a huge vocabulary');
  assert.ok(template?.blocks?.length);
  assert.equal(relations.classify(template).kind,'structure');
  assert.equal(relations.classify(template).lineLabel,'');
  assert.equal(relations.classify({tag:'関係代名詞の省略'}).title,'省略された関係詞節が先行詞を説明');
});
test('When highlights overlap, both relationships remain attached to correct words',()=>{
  const text='The boy who plays soccer is my brother.';
  const note={tag:'関係代名詞 who',focus:'who plays soccer',target:'boy who plays'};
  const pieces=relations.pieces(text,note);
  assert.equal(pieces.map(p=>p.text).join(''),text);
  assert.ok(pieces.some(p=>p.focus&&p.target&&p.text==='who'));
  assert.ok(pieces.some(p=>p.keyword&&p.text==='who'));
  const phrase=relations.rangeOf(text,'who');
  const touching=relations.touchingNotes(text,[note],phrase.start);
  assert.equal(touching.length,1);
  assert.equal(relations.touchingNotes(text,[note],0).length,0);
});
test('Geometry attaches a visible arc to the nearest source/target words across wrapping',()=>{
  const to=(left,top,right,bottom)=>({left,top,right,bottom});
  const focus=[to(600,70,645,97),to(50,125,100,154)];
  const target=[to(355,70,430,97),to(445,70,505,97)];
  const pair=relations.nearestPair(focus,target);
  assert.equal(pair.focus,focus[0],'prefer same-line attachment');
  assert.equal(pair.target,target[1]);
  const curve=relations.layout(focus,target,to(0,0,900,240));
  assert.ok(curve?.sameLine);
  assert.match(curve.path,/^M \d+\.\d \d+\.\d Q /);
  assert.ok(curve.from.x>curve.to.x);
  assert.ok(curve.label.y>=10);
  const crossing=relations.layout([to(100,130,130,156)],[to(380,80,410,110)],to(0,0,720,240));
  assert.equal(crossing.sameLine,false);
  assert.match(crossing.path,/ C /);
  assert.equal(relations.layout([],target,to(0,0,900,240)),null);
});
test('Sentence-anchored arrow is drawn from real DOM word rectangles; tapping a word highlights its relationship',()=>{
  const prior=global.PowerOnGrammarNotes;
  global.PowerOnGrammarNotes=notes;
  const visualizer=require('../js/grammarVisualizer.js');
  try{
    const selected={};
    function fakeNode(name='div'){
      return {
        name,textContent:'',title:'',hidden:false,disabled:false,style:{},children:[],attrs:{},listeners:{},
        setAttribute(k,v){this.attrs[k]=String(v)},
        getAttribute(k){return this.attrs[k]??null},
        addEventListener(k,fn){this.listeners[k]=fn},
        removeEventListener(){},
        appendChild(node){this.children.push(node);return node},
        replaceChildren(...nodes){this.children=nodes},
        focus(){this.focused=true},
        remove(){this.removed=true},
        click(){this.listeners.click?.()}
      };
    }
    const doc={createElement:name=>{
      const node=fakeNode(name);node.classList={toggle(){}};
      node.querySelector=s=>selected[s]||(selected[s]=fakeNode(s));
      if(name==='mark'){
        node.getClientRects=()=>{
          const word=String(node.textContent);
          if(word==='which')return [{left:700,right:740,top:104,bottom:136}];
          if(word==='Falls')return [{left:210,right:250,top:104,bottom:136}];
          if(word==='Niagara')return [{left:690,right:715,top:104,bottom:136}];
          return [{left:230,right:280,top:104,bottom:136}];
        };
      }
      return node;
    },createTextNode:text=>({textContent:text})};
    const root=fakeNode('root'),stage=fakeNode('stage'),button=fakeNode('button');
    root.ownerDocument=doc;root.classList={toggle(){}};
    selected['.po-grammar-sentence-map']=fakeNode('map');
    selected['.po-grammar-sentence-map'].getBoundingClientRect=()=>({left:0,top:0,right:900,bottom:220,width:900,height:220});
    const grammar=visualizer.mount({root,stage,button,lesson:8,splitSentences:x=>[x],getScene:()=>null});
    grammar.update({sentences:[examples[0].text],english:examples[0].text});
    grammar.open();
    const path=selected['.po-grammar-link-path'];
    assert.ok(path.attrs.d&&path.attrs.d.startsWith('M '),'renders a real connector from word measurements');
    assert.match(path.attrs.d,/^M 720\.0 98\.0 /,'the arrow begins at the actual which token, not an arbitrary word in its clause');
    assert.match(path.attrs.d,/ 230\.0 98\.0$/,'the arrow lands on Falls, not the closer but wrong Niagara token');
    assert.equal(selected['.po-grammar-links'].hidden,false);
    assert.equal(selected['.po-grammar-link-caption'].textContent,'修飾先');
    const words=selected['.po-grammar-sentence'].children;
    const which=words.find(w=>w.textContent==='which'&&w.name==='mark');
    assert.ok(which,'the relative pronoun is individually selectable');
    assert.ok(which.className.includes('is-keyword'),'key grammatical word has stronger highlight');
    which.click();
    assert.equal(grammar.getState().wordFocus?.text,'which');
    assert.match(selected['.po-grammar-word-lens'].textContent,/Niagara Falls/,'tapping which reveals its antecedent');
    const selectedAgain=selected['.po-grammar-sentence'].children.find(w=>w.name==='mark'&&w.textContent==='which');
    assert.equal(selectedAgain.focused,true,'focus is restored after a reactive repaint');
    assert.match(selected['.po-grammar-word-lens'].textContent,/which/);
    assert.equal(selected['.po-grammar-word-lens'].hidden,false);
    grammar.update({sentences:['St. Catharines is a small city along the shore of Lake Ontario.'],english:'St. Catharines is a small city along the shore of Lake Ontario.'});
    assert.equal(selected['.po-grammar-links'].hidden,true,'SVC roles never pretend to be modification links');
    assert.equal(selected['.po-grammar-pattern'].hidden,false);
    grammar.close();
    assert.equal(selected['.po-grammar-links'].hidden,true);
    grammar.destroy();
  }finally{if(prior===undefined)delete global.PowerOnGrammarNotes;else global.PowerOnGrammarNotes=prior;}
});
