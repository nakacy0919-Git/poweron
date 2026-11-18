/* Sentence-anchored relationship geometry for PowerOn Grammar Visualizer.
   All source spans are exact substrings of the selected textbook sentence. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PowerOnGrammarRelations=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const inside=(a,b,r)=>a>=r.start&&b<=r.end;
  const normalize=x=>String(x||'').toLocaleLowerCase('en');
  function rangeOf(text,phrase){
    const source=String(text||''),term=String(phrase||'');
    if(!term)return null;
    const start=normalize(source).indexOf(normalize(term));
    return start<0?null:{start,end:start+term.length};
  }
  function classify(note){
    if(!note)return {kind:'none',title:'構造を確認',focusLabel:'注目する表現',targetLabel:'つながる語句',lineLabel:''};
    const tag=String(note.tag||'');
    if(/関係(代名詞|副詞)|関係詞/.test(tag)){
      return {kind:'relative',title:'関係詞が先行詞を説明',focusLabel:'関係詞節（説明する部分）',targetLabel:'先行詞（説明される語）',lineLabel:'修飾先'};
    }
    if(/分詞.*(前置|後置)修飾/.test(tag)){
      return {kind:'modifier',title:'分詞が名詞を修飾',focusLabel:'修飾する語句',targetLabel:'修飾される名詞',lineLabel:'修飾先'};
    }
    if(/目的の so that|目的を表す.*不定詞|受動態＋目的の不定詞/.test(tag)){
      return {kind:'purpose',title:'行動とその目的',focusLabel:'目的を表す語句',targetLabel:'行動・中心部分',lineLabel:'目的'};
    }
    if(/because|時を表す|when 節|時・年齢を表す修飾語/.test(tag)){
      return {kind:'context',title:'主節に補足情報を加える',focusLabel:'理由・時を示す表現',targetLabel:'説明される中心部分',lineLabel:'補足'};
    }
    if(/関係代名詞の省略/.test(tag)){
      return {kind:'relative',title:'省略された関係代名詞を考える',focusLabel:'省略後の修飾節',targetLabel:'先行詞',lineLabel:'修飾先'};
    }
    return {kind:'relation',title:'語句のつながりを確認',focusLabel:'注目する表現',targetLabel:'関連する語句',lineLabel:'関連'};
  }
  function keyword(note){
    if(!note)return '';
    if(/関係(代名詞|副詞)|関係詞/.test(note.tag||'')){
      const word=String(note.focus||'').match(/^(who|which|that|where|whose|whom)\b/i);
      return word?word[1]:'';
    }
    return '';
  }
  function pieces(text,note){
    const source=String(text||'');
    const focus=note?rangeOf(source,note.focus):null;
    const target=note?rangeOf(source,note.target):null;
    const key=keyword(note),keyRange=key&&focus?{start:focus.start,end:focus.start+key.length}:null;
    const boundaries=[...new Set([0,source.length,...[focus,target,keyRange].filter(Boolean).flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
    const out=[];
    for(let i=0;i<boundaries.length-1;i++){
      const start=boundaries[i],end=boundaries[i+1],chunk=source.slice(start,end);
      for(const m of chunk.matchAll(/\s+|\S+/g)){
        const a=start+m.index,b=a+m[0].length;
        const focusHit=focus&&inside(a,b,focus),targetHit=target&&inside(a,b,target);
        out.push({text:m[0],start:a,end:b,focus:!!focusHit,target:!!targetHit,keyword:!!keyRange&&inside(a,b,keyRange),space:/^\s+$/.test(m[0])});
      }
    }
    return out;
  }
  function touchingNotes(text,notes,offset){
    return (notes||[]).filter(n=>[n.focus,n.target].some(part=>{
      const r=rangeOf(text,part);return r&&offset>=r.start&&offset<r.end;
    }));
  }
  function centerOf(rect){return {x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};}
  function nearestPair(focusRects,targetRects){
    if(!focusRects?.length||!targetRects?.length)return null;
    let best=null;
    for(const a of focusRects){
      for(const b of targetRects){
        if(![a.left,a.right,a.top,a.bottom,b.left,b.right,b.top,b.bottom].every(Number.isFinite))continue;
        const aa=centerOf(a),bb=centerOf(b);
        const delta=(aa.x-bb.x)**2+(aa.y-bb.y)**2;
        if(!best||delta<best.distance)best={focus:a,target:b,distance:delta};
      }
    }
    return best;
  }
  function layout(focusRects,targetRects,container){
    const pair=nearestPair(focusRects,targetRects);
    if(!pair||!container)return null;
    const f=centerOf(pair.focus),t=centerOf(pair.target);
    // Underline both phrases and connect them with a curved arc ABOVE the text.
    const x1=f.x-container.left,x2=t.x-container.left;
    const y1=pair.focus.top-container.top-6,y2=pair.target.top-container.top-6;
    const distance=Math.abs(x2-x1),h=Math.abs(y2-y1);
    const lift=Math.max(13,Math.min(49,12+distance*.18));
    const control=Math.max(6,Math.min(y1,y2)-lift);
    const sameLine=h<25;
    const path=sameLine
      ?'M '+x1.toFixed(1)+' '+y1.toFixed(1)+' Q '+((x1+x2)/2).toFixed(1)+' '+control.toFixed(1)+' '+x2.toFixed(1)+' '+y2.toFixed(1)
      :'M '+x1.toFixed(1)+' '+y1.toFixed(1)+' C '+x1.toFixed(1)+' '+control.toFixed(1)+', '+x2.toFixed(1)+' '+control.toFixed(1)+', '+x2.toFixed(1)+' '+y2.toFixed(1);
    const labelX=(x1+x2)/2,labelY=sameLine?Math.max(10,(y1+y2)/2-lift*.48):Math.max(10,control+6);
    return {path,from:{x:x1,y:y1},to:{x:x2,y:y2},label:{x:labelX,y:labelY},sameLine};
  }
  return {rangeOf,classify,keyword,pieces,touchingNotes,nearestPair,layout};
});
