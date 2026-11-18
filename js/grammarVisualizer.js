/* Grammar Visualizer: standalone, no external AI/API or framework.
   Scene-based display stays separate from narration/progress and never claims unreviewed parses. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PowerOnGrammarVisualizer=api;
})(typeof window!=='undefined'?window:globalThis,function(host){
  'use strict';
  const trim=s=>String(s||'').replace(/\s+/g,' ').trim();
  const shorten=(s,n=72)=>trim(s).length>n?trim(s).slice(0,n-1)+'…':trim(s);
  const staticMarkup=
    '<div class="po-grammar-top"><div><span class="po-grammar-kicker">GRAMMAR VISUALIZER</span><h2>英文構造を見える化</h2></div>'+
    '<button type="button" data-grammar="close" aria-label="文法解説を閉じる">×</button></div>'+
    '<div class="po-grammar-nav"><button type="button" data-grammar="prevSentence" aria-label="前の英文">‹ 前の文</button>'+
    '<span class="po-grammar-counter" aria-live="polite"></span>'+
    '<button type="button" data-grammar="nextSentence" aria-label="次の英文">次の文 ›</button></div>'+
    '<div class="po-grammar-center"><p class="po-grammar-sentence" aria-label="解析する英文"></p>'+ 
    '<div class="po-grammar-pattern" aria-label="文型・句の構造" hidden></div>'+
    '<div class="po-grammar-relation" hidden><div class="po-grammar-node po-grammar-node-focus"><small>注目する表現</small><strong data-grammar-field="focus"></strong></div>'+
    '<span class="po-grammar-arrow" aria-hidden="true">→</span>'+
    '<div class="po-grammar-node po-grammar-node-target"><small>つながる語句</small><strong data-grammar-field="target"></strong></div></div>'+
    '<article class="po-grammar-comment" aria-live="polite"><span class="po-grammar-kind"></span>'+
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
    let observer=null,disposed=false;
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
    function sentenceText(node,text,note){
      const ranges=[];
      if(note){
        for(const spec of [{value:note.focus,kind:'focus'},{value:note.target,kind:'target'}]){
          if(!spec.value)continue;
          const start=text.toLowerCase().indexOf(spec.value.toLowerCase());
          if(start>=0)ranges.push({start,end:start+spec.value.length,kind:spec.kind});
        }
      }
      // Split at every boundary so overlapping modifier/dependency spans
      // remain visible instead of one silently hiding the other.
      const cuts=[...new Set([0,text.length,...ranges.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
      node.replaceChildren();
      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i],b=cuts[i+1],piece=text.slice(a,b);
        if(!piece)continue;
        const focus=ranges.some(r=>r.kind==='focus'&&r.start<=a&&b<=r.end);
        const target=ranges.some(r=>r.kind==='target'&&r.start<=a&&b<=r.end);
        if(!focus&&!target){node.appendChild(doc.createTextNode(piece));continue;}
        const mark=doc.createElement('mark');
        mark.className='po-grammar-highlight '+(focus&&target?'is-both':focus?'is-focus':'is-target');
        mark.textContent=piece;node.appendChild(mark);
      }
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
      sentenceText(sentenceNode,sentence,selected);
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
      if(selected){
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
    }
    function changeSentence(delta){const ss=sentences();sentenceIndex=Math.max(0,Math.min(ss.length-1,sentenceIndex+delta));pointIndex=0;paint();}
    function nextPoint(){
      const ss=sentences(),points=notesFor(ss[sentenceIndex]||'');
      if(pointIndex+1<points.length){pointIndex++;paint();}
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
      showing=false;updateButtons();root.classList.toggle('po-grammar-compact',false);
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
      update(next){if(next!==scene){scene=next;sentenceIndex=0;pointIndex=0;}paint();},
      toggle,close,isOpen:()=>showing,open,
      previousSentence:()=>changeSentence(-1),nextSentence:()=>changeSentence(1),
      destroy(){
        if(disposed)return;
        close();disposed=true;observer?.disconnect();
        root.classList.toggle('po-grammar-compact',false);
        button.removeEventListener?.('click',toggle);
        panel.remove();
      },
      getState:()=>({showing,sentenceIndex,pointIndex,compact,explanationVisible,sentences:sentences().length})
    };
  }
  return {mount};
});
