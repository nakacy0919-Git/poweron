const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'lessons/sceneMedia.js'),'utf8'),sandbox);
const media=sandbox.window.PowerOnSceneMedia;
const plan=JSON.parse(fs.readFileSync(path.join(root,'lessons/scene-plan.json'),'utf8'));
const expected={
  3:['L09_P3_p5_s01','L09_P3_p5_s03','L09_P3_p5_s05','L09_P3_p5_s07','L09_P3_p5_s09','L09_P3_p6_s01','L09_P3_p6_s03'],
  4:['L09_P4_p7_s01','L09_P4_p7_s03','L09_P4_p7_s05','L09_P4_p7_s07','L09_P4_p7_s08','L09_P4_p8_s01','L09_P4_p8_s03','L09_P4_p8_s05','L09_P4_p9_s01','L09_P4_p9_s03']
};
test('Lesson 9 Parts 3–4: 17 image files match the exact 17 scene IDs',()=>{
  assert.equal(expected[3].length,7);
  assert.equal(expected[4].length,10);
  for (const part of [3,4]) {
    expected[part].forEach((id,index)=>{
      const filename='L09_P'+part+'_'+String(index+1).padStart(2,'0')+'.webp';
      const image='lessons/lesson9/part'+part+'/images/'+filename;
      assert.equal(media[id]?.image,image,'Missing mapping for '+id);
      assert.equal(media[id]?.audio,undefined,'Keep Part-level MP3 playback for '+id);
      const imageBytes=fs.readFileSync(path.join(root,image));
      assert.equal(imageBytes.toString('ascii',0,4),'RIFF',image);
      assert.equal(imageBytes.toString('ascii',8,12),'WEBP',image);
      assert.equal(plan.scenes.find(scene=>scene.id===id)?.image,image,'Scene plan for '+id);
    });
  }
});
test('Previously released Lesson 9 Part 1/2 scene registrations are preserved',()=>{
  assert.equal(Object.keys(media).filter(id=>id.startsWith('L09_P1_')).length,7);
  assert.equal(Object.keys(media).filter(id=>id.startsWith('L09_P2_')).length,8);
});
