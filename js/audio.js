/* ===== audio.js: Bộ tổng hợp âm thanh Web Audio API & hiệu ứng SFX ===== */
// ===== Âm thanh: tổng hợp bằng code (tạm), có thể ghi đè bằng file thật qua SOUNDPACK =====
const SOUNDPACK = {   // tên âm -> đường dẫn file mp3/ogg (tải khi mở âm thanh)
  isle:'snd/isle.mp3'   // tiếng bị kéo vào / dẫm vào Đảo hoang (file của người chơi)
  ,jail:'snd/jail.mp3'   // tiếng bị bắt vào tù (file của người chơi)
  ,hotel:'snd/hotel.mp3'   // tiếng xây xong khách sạn / cao ốc cấp 3 (file của người chơi)
  ,lose:'snd/lose.mp3'   // tiếng bị trừ tiền (file của người chơi)
  ,gain:'snd/gain.mp3'   // tiếng được cộng tiền (file của người chơi)
  ,podium:'snd/podium.mp3'   // tiếng bục vinh danh khi hết trận (file của người chơi)
};
const SFX = (() => {
  const has = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  let ctx = null, sg = null, mg = null, mode = 'off', sched = null, nextT = 0, mstep = 0;
  const pack = {}, last = {}, voice = {};
  // Điều phối tiếng: tiếng sự kiện (mua, trả tiền, nhận tiền, vào tù...) không chồng lên nhau mà nối đuôi; cùng một tiếng gọi 2 lần sát nhau chỉ phát 1 lần
  const LIGHT = new Set(['step','tick','click','chat','pop','dice','shuffle','turn']);
  const DUR = {land:.16, buy:.15, lose:1.07, coin:.33, coinbig:.4, gain:2.5, card:.25, event:.9, jail:.68, isle:.42, island:1.1, cry:2, auction:.8, loan:.3, unjail:.45, double:.55};
  let fgNext = 0, fgLast = -9, diceUntil = 0;
  let st = {mus:.55, sfx:.9, master:1}, dk = 1;
  try { const r = localStorage.getItem('lendoi_snd'); if(r) st = Object.assign(st, JSON.parse(r)); } catch(e) {}
  const save = () => { try { localStorage.setItem('lendoi_snd', JSON.stringify(st)); } catch(e) {} };
  const M = m => 440*Math.pow(2, (m-69)/12);
  const applyGains = () => { if(!ctx) return; sg.gain.value = st.sfx*st.master; mg.gain.setTargetAtTime(st.mus*.32*st.master*dk, ctx.currentTime, .08); };
  const nb = c => { if(!c._nb){ const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1; c._nb = b; } return c._nb; };
  function tone(c, d, t, f, dur, o){
    o = o || {};
    const os = c.createOscillator(), g = c.createGain(), v = o.vol==null ? .3 : o.vol, a = o.att==null ? .006 : o.att;
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
    if(o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t+dur);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t+a); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    let n = os; if(o.lp){ const q = c.createBiquadFilter(); q.type = 'lowpass'; q.frequency.value = o.lp; os.connect(q); n = q; }
    n.connect(g); g.connect(d); os.start(t); os.stop(t+dur+.05);
  }
  function hiss(c, d, t, dur, o){
    o = o || {};
    const s = c.createBufferSource(), q = c.createBiquadFilter(), g = c.createGain(), v = o.vol==null ? .3 : o.vol, a = o.att==null ? .004 : o.att;
    s.buffer = nb(c); s.loop = true; q.type = o.type || 'bandpass'; q.frequency.setValueAtTime(o.f || 1500, t); if(o.to) q.frequency.exponentialRampToValueAtTime(o.to, t+dur); q.Q.value = o.q==null ? 1 : o.q;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t+a); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    s.connect(q); q.connect(g); g.connect(d); s.start(t, Math.random()*.5); s.stop(t+dur+.05);
  }
  const SND = {
    click:(c,d,t)=>tone(c,d,t,880,.05,{type:'triangle',vol:.2}),
    pop:(c,d,t)=>tone(c,d,t,480,.09,{vol:.22,to:720}),
    turn:(c,d,t)=>{ tone(c,d,t,784,.22,{type:'triangle',vol:.3}); tone(c,d,t+.12,1175,.34,{type:'triangle',vol:.3}); },
    // Xúc xắc rơi từ trên xuống (showDice): viên 1 chạy 950ms, viên 2 chạy 1080ms; chạm bàn ở 55%, nảy rồi chạm lại ở 88%, nằm yên ở 100%
    dice:(c,d,t)=>{ hiss(c,d,t,.5,{f:600,to:1800,q:.7,vol:.05,att:.3});
      const hit = (tt, v) => { hiss(c,d,tt,.045,{f:2200+Math.random()*1400,q:2,vol:.32*v}); tone(c,d,tt,150+Math.random()*50,.07,{type:'triangle',vol:.22*v,to:90}); hiss(c,d,tt+.03+Math.random()*.02,.03,{f:3200,q:3,vol:.12*v}); };
      [950,1080].forEach((ms,k) => { const s = ms/1000; hit(t+s*.55, 1); [.62,.68].forEach(o => hit(t+s*o+Math.random()*.01, .25)); hit(t+s*.88, .55); hit(t+s, .2); }); },
    shuffle:(c,d,t)=>{ for(let k=0;k<9;k++){ const tt = t+k*.075+Math.random()*.03; hiss(c,d,tt,.05,{f:1500+Math.random()*1800,q:2,vol:.3*(1-k/12)}); tone(c,d,tt,140+Math.random()*60,.05,{type:'triangle',vol:.14*(1-k/12)}); } hiss(c,d,t+.78,.09,{f:900,q:1.5,vol:.18}); },
    double:(c,d,t)=>[76,80,83,88].forEach((m,k)=>tone(c,d,t+k*.07,M(m),.34,{vol:.2})),
    fly:(c,d,t)=>{ hiss(c,d,t,.26,{f:420,to:1100,q:.9,vol:.06,att:.06}); hiss(c,d,t+.12,.2,{f:900,to:500,q:.9,vol:.035,att:.05}); },
    step:(c,d,t)=>{ tone(c,d,t,180+Math.random()*30,.075,{vol:.34,to:105,type:'triangle',lp:800}); hiss(c,d,t,.022,{f:700,type:'lowpass',vol:.05}); },
    land:(c,d,t)=>{ tone(c,d,t,200,.16,{vol:.3,to:140}); hiss(c,d,t,.05,{f:2500,vol:.12}); },
    tick:(c,d,t)=>tone(c,d,t,1250,.045,{type:'square',vol:.09}),
    coin:(c,d,t)=>{ tone(c,d,t,1568,.14,{type:'triangle',vol:.26}); tone(c,d,t+.07,2093,.26,{type:'triangle',vol:.26}); },
    coinbig:(c,d,t)=>{ [1175,1568,2093,2637].forEach((f,k)=>tone(c,d,t+k*.06,f,.28,{type:'triangle',vol:.24})); hiss(c,d,t+.1,.3,{type:'highpass',f:6000,vol:.05}); },
    lose:(c,d,t)=>{ tone(c,d,t,420,.28,{type:'triangle',vol:.3,to:190}); hiss(c,d,t,.1,{type:'lowpass',f:500,vol:.25}); },
    go:(c,d,t)=>[72,76,79,84].forEach((m,k)=>tone(c,d,t+k*.08,M(m),.25,{type:'triangle',vol:.26})),
    buy:(c,d,t)=>{ hiss(c,d,t,.09,{type:'lowpass',f:450,vol:.4}); tone(c,d,t,120,.12,{vol:.4,to:70}); tone(c,d,t+.07,950,.06,{type:'triangle',vol:.2}); },
    build:(c,d,t)=>{ [0,.2].forEach(o=>{ hiss(c,d,t+o,.07,{f:900,q:3,vol:.4}); tone(c,d,t+o,180,.08,{vol:.3,to:100}); }); tone(c,d,t+.5,520,.2,{vol:.28,to:980}); },
    jail:(c,d,t)=>{ tone(c,d,t,160,.5,{type:'sawtooth',vol:.18,to:90,lp:900}); hiss(c,d,t,.25,{type:'highpass',f:2500,vol:.25}); tone(c,d,t+.12,95,.3,{vol:.35,to:60}); },
    unjail:(c,d,t)=>{ tone(c,d,t,300,.25,{type:'triangle',vol:.25,to:700}); tone(c,d,t+.2,880,.2,{type:'triangle',vol:.22}); },
    bankrupt:(c,d,t)=>[392,370,349,311].forEach((fr,k)=>tone(c,d,t+k*.28,fr,k===3?.9:.3,{type:'sawtooth',vol:.18,lp:1100,to:k===3?fr*.8:0})),
    loan:(c,d,t)=>{ hiss(c,d,t,.16,{type:'highpass',f:3500,vol:.18}); hiss(c,d,t+.2,.09,{type:'lowpass',f:450,vol:.35}); tone(c,d,t+.2,115,.1,{vol:.3,to:70}); },
    debtpaid:(c,d,t)=>{ tone(c,d,t,1568,.5,{vol:.25}); tone(c,d,t+.1,2093,.5,{vol:.2}); },
    warn:(c,d,t)=>[0,.16,.32,.48].forEach((o,k)=>tone(c,d,t+o,k%2?520:740,.15,{type:'square',vol:.1,lp:1800})),
    card:(c,d,t)=>{ hiss(c,d,t,.22,{f:1200,to:4200,q:1.2,vol:.26}); tone(c,d,t+.2,900,.05,{type:'triangle',vol:.15}); },
    badge:(c,d,t)=>[79,83,86,91,95].forEach((m,k)=>tone(c,d,t+k*.07,M(m),.4,{vol:.2})),
    event:(c,d,t)=>{ tone(c,d,t,660,.8,{vol:.28}); tone(c,d,t,990,.6,{vol:.14}); tone(c,d,t+.25,880,.7,{vol:.2}); },
    cut:(c,d,t)=>{ tone(c,d,t,260,.7,{type:'sawtooth',vol:.2,to:90,lp:800}); hiss(c,d,t,.2,{type:'lowpass',f:400,vol:.25}); },
    bounty:(c,d,t)=>[0,.13].forEach(o=>tone(c,d,t+o,1046,.12,{type:'square',vol:.12,lp:2500})),
    win:(c,d,t)=>{ [[72,0],[76,.14],[79,.28],[84,.42]].forEach(a=>{ tone(c,d,t+a[1],M(a[0]),.3,{type:'triangle',vol:.28}); tone(c,d,t+a[1],M(a[0]),.3,{type:'square',vol:.07,lp:2000}); }); [72,76,79,84].forEach(m=>tone(c,d,t+.6,M(m),1.1,{type:'triangle',vol:.2})); },
    lose2:(c,d,t)=>[67,65,63,60].forEach((m,k)=>tone(c,d,t+k*.3,M(m),k===3?.9:.35,{type:'triangle',vol:.26,lp:1500})),
    levelup:(c,d,t)=>[72,76,79,84,88,91].forEach((m,k)=>tone(c,d,t+k*.08,M(m),.35,{type:'triangle',vol:.22})),
    whoosh:(c,d,t)=>hiss(c,d,t,.5,{f:350,to:2600,q:.9,vol:.4}),
    splat:(c,d,t)=>{ hiss(c,d,t,.28,{type:'lowpass',f:1100,vol:.5}); tone(c,d,t,170,.22,{vol:.45,to:55}); [.12,.2,.3].forEach((o,k)=>tone(c,d,t+o,600+k*170,.06,{vol:.2,to:300})); },
    slurp:(c,d,t)=>[0,.22,.44,.66].forEach(o=>{ tone(c,d,t+o,260,.16,{vol:.28,to:150}); hiss(c,d,t+o,.14,{f:900,to:400,q:2,vol:.12}); }),
    umbrella:(c,d,t)=>{ hiss(c,d,t,.14,{f:900,to:3000,vol:.3}); tone(c,d,t,640,.12,{vol:.2,to:1100}); [.5,.85,1.2].forEach((o,k)=>tone(c,d,t+o,1500+k*140,.12,{type:'triangle',vol:.2})); },
    sparkle:(c,d,t)=>[84,88,91,96,100].forEach((m,k)=>tone(c,d,t+k*.09,M(m),.3,{vol:.14})),
    chat:(c,d,t)=>{ tone(c,d,t,1046,.07,{vol:.2}); tone(c,d,t+.07,1318,.1,{vol:.2}); },
    join:(c,d,t)=>{ tone(c,d,t,659,.12,{type:'triangle',vol:.25}); tone(c,d,t+.1,880,.2,{type:'triangle',vol:.25}); },
    island:(c,d,t)=>hiss(c,d,t,1.1,{type:'lowpass',f:500,to:900,q:.5,vol:.35,att:.5}),
    podium:(c,d,t)=>{ [[72,0],[76,.14],[79,.28],[84,.42]].forEach(a=>tone(c,d,t+a[1],M(a[0]),.3,{type:'triangle',vol:.28})); },
    gain:(c,d,t)=>{ tone(c,d,t,1568,.14,{type:'triangle',vol:.26}); tone(c,d,t+.07,2093,.26,{type:'triangle',vol:.26}); },
    isle:(c,d,t)=>{ tone(c,d,t,520,.3,{type:'triangle',vol:.3,to:180}); hiss(c,d,t,.25,{type:'lowpass',f:700,vol:.25}); },
    cry:(c,d,t)=>[0,.42,.84,1.26,1.68].forEach((o,k)=>{ tone(c,d,t+o,720-k*30,.34,{type:'triangle',vol:.22,to:420-k*20}); tone(c,d,t+o+.05,1100-k*40,.26,{vol:.07,to:700}); }),
    grr:(c,d,t)=>{                // tiếng gầm "Grrr" giận dữ: giọng trầm khàn, lăn chữ R, vang theo nguyên âm "u"
      const dur = 1.35, out = c.createGain(), env = c.createGain(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      env.gain.setValueAtTime(.0001, t); env.gain.linearRampToValueAtTime(1, t+.05); env.gain.setValueAtTime(1, t+.25); env.gain.linearRampToValueAtTime(.8, t+dur*.72); env.gain.exponentialRampToValueAtTime(.0001, t+dur);
      lfo.type = 'triangle'; lfo.frequency.setValueAtTime(24, t); lfo.frequency.linearRampToValueAtTime(30, t+dur); lg.gain.value = .48; am.gain.value = .52; lfo.connect(lg); lg.connect(am.gain);
      const ws = c.createWaveShaper(), cv = new Float32Array(1024); for(let i=0;i<1024;i++){ const x = i/511.5-1; cv[i] = Math.tanh(x*3.2); } ws.curve = cv;
      const v = c.createGain(); v.gain.value = .55; v.connect(ws);
      const f0 = c.createOscillator(), f1 = c.createOscillator(); f0.type = 'sawtooth'; f1.type = 'square';
      [[f0,1],[f1,.5]].forEach(([o,k]) => { o.frequency.setValueAtTime(92*k, t); o.frequency.linearRampToValueAtTime(128*k, t+.22); o.frequency.exponentialRampToValueAtTime(78*k, t+dur); const g = c.createGain(); g.gain.value = k===1 ? 1 : .55; o.connect(g); g.connect(v); });
      const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain(); n.buffer = nb(c); n.loop = true; nf.type = 'bandpass'; nf.frequency.value = 520; nf.Q.value = .9; ng.gain.value = .35; n.connect(nf); nf.connect(ng); ng.connect(v);
      [[330,4.5,1],[820,6,.75],[2400,3,.25]].forEach(([fq,q,gv]) => { const b = c.createBiquadFilter(), g = c.createGain(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = q; g.gain.value = gv; ws.connect(b); b.connect(g); g.connect(am); });
      am.connect(env); env.connect(out); out.gain.value = 1.15; out.connect(d);
      [f0,f1,lfo].forEach(o => { o.start(t); o.stop(t+dur+.05); }); n.start(t, Math.random()*.5); n.stop(t+dur+.05);
    },
    saw:(c,d,t)=>[0,.2,.4,.6].forEach(o=>hiss(c,d,t+o,.15,{f:1300,to:2700,q:4,vol:.22})),
    auction:(c,d,t)=>{ [0,.12,.24].forEach(o=>tone(c,d,t+o,200,.07,{vol:.35,to:140})); tone(c,d,t+.5,1100,.3,{type:'triangle',vol:.25}); }
  };
  const CALM = {ch:[[48,52,55],[45,48,52],[41,45,48],[43,47,50]], mel:[72,74,76,79,76,74,72,69,72,76,79,81,79,76,74,72,77,76,74,72,74,76,77,79,79,76,74,71,72,74,76,72]};
  const TENSE = {ch:[[45,48,52],[41,45,48],[43,47,50],[40,44,47]], mel:[69,72,74,76,74,72,69,67,69,72,76,79,76,74,72,69,77,76,74,72,71,72,74,76,76,74,72,71,69,71,72,69]};
  function tickMusic(){
    if(!ctx || mode==='off') return;
    const P = mode==='tense' ? TENSE : CALM, sp = 60/(mode==='tense' ? 138 : 104)/2;
    if(nextT < ctx.currentTime) nextT = ctx.currentTime + .05;
    while(nextT < ctx.currentTime + .3){
      const ch = P.ch[Math.floor(mstep/8) % 4], pos = mstep % 8;
      if(pos===0){ tone(ctx, mg, nextT, M(ch[0]), sp*7, {vol:.3}); [1,2].forEach(k => tone(ctx, mg, nextT, M(ch[k]+12), sp*3, {vol:.1, type:'triangle', lp:1400})); }
      if(pos===4) tone(ctx, mg, nextT, M(ch[0]+7), sp*3, {vol:.16});
      if(pos%2===0 || Math.random()<.35) tone(ctx, mg, nextT, M(P.mel[mstep % P.mel.length]), sp*1.8, {vol:.15, type:'triangle', lp:2600});
      if(pos%2===1) hiss(ctx, mg, nextT, .03, {type:'highpass', f:7000, vol:.03});
      nextT += sp; mstep++;
    }
  }
  const schedOld = () => { if(ctx && !sched){ nextT = ctx.currentTime + .1; sched = setInterval(tickMusic, 60); } };   // dự phòng cho máy không dựng sẵn được
  // Nhạc nền nhẹ máy: dựng sẵn một đoạn 32 nhịp (khoảng 7 đến 9 giây) MỘT lần, rồi phát lặp như file nhạc.
  // Trước đây mỗi nốt nhạc được tạo trực tiếp, cứ 0,06 giây một lần, làm máy chạy liên tục và nóng.
  const LOOPS = {}; let cur = null, curMode = '';
  const bake = m => new Promise(res => {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if(!OC){ res(null); return; }
    try {
      const P = m==='tense' ? TENSE : CALM, sp = 60/(m==='tense' ? 138 : 104)/2, steps = 32, sr = 22050, n = Math.round(steps*sp*sr);
      const oc = new OC(1, n + 2*sr, sr), d = oc.createGain(); d.connect(oc.destination);
      for(let k=0;k<steps;k++){ const t = .01 + k*sp, ch = P.ch[Math.floor(k/8) % 4], pos = k % 8;
        if(pos===0){ tone(oc, d, t, M(ch[0]), sp*7, {vol:.3}); [1,2].forEach(q => tone(oc, d, t, M(ch[q]+12), sp*3, {vol:.1, type:'triangle', lp:1400})); }
        if(pos===4) tone(oc, d, t, M(ch[0]+7), sp*3, {vol:.16});
        if(pos%2===0 || Math.random()<.35) tone(oc, d, t, M(P.mel[k % P.mel.length]), sp*1.8, {vol:.15, type:'triangle', lp:2600});
        if(pos%2===1) hiss(oc, d, t, .03, {type:'highpass', f:7000, vol:.03}); }
      const done = buf => { try { const out = ctx.createBuffer(1, n, sr), o = out.getChannelData(0), src = buf.getChannelData(0);
          for(let i=0;i<src.length;i++) o[i % n] += src[i];   // phần ngân dư ở cuối cộng vòng về đầu để lặp liền mạch
          res(out); } catch(e) { res(null); } };
      const r = oc.startRendering(); if(r && r.then) r.then(done, () => res(null)); else oc.oncomplete = e => done(e.renderedBuffer);
    } catch(e) { res(null); }
  });
  const startSched = () => {
    if(!ctx || mode==='off' || (cur && curMode===mode)) return;
    const m = mode, go = buf => {
      if(!ctx || mode!==m) return;
      if(!buf){ schedOld(); return; }
      const t = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(1, t + .8); s.connect(g); g.connect(mg); s.start(t);
      if(cur){ const o = cur; o.g.gain.setTargetAtTime(.0001, t, .25); try { o.s.stop(t + 1.2); } catch(e) {} }
      cur = {s, g}; curMode = m; };
    if(LOOPS[m]) go(LOOPS[m]); else bake(m).then(b => { LOOPS[m] = b; go(b); });
  };
  const stopSched = () => { if(sched){ clearInterval(sched); sched = null; }
    if(cur && ctx){ const o = cur, t = ctx.currentTime; o.g.gain.setTargetAtTime(.0001, t, .2); try { o.s.stop(t + 1); } catch(e) {} } cur = null; curMode = ''; };
  // màn hình tắt hoặc chuyển ứng dụng: tạm ngưng hẳn âm thanh cho đỡ tốn pin
  if(typeof document!=='undefined') document.addEventListener('visibilitychange', () => { if(!ctx) return; try { if(document.hidden) ctx.suspend(); else ctx.resume(); } catch(e) {} });
  return {
    state(){ return !has ? 'máy không hỗ trợ' : !ctx ? 'chưa mở' : ctx.state; },
    unlock(){
      if(!has) return;
      if(!ctx){
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          const comp = ctx.createDynamicsCompressor(); sg = ctx.createGain(); mg = ctx.createGain();
          applyGains(); sg.connect(comp); mg.connect(comp); comp.connect(ctx.destination);
          Object.keys(SOUNDPACK).forEach(k => { fetch(SOUNDPACK[k]).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(ab => { ctx.decodeAudioData(ab, buf => { pack[k] = buf; }, () => {}); }).catch(() => {}); });   // tải lỗi thì dùng âm tổng hợp
        } catch(e) { ctx = null; return; }
      }
      // iPhone có thêm trạng thái "interrupted" ngoài "suspended": cứ chưa chạy là gọi resume, kèm một mẫu im lặng phát ngay trong lúc chạm để mở khóa loa
      if(ctx.state!=='running'){ try { const pr = ctx.resume(); if(pr && pr.catch) pr.catch(() => {}); } catch(e) {}
        try { const sb = ctx.createBuffer(1, 1, 22050), ss = ctx.createBufferSource(); ss.buffer = sb; ss.connect(ctx.destination); ss.start(0); } catch(e) {} }
      // iPhone: âm tổng hợp bị tắt khi gạt nút im lặng. Báo cho máy đây là âm thanh "phát nhạc" và phát kèm một đoạn im lặng lặp lại để tiếng game vẫn ra loa
      if(!this._ios){ this._ios = 1;
        try { if(navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
        try { const n = 2205, b = new Uint8Array(44+n), dv = new DataView(b.buffer), W = (o,t) => { for(let i=0;i<t.length;i++) b[o+i] = t.charCodeAt(i); };
          W(0,'RIFF'); dv.setUint32(4,36+n,true); W(8,'WAVEfmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true); dv.setUint32(24,22050,true); dv.setUint32(28,22050,true); dv.setUint16(32,1,true); dv.setUint16(34,8,true); W(36,'data'); dv.setUint32(40,n,true); b.fill(128,44);
          let bin = ''; for(let i=0;i<b.length;i++) bin += String.fromCharCode(b[i]);
          const au = document.createElement('audio'); au.src = 'data:audio/wav;base64,' + btoa(bin); au.loop = true; au.setAttribute('playsinline', ''); au.preload = 'auto'; this._sil = au;
          const p = au.play(); if(p && p.catch) p.catch(() => {}); } catch(e) {} }
      else if(this._sil && this._sil.paused){ try { const p = this._sil.play(); if(p && p.catch) p.catch(() => {}); } catch(e) {} }
      if(mode!=='off') startSched();
    },
    play(name, delay, vol){
      if(!ctx || st.sfx<=0 || st.master<=0) return; if(name==='chat' && this.focus) return;
      let t = ctx.currentTime + .005 + (delay || 0); const light = LIGHT.has(name);
      if(last[name]!=null && Math.abs(t - last[name]) < (light ? .09 : .35)) return;   // cùng một tiếng bị gọi 2 lần (ví dụ vừa từ ô đất vừa từ dòng thông báo)
      if(name==='pop' && (Math.abs(t - fgLast) < .25 || t < fgNext)) return;            // tiếng bật hộp thoại nhường cho tiếng sự kiện đang phát
      if(!light){ if(t < fgNext && fgNext - t < .9) t = fgNext; fgLast = t; fgNext = t + Math.max(.18, Math.min(DUR[name] || .3, .45)); }
      if(name==='dice') diceUntil = t + 1.15;
      last[name] = t;
      let dest = sg; if(vol!=null && vol!==1){ dest = ctx.createGain(); dest.gain.value = vol; dest.connect(sg); }
      if(pack[name]){ const s = ctx.createBufferSource(); s.buffer = pack[name]; s.connect(dest);
        if(name==='gain' || name==='podium'){ try { if(voice[name]) voice[name].stop(t); } catch(e) {} voice[name] = s; }   // tiền cộng liên tiếp: tiếng mới phát lại từ đầu, không chồng lớp
        if(name==='gain'){ const g = ctx.createGain(); s.disconnect(); s.connect(g); g.connect(dest); g.gain.setValueAtTime(1, t+1.6); g.gain.linearRampToValueAtTime(.0001, t+2.5); s.start(t); s.stop(t+2.55); return; }   // file tiền dài 4 giây: giữ 2,5 giây, nhỏ dần từ giây 1,6
        s.start(t); return; }
      const fn = SND[name]; if(fn){ try { fn(ctx, dest, t); } catch(e) {} }
    },
    // Tiếng nền của các cảnh trang trí (xe tiền, máy bay, xe cảnh sát, mưa): chờ lúc xúc xắc đã nằm yên và không có tiếng sự kiện, đợi tối đa khoảng 2,5 giây
    amb(name, delay, vol, n){ if(!ctx) return; n = n || 0;
      setTimeout(() => { const now = ctx.currentTime; if(n < 12 && (now < diceUntil || now - fgLast < .3 || fgNext > now + .05)) return this.amb(name, .2, vol, n+1); this.play(name, 0, vol); }, (delay || 0)*1000); },
    music(m){ mode = m; if(!has) return; if(m==='off') stopSched(); else { mstep = m==='tense' ? mstep : 0; if(ctx){ if(sched){ clearInterval(sched); sched = null; } startSched(); } } },
    mood(tense){ if(mode==='off') return; const m = tense ? 'tense' : 'calm'; if(m!==mode){ mode = m; if(ctx && !sched) startSched(); } },
    vol(k){ return st[k]; },
    setVol(k, v){ st[k] = Math.max(0, Math.min(1, v)); save(); applyGains(); },
    duck(on){ dk = on ? .25 : 1; applyGains(); },
    msg(t){
      t = String(t||'');
      const R = [[/ra tù/, 'unjail'], [/bị giam ở ô Vào tù|vào tù/, 'jail'], [/phá sản\.?$/, 'bankrupt'], [/bị loại/, 'cut'], [/trả hết/, 'debtpaid'], [/\bvay (ngân hàng|xã hội)/, 'loan'],
        [/qua Xuất phát/, 'gain'], [/gom đủ nhóm/, 'badge'], [/nửa huy hiệu/, 'pop'], [/Sự kiện vòng/, 'event'], [/truy nã/, 'bounty'], [/thắng đấu giá/, 'auction'], [/kéo .* vào Đảo hoang/, ''], [/bị giam ở Đảo hoang/, ''], [/Đảo hoang/, 'island'],
        [/\bnâng .* lên/, 'build'], [/\bmua .* với giá/, 'buy'], [/rao bán/, 'pop']];
      for(const r of R){ if(r[0].test(t)){ if(r[1]) this.play(r[1]); return; } }
    },
    tile(n){ n = String(n||''); const R = [[/Vào tù/, 'jail'], [/Đảo hoang/, 'isle'], [/Quỹ/, 'coinbig'], [/Hộp quà/, 'sparkle'], [/Khởi nghiệp/, 'go'], [/Công viên|Vườn thú/, 'pop']];
      for(const r of R){ if(r[0].test(n)){ this.play(r[1], .15); return; } } },
    stop(name){ try { if(voice[name]) voice[name].stop(); } catch(e) {} voice[name] = null; },
    names: () => Object.keys(SND),
    offline(name){
      const OC = (typeof OfflineAudioContext!=='undefined') ? OfflineAudioContext : null; if(!OC) return Promise.resolve(null);
      const oc = new OC(1, 44100*4, 44100); SND[name](oc, oc.destination, .01);
      return oc.startRendering().then(b => { const d = b.getChannelData(0); let pk = 0, sum = 0, end = 0; for(let i=0;i<d.length;i++){ const a = Math.abs(d[i]); if(a>pk) pk = a; sum += a*a; if(a>.003) end = i; } return {peak:+pk.toFixed(2), rms:+Math.sqrt(sum/d.length).toFixed(3), dur:+(end/44100).toFixed(2)}; });
    }
  };
})();