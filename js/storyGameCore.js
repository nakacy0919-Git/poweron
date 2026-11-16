/* Adapted from story-match/src/utils/game.js */
(function(root){'use strict';
// Fisher-Yates shuffle: unlike sort(() => Math.random() - 0.5), it is unbiased.
function shuffle(items, random = Math.random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function makeQuestions(sceneCount, count, random = Math.random) {
  const total = Number.isInteger(sceneCount) ? Math.max(0, sceneCount) : 0;
  const requested = count === 'ALL' ? total : Number(count);
  const limit = Number.isFinite(requested) ? Math.min(total, Math.max(0, Math.floor(requested))) : total;
  return shuffle(Array.from({ length: total }, (_, index) => index), random).slice(0, limit);
}

function makeChoices(sceneCount, correctIndex, random = Math.random) {
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= sceneCount) return [];
  const wrong = shuffle(
    Array.from({ length: sceneCount }, (_, index) => index).filter(index => index !== correctIndex),
    random
  ).slice(0, 2);
  return shuffle([correctIndex, ...wrong], random);
}

function deferQuestion(queue, index) {
  if (!Array.isArray(queue) || index < 0 || index >= queue.length) return queue;
  return [...queue, queue[index]];
}

function target(n){return Math.ceil(n*200/3);}
function points(seconds,listen){return Math.max(10,Math.floor(100-Math.max(0,seconds)*(listen?15:12)));}
function hints(n,level){return Array.from({length:n},(_,i)=>i).filter(i=>level===1?i%2===0:level===2?i%5===0:false).slice(0,Math.max(0,n-1));}
const api={shuffle,makeQuestions,makeChoices,deferQuestion,target,points,hints};if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PowerOnStoryGameCore=api;
})(typeof globalThis==='object'?globalThis:this);
