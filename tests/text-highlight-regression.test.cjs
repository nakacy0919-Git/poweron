// node --test tests/text-highlight-regression.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function createApp() {
    const nodes = {}, speech = [];
    const context = {
        currentKey:'L08_P1_full', currentLevel:'standard',
        isScriptOpen:true, isJapaneseOpen:false, currentMode:'text',
        document:{
            getElementById(id) {
                if (!nodes[id]) nodes[id] = {
                    innerHTML:'',innerText:'',style:{},offsetWidth:250
                };
                return nodes[id];
            },
            querySelectorAll(){return []},
            body:{classList:{add(){},remove(){}}},
            createElement(){return {style:{},remove(){}}}
        },
        window:{
            innerWidth:1200,innerHeight:900,addEventListener(){},
            speechSynthesis:{speak(utterance){speech.push(utterance.text)}}
        },
        SpeechSynthesisUtterance:function(text){this.text=text},
        resetAppMode(){}
    };
    vm.createContext(context);
    for (const file of ['lessons/lessonData.js','js/ui.js']) {
        vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
    }
    return {context,nodes,speech,run(code){return vm.runInContext(code,context)}};
}
function normalize(text) {
    return String(text)
        .replace(/<br\s*\/?>/gi,' ')
        .replace(/<[^>]*>/g,'')
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
        .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
        .replace(/\s+/g,' ').trim();
}
function englishPanel(html) {
    const start = html.indexOf('id="engContainer"');
    assert.ok(start >= 0, 'English text panel exists');
    const end = html.indexOf('</div></div>',start);
    assert.ok(end > start);
    const section = html.slice(start,end);
    return section.slice(section.indexOf('>')+1);
}

test('all 108 textbook scopes preserve the original English words and punctuation',()=>{
    const a=createApp();
    const keys=a.run('Object.keys(lessonScripts)');
    assert.equal(keys.length,108);
    for(const key of keys){
        a.context.currentKey=key;
        a.run('renderDualText()');
        const expected=a.run('lessonScripts[currentKey]');
        assert.equal(normalize(englishPanel(a.nodes.targetTextDisplay.innerHTML)),normalize(expected),key);
    }
});
test('St. Catharines and hyphenated/multiword terms remain intact and clickable',()=>{
    const a=createApp();
    a.run('renderDualText()');
    const html=englishPanel(a.nodes.targetTextDisplay.innerHTML);
    assert.match(html,/>St\. Catharines<\/span>/);
    assert.match(html,/data-word="St\.%20Catharines"/);
    assert.match(html,/>world-famous<\/span>/);
    assert.match(html,/>Niagara Falls<\/span>/);
    assert.match(html,/>National Historic Site of Canada<\/span>/);
    assert.doesNotMatch(normalize(html),/Catharines'\s*,\s*'St\./);
    assert.ok(html.indexOf('St. Catharines') < html.indexOf('Lake Ontario'));
});
test('clicking a highlighted name still opens vocabulary details and pronunciation',()=>{
    const a=createApp();
    a.run("showVocab({stopPropagation(){},pageX:25,pageY:30},'St. Catharines','St. Catharines')");
    assert.equal(a.nodes.popupWord.innerText,'St. Catharines');
    assert.equal(a.nodes.popupMean.innerText,'セントキャサリンズ（地名）');
    assert.equal(a.nodes.vocabPopup.style.display,'block');
    assert.deepEqual(a.speech,['St. Catharines']);
});
test('abbreviations are not split and escaped text cannot create HTML nodes',()=>{
    const a=createApp();
    assert.equal(a.run("splitEnglishSentences('St. Catharines is here. In the U.S. many people live.').length"),2);
    assert.equal(a.run("highlightVocabText('<img src=x onerror=alert(1)>',[])"),'&lt;img src=x onerror=alert(1)&gt;');
});
test('Lesson 8 text still appears when an unpopulated advanced level is selected',()=>{
    const a=createApp();
    a.context.currentLevel='pre1';
    a.run('renderDualText()');
    assert.match(englishPanel(a.nodes.targetTextDisplay.innerHTML),/>St\. Catharines<\/span>/);
});
