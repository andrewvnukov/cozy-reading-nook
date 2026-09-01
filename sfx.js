'use strict';
// ============================================================
// sfx.js — процедурные звуки и генеративный музыкальный луп. Никаких
// аудиофайлов — весь звук синтезируется на лету движком ZzFXMicro
// (Frank Force, MIT/CC0, https://killedbyapixel.github.io/ZzFX/).
// ============================================================
const audioDefaultSampleRate = 44100;
let audioCtx = null, masterGain = null;
function ensureAudio(){
  if(audioCtx) return audioCtx;
  try{
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = .6;
    masterGain.connect(audioCtx.destination);
  }catch(e){}
  return audioCtx;
}
// разблокировка звука по первому касанию (автоплей-политики браузеров/WebView)
addEventListener("pointerdown", ()=>{ const ctx=ensureAudio(); if(ctx&&ctx.state!=="running") ctx.resume().catch(()=>{}); }, {once:true, passive:true});

const rand = (a=1,b=0) => b+(a-b)*Math.random();

// ---------- ZzFXMicro: генерация сэмплов по параметрам ----------
function zzfxG(volume=1, randomness=.05, frequency=220, attack=0, sustain=0, release=.1,
  shape=0, shapeCurve=1, slide=0, deltaSlide=0, pitchJump=0, pitchJumpTime=0, repeatTime=0,
  noise=0, modulation=0, bitCrush=0, delay=0, sustainVolume=1, decay=0, tremolo=0, filter=0){
  let sampleRate=audioDefaultSampleRate, PI2=Math.PI*2,
    startSlide=slide*=500*PI2/sampleRate/sampleRate,
    startFrequency=frequency*=(1+rand(randomness,-randomness))*PI2/sampleRate,
    modOffset=0, repeat=0, crush=0, jump=1, length, b=[], t=0, i=0, s=0, f,
    quality=2, w=PI2*Math.abs(filter)*2/sampleRate,
    cosw=Math.cos(w), alpha=Math.sin(w)/2/quality,
    a0=1+alpha, a1=-2*cosw/a0, a2=(1-alpha)/a0,
    b0=(1+Math.sign(filter)*cosw)/2/a0, b1=-(Math.sign(filter)+cosw)/a0, b2=b0,
    x2=0, x1=0, y2=0, y1=0;
  const minAttack=9;
  attack=attack*sampleRate||minAttack; decay*=sampleRate; sustain*=sampleRate; release*=sampleRate;
  delay*=sampleRate; deltaSlide*=500*PI2/sampleRate**3; modulation*=PI2/sampleRate;
  pitchJump*=PI2/sampleRate; pitchJumpTime*=sampleRate; repeatTime=repeatTime*sampleRate|0;
  for(length=attack+decay+sustain+release+delay|0; i<length; b[i++]=s*volume){
    if(!(++crush%(bitCrush*100|0))){
      s = shape? shape>1? shape>2? shape>3? shape>4?
          (t/PI2%1 < shapeCurve/2? 1:-1):
          Math.sin(t**3):
          Math.max(Math.min(Math.tan(t),1),-1):
          1-(2*t/PI2%2+2)%2:
          1-4*Math.abs(Math.round(t/PI2)-t/PI2):
          Math.sin(t);
      s = (repeatTime? 1-tremolo+tremolo*Math.sin(PI2*i/repeatTime) : 1) *
          (shape>4?s:Math.sign(s)*Math.abs(s)**shapeCurve) *
          (i<attack? i/attack :
           i<attack+decay? 1-((i-attack)/decay)*(1-sustainVolume) :
           i<attack+decay+sustain? sustainVolume :
           i<length-delay? (length-i-delay)/release*sustainVolume : 0);
      s = delay? s/2 + (delay>i? 0 : (i<length-delay? 1:(length-i)/delay) * b[i-delay|0]/2/volume) : s;
      if(filter) s = y1 = b2*x2 + b1*(x2=x1) + b0*(x1=s) - a2*y2 - a1*(y2=y1);
    }
    f=(frequency+=slide+=deltaSlide)*Math.cos(modulation*modOffset++);
    t+=f+f*noise*Math.sin(i**5);
    if(jump && ++jump>pitchJumpTime){ frequency+=pitchJump; startFrequency+=pitchJump; jump=0; }
    if(repeatTime && !(++repeat%repeatTime)){ frequency=startFrequency; slide=startSlide; jump=jump||1; }
  }
  return b;
}
function playBuffer(samples, volume=1, loop=false){
  const ctx=ensureAudio(); if(!ctx) return;
  const buf=ctx.createBuffer(1, samples.length, audioDefaultSampleRate);
  buf.getChannelData(0).set(samples);
  const src=ctx.createBufferSource(); src.buffer=buf; src.loop=loop;
  const g=ctx.createGain(); g.gain.value=volume;
  src.connect(g).connect(masterGain);
  src.start(0);
  return src;
}
function zzfx(...params){ return playBuffer(zzfxG(...params)); }

