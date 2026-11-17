/* PowerOn's full-screen Story Theater: no framework or external service required. */
(function(root,factory){
    const api=factory(root);
    if(typeof module==='object'&&module.exports)module.exports=api;
    else root.PowerOnStoryTheater=api;
})(typeof window!=='undefined'?window:globalThis,function(host){
    'use strict';
    // Session generation invalidates callbacks from stopped or previous scenes.
    function createSession({scenes,rate=.85,play,playRecorded,stop,update,finish,back,onComplete,setTimer=setTimeout,clearTimer=clearTimeout}){
        let index=0,playing=false,auto=false,finished=false,japanese=false,error='',generation=0,timer=null,watchdog=null,closed=false;
        const listened=new Set();let notified=false;
        function audioFinished(from,to){
            for(let i=from;i<to;i++)listened.add(i);
            if(listened.size===scenes.length&&!notified){
                notified=true;
                // Only actual completed narration earns Story Theater credit.
                onComplete?.();
            }
        }
        const snapshot=()=>({index,total:scenes.length,playing,auto,finished,japanese,error,rate,scene:scenes[index]});
        const paint=()=>{if(!closed)update(snapshot());};
        function cancel(){
            ++generation;clearTimer(timer);clearTimer(watchdog);timer=watchdog=null;
            playing=auto=false;stop();
        }
        function run(next,continuous,recorded=true,notice=""){
            if(closed||!scenes[next])return;
            cancel();const id=generation;let settled=false;
            index=next;playing=true;auto=continuous;finished=false;error=notice;paint();
            const fail=()=>{
                if(closed||id!==generation||settled)return;
                settled=true;cancel();error='音声が再生できませんでした。もう一度再生するか、手動で次へ進んでください。';paint();
            };
            // A scene-specific MP3 always takes priority over the old Part-level recording.
            // Without one, retain the continuous Part audio for Parts 3/4 and other lessons.
            if(recorded&&!scenes[next].audio&&typeof playRecorded==='function'){
                // Use existing, real Part recordings for both manual and automatic
                // theater narration. For automatic playback this is one continuous
                // MP3, not a new play() call for every scene.
                watchdog=setTimer(fail,600000);
                try{
                    playRecorded(next,continuous?scenes.length:next+1,rate,
                        sceneIndex=>{
                            if(closed||id!==generation||settled)return;
                            index=sceneIndex;paint();
                        },
                        ()=>{
                            if(closed||id!==generation||settled)return;
                            settled=true;clearTimer(watchdog);watchdog=null;
                            if(continuous)index=scenes.length-1;
                            audioFinished(next,continuous?scenes.length:next+1);
                            playing=auto=false;finished=index===scenes.length-1;paint();
                        },
                        ()=>{
                            if(closed||id!==generation||settled)return;
                            settled=true;
                            // A missing/blocked MP3 falls back to exact-scene
                            // browser speech instead of leaving the screen silent.
                            run(index,continuous,false,'録音音声が利用できないため、端末の読み上げに切り替えました。');
                        }
                    );
                }catch(_){run(index,continuous,false,'録音音声が利用できないため、端末の読み上げに切り替えました。');}
                return;
            }
            watchdog=setTimer(fail,Math.max(35000,scenes[index].english.length*180/rate));
            try{play(scenes[index],rate,()=>{
                if(closed||id!==generation||settled)return;
                settled=true;clearTimer(watchdog);watchdog=null;
                audioFinished(next,next+1);
                if(continuous&&next+1<scenes.length){
                    timer=setTimer(()=>{if(!closed&&id===generation)run(next+1,true,false,notice);},650);
                }else{
                    playing=auto=false;finished=next===scenes.length-1;paint();
                }
            },fail);}catch(_){fail();}
        }
        function navigate(delta){if(closed)return;cancel();index=Math.max(0,Math.min(scenes.length-1,index+delta));error='';finished=false;paint();}
        function pause(){if(closed)return;cancel();paint();}
        function close(action){if(closed)return;closed=true;cancel();if(action==='finish')finish();else if(action==='back')back();}
        return {snapshot,paint,navigate,pause,close,
            manual(){if(closed)return;if(playing){if(!auto)pause();}else run(index,false);},
            autoplay(){if(closed)return;if(playing&&auto)pause();else run(index,true);},
            toggleJapanese(){if(!closed){japanese=!japanese;paint();}},
            changeRate(value){if(!closed&&!playing&&[.65,.85,1].includes(Number(value))){rate=Number(value);paint();}}
        };
    }

    // The original MP3 has no per-scene timestamps. Estimate scene boundaries
    // without altering the recording, and keep the same media element playing
    // continuously across an entire Part in automatic mode.
    function sceneBoundaries(scenes){
        const weights=scenes.map(scene=>{
            const text=String(scene?.english||'');
            const words=text.trim().split(/\s+/).filter(Boolean);
            return Math.max(1,words.reduce((sum,word)=>sum+Math.max(1,Math.sqrt(word.replace(/[^a-z]/gi,'').length||1)),0)+Math.min(5,(text.match(/[.!?]/g)||[]).length));
        });
        const total=weights.reduce((sum,x)=>sum+x,0);
        const boundaries=[0];let sum=0;
        for(const weight of weights){sum+=weight;boundaries.push(sum/total);}
        boundaries[boundaries.length-1]=1;
        return boundaries;
    }
    function playRecordedAudio(host,{url,scenes,startIndex,endIndex,rate,onScene,onEnd,onError}){
        if(!url||!scenes.length||!host.Audio)throw Error('Recorded media unavailable');
        const player=new host.Audio(url),boundaries=sceneBoundaries(scenes);
        let active=true,settled=false,seeked=startIndex===0,lastIndex=-1;
        player.preload='auto';player.playsInline=true;player.playbackRate=rate;
        const cleanup=()=>{
            player.onloadedmetadata=null;player.ontimeupdate=null;
            player.onended=null;player.onerror=null;
        };
        const stop=()=>{
            if(!active)return;
            active=false;cleanup();try{player.pause();}catch(_){}
        };
        const finish=()=>{
            if(!active||settled)return;settled=true;stop();onEnd();
        };
        const fail=error=>{
            if(!active||settled)return;settled=true;stop();onError(error);
        };
        const ensureSeek=()=>{
            if(!active||seeked||!Number.isFinite(player.duration)||player.duration<=0)return;
            seeked=true;
            try{player.currentTime=Math.min(Math.max(0,player.duration*boundaries[startIndex]),Math.max(0,player.duration-.1));}
            catch(_){fail(new Error('Unable to seek recorded audio'));}
        };
        const update=()=>{
            if(!active||!Number.isFinite(player.duration)||player.duration<=0)return;
            ensureSeek();if(!active||!seeked)return;
            const progress=Math.max(0,Math.min(1,player.currentTime/player.duration));
            if(progress>=boundaries[endIndex]-0.0003){finish();return;}
            let next=startIndex;
            while(next+1<endIndex&&progress>=boundaries[next+1])next++;
            if(next!==lastIndex){lastIndex=next;onScene(next);}
        };
        player.onloadedmetadata=()=>{ensureSeek();update();};
        player.ontimeupdate=update;
        player.onended=finish;
        player.onerror=()=>fail(player.error||new Error('Audio loading error'));
        // play() is invoked directly from the user's gesture on Safari/iPad.
        // Do not await metadata first, or iOS can reject play() as autoplay.
        try{const result=player.play();result?.catch?.(fail);}
        catch(e){fail(e);}
        return {stop,player};
    }
    // Reuse a single media element for sequential scene clips. Mobile Safari is
    // more reliable when every scene does not create another Audio object.
    function createSceneClipPlayer(host){
        let audio=null,generation=0;
        function stop(){
            generation++;
            if(audio){
                audio.onended=null;audio.onerror=null;
                try{audio.pause();}catch(_){}
            }
        }
        function play({url,rate,onEnd,onError}){
            stop();
            if(!url||!host.Audio){onError(new Error('Scene MP3 unavailable'));return;}
            const id=generation;
            let settled=false;
            const fail=e=>{
                if(id!==generation||settled)return;
                settled=true;stop();onError(e);
            };
            try{
                if(!audio)audio=new host.Audio();
                audio.preload='auto';audio.playsInline=true;
                audio.src=url;audio.playbackRate=rate;
                audio.onended=()=>{
                    if(id!==generation||settled)return;
                    settled=true;
                    audio.onended=null;audio.onerror=null;onEnd();
                };
                audio.onerror=()=>fail(audio.error||new Error('Scene MP3 loading failed'));
                const task=audio.play();
                task?.catch?.(fail);
            }catch(e){fail(e);}
        }
        return {play,stop};
    }
    let active=null;
    function dismiss(){if(active)active.remove();}
    function pause(){if(active)active.session.pause();}
    const seats=[0,1].map(row=>'<g opacity="'+(row===0?.65:1)+'" transform="'+(row===0?'translate(0 0)':'translate(-70 65) scale(1.12)')+'">'+Array.from({length:11},(_,i)=>'<g transform="translate('+(i*122-55)+' 0)"><path d="M8 99V48Q8 12 39 12H79Q110 12 110 48V99Z" fill="url(#poCinemaSeat)" stroke="#633039" stroke-width="1.4"/><path d="M18 51Q18 23 42 23H76Q100 23 100 51" fill="none" stroke="#9a5055" stroke-opacity=".24" stroke-width="2"/><rect x="0" y="73" width="118" height="26" rx="12" fill="#120e14"/></g>').join('')+'</g>').join('');
    const markup='<div class="theater-auditorium" aria-hidden="true"><div class="theater-curtain left"></div><div class="theater-curtain right"></div><div class="theater-wall-light left"></div><div class="theater-wall-light right"></div><svg class="theater-seats" viewBox="0 0 1200 190" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="poCinemaSeat" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#49232a"/><stop offset=".45" stop-color="#24141a"/><stop offset="1" stop-color="#08070c"/></linearGradient></defs>'+seats+'</svg></div>'+
        '<header class="theater-header"><div><span data-title></span><strong>Step 1　本文を読む・聞く</strong></div><output aria-live="polite" data-count></output><button type="button" class="theater-close" data-action="close" aria-label="紙芝居を閉じる">×</button></header>'+
        '<div class="theater-progress" aria-hidden="true"><i></i></div><div class="theater-stage"><div class="theater-picture"><img class="theater-image-fill" alt="" aria-hidden="true"><img class="theater-artwork" alt=""><span class="theater-cover-note" hidden>Lessonカバー · 場面画像は未登録</span><div class="theater-caption" tabindex="0"><p class="theater-en"></p><small class="theater-ja-label" hidden></small><p class="theater-ja" hidden></p></div></div></div>'+
        '<p class="theater-message" role="status" hidden></p><footer class="theater-controls"><div><button type="button" data-action="prev" aria-label="前のシーン">◀</button><button type="button" data-action="next" aria-label="次のシーン">▶</button></div><div><button type="button" class="theater-manual" data-action="manual">🔊 このシーン</button><button type="button" class="theater-auto" data-action="auto">▶ 自動再生</button></div><div><button type="button" data-action="jp" aria-pressed="false">和訳 OFF</button><select aria-label="紙芝居の音声速度"><option value="0.65">0.65×</option><option value="0.85">0.85×</option><option value="1">1×</option></select></div><button type="button" class="theater-finish" data-action="finish">⏭ スキップして音読へ進む</button></footer>';
    function open(config){
        dismiss();if(!config.scenes?.length)return;
        const doc=host.document,old=doc.activeElement,root=doc.createElement('section');
        root.className='story-theater';root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Story Theater 紙芝居モード');root.innerHTML=markup;
        const q=s=>root.querySelector(s),button=name=>q('[data-action="'+name+'"]'),frame=q('.theater-picture');
        const previousInert=new Map();
        for(const child of doc.body.children){if('inert' in child){previousInert.set(child,child.inert);child.inert=true;}}
        doc.body.appendChild(root);doc.body.classList.add('po-theater-active');
        q('[data-title]').textContent=config.title+' · STORY THEATER';
        let observer=null,last=-1,showJa=false,removed=false,recordedHandle=null;
        const stopRecorded=()=>{recordedHandle?.stop();recordedHandle=null;};
        const sceneClips=createSceneClipPlayer(host);
        function fit(){
            for(const [selector,lines,min] of [['.theater-en',2,16],['.theater-ja',1,13]]){
                const el=q(selector);if(el.hidden||!el.clientWidth)continue;
                el.style.fontSize='';
                let size=parseFloat(host.getComputedStyle(el).fontSize);
                while(Number.isFinite(size)&&size>min){
                    const lh=parseFloat(host.getComputedStyle(el).lineHeight);
                    if(!Number.isFinite(lh)||el.scrollHeight<=lh*lines+2)break;
                    size=Math.max(min,size-1);el.style.fontSize=size+'px';
                }
            }
        }
        function paint(s){
            if(s.index!==last){
                last=s.index;const img=q('.theater-artwork'),fill=q('.theater-image-fill');
                img.src=s.scene.image;fill.src=s.scene.image;img.alt=s.scene.isCover?'Lessonカバー':'Scene '+(s.index+1);
                q('.theater-cover-note').hidden=!s.scene.isCover;
                q('.theater-en').textContent=s.scene.english;
                q('.theater-ja').textContent=s.scene.japanese;
                q('.theater-ja-label').textContent='Paragraph '+s.scene.paragraph+' の和訳（段落全体）';
                q('.theater-caption').scrollTop=0;
                frame.classList.remove('theater-transition');void frame.offsetWidth;frame.classList.add('theater-transition');
                const next=config.scenes[s.index+1];if(next&&host.Image){const preload=new host.Image();preload.src=next.image;}
            }
            showJa=s.japanese;q('.theater-ja').hidden=!showJa;q('.theater-ja-label').hidden=!showJa;
            q('[data-count]').textContent='Scene '+(s.index+1)+' / '+s.total;
            q('.theater-progress i').style.width=((s.index+1)/s.total*100)+'%';
            button('prev').disabled=s.index===0;button('next').disabled=s.index===s.total-1;
            button('manual').disabled=s.playing&&s.auto;
            button('manual').textContent=s.playing&&!s.auto?'■ 停止':'🔊 このシーン';
            button('auto').textContent=s.playing&&s.auto?'■ 自動再生停止':'▶ 自動再生';
            button('jp').textContent='和訳 '+(showJa?'ON':'OFF');button('jp').setAttribute('aria-pressed',String(showJa));
            q('select').value=String(s.rate);q('select').disabled=s.playing;
            button('finish').textContent=s.index===s.total-1&&!s.playing?'Step 2　音読へ進む →':'⏭ スキップして音読へ進む';
            const msg=q('.theater-message');msg.textContent=s.error||(s.finished?'✓ 最後のシーンまで再生しました。次は音読練習です。':'');msg.hidden=!msg.textContent;msg.setAttribute('role',s.error?'alert':'status');
            fit();
        }
        const session=createSession({...config,
            stop:()=>{stopRecorded();sceneClips.stop();config.stop();},
            play:(scene,rate,onEnd,onError)=>{
                if(scene.audio){
                    sceneClips.play({
                        url:scene.audio,rate,onEnd,
                        onError:()=>config.play({...scene,audio:null},rate,onEnd,onError)
                    });
                }else config.play(scene,rate,onEnd,onError);
            },
            playRecorded:config.recordedAudio?((startIndex,endIndex,rate,onScene,onEnd,onError)=>{
                stopRecorded();
                recordedHandle=playRecordedAudio(host,{
                    url:config.recordedAudio,scenes:config.scenes,
                    startIndex,endIndex,rate,onScene,onEnd,onError
                });
            }):undefined,
            update:paint,finish:()=>{remove();config.onFinish();},back:()=>{remove();config.onBack();}
        });
        function remove(){
            if(removed)return;removed=true;session.close();observer?.disconnect();host.removeEventListener('resize',fit);root.remove();doc.body.classList.remove('po-theater-active');
            for(const [child,value] of previousInert)child.inert=value;
            if(active?.session===session)active=null;
            if(old?.isConnected)old.focus();
        }
        active={session,remove};
        const actions={prev:()=>session.navigate(-1),next:()=>session.navigate(1),manual:session.manual,auto:session.autoplay,jp:session.toggleJapanese,finish:()=>session.close('finish'),close:()=>session.close('back')};
        Object.keys(actions).forEach(name=>button(name).addEventListener('click',actions[name]));
        q('select').addEventListener('change',e=>session.changeRate(e.target.value));
        root.addEventListener('keydown',e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();session.close('back');}
            else if(e.target===root&&e.key==='ArrowLeft')session.navigate(-1);
            else if(e.target===root&&e.key==='ArrowRight')session.navigate(1);
            else if(e.key==='Tab'){
                const controls=[...root.querySelectorAll('button:not(:disabled),select:not(:disabled),[tabindex="0"]')];
                if(!controls.length)return;
                const first=controls[0],last=controls[controls.length-1];
                if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===root)){e.preventDefault();last.focus();}
                else if(!e.shiftKey&&(doc.activeElement===last||doc.activeElement===root)){e.preventDefault();first.focus();}
            }
        });
        if(typeof host.ResizeObserver==='function'){observer=new host.ResizeObserver(fit);observer.observe(frame);}
        host.addEventListener('resize',fit);session.paint();root.focus();
    }
    return {open,dismiss,pause,createSession,sceneBoundaries,playRecordedAudio,createSceneClipPlayer};
});
