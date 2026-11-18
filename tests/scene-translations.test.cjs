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
  assert.equal(checked,358);
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
test('Quoted exclamations followed by reporting clauses stay in their complete sentence',()=>{
  const deli=para('L09_P2_p4'),coinage=para('L09_P4_p7');
  const d=core.splitSentences(deli.english),c=core.splitSentences(coinage.english);
  assert.equal(d.length,9);
  assert.equal(c.length,7);
  assert.equal(d[3],'"I\'m going to a deli!" is a sentence we might hear on a street in New York City.');
  assert.equal(c[1],'"I googled you!" would be a good example.');
  assert.equal(d[7],'"Have you seen the ad for the new smartphone?"');
  assert.ok(!c.some(s=>/^would be/.test(s)));
});
test('Lesson 9 Part 2 scenes keep media IDs and align clipping, deli and speech/exam',()=>{
  const scenes=core.buildScenes([para('L09_P2_p3'),para('L09_P2_p4')],core.splitSentences,core.CURATED_SCENE_SIZES);
  assert.equal(scenes.length,8);
  assert.deepEqual(scenes.map(s=>s.id),[
    'L09_P2_p3_s01','L09_P2_p3_s03','L09_P2_p3_s04',
    'L09_P2_p4_s01','L09_P2_p4_s03','L09_P2_p4_s05','L09_P2_p4_s07','L09_P2_p4_s09'
  ]);
  assert.ok(scenes[3].english.includes('Clipping means to shorten a word'));
  assert.ok(scenes[4].english.includes('I\'m going to a deli!'));
  assert.ok(scenes[4].english.includes('New York City.'));
  assert.ok(scenes[5].english.includes('delicatessen'));
  assert.ok(scenes[6].english.includes('When you give a speech'));
  assert.ok(scenes[6].english.includes('examination'));
  for(const scene of scenes)assert.ok(translations.forScene(scene,[para(scene.paragraphKey)],core.splitSentences));
});
test('Lesson 9 Part 4 scenes show complete Google quotation and keep ten existing IDs',()=>{
  const scenes=core.buildScenes([para('L09_P4_p7'),para('L09_P4_p8'),para('L09_P4_p9')],core.splitSentences,core.CURATED_SCENE_SIZES);
  assert.equal(scenes.length,10);
  assert.deepEqual(scenes.slice(0,5).map(s=>s.id),['L09_P4_p7_s01','L09_P4_p7_s03','L09_P4_p7_s05','L09_P4_p7_s07','L09_P4_p7_s08']);
  assert.ok(scenes[0].english.includes('"I googled you!" would be a good example.'));
  assert.ok(scenes[1].english.includes('coinage based on'));
  assert.ok(scenes[2].english.includes('Another example of coinage is nylon.'));
  assert.ok(scenes[2].english.includes('American scientist'));
  for(const scene of scenes)assert.ok(translations.forScene(scene,[para(scene.paragraphKey)],core.splitSentences));
});
test('Speech/exam scene uses its corrected illustration instead of the unrelated image',()=>{
  const media=fs.readFileSync(path.join(__dirname,'../lessons/sceneMedia.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(media,/L09_P2_p4_s07.*L09_P2_07_speech_exam\.svg/);
  assert.match(html,/js\/practiceCore\.js\?v=12/);
  assert.match(html,/js\/sceneTranslations\.js\?v=2/);
  const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'../lessons/scene-plan.json'),'utf8'));
  const expected=plan.scenes.find(s=>s.id==='L09_P2_p4_s07');
  assert.equal(expected.image,'lessons/lesson9/part2/images/L09_P2_07_speech_exam.svg');
  assert.ok(fs.existsSync(path.join(__dirname,'..',expected.image)));
});
test('Unknown or changed translation alignment never falls back to the full Japanese paragraph',()=>{
  const p=para('L09_P1_p2');
  assert.equal(translations.alignParagraph({...p,japanese:'未翻訳の短い訳。'},core.splitSentences),null);
  const scene=core.buildScenes([p],core.splitSentences,core.CURATED_SCENE_SIZES)[0];
  assert.equal(translations.forScene(scene,[{...p,japanese:'未翻訳の短い訳。'}],core.splitSentences),null);
  assert.equal(translations.forScene(scene,[],core.splitSentences),null);
});
test('Story Theater displays Japanese captions without a redundant heading',()=>{
  const practice=fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8');
  const theater=fs.readFileSync(path.join(__dirname,'../js/storyTheater.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.ok(practice.includes('PowerOnSceneTranslations?.forScene?.'));
  assert.ok(practice.includes('この英文の和訳は準備中です。'));
  assert.ok(!theater.includes('theater-ja-label'));
  assert.ok(!theater.includes('表示中の英文の和訳'));
  assert.ok(theater.includes('class="theater-ja" hidden'));
  assert.ok(theater.includes("q('.theater-ja').hidden=!showJa"));
  assert.ok(html.includes('js/storyTheater.js?v=7'));
  assert.ok(html.includes('js/sceneTranslations.js?v=2'));
  assert.ok(html.indexOf('js/sceneTranslations.js?v=2')<html.indexOf('js/practice.js?v='));
});