// ---------- Книжный Уголок: мягкий бумажный шелест переворота страницы,
// тёплый звон искры, уютный колокольчик покупки, глухая ошибка ----------
const SFX = {
  tap:  [.28,.12,340,.004,.02,.05,3,1.4,-40,0,0,0,0,.35,0,.04,0,.5,.015],
  coin: [.42,.03,700,.01,.045,.11,0,1.4,120,0,200,.04,0,0,0,0,.04,.68,.025],
  buy:  [.6,0,494,.02,.3,.4,0,1.25,0,0,120,.07,0,0,0,0,.1,.85,.05],
  error:[.4,0,140,.02,.05,.12,1,.8,0,0,0,0,0,.24,0,.08,0,.6,.04],
};
function sfx(name){ try{ zzfx(...SFX[name]); }catch(e){} }

// ---------- Генеративный музыкальный луп ----------
// F-мажор, 88 BPM, прогрессия F–Dm–Bb–C (I–vi–IV–V), сыграна дважды (2 круга
// по 4 такта = 32 доли), бесшовно зациклена. Три слоя: пэды-аккорды (синус),
// бас на корне аккорда октавой ниже (треугольник), «капельная» мелодия-
// колокольчик по F-мажорной пентатонике с лёгким эхом (delay ~.15) — тёплый,
// сонный тембр дождливого вечера у свечи. Буфер нормализован к пику 0.8.
const NOTE_HZ = m => 440*Math.pow(2,(m-69)/12);
function mixInto(mix, samples, offset, gain){
  gain = gain==null?1:gain;
  for(let i=0;i<samples.length;i++){
    const idx=offset+i; if(idx<0||idx>=mix.length) continue;
    mix[idx]+=(samples[i]||0)*gain;
  }
}
function buildSong(){
  const sr=audioDefaultSampleRate, bpm=88, beat=60/bpm;
  const chords=[ [65,69,72], [62,65,69], [58,62,65], [60,64,67] ]; // F, Dm, Bb, C
  const bassRoots=[41,38,34,36];                                    // F2, D2, Bb1, C2
  const melodyScale=[74,77,79,81,84];                                // D5 F5 G5 A5 C6 (пентатоника F-мажор)
  const melodyPattern=[
    [0,2,4,2],[1,3,1,4],[2,0,3,1],[4,2,0,3],
    [0,3,2,4],[3,1,4,0],[2,4,1,3],[1,0,4,2],
  ];
  const barsPerLoop=4, loops=2, totalBeats=barsPerLoop*4*loops; // 32 доли
  const totalSec = totalBeats*beat + 2;
  const mix = new Float32Array(Math.ceil(totalSec*sr));

  for(let loop=0; loop<loops; loop++){
    for(let bar=0; bar<barsPerLoop; bar++){
      const ci=bar%4, chord=chords[ci], bassRoot=bassRoots[ci];
      const barStartBeat = loop*barsPerLoop*4 + bar*4;
      const barStartSample = Math.round(barStartBeat*beat*sr);
      // пэды — 3 ноты аккорда, синус, мягкая атака/спад
      chord.forEach(note=>{
        const s=zzfxG(.17,0,NOTE_HZ(note),.85,2.7*beat,1.2,0,1,0,0,0,0,0,0,0,0,0,.9,0,0,0);
        mixInto(mix, s, barStartSample, 1);
      });
      // бас — корень аккорда октавой ниже, треугольник, на сильной доле
      const bs=zzfxG(.24,0,NOTE_HZ(bassRoot),.02,beat*0.85,.3,1,1,0,0,0,0,0,0,0,0,0,.85,0,0,0);
      mixInto(mix, bs, barStartSample, 1);
      // мелодия — «капельный» колокольчик по пентатонике, с лёгким эхом
      const pattern = melodyPattern[(loop*barsPerLoop+bar)%melodyPattern.length];
      pattern.forEach((deg,i)=>{
        const noteSample = Math.round((barStartBeat+i)*beat*sr);
        const midi = melodyScale[deg] + (Math.random()<0.12?-12:0);
        const m=zzfxG(.14,.02,NOTE_HZ(midi),.015,beat*0.45,.35,0,1.55,0,0,0,0,0,0,0,0,.15,.9,0,0,0);
        mixInto(mix, m, noteSample, 1);
      });
    }
  }
  // нормализация к пику 0.8 (иначе клиппинг)
  let peak=0; for(let i=0;i<mix.length;i++){ const a=Math.abs(mix[i]); if(a>peak) peak=a; }
  if(peak>0){ const k=0.8/peak; for(let i=0;i<mix.length;i++) mix[i]*=k; }
  return mix;
}
let musicSrc=null;
function startMusic(){
  if(musicSrc) return;
  const ctx=ensureAudio(); if(!ctx) return;
  try{ musicSrc=playBuffer(buildSong(), .4, true); }catch(e){}
}
function stopMusic(){ if(musicSrc){ try{ musicSrc.stop(); }catch(e){} musicSrc=null; } }
