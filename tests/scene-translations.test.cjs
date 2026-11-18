const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../js/practiceCore.js');
const translations=require('../js/sceneTranslations.js');
const lessonText=fs.readFileSync(path.join(__dirname,'../lessons/lessonData.js'),'utf8');
const data=new Function(lessonText+';return {scripts:lessonScripts,translations:lessonTranslations};')();
const paragraphKeys=Object.keys(data.scripts).filter(key=>/^L\d\d_P\d+_p\d+$/.test(key));
const para=key=>({key,number:Number((key.match(/_p(\d+)$/)||[])[1]),english:data.scripts[key],japanese:data.translations[key]});

test('Every original paragraph in Lessons 1–10 has an aligned Japanese translation for every English sentence',()=>{
  assert.equal(paragraphKeys.length,76);
  let checked=0;
  for(const key of paragraphKeys){
    const p=para(key),english=core.splitSentences(p.english),aligned=translations.alignParagraph(p,core.splitSentences);
    assert.ok(aligned,'No alignment for '+key);
    assert.equal(aligned.length,english.length,key);
    for(const sentence of aligned){assert.ok(sentence.trim(),key+' empty Japanese subtitle');checked++}
    const scenes=core.buildScenes([p],core.splitSentences,core.CURATED_SCENE_SIZES);
    for(const scene of scenes){
      const actual=translations.forScene(scene,[p],core.splitSentences);
      assert.equal(actual,aligned.slice(scene.firstSentence-1,scene.lastSentence).join(' '),key+' scene '+scene.id);
      if(scenes.length>1)assert.notEqual(actual,p.japanese,key+' displays full paragraph');
    }
  }
  assert.equal(checked,360);
});
test('Lesson 9 English-and-German scene shows its own one-sentence translation',()=>{
  const p=para('L09_P1_p2');
  const scenes=core.buildScenes([p],core.splitSentences,core.CURATED_SCENE_SIZES);
  const scene=scenes.find(s=>s.english.includes('English and German were similar languages'));
  assert.ok(scene);
  assert.equal(translations.forScene(scene,[p],core.splitSentences),'英語とドイツ語は11世紀まで類似した言語でした。');
  assert.ok(!translations.forScene(scene,[p],core.splitSentences).includes('レストラン'));
});
test('Curated quotation boundaries combine Japanese segments correctly, without leaking adjacent lines',()=>{
  const p=para('L09_P1_p2');
  const aligned=translations.alignParagraph(p,core.splitSentences);
  assert.equal(aligned.length,7);
  assert.ok(aligned[5].includes('私はcow'));
  assert.ok(aligned[5].includes('友人には pig'));
  assert.ok(aligned[5].includes('とは言いません'));
  assert.ok(!aligned[5].includes('beef（牛肉）'));
  assert.ok(aligned[6].includes('beef（牛肉）'));
  const p2=para('L10_P1_p1');
  const aligned2=translations.alignParagraph(p2,core.splitSentences);
  assert.equal(aligned2.length,3);
  assert.ok(aligned2[0].includes('郵便配達人'));
  assert.ok(aligned2[0].includes('飼い主'));
  assert.ok(!aligned2[0].includes('そして飼い主はしばしば'));
});
test('Unknown or changed translation alignment never falls back to the full Japanese paragraph',()=>{
  const p=para('L09_P1_p2');
  assert.equal(translations.alignParagraph({...p,japanese:'未翻訳の短い訳。'},core.splitSentences),null);
  const scene=core.buildScenes([p],core.splitSentences,core.CURATED_SCENE_SIZES)[0];
  assert.equal(translations.forScene(scene,[{...p,japanese:'未翻訳の短い訳。'}],core.splitSentences),null);
  assert.equal(translations.forScene(scene,[],core.splitSentences),null);
});
test('Story Theater loads scene translations without a redundant heading or scoring changes',()=>{
  const practice=fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8');
  const theater=fs.readFileSync(path.join(__dirname,'../js/storyTheater.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.ok(practice.includes('PowerOnSceneTranslations?.forScene?.'));
  assert.ok(practice.includes('この英文の和訳は準備中です。'));
  assert.ok(!theater.includes('theater-ja-label'));
  assert.ok(!theater.includes('表示中の英文の和訳'));
  assert.ok(theater.includes('class="theater-ja" hidden'));
  assert.ok(theater.includes("q('.theater-ja').hidden=!showJa"));
  assert.ok(html.includes('js/storyTheater.js?v=6'));
  assert.ok(html.includes('js/sceneTranslations.js?v=1'));
  assert.ok(html.indexOf('js/sceneTranslations.js?v=1')<html.indexOf('js/practice.js?v='));
});
