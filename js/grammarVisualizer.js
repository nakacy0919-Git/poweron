/* Grammar Visualizer: standalone, no external AI/API or framework.
   Scene-based display stays separate from narration/progress and never claims unreviewed parses. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PowerOnGrammarVisualizer=api;
})(typeof window!=='undefined'?window:globalThis,function(host){
  'use strict';
  const relations=host.PowerOnGrammarRelations||{
    pieces:(text)=>[{text,start:0,end:text.length,space:false,focus:false,target:false,keyword:false}],
    classify:()=>({kind:'relation',title:'語句のつながり',focusLabel:'注目する表現',targetLabel:'関連する語句',lineLabel:'関連'}),
    touchingNotes:()=>[],layout:()=>null,keyword:()=>''};
  const trim=s=>String(s||'').replace(/\s+/g,' ').trim();
  const shorten=(s,n=72)=>trim(s).length>n?trim(s).slice(0,n-1)+'…':trim(s);
  const staticMarkup=
    '<div class="po-grammar-top"><div><span class="po-grammar-kicker">GRAMMAR VISUALIZER</span><h2>英文構造を見える化</h2></div>'+
    '<button type="button" data-grammar="close" aria-label="文法解説を閉じる">×</button></div>'+
    '<div class="po-grammar-nav"><button type="button" data-grammar="prevSentence" aria-label="前の英文">‹ 前の文</button>'+
    '<span class="po-grammar-counter" aria-live="polite"></span>'+
    '<button type="button" data-grammar="nextSentence" aria-label="次の英文">次の文 ›</button></div>'+
    '<div class="po-grammar-center"><div class="po-grammar-sentence-map"><svg class="po-grammar-links" aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="poGrammarArrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#f9bb6b"/></marker></defs><path class="po-grammar-link-path" marker-end="url(#poGrammarArrowhead)"></path><circle class="po-grammar-link-from" r="4"></circle><circle class="po-grammar-link-to" r="4"></circle><text class="po-grammar-link-caption" text-anchor="middle"></text></svg><p class="po-grammar-sentence" aria-label="解析する英文"></p></div><p class="po-grammar-word-lens" role="status" hidden></p>'+ 
    '<div class="po-grammar-pattern" aria-label="文型・句の構造" hidden></div>'+
    '<div class="po-grammar-relation" hidden><div class="po-grammar-node po-grammar-node-focus"><small>注目する表現</small><strong data-grammar-field="focus"></strong></div>'+
    '<span class="po-grammar-arrow" aria-hidden="true">→</span>'+
    '<div class="po-grammar-node po-grammar-node-target"><small>つながる語句</small><strong data-grammar-field="target"></strong></div></div>'+
    '<article class="po-grammar-comment" aria-live="polite"><div class="po-grammar-tagline"><span class="po-grammar-kind"></span><span class="po-grammar-relation-title"></span><span class="po-grammar-keyword" hidden></span></div>'+
    '<p class="po-grammar-explain"></p></article></div>'+
    '<footer class="po-grammar-bottom"><div class="po-grammar-steps" aria-label="文法ポイントの切り替え"></div>'+ 
    '<button type="button" class="po-grammar-toggle-explain" data-grammar="toggleExplain" aria-pressed="true">解説を隠す</button>'+
    '<button type="button" class="po-grammar-reveal" data-grammar="nextPoint">次のポイント →</button></footer>';
  function mount({root,stage,button,lesson,splitSentences,getScene,onOpen,onVisibilityChange}){
    if(!root||!stage||!button||typeof getScene!=='function')return null;
    const doc=root.ownerDocument||host.document;
    const panel=doc.createElement('section');
    panel.className='po-grammar-overlay'; panel.hidden=true;
    panel.setAttribute('role','region');panel.setAttribute('aria-label','英文の文法構造と解説');
    panel.innerHTML=staticMarkup;stage.appendChild(panel);
    const q=s=>panel.querySelector(s),b=n=>q('[data-grammar="'+n+'"]');
    let showing=false,scene=null,sentenceIndex=0,pointIndex=0;
    let explanationVisible=true,explanationOverridden=false,compact=false;
    let observer=null,disposed=false,paintGeneration=0,spanElements={focus:[],target:[]},wordFocus=null;
    const prefersReducedMotion=()=>host.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
    function adapt(){
      if(disposed)return;
      const bounds=typeof stage.getBoundingClientRect==='function'?stage.getBoundingClientRect():null;
      // The panel, not the outer stage, determines actual teaching space.
      // iPad portrait can have a tall stage with a considerably shorter card.
      const panelBounds=typeof panel.getBoundingClientRect==='function'?panel.getBoundingClientRect():null;
      const height=panelBounds?.height||panel.clientHeight||bounds?.height||stage.clientHeight||0;
      const width=panelBounds?.width||panel.clientWidth||bounds?.width||stage.clientWidth||0;
      compact=Boolean((height&&height<470)||(width&&width<520));
      panel.classList?.toggle?.('is-compact',compact);
      root.classList.toggle('po-grammar-compact',showing&&compact);
      if(!explanationOverridden)explanationVisible=!((height&&height<370)||(width&&width<500));
      updateExplanationButton();
    }
    function updateExplanationButton(){
      panel.classList?.toggle?.('is-explanation-visible',explanationVisible);
      const control=panel.querySelector('[data-grammar="toggleExplain"]');
      if(!control)return;
      control.textContent=explanationVisible?'解説を隠す':'解説を見る';
      control.setAttribute('aria-pressed',String(explanationVisible));
      control.setAttribute('aria-expanded',String(explanationVisible));
      // The grammar label must stay visible, even on compact phones.
      // Only the lengthy Japanese explanation is toggled.
      panel.querySelector('.po-grammar-explain').hidden=!explanationVisible;
      panel.querySelector('.po-grammar-comment').classList?.toggle?.('is-collapsed',!explanationVisible);
    }
    const sentences=()=>Array.isArray(scene?.sentences)&&scene.sentences.length?scene.sentences:
      (typeof splitSentences==='function'?splitSentences(scene?.english||''):[trim(scene?.english||'')]).filter(Boolean);
    const notesFor=s=>host.PowerOnGrammarNotes?.forSentence?.(lesson,s)||[];
    function sentenceText(node,text,note,points){
      const segments=relations.pieces(text,note);
      node.replaceChildren();
      spanElements={focus:[],target:[]};
      for(const part of segments){
        if(part.space||(!part.focus&&!part.target)){
          node.appendChild(doc.createTextNode(part.text));
          continue;
        }
        const mark=doc.createElement('mark');
        mark.className='po-grammar-highlight '+(part.focus&&part.target?'is-both':part.focus?'is-focus':'is-target')+(part.keyword?' is-keyword':'');
        mark.textContent=part.text;
        mark.tabIndex=0;
        mark.setAttribute('role','button');
        const role=relations.classify(note);
        const label=(part.focus&&part.target?'関連する両方の語句':part.focus?role.focusLabel:role.targetLabel);
        mark.setAttribute('aria-label',part.text+' · '+label+'。押すとこの語句の関係を確認します');
        mark.title=label+'｜タップすると語句に注目';
        if(part.focus)spanElements.focus.push(mark);
        if(part.target)spanElements.target.push(mark);
        const activate=()=>{
          const current=relations.touchingNotes(text,points,part.start);
          if(current.length){
            const next=current.find(n=>n!==points[pointIndex])||current[0];
            const selectedIndex=points.indexOf(next);
            if(selectedIndex>=0)pointIndex=selectedIndex;
          }
          wordFocus={text:part.text.replace(/\s+/g,' ').trim(),label,offset:part.start};
          paint();
        };
        mark.addEventListener('click',activate);
        mark.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}
        });
        node.appendChild(mark);
      }
    }
    function hideArc(){
      const svg=q('.po-grammar-links');
      if(svg)svg.hidden=true;
    }
    function drawArc(expected){
      if(!showing||disposed||expected!==paintGeneration)return;
      const svg=q('.po-grammar-links'),map=q('.po-grammar-sentence-map');
      if(!svg||!map||typeof map.getBoundingClientRect!=='function'){hideArc();return;}
      const focusRects=spanElements.focus.flatMap(el=>typeof el.getClientRects==='function'?[...el.getClientRects()]:[]);
      const targetRects=spanElements.target.flatMap(el=>typeof el.getClientRects==='function'?[...el.getClientRects()]:[]);
      const bounds=map.getBoundingClientRect();
      const curve=relations.layout(focusRects,targetRects,bounds);
      if(!curve||bounds.width<=0||bounds.height<=0){hideArc();return;}
      svg.hidden=false;
      svg.setAttribute('viewBox','0 0 '+bounds.width+' '+bounds.height);
      const path=q('.po-grammar-link-path');
      path?.setAttribute('d',curve.path);
      const start=q('.po-grammar-link-from'),end=q('.po-grammar-link-to');
      start?.setAttribute('cx',curve.from.x);start?.setAttribute('cy',curve.from.y);
      end?.setAttribute('cx',curve.to.x);end?.setAttribute('cy',curve.to.y);
      const descriptor=relations.classify(notesFor(sentences()[sentenceIndex]||'')[pointIndex]);
      const caption=q('.po-grammar-link-caption');
      if(caption){
        caption.textContent=descriptor.lineLabel;
        caption.setAttribute('x',curve.label.x);
        caption.setAttribute('y',curve.label.y);
      }
      if(path?.style){
        path.style.transition='none';
        if(typeof path.getTotalLength==='function'&&!prefersReducedMotion()){
          const length=path.getTotalLength();
          path.style.strokeDasharray=length;
          path.style.strokeDashoffset=length;
          const reveal=()=>{if(expected===paintGeneration&&showing&&!disposed){path.style.transition='stroke-dashoffset .55s ease';path.style.strokeDashoffset='0';}};
          if(host.requestAnimationFrame)host.requestAnimationFrame(reveal);else reveal();
        }else{path.style.strokeDasharray='none';path.style.strokeDashoffset='0';}
      }
    }
    function scheduleArc(){
      const generation=++paintGeneration;
      if(host.requestAnimationFrame)host.requestAnimationFrame(()=>drawArc(generation));
      else drawArc(generation);
    }
    function updateButtons(){
      button.setAttribute('aria-pressed',String(showing));
      button.textContent=showing?'✦ 文法 ON':'✦ 文法解説';
      root.classList.toggle('po-grammar-on',showing);
      panel.hidden=!showing;
      onVisibilityChange?.(showing);
      // The original caption remains visually available when the grammar
      // layer is closed but never receives hidden keyboard focus.
      const caption=root.querySelector?.('.theater-caption');
      if(caption){
        caption.tabIndex=showing?-1:0;
        caption.setAttribute('aria-hidden',String(showing));
      }
    }
    function fitContent(){
      if(disposed||!showing)return;
      const center=q('.po-grammar-center');
      const sentenceNode=q('.po-grammar-sentence');
      if(!center||!sentenceNode)return;
      panel.classList?.toggle?.('is-dense',false);
      sentenceNode.style.fontSize='';
      const overflows=()=>center.clientHeight>0&&center.scrollHeight>center.clientHeight+5;
      if(!overflows())return;
      panel.classList?.toggle?.('is-dense',true);
      // Never shrink classroom text below 14px; preserve legibility.
      if(overflows()&&typeof host.getComputedStyle==='function'){
        let font=parseFloat(host.getComputedStyle(sentenceNode).fontSize);
        while(Number.isFinite(font)&&font>14&&overflows()){
          font=Math.max(14,font-1);
          sentenceNode.style.fontSize=font+'px';
        }
      }
      // If content cannot reasonably fit, keep the heading visible and
      // offer the explanation explicitly; the center can still scroll as fallback.
      if(overflows()&&explanationVisible&&!explanationOverridden){
        explanationVisible=false;
        updateExplanationButton();
      }
    }
    function paint(){
      if(!showing||!scene)return;
      adapt();
      const ss=sentences(),sentence=ss[Math.min(sentenceIndex,ss.length-1)]||trim(scene.english);
      sentenceIndex=Math.max(0,Math.min(ss.length-1,sentenceIndex));
      const points=notesFor(sentence);
      pointIndex=Math.max(0,Math.min(points.length-1,pointIndex));
      const selected=points[pointIndex];
      q('.po-grammar-counter').textContent='LESSON '+lesson+'  ·  文 '+(sentenceIndex+1)+' / '+ss.length;
      b('prevSentence').disabled=sentenceIndex===0;
      b('nextSentence').disabled=sentenceIndex>=ss.length-1;
      const sentenceNode=q('.po-grammar-sentence');
      sentenceNode.classList?.toggle?.('is-long',sentence.length>145&&sentence.length<=220);
      sentenceNode.classList?.toggle?.('is-very-long',sentence.length>220);
      sentenceText(sentenceNode,sentence,selected,points);
      const relationType=relations.classify(selected);
      panel.setAttribute('data-grammar-relation',relationType.kind);
      const wordLens=q('.po-grammar-word-lens');
      if(wordLens){
        wordLens.hidden=!wordFocus;
        if(wordFocus)wordLens.textContent='語句に注目：'+wordFocus.text+'　｜　'+wordFocus.label;
      }
      const linkCaption=q('.po-grammar-link-caption');
      if(linkCaption)linkCaption.textContent=relationType.lineLabel;
      // Avoid returning users to the previous sentence's scrolled position.
      q('.po-grammar-center').scrollTop=0;
      const pattern=q('.po-grammar-pattern');
      pattern.replaceChildren();
      pattern.hidden=!selected?.blocks?.length;
      if(selected?.blocks?.length){
        selected.blocks.forEach((block,i)=>{
          if(i){
            const arrow=doc.createElement('span');
            arrow.className='po-grammar-pattern-arrow';
            arrow.textContent='→';
            arrow.setAttribute('aria-hidden','true');
            pattern.appendChild(arrow);
          }
          const chip=doc.createElement('div');chip.className='po-grammar-pattern-chip';
          const role=doc.createElement('small');role.textContent=block.role;
          const value=doc.createElement('strong');value.textContent=block.text;
          chip.appendChild(role);chip.appendChild(value);pattern.appendChild(chip);
        });
      }
      const relation=q('.po-grammar-relation');
      relation.hidden=!selected||!!selected?.blocks?.length;
      q('.po-grammar-relation-title').textContent=selected?relationType.title:'';
      const keyword=q('.po-grammar-keyword');
      const keywordText=relations.keyword(selected);
      keyword.hidden=!keywordText;
      if(keywordText)keyword.textContent='関係詞 '+keywordText;
      if(selected){
        q('.po-grammar-node-focus small').textContent=relationType.focusLabel;
        q('.po-grammar-node-target small').textContent=relationType.targetLabel;
        q('[data-grammar-field="focus"]').textContent=shorten(selected.focus);
        q('[data-grammar-field="focus"]').title=selected.focus;
        q('[data-grammar-field="target"]').textContent=shorten(selected.target);
        q('[data-grammar-field="target"]').title=selected.target;
        q('.po-grammar-kind').textContent=selected.tag;
        q('.po-grammar-explain').textContent=selected.explain;
      }else{
        q('.po-grammar-kind').textContent='解説準備中';
        q('.po-grammar-explain').textContent='この英文の構文は現在確認中です。文法の役割を推測で表示せず、授業用の正確な解説ができ次第追加します。';
      }
      const steps=q('.po-grammar-steps');steps.replaceChildren();
      points.forEach((item,i)=>{
        const control=doc.createElement('button');control.type='button';
        control.className='po-grammar-step'+(i===pointIndex?' is-selected':'');
        control.textContent=(i+1)+' · '+item.tag;
        control.title=item.tag;
        control.setAttribute('aria-pressed',String(i===pointIndex));
        control.addEventListener('click',()=>{pointIndex=i;paint();});
        steps.appendChild(control);
      });
      b('nextPoint').disabled=!points.length||(pointIndex===points.length-1&&sentenceIndex===ss.length-1);
      b('nextPoint').textContent=points.length&&pointIndex<points.length-1?'次のポイント →':sentenceIndex<ss.length-1?'次の英文 →':'解説を確認';
      fitContent();
      scheduleArc();
    }
    function changeSentence(delta){const ss=sentences();sentenceIndex=Math.max(0,Math.min(ss.length-1,sentenceIndex+delta));pointIndex=0;wordFocus=null;paint();}
    function nextPoint(){
      const ss=sentences(),points=notesFor(ss[sentenceIndex]||'');
      if(pointIndex+1<points.length){pointIndex++;wordFocus=null;paint();}
      else if(sentenceIndex+1<ss.length)changeSentence(1);
    }
    function open(){
      if(showing||disposed)return;
      onOpen?.();
      showing=true;updateButtons();paint();
      b('close').focus();
    }
    function close(){
      if(!showing)return false;
      showing=false;++paintGeneration;hideArc();updateButtons();root.classList.toggle('po-grammar-compact',false);
      button.focus();
      return true;
    }
    function toggle(){if(showing)close();else open();}
    button.addEventListener('click',toggle);
    b('close').addEventListener('click',close);
    b('prevSentence').addEventListener('click',()=>changeSentence(-1));
    b('nextSentence').addEventListener('click',()=>changeSentence(1));
    b('nextPoint').addEventListener('click',nextPoint);
    b('toggleExplain').addEventListener('click',()=>{
      explanationOverridden=true;explanationVisible=!explanationVisible;
      updateExplanationButton();
      fitContent();
    });
    if(typeof host.ResizeObserver==='function'&&typeof stage.getBoundingClientRect==='function'){
      observer=new host.ResizeObserver(()=>{if(showing){adapt();paint();}});
      observer.observe(stage);
    }
    updateButtons();updateExplanationButton();
    return {
      update(next){if(next!==scene){scene=next;sentenceIndex=0;pointIndex=0;wordFocus=null;}paint();},
      toggle,close,isOpen:()=>showing,open,
      previousSentence:()=>changeSentence(-1),nextSentence:()=>changeSentence(1),
      destroy(){
        if(disposed)return;
        close();disposed=true;observer?.disconnect();
        root.classList.toggle('po-grammar-compact',false);
        button.removeEventListener?.('click',toggle);
        panel.remove();
      },
      getState:()=>({showing,sentenceIndex,pointIndex,compact,explanationVisible,sentences:sentences().length,wordFocus})
    };
  }
  return {mount};
});
