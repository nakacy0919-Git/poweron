/* Regression: PowerSlide navigation must start at viewport top on desktop/iPad. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../css/style.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function declarations(selector){
  const source=css.match(new RegExp('(?:^|\\n)'+selector+'\\s*\\{([^}]+)\\}','m'));
  assert.ok(source,'Missing CSS for '+selector);
  return source[1];
}
test('The html root is a block viewport; only body owns the main vertical flex layout',()=>{
  const root=declarations('html'),body=declarations('body');
  assert.match(root,/display:\s*block\s*!important/);
  assert.match(root,/height:\s*100%\s*!important/);
  assert.doesNotMatch(root,/display:\s*flex/);
  assert.match(body,/display:\s*flex\s*!important/);
  assert.match(body,/height:\s*100dvh\s*!important/);
  assert.match(body,/justify-content:\s*flex-start\s*!important/);
  assert.match(body,/margin:\s*0\s*!important/);
  assert.match(body,/padding:\s*0\s*!important/);
});
test('Lesson navigation cannot introduce top margin and the app region can shrink below it',()=>{
  assert.match(css,/\.nav-container\s*\{[^}]*margin-top:\s*0\s*!important/s);
  assert.match(css,/\.nav-container\s*\{[^}]*flex:\s*0 0 auto\s*!important/s);
  assert.match(css,/\.app-container\s*\{[^}]*min-height:\s*0\s*!important/s);
});
test('Lesson 1–10, main display and sidebar are intact',()=>{
  assert.equal((html.match(/class="nav-btn /g)||[]).length,10);
  for(const id of ['appContainer','mainScreen','sidebar'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/css\/style\.css\?v=24/);
});
