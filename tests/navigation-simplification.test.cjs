const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Right sidebar exposes one course menu and one Script / Progress shortcut',()=>{
  const html=read('index.html'),css=read('css/practice.css');
  const sidebar=html.slice(html.indexOf('<div class="sidebar compact-sidebar"'),html.indexOf('</body>'));
  assert.match(sidebar,/class="po-internal-selectors" aria-hidden="true"/);
  assert.match(css,/\.po-internal-selectors\{display:none!important\}/);
  for(const id of ['partSelect','paraSelect','levelSelect','btnMainAudio']){
    assert.ok(sidebar.includes('id="'+id+'"'));
  }
  const menu=sidebar.slice(sidebar.indexOf('<nav class="po-learning-menu"'));
  assert.equal((menu.match(/class="po-progress-link"/g)||[]).length,1);
  assert.equal((menu.match(/id="btnScript"/g)||[]).length,1);
});

test('Script owns a single bottom audio strip and interactive dictionary words',()=>{
  const ui=read('js/ui.js'),audio=read('js/audio.js');
  assert.match(ui,/id="btnScriptAudio"/);
  assert.match(ui,/function selectScriptPart\(part\)/);
  assert.match(ui,/function scriptWordButtons\(raw\)/);
  assert.match(audio,/getElementById\('btnScriptAudio'\)/);
});

test('Learning Progress is aggregated across Lesson parts, not fixed at selected Part',()=>{
  const practice=read('js/practice.js'),css=read('css/practice.css');
  assert.match(practice,/function lessonProgress\(\)/);
  assert.match(practice,/const parts=Object.keys\(\(typeof lessonStructure/);
  assert.match(practice,/function progressDashboard\(\)/);
  assert.match(practice,/Part別の達成度/);
  assert.match(practice,/th-lesson-part-metrics/);
  assert.match(css,/body\.po-practice-active \.sidebar,body\.po-story-active \.sidebar/);
});

test('Registered learner cannot edit without local teacher PIN and old records are copied on authorized rename',()=>{
  const practice=read('js/practice.js');
  assert.match(practice,/\(learner&&!editing\)\)return/);
  assert.match(practice,/String\(answer\)\.trim\(\)!=='9999'/);
  assert.match(practice,/storage\.setItem\(nextStoreKey,JSON\.stringify\(store\.snapshot\(\)\)\)/);
  assert.match(practice,/function anonymous\(\)\{return false;\}/);
});

test('Explanation popup has only Next and retains feedback without automatic timer',()=>{
  const course=read('js/learningCourses.js');
  assert.doesNotMatch(course,/button\("pauseFeedback","説明を読む"/);
  const answer=course.slice(course.indexOf('function answer(index)'),course.indexOf('function nextQuestion()'));
  assert.doesNotMatch(answer,/advanceVocabularyAfterFeedback\(\);/);
  assert.match(course,/po-course-choice-grid/);
});
