const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/practiceCore.js');

test('English sentence splitter keeps abbreviations, numbers and quoted endings', () => {
    assert.deepEqual(core.splitSentences('Dr. Green came at 3.5 p.m. "Really?" Yes!'), [
        'Dr. Green came at 3.5 p.m.', '"Really?"', 'Yes!'
    ]);
    assert.deepEqual(core.splitSentences('1. Do you understand? 2. Try again.'), [
        '1. Do you understand?', '2. Try again.'
    ]);
    assert.deepEqual(core.splitSentences(''), []);
    assert.deepEqual(core.splitSentences('One sentence without a final period'), [
        'One sentence without a final period'
    ]);
});

test('puzzle is scrambled, has unique IDs and accepts only original order', () => {
    const puzzle = core.makePuzzle('The students are working together to solve an interesting problem today.', () => 0.99);
    assert.ok(puzzle);
    assert.ok(puzzle.cards.length >= 3);
    assert.equal(new Set(puzzle.cards.map(x => x.id)).size, puzzle.cards.length);
    assert.notDeepEqual(puzzle.cards.map(x => x.id), puzzle.ordered.map(x => x.id));
    assert.equal(core.puzzleCorrect(puzzle, puzzle.ordered.map(x => x.id)), true);
    assert.equal(core.puzzleCorrect(puzzle, puzzle.cards.map(x => x.id)), false);
    assert.equal(core.makePuzzle('Only three words', () => 0), null);
});

test('transcript similarity uses ordered words and ignores simple punctuation', () => {
    assert.equal(core.transcriptAccuracy('I enjoy reading books.', 'i enjoy reading books'), 100);
    assert.equal(core.transcriptAccuracy('one two three four', 'four three two one'), 25);
    assert.equal(core.transcriptAccuracy('one two three four', 'one three four'), 75);
    assert.equal(core.transcriptAccuracy('one two', ''), 0);
});

test('progress persists per level/scope/mode and only increases completion', () => {
    const map = new Map();
    const storage = {
        getItem:k => map.has(k) ? map.get(k) : null,
        setItem:(k,v) => map.set(k,v)
    };
    const scope = 'standard:L01_P1_full', sig = core.fingerprint(['One.', 'Two.']);
    const s = core.createProgressStore(storage);
    assert.equal(s.get(scope,'reading',2,sig).attempts, 0);
    assert.equal(s.record(scope,'reading',0,2,sig,{attempt:true,accuracy:83,complete:true}),true);
    assert.equal(s.record(scope,'reading',0,2,sig,{attempt:true,accuracy:45,complete:false}),true);
    assert.deepEqual(Object.keys(s.get(scope,'reading',2,sig).completed),['0']);
    assert.equal(s.get(scope,'reading',2,sig).attempts,2);
    assert.equal(s.get(scope,'reading',2,sig).bestAccuracy,83);
    assert.equal(s.get(scope,'puzzle',2,sig).attempts,0);
    const reload = core.createProgressStore(storage);
    assert.equal(reload.get(scope,'reading',2,sig).completed[0],true);
    assert.equal(reload.get('pre1:L01_P1_full','reading',2,sig).completed[0],undefined);
    assert.equal(reload.get(scope,'reading',2,'modified').completed[0],undefined);
    assert.equal(reload.record(scope,'reading',2,2,sig,{complete:true}),false);
});

test('storage corruption or private mode degrades to usable session memory', () => {
    const broken = {getItem:() => {throw new Error('blocked');},setItem:() => {throw new Error('blocked');}};
    const s = core.createProgressStore(broken);
    assert.equal(s.isPersistent(),false);
    assert.equal(s.record('standard:L01_P1_p1','deep',0,1,'abc',{complete:true}),true);
    assert.equal(s.get('standard:L01_P1_p1','deep',1,'abc').completed[0],true);
    assert.equal(s.isPersistent(),false);
});
