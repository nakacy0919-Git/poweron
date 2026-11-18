const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('both layouts show exactly four fixed activities without extra menus',()=>{
 const menus=html.match(/<nav class="po-learning-menu[^"]*" aria-label="4ステップ学習メニュー">[\s\S]*?<\/nav>/g)||[];
 assert.equal(menus.length,2);
 for(const menu of menus){
  assert.equal((menu.match(/class="po-step-primary"/g)||[]).length,4);
  for(const action of ["PowerOnPractice.openTheater()","PowerOnPractice.open('sceneReading')","PowerOnPractice.launchStory()","PowerOnCourses.launchChallenge()",
   "toggleTextMode('script')","toggleTextMode('japanese')","PowerOnPractice.open('progress')","resetAppMode()"])
     assert.ok(menu.includes(action),action);
  for(const absent of ['po-course-launch','FREE STUDY','po-step-expand','po-step-options',"open('puzzle')","openSpeechOverlay('shadowing')"])
     assert.ok(!menu.includes(absent),absent);
 }
 assert.equal((html.match(/id="btnScript"/g)||[]).length,1);
 assert.equal((html.match(/id="btnJapanese"/g)||[]).length,1);
});

test('existing anonymous and registered Story Match records survive every new step and screen reset',()=>{
const core=require('../js/practiceCore.js'),games=require('../js/storyGameCore.js'),reading=require('../js/storyReading.js');
const practice=fs.readFileSync(path.join(__dirname,'../js/practice.js'),'utf8');
new Function('core','games','reading',"\nconst sentences=['We learn English today.','She walks to school.','They play baseball.','He likes oranges.'];\nconst scope='standard:L08_P1_full', profile={class:'3-2',number:'1',name:'Test Learner'};\nconst storage=new Map(),api={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};\nconst learnerKey='poweron_study_progress_v1:'+JSON.stringify([profile.class,profile.number,profile.name]);\nconst script=Object.fromEntries([...sentences.map((s,i)=>['L08_P1_p'+(i+1),s]),['L08_P1_full',sentences.join(' ')]]);\nconst sceneList=core.buildScenes(sentences.map((english,i)=>({key:'L08_P1_p'+(i+1),number:i+1,english})),core.splitSentences,core.LESSON8_SCENE_SIZES);\nconst media=Object.fromEntries(sceneList.map((s,i)=>[s.id,{image:'scene'+i+'.webp'}]));\nconst sig=core.fingerprint(sceneList.map(s=>s.english)),gameSig=core.fingerprint(sceneList.map(s=>s.id+'|'+s.english+'|'+media[s.id].image));\nfor(const key of [undefined,learnerKey]){\n const old=core.createProgressStore(api,key);\n old.record(scope,'sceneReading',0,sceneList.length,sig,{accuracy:96,complete:true,attempt:true});\n old.record(scope,'storyPuzzle',0,1,gameSig,{seconds:18.4,gameLevel:3,complete:true,attempt:true});\n old.record(scope,'storyRandom',0,1,gameSig,{points:400,questionCount:4,full:true,complete:true,attempt:true});\n old.record(scope,'storyListen',0,1,gameSig,{points:350,questionCount:4,full:true,complete:true,attempt:true});\n}\nstorage.set('poweron_study_learner_v1',JSON.stringify(profile));\nconst original=JSON.stringify([...storage]);\nconst nodes=Object.fromEntries(['targetTextDisplay','mainOverlay','speechResultWindow','overlayTitle','po-audio-status'].map(k=>[k,{style:{},innerHTML:'',textContent:''}]));\nlet theaterConfig, speech;\nconst window={PowerOnPracticeCore:core,PowerOnStoryGameCore:games,PowerOnReadingScore:reading,PowerOnStoryTheater:{open:o=>theaterConfig=o,dismiss(){},pause(){}},localStorage:api,PowerOnSceneMedia:media,SpeechSynthesisUtterance:class{constructor(t){this.text=t}},speechSynthesis:{cancel(){},speak(u){speech=u}}};\nconst document={body:{classList:{add(){},remove(){}}},getElementById:k=>nodes[k]||null};\nlet currentLesson=8,currentKey='L08_P1_full',currentLevel='standard',currentMode='';\nconst lessonStructure={8:{1:[1,2,3,4]}},lessonScripts=script,lessonTranslations={};\nfunction resetAppMode(){window.PowerOnPractice?.stop();currentMode='';}\n"+practice+"\nconst p=window.PowerOnPractice;\nfunction check(x,m){if(!x)throw Error(m);}\np.launchStory();\ncheck(nodes.targetTextDisplay.innerHTML.includes('18.4 秒'),'puzzle best');\ncheck(nodes.targetTextDisplay.innerHTML.includes('400 pts'),'random best');\ncheck(nodes.targetTextDisplay.innerHTML.includes('350 pts'),'listening best');\np.openTheater();theaterConfig.onFinish();\ncheck(nodes.targetTextDisplay.innerHTML.includes('Scene 2 / 4'),'resume first unfinished');\np.open('sceneReading');p.launchStory();p.launchKnowledge();p.open('progress');resetAppMode();\ncheck(JSON.stringify([...storage])===original,'all saved records and profile bytes must remain unchanged');\nconst profileSaved=p.getProgress().scopes[scope];check(profileSaved.sceneReading.scores[0]===96,'accuracy retained');\ncheck(profileSaved.storyPuzzle.bestSeconds===18.4&&profileSaved.storyRandom.bestPoints===400&&profileSaved.storyListen.bestPoints===350,'all mission records retained');\n")(core,games,reading);
});

test('expand arrow and dropdown content are absent from the entire HTML',()=>{
 assert.ok(!html.includes('class="po-step-expand"'));
 assert.ok(!html.includes('class="po-step-options"'));
 assert.ok(!html.includes('FREE STUDY'));
 assert.ok(!html.includes('po-course-launch'));
});
