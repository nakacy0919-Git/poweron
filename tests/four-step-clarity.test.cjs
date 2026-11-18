const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('All four fixed step buttons are directly accessible, no expandable menu is present',()=>{
  const html=read('index.html');
  for(const action of ['PowerOnPractice.openTheater()',"PowerOnPractice.open('sceneReading')",'PowerOnPractice.launchStory()','PowerOnCourses.launchChallenge()'])
    assert.equal(html.split(action).length-1,2,action);
  assert.doesNotMatch(html,/po-course-launch|FREE STUDY|class="po-step-expand"|class="po-step-options"/);
  assert.doesNotMatch(html,/shadowingMicContainer|bigShadowBtn|stopShadowBtn/);
});

test('Removed legacy activities cannot be launched by the interface, but stored scores remain supported',()=>{
  const html=read('index.html'),practice=read('js/practice.js'),speech=read('js/speech.js');
  assert.doesNotMatch(html,/Listening Puzzle|openSpeechOverlay\('shadowing'\)|PowerOnPractice.open\('puzzle'\)/);
  assert.match(practice,/if\(mode==='puzzle'\)return;/);
  assert.match(speech,/if\(mode==='shadowing'\)return;/);
  assert.match(practice,/store\.record\(app\.slideScope,'theater'/);
});

test('Compact Lesson Progress fits four Part cards on desktop and iPad with safe mobile overflow',()=>{
  const css=read('css/practice.css'),practice=read('js/practice.js');
  assert.match(css,/\.po-practice \.th-lesson-parts\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.po-practice\.po-mode-progress>\.po-content\{[^}]*overflow:hidden!important/);
  assert.match(css,/@media\(max-width:768px\)\{[^}]*\.po-practice\.po-mode-progress>\.po-content\{overflow-y:auto!important/);
  for(const label of ['① Watch & Listen','② Read & Practice','③ Story Match','④ Check Understanding'])
    assert.ok(practice.includes(label));
});

test('Strict challenge completion is per Part, not claimed by speed or partial credit',()=>{
  const course=read('js/learningCourses.js');
  assert.match(course,/const perfect=v\.clear&&c\.clear&&v\.total>=2&&c\.total===20&&score===total;/);
  assert.match(course,/return \{vocabulary,comprehension,ready:vocabulary>0&&comprehension>=10\}/);
  assert.match(course,/challengeActive\?"challengeIntro":"choose"/);
  assert.match(course,/lastClear:perfect/);
});
