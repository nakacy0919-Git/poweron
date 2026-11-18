const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../js/courseCore.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

function fixture(){
  const elements=new Map(),classes=new Set();
  const body={
    classList:{
      add:(...names)=>names.forEach(name=>classes.add(name)),
      remove:(...names)=>names.forEach(name=>classes.delete(name)),
      contains:name=>classes.has(name),
      toggle:(name,on)=>{if(on)classes.add(name);else classes.delete(name);return !!on;}
    },
    appendChild:node=>{node.parentName='body';elements.set(node.id,node);}
  };
  const mainScreen={appendChild:node=>{node.parentName='mainScreen';elements.set(node.id,node);}};
  elements.set('mainScreen',mainScreen);
  elements.set('partSelect',{value:'1'});
  elements.set('paraSelect',{value:'full'});
  const doc={
    body,addEventListener(){},getElementById:id=>elements.get(id)||null,
    createElement:tag=>({
      tag,style:{},innerHTML:'',scrollTop:0,
      setAttribute(){},addEventListener(){},focus(){},
      remove(){elements.delete(this.id);}
    })
  };
  const storage=new Map();
  const host={
    document:doc,PowerOnCourseCore:core,PowerOnCourseQuestionBank:[],
    PowerOnComprehension:{},PowerOnPractice:{getProgress:()=>({scopes:{}})},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    setTimeout,clearTimeout
  };
  const lessonStructure={8:{1:[1],2:[2],3:[3],4:[4]},9:{1:[1,2],2:[3,4],3:[5,6],4:[7,8,9]}};
  const run=new Function('window','lessonStructure',
    'let currentLesson=8,currentKey="L08_P1_full",currentLevel="standard";'+
    read('js/learningCourses.js')+
    ';return {setLesson(n){currentLesson=n;currentKey="L"+String(n).padStart(2,"0")+"_P1_full";}};');
  const {setLesson}=run(host,lessonStructure);
  return {course:host.PowerOnCourses,setLesson,elements,classes};
}

test('Selecting Lesson 8–10 only changes the Lesson; no chooser is opened',()=>{
  const f=fixture();
  for(const n of [8,9,10]){
    f.setLesson(n);
    f.course.lessonChanged(n);
    assert.equal(f.elements.has('po-course-overlay'),false);
    assert.equal(f.classes.has('po-course-guided'),true);
  }
  f.course.lessonChanged(7);
  assert.equal(f.classes.has('po-course-guided'),false);
});

test('Explicit course launch is inside the main canvas and shows its Lesson artwork',()=>{
  const f=fixture();
  f.course.lessonChanged(8);
  f.course.open();
  let overlay=f.elements.get('po-course-overlay');
  assert.ok(overlay);
  assert.equal(overlay.parentName,'mainScreen');
  assert.match(overlay.style.backgroundImage,/img\/L8\.webp/);
  assert.match(overlay.innerHTML,/Choose Your Learning Course/);
  f.setLesson(9);
  f.course.lessonChanged(9);
  assert.equal(f.elements.has('po-course-overlay'),false);
  f.course.open();
  overlay=f.elements.get('po-course-overlay');
  assert.match(overlay.style.backgroundImage,/img\/L9\.webp/);
  assert.match(overlay.innerHTML,/Lesson 9 · Part 1/);
});

test('Layout retains Lesson tabs and sidebar rather than opening a full-screen navy modal',()=>{
  const css=read('css/learningCourses.css');
  const html=read('index.html');
  const main=read('js/main.js');
  const mobile=read('js/mobile.js');
  assert.match(css,/\.po-course-overlay\{position:absolute;/);
  assert.match(css,/\.po-course-inner\{[^\n]*background:rgba\(12,32,56,\.77\)/);
  assert.match(main,/window\.PowerOnCourses\?\.lessonChanged\?\.\(num\)/);
  assert.doesNotMatch(main,/PowerOnPractice\.open\(previousMode\)/);
  for(const n of [8,9,10]){
    assert.ok(html.includes('onclick="selectLesson('+n+', this)"'));
    assert.ok(!html.includes('selectLesson('+n+', this);window.PowerOnCourses'));
  }
  assert.match(mobile,/if\(lessonChanged\)return;/);
});
