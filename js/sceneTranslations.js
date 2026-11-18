/* Align each visible Story Theater scene with its own Japanese translation.
   Existing paragraph translations are the source of truth; never show a whole
   paragraph as a one-sentence subtitle or fabricate a translation. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.PowerOnSceneTranslations=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  // How many Japanese punctuation-delimited segments belong to each English
  // sentence in the original paragraph translation (not each picture).
  // Quotation marks, explanatory relatives and combined English sentences
  // account for the differences. Keep explicit rather than guessing.
  const segmentGroups=Object.freeze({
    L02_P1_p1:[1,1,1,1,1,2],
    L02_P1_p2:[1,1,1,2],
    L02_P1_p3:[1,1,1,1,2],
    L03_P2_p1:[1,1,2,1,1,1],
    L03_P2_p3:[1,2],
    L04_P1_p2:[1,2],
    L04_P3_p2:[1,1,1,1,2],
    L07_P2_p4:[1,1,1,1,2],
    L08_P3_p7:[1,2],
    L09_P1_p2:[1,1,1,1,1,3,1],
    L09_P2_p3:[1,1,1,2],
    L09_P4_p7:[1,1,1,1,1,1,1,2],
    L10_P1_p1:[2,1,1],
    L10_P3_p8:[1,2,1,1,1,1,1,1,1]
  });
  function splitJapanese(value){
    const text=String(value||"").replace(/<br\s*\/?>/gi," ").replace(/<[^>]+>/g,"")
      .replace(/\s+/g," ").trim();
    if(!text)return [];
    return text.split(/(?<=[。！？])/u).map(x=>x.trim()).filter(Boolean);
  }
  function alignParagraph(paragraph,splitEnglish){
    if(!paragraph||typeof splitEnglish!=="function")return null;
    const english=splitEnglish(paragraph.english),japanese=splitJapanese(paragraph.japanese);
    if(!english.length||!japanese.length)return null;
    const curated=segmentGroups[paragraph.key];
    // Special grouping belongs to the original Standard translation only.
    // Unmatched alternate-level translations return null, not a wrong subtitle.
    const group=curated&&curated.length===english.length&&
      curated.reduce((sum,n)=>sum+n,0)===japanese.length
        ?curated:english.length===japanese.length?english.map(()=>1):null;
    if(!group)return null;
    let cursor=0;
    return group.map(n=>{
      const text=japanese.slice(cursor,cursor+n).join(" ").replace(/\s+([」』）】])/g,"$1");
      cursor+=n;
      return text;
    });
  }
  function forScene(scene,paragraphs,splitEnglish){
    if(!scene||!Array.isArray(paragraphs))return null;
    const paragraph=paragraphs.find(p=>p.key===scene.paragraphKey);
    const aligned=alignParagraph(paragraph,splitEnglish);
    const first=Number(scene.firstSentence)-1,last=Number(scene.lastSentence);
    if(!aligned||!Number.isInteger(first)||!Number.isInteger(last)||
      first<0||last>aligned.length||first>=last)return null;
    return aligned.slice(first,last).join(" ");
  }
  return {splitJapanese,alignParagraph,forScene,segmentGroups};
});
