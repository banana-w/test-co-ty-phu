/* ===== game.js: Core Monopoly Game Engine (luật chơi, bot AI, trading, render bàn cờ, cửa hàng) ===== */
// ===== Hệ thống: âm thanh, micro, hiệu năng, tập trung =====
const SYS = (() => {
  let d = {duck:true, iso:true, perf:false, wake:true, focus:false, lock:false, eco: typeof window!=='undefined' && !!window.matchMedia && matchMedia('(pointer:coarse)').matches};
  try { const r = localStorage.getItem('lendoi_sys'); if(r) d = Object.assign(d, JSON.parse(r)); } catch(e) {}
  const save = () => { try { localStorage.setItem('lendoi_sys', JSON.stringify(d)); } catch(e) {} };
  const api = {
    get: k => d[k],
    set(k, v){ d[k] = v; save(); api.apply(); },
    apply(){
      if(typeof document==='undefined') return;
      d.perf = false; d.focus = false; d.lock = false;
      document.body.classList.toggle('eco', !!d.eco); document.body.classList.toggle('lowfx', !!d.eco);   // Tiết kiệm pin gồm cả chế độ hiệu ứng nhẹ (ngưng chuyển động trang trí trên bàn) let slow = false; try { slow = !!(PERF.fps && PERF.fps < 40); } catch(e) {} document.body.classList.toggle('lite', !!d.eco || slow);
      document.body.classList.toggle('perf', !!d.perf); document.body.classList.toggle('focus', !!d.focus); document.body.classList.toggle('qlock', !!d.lock);
      SFX.focus = !!d.focus;
      const q = document.getElementById('quitBtn'); if(q) q.textContent = d.lock ? '🔒 Giữ để thoát' : 'Thoát';
    }
  };
  return api;
})();
const MIC = {on:false, stream:null, ctx:null, an:null, raf:0};
const MIC_ON = false;   // đã gỡ tính năng nói chuyện bằng mic (chưa có máy chủ chuyển tiếp giọng nói ổn định)
const MICS = {};   // trạng thái mic của từng người trong phòng Chơi với bạn (theo số ghế)
const micOf = id => (NET && id===NET.me) ? micIsOn() : !!MICS[id];
const micIsOn = () => (typeof VOICE!=='undefined' && VOICE.live()) ? VOICE.on() : !!SYS.get('mic');
function micUI(){
  const v = micIsOn();
  const b = document.getElementById('swMic'); if(b){ b.classList.toggle('on', v); b.setAttribute('aria-checked', v); }
  const g = document.getElementById('gameMic'); if(g){ g.firstChild.textContent = v ? '🎙️' : '🔇'; g.classList.toggle('on', v); g.setAttribute('aria-label', v ? 'Tắt mic' : 'Bật mic'); }
  const h = document.getElementById('homeMic'); if(h){ h.textContent = v ? '🎙️' : '🔇'; h.classList.toggle('on', v); h.setAttribute('aria-label', v ? 'Tắt mic' : 'Bật mic'); }
  const st = document.getElementById('micSt'); if(st) st.textContent = v ? (VOICE.live() ? 'Mic đang bật, mọi người trong phòng nghe được bạn' : 'Mic đang bật: vào Chơi với bạn là nói chuyện được ngay') : 'Mic đang tắt';
}
// chưa cấp quyền micro: trong app thì nhảy thẳng sang Cài đặt của iPhone (mục Lên Voi Xuống Chó) để người dùng tự bật
function micDenied(e){
  const n = e && e.name;
  if(n==='NotFoundError'){ window.palToast && palToast('Không tìm thấy micro trên máy'); return; }
  if(IS_APP){ try { localStorage.setItem('lendoi_micwant', '1'); } catch(err) {} window.palToast && palToast('Hãy bật Micro cho Lên Voi Xuống Chó trong Cài đặt'); setTimeout(() => { const M = NMIC(); if(M) M.openSettings().catch(() => {}); else location.href = 'app-settings:'; }, 700);
  } else if(typeof openModal==='function') openModal('🎙️ Trình duyệt đang chặn micro', `<p>Trang web không tự mở được Cài đặt của máy, bạn bật giúp micro cho <b>${esc(location.host || 'trang này')}</b>:</p><ul class="mhelp"><li><b>iPhone, Safari:</b> bấm <b>aA</b> ở thanh địa chỉ → <b>Cài đặt trang web</b> → <b>Micro</b> → <b>Cho phép</b>. Hoặc Cài đặt iPhone → Safari → Micro → Cho phép.</li><li><b>Chrome:</b> bấm biểu tượng bên trái địa chỉ → <b>Quyền</b> → <b>Micro</b> → <b>Cho phép</b>.</li><li><b>Mở từ Messenger, Zalo:</b> mở bằng Safari hoặc Chrome rồi thử lại.</li></ul><p>Xong thì bấm <b>Thử lại</b>.</p>`,
      [{label:'Đóng', fn: closeModal}, {label:'Thử lại', primary:true, fn: () => { closeModal(); micSet(true); }}]);
  else window.palToast && palToast('Trình duyệt đang chặn micro. Hãy cho phép micro cho trang này rồi bật lại.');
}
// quay lại từ Cài đặt (iPhone tự mở lại app khi đổi quyền): đã cho phép micro thì bật mic luôn
async function micBack(){
  if(!MIC_ON) return;
  let want = null; try { want = localStorage.getItem('lendoi_micwant'); } catch(e) {}
  if(!want || micIsOn()) return;
  if((await micPerm())!=='granted') return;
  try { localStorage.removeItem('lendoi_micwant'); } catch(e) {}
  micSet(true);
}
if(typeof document!=='undefined') document.addEventListener('visibilitychange', () => { if(!document.hidden) micBack(); });
async function micAsk(){
  const M = NMIC();
  if(M){ let st = 'prompt'; try { st = (await M.request()).state; } catch(e) {} if(st==='granted') return true; micDenied({name:'NotAllowedError'}); return false; }
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ window.palToast && palToast('Máy này không hỗ trợ mic'); return false; }
  try { if(navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch(e) {}
  try { const m = await navigator.mediaDevices.getUserMedia({audio:true}); m.getTracks().forEach(t => t.stop()); return true; }
  catch(e){ micDenied(e); return false; }
  finally { try { if(navigator.audioSession && !(VOICE.live() && VOICE.on())) navigator.audioSession.type = 'playback'; } catch(e) {} }
}
// bật/tắt mic: ngoài phòng thì ghi nhớ (xin quyền luôn), trong phòng Chơi với bạn thì mở/tắt tiếng nói ngay
async function micSet(v){
  if(VOICE.live()){ if(VOICE.on()!==v) await VOICE.toggle(); }
  else { if(v) v = await micAsk(); SYS.set('mic', v); }
  micUI();
}
const NMIC = () => (IS_APP && window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Mic) || null;
async function micPerm(){ const M = NMIC(); if(M){ try { return (await M.status()).state; } catch(e) {} } try { if(navigator.permissions && navigator.permissions.query){ const r = await navigator.permissions.query({name:'microphone'}); return r.state; } } catch(e) {} return 'unknown'; }
async function micStart(){
  const st = document.getElementById('micSt');
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ if(st) st.textContent = 'Trình duyệt không hỗ trợ micro'; return; }
  try {
    const iso = !!SYS.get('iso');
    try { if(navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch(e) {}
    MIC.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:iso, noiseSuppression:iso, autoGainControl:iso}});
    const AC = window.AudioContext || window.webkitAudioContext; MIC.ctx = new AC();
    const src = MIC.ctx.createMediaStreamSource(MIC.stream); MIC.an = MIC.ctx.createAnalyser(); MIC.an.fftSize = 512; src.connect(MIC.an);
    MIC.on = true; SFX.duck(!!SYS.get('duck')); micUI();
    const buf = new Uint8Array(MIC.an.fftSize);
    const loop = () => { if(!MIC.on) return; MIC.an.getByteTimeDomainData(buf); let m = 0; for(let i=0;i<buf.length;i++) m = Math.max(m, Math.abs(buf[i]-128)); const bar = document.getElementById('micBar'); if(bar) bar.style.width = Math.min(100, Math.round(m/128*170)) + '%'; MIC.raf = requestAnimationFrame(loop); };
    loop();
  } catch(e) {
    const n = e && e.name;
    if(st) st.textContent = n==='NotAllowedError' ? 'Bị chặn: hãy cho phép micro cho trang này' : n==='NotFoundError' ? 'Không tìm thấy micro' : 'Không bật được micro';
  }
}
function micStop(){
  MIC.on = false; cancelAnimationFrame(MIC.raf);
  try { if(MIC.stream) MIC.stream.getTracks().forEach(t => t.stop()); } catch(e) {}
  try { if(MIC.ctx) MIC.ctx.close(); } catch(e) {}
  MIC.stream = MIC.ctx = MIC.an = null; SFX.duck(false); micUI();
  try { if(navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
}
let WL = null;
async function wakeOn(){ try { if(navigator.wakeLock && SYS.get('wake') && !WL){ WL = await navigator.wakeLock.request('screen'); WL.addEventListener('release', () => { WL = null; }); } } catch(e) {} }
function wakeOff(){ try { if(WL){ WL.release(); WL = null; } } catch(e) {} }
/* v131: đang Tạm dừng ván mà không chạm máy 3 phút thì thôi giữ màn sáng (máy tự tắt màn như thường); chạm lại thì giữ tiếp */
if(!HEADLESS){ let lastT = Date.now(), idleOff = false;
  const poke = () => { lastT = Date.now(); if(idleOff){ idleOff = false; const g = document.getElementById('game'); if(g && !g.hidden) wakeOn(); } };
  ['pointerdown','keydown'].forEach(ev => document.addEventListener(ev, poke, true));
  setInterval(() => { if(WL && PAUSED && Date.now() - lastT > 180000){ idleOff = true; wakeOff(); } }, 30000); }
const SOFTKB = !HEADLESS && !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
const REWARD = {coins:[40,30,20,0], exp:[100,80,65,50], rp:[30,10,-10,-20], perLevel:20};
// Phạt ở Xếp hạng: thoát giữa trận (kể cả đóng trang) và treo máy (3 lượt liền để game tự gieo)
const RANK_PEN = {quit:-40, afk:-30, afkTurns:3};
const RKLIVE = 'lendoi_rklive';
const rankLive = on => { try { if(on) localStorage.setItem(RKLIVE, String(Date.now())); else localStorage.removeItem(RKLIVE); } catch(e) {} };
const RULES_DEF = {finale:3, limit:0, rounds:ROUND_LIMIT, deal:0, cash:0, ramp:.15, goalNet:0, goalSets:3, side:true, cut:[], events:true, bounty:true, weekly:'', teams:false};   // thắng ngay: đủ 3 nhóm màu hoặc chiếm trọn đất 1 cạnh bàn
const RULES_RANK = {rounds:20, deal:3, cash:600, ramp:.15, goalNet:3000, goalSets:2, cut:[10,15], events:true, bounty:true, weekly:'', teams:false};
const WEEKLY = {
  air2:{n:'Tuần hàng không', d:'Sân bay thu tiền thuê gấp đôi'},
  go300:{n:'Tuần lương thưởng', d:'Qua Xuất phát nhận 300 thay vì 200'},
  allbid:{n:'Tuần đấu giá', d:'Không mua thẳng, mọi ô đất đều đấu giá kín'},
  nojail:{n:'Tuần ân xá', d:'Ô Vào tù không giam ai'}
};
const weeklyId = () => { const ks = Object.keys(WEEKLY); return ks[Math.floor(Date.now()/(7*864e5)) % ks.length]; };
const TEAMN = ['Hổ và Voi', 'Trâu và Gà'];
function applyRules(mode, teams, weekly){
  S.mode = mode; S.rules = Object.assign({}, mode==='rank' ? RULES_RANK : RULES_DEF); S.ev = {};
  if(mode!=='rank') return;
  S.rules.weekly = weekly || weeklyId();
  if(teams){ S.rules.teams = true; S.rules.cut = []; S.rules.goalNet = 5000; S.rules.goalSets = 0; }
  const pool = shuffle(TILES.map((t,i) => i).filter(i => TILES[i].k==='land'));
  S.players.forEach(p => { p.cash = S.rules.cash; for(let k=0;k<S.rules.deal;k++) S.owner[pool.pop()] = p.id; });
}
const mate = (a, b) => !!(S.rules.teams && a.id!==b.id && a.id%2===b.id%2);
function rentMul(i){
  const R = S.rules, t = TILES[i]; let m = 1 + R.ramp*Math.floor((S.round-1)/5);
  if(S.ev.fest && S.round<=S.ev.fest.until && t.g===S.ev.fest.g) m *= 2;
  if(S.ev.storm && S.round<=S.ev.storm.until && t.g===S.ev.storm.g) m *= .7;   // mưa bão ngập đường, sửa đường
  if(R.weekly==='air2' && t.k==='air') m *= 2;
  if(R.finale && S.round > R.rounds - R.finale) m *= 2;          // các vòng cuối: tiền thuê gấp đôi để còn cơ hội lật thế
  return m;
}
const priceOf = i => Math.round(TILES[i].p*(S.ev.boom && S.round<=S.ev.boom.until ? 1.5 : 1));
function leaderId(){
  if(!S.rules.bounty || S.round<3) return -1;
  const a = alive().slice().sort((x,y) => netWorth(y)-netWorth(x)); return a.length>1 && netWorth(a[0])>netWorth(a[1]) ? a[0].id : -1;
}
const LV_MAX = 30, lvNeed = L => 400 + 420*(L-1),   // kinh nghiệm cần để từ cấp L lên cấp L+1: cấp 1 lên 20 hết khoảng 79.000, tức 3 đến 4 tháng chơi 1 đến 2 tiếng mỗi ngày
  lvOf = exp => { let L = 1; exp = Math.max(0, exp||0); while(L < LV_MAX && exp >= lvNeed(L)){ exp -= lvNeed(L); L++; } return L >= LV_MAX ? {L, cur:lvNeed(LV_MAX-1), need:lvNeed(LV_MAX-1), max:true} : {L, cur:exp, need:lvNeed(L)}; };
const TIERS = [{n:'Đồng',min:0,c:'#DDA574',i:'🥉',rp:[30,15,-5,-10]},{n:'Bạc',min:150,c:'#C9D3DC',i:'🥈',rp:[30,12,-8,-15],safe:1},{n:'Vàng',min:400,c:'#F4C542',i:'🥇',rp:[28,10,-10,-18],safe:1},{n:'Bạch kim',min:800,c:'#9CCDE4',i:'💠',rp:[26,8,-12,-20]},{n:'Kim cương',min:1300,c:'#C4A8EA',i:'💎',rp:[25,6,-14,-24]},{n:'Huyền thoại',min:2000,c:'#FF7A45',i:'👑',rp:[22,5,-15,-25]}];
/* quà lên hạng: nhận 1 lần khi lần đầu chạm hạng */
const TIER_GIFT = [null, {xu:300, gem:3}, {xu:600, gem:8, pl:'rkvang'}, {xu:1000, gem:15, pl:'rkbk'}, {xu:1500, gem:25, pl:'rkkc', chest:1}, {xu:3000, gem:50, pl:'rkht', av:4}];
const TBADGE = (k, big) => { const C = [['#F6C9A0','#C9783D','#8A4A1E'],['#F4F7FA','#AFBCCA','#6E7E92'],['#FFF0A0','#F2B21B','#A86A00'],['#D9F6FF','#4FB7D9','#1F6F90'],['#EEE3FF','#9A72E8','#5530A8'],['#FFE08A','#F0592E','#9A1E12']][k], id = 'tb' + k + (big ? 'b' : '');
  const L = 'stroke="#2B3A67" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"', W = 'fill="#FFFDF6" stroke="#2B3A67" stroke-width="1.8" stroke-linejoin="round"';
  const wings = k>=3 ? `<path d="M7 18Q-1 20 1 30Q4 27 7 28Q3 33 6 38Q9 33 11 33Z" fill="${C[1]}" ${L}/><path d="M41 18Q49 20 47 30Q44 27 41 28Q45 33 42 38Q39 33 37 33Z" fill="${C[1]}" ${L}/>` : '';
  const mid = [`<path d="M17 26l7-6 7 6" fill="none" stroke="#FFFDF6" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M17 22l7-6 7 6M17 30l7-6 7 6" fill="none" stroke="#FFFDF6" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M24 14l3 6.2 6.8.8-5 4.6 1.4 6.7L24 29l-6.2 3.3 1.4-6.7-5-4.6 6.8-.8z" ${W}/>`,
    `<path d="M24 13l3.2 6.6 7.2.9-5.3 4.9 1.4 7.1L24 29l-6.5 3.5 1.4-7.1-5.3-4.9 7.2-.9z" ${W}/><circle cx="24" cy="23.5" r="2.2" fill="${C[1]}"/>`,
    `<path d="M16 19l4-5h8l4 5-8 12z" ${W}/><path d="M16 19h16M20 14l4 17 4-17" fill="none" stroke="#2B3A67" stroke-width="1.3"/>`,
    `<path d="M14 29l-1-12 6 5 5-8 5 8 6-5-1 12z" fill="#FFE27A" stroke="#2B3A67" stroke-width="1.8" stroke-linejoin="round"/><circle cx="24" cy="24" r="1.8" fill="#E0483A"/><circle cx="18" cy="25.5" r="1.3" fill="#4FB7D9"/><circle cx="30" cy="25.5" r="1.3" fill="#4FB7D9"/>`][k];
  return `<svg class="tbadge" viewBox="-2 -2 52 52" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C[0]}"/><stop offset=".55" stop-color="${C[1]}"/><stop offset="1" stop-color="${C[2]}"/></linearGradient></defs>${wings}
    <path d="M24 3L41 9.5V24C41 34.5 33 41.5 24 45.5C15 41.5 7 34.5 7 24V9.5Z" fill="url(#${id})" ${L}/><path d="M24 7.5L37 12.5V24C37 32 31 37.5 24 41C17 37.5 11 32 11 24V12.5Z" fill="${C[2]}" opacity=".35"/>
    <path d="M12 12.5L24 7.5 36 12.5" fill="none" stroke="#FFFDF6" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>${mid}</svg>`; };
const RKCARD = (ch, uid) => { const id = 'rkc' + (ch ? 'c' : 'f') + (uid || ''), A = ch ? ['#FFB25A','#E0483A','#6E1410'] : ['#9CD8FF','#3B6FE0','#141C5A'], G = ch ? '#FF8A2B' : '#5FB8FF';
  const icon = ch ? `<path d="M26 58L44 36M44 58L26 36" stroke="#FFFDF6" stroke-width="4" stroke-linecap="round"/><path d="M24 54l6 6M46 54l-6 6" stroke="#FFD23F" stroke-width="3.6" stroke-linecap="round"/><path d="M26 58L44 36M44 58L26 36" stroke="#2B3A67" stroke-width="1" stroke-linecap="round" opacity=".5"/>`
    : `<path d="M38 30L27 50h8l-3 16 12-21h-8l4-15z" fill="#FFE27A" stroke="#2B3A67" stroke-width="1.6" stroke-linejoin="round"/>`;
  return `<svg class="rkcard" viewBox="0 0 70 100" aria-hidden="true"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E1F5E"/><stop offset="1" stop-color="#0E0C26"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A[0]}"/><stop offset=".55" stop-color="${A[1]}"/><stop offset="1" stop-color="${A[2]}"/></linearGradient><radialGradient id="${id}g"><stop offset="0" stop-color="${G}" stop-opacity=".75"/><stop offset="1" stop-color="${G}" stop-opacity="0"/></radialGradient></defs>
    <rect x="1.5" y="1.5" width="67" height="97" rx="8" fill="url(#${id}b)" stroke="#FFD23F" stroke-width="3"/><rect x="5.5" y="5.5" width="59" height="89" rx="5" fill="none" stroke="#FFD23F" stroke-width="1" opacity=".55"/>
    <g fill="none" stroke="#FFD23F" stroke-width="1.4" opacity=".8"><path d="M9 16q0-7 7-7M61 16q0-7-7-7M9 84q0 7 7 7M61 84q0 7-7 7"/></g>
    <g opacity=".22" stroke="#FFFDF6" stroke-width="1">${[0,1,2,3,4,5,6,7].map(k => `<path d="M35 46L${35 + Math.cos(k*Math.PI/4)*40} ${46 + Math.sin(k*Math.PI/4)*40}"/>`).join('')}</g>
    <circle cx="35" cy="46" r="27" fill="url(#${id}g)"/>
    <path d="M35 18L55 25.5V44C55 56 46 64 35 68.5C24 64 15 56 15 44V25.5Z" fill="url(#${id}s)" stroke="#141C3D" stroke-width="2.4" stroke-linejoin="round"/><path d="M35 23L50 28.5V44C50 53 43.5 59 35 62.5C26.5 59 20 53 20 44V28.5Z" fill="rgba(0,0,0,.18)"/><path d="M20 28.5L35 23 50 28.5" fill="none" stroke="#FFFDF6" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
    ${icon}
    <path d="M8 76h54l-4 6 4 6H8l4-6z" fill="${A[1]}" stroke="#141C3D" stroke-width="1.6" stroke-linejoin="round"/><text x="35" y="85" text-anchor="middle" font-family="Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="8.2" fill="#FFF6C8" stroke="#141C3D" stroke-width=".6" paint-order="stroke" letter-spacing=".5">${ch ? 'CƠ HỘI' : 'KHÍ VẬN'}</text></svg>`; };
const RANK_GAP = 1;   /* ghép trận xếp hạng: chỉ gặp người chênh tối đa 1 hạng */
const tierOf = rp => { let k = 0; TIERS.forEach((t,j) => { if(rp >= t.min) k = j; }); return {k, t:TIERS[k], next:TIERS[k+1] || null}; };
const TROPHY = '<svg viewBox="0 0 48 48" aria-hidden="true" style="display:block;width:100%;height:100%;overflow:visible"><g stroke="#2B3A67" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M14 11H7.5q0 10 8.5 11" fill="none"/><path d="M34 11h6.5q0 10-8.5 11" fill="none"/><path d="M13 6h22v12a11 11 0 0 1-22 0Z" fill="#F4C542"/><rect x="21" y="28" width="6" height="7" fill="#E3A82E"/><rect x="14" y="35" width="20" height="6" rx="2" fill="#F4C542"/></g><path d="M24 10.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6Z" fill="#FFFDF6" stroke="#2B3A67" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const FITS = {
  non:{n:'Nón lá', p:60}, kinh:{n:'Kính râm', p:40}, mu:{n:'Mũ lưỡi trai', p:50}, no:{n:'Nơ đỏ', p:30}, vuong:{n:'Vương miện', p:120},
  len:{n:'Mũ len', p:45}, tainghe:{n:'Tai nghe', p:70}, khan:{n:'Khăn quàng', p:40}, hoa:{n:'Hoa cài tóc', p:35},
  kinhtron:{n:'Kính cận tròn', p:45}, chop:{n:'Mũ ảo thuật', p:110}, ria:{n:'Ria mép', p:30}, sinhnhat:{n:'Mũ sinh nhật', p:55},
  choi:{n:'Chổi phù thủy', p:1500, fly:1},
  noel:{n:'Mũ Noel', p:80, xmas:1}, tuanloc:{n:'Sừng tuần lộc', p:90, xmas:1}, raunoel:{n:'Râu ông già Noel', p:60, xmas:1}
};
const FSLOT = {non:'h', mu:'h', len:'h', vuong:'h', chop:'h', sinhnhat:'h', noel:'h', tuanloc:'h', tainghe:'h', kinh:'f', kinhtron:'f', ria:'m', raunoel:'m', khan:'n', no:'n', hoa:'x', choi:'r'};
const FORD = ['r','n','m','f','h','x'];   /* thứ tự vẽ: chổi, cổ, miệng, mặt, đầu, tóc */
const fitList = v => String(v || '').split('+').filter(k => FITS[k]);
const isXmas = k => fitList(k).some(x => FITS[x].xmas);
const fitWith = (cur, k) => { const L = fitList(cur).filter(x => (FSLOT[x] || x)!==(FSLOT[k] || k)); L.push(k); L.sort((a,b) => FORD.indexOf(FSLOT[a]) - FORD.indexOf(FSLOT[b])); return L.join('+'); };   /* mặc thử: giữ đồ đang mặc ở vị trí khác */
// ===== BẢNG GIÁ (cân theo thu nhập: mỗi ván 0–40 xu, nhiệm vụ ngày ~90 xu, điểm danh ~60 xu, mỗi video 15 xu + 1💎) =====
Object.assign(FITS.no, {p:150}); Object.assign(FITS.ria, {p:150}); Object.assign(FITS.hoa, {p:180}); Object.assign(FITS.khan, {p:200}); Object.assign(FITS.kinh, {p:220});
Object.assign(FITS.len, {p:250}); Object.assign(FITS.kinhtron, {p:250}); Object.assign(FITS.mu, {p:280}); Object.assign(FITS.sinhnhat, {p:300}); Object.assign(FITS.non, {p:350});
Object.assign(FITS.choi, {p:1500}); Object.assign(FITS.tainghe, {p:400}); Object.assign(FITS.chop, {p:600}); Object.assign(FITS.vuong, {p:900});
Object.assign(FITS.raunoel, {p:400}); Object.assign(FITS.noel, {p:500}); Object.assign(FITS.tuanloc, {p:600});
PREM[4].p = 1500; PREM[5].p = 900; PREM[6].p = 900;
Object.keys(ITEMS).forEach(k => { ITEMS[k].p = Math.round(ITEMS[k].p*2.5/5)*5; });
Object.keys(PLATES).forEach(k => { if(!PLATES[k].gem) PLATES[k].p = Math.round(PLATES[k].p*4/10)*10; });
const STORE = (() => {
  let d = {coins:60, bag:{}, fits:{}, fit:'', exp:0, rp:0};
  try { const r = localStorage.getItem('lendoi_store'); if(r) d = Object.assign(d, JSON.parse(r)); } catch(e) {}
  // tên thuandeptrai (có dấu, viết hoa, có cách đều được): xu và kim cương luôn đầy để mua đồ, mỗi lần mở game hoặc đặt tên lại nạp đầy
  const VIP_XU = 999999, VIP_GEM = 99999;
  const vip = () => String(d.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/\s+/g, '').toLowerCase()==='thuandeptrai';
  const fill = () => { if(!vip()) return false; d.coins = Math.max(d.coins || 0, VIP_XU); d.gems = Math.max(d.gems || 0, VIP_GEM); return true; };
  fill();
  const save = () => { d.ts = Date.now(); try { localStorage.setItem('lendoi_store', JSON.stringify(d)); } catch(e) {} try { window.__stSaved && window.__stSaved(); } catch(e) {} };
  return { dump: () => d, load(o){ d = Object.assign({coins:60, bag:{}, fits:{}, fit:'', exp:0, rp:0}, o); try { localStorage.setItem('lendoi_store', JSON.stringify(d)); } catch(e) {} }, get coins(){ return d.coins; }, add(n){ d.coins = Math.max(0, d.coins + n); save(); }, get gems(){ return d.gems || 0; }, addGem(n){ d.gems = Math.max(0, (d.gems||0) + n); save(); }, has: k => d.bag[k] || 0, give(k, n){ d.bag[k] = Math.max(0, (d.bag[k]||0) + n); save(); },
    get exp(){ return d.exp || 0; }, addExp(n){ d.exp = (d.exp||0) + n; save(); }, get rp(){ return d.rp || 0; }, addRp(n){ d.rp = Math.max(0, (d.rp||0) + n); save(); },
    get fit(){ return d.fit || ''; }, ownsFit: k => !!(d.fits && d.fits[k]), buyFit(k){ d.fits = d.fits || {}; d.fits[k] = 1; save(); }, wear(k){ if(!k){ d.fit = ''; save(); return; } let L = fitList(d.fit); if(L.includes(k)) L = L.filter(x => x!==k); else { L = L.filter(x => (FSLOT[x] || x)!==(FSLOT[k] || k)); L.push(k); } L.sort((a,b) => FORD.indexOf(FSLOT[a]) - FORD.indexOf(FSLOT[b])); d.fit = L.join('+'); save(); }, put(k){ if(!fitList(d.fit).includes(k)) this.wear(k); }, wearing: k => fitList(d.fit).includes(k),
    get plate(){ return d.plate || ''; }, ownsPlate: k => !!(d.plates && d.plates[k]), buyPlate(k){ d.plates = d.plates || {}; d.plates[k] = 1; save(); }, setPlate(k){ d.plate = k; save(); },
    ownsAv: k => k<4 || !!(d.avs && d.avs[k]), buyAv(k){ d.avs = d.avs || {}; d.avs[k] = 1; save(); },
    get name(){ return d.name || ''; }, setName(v){ d.name = String(v||'').slice(0,14); const f = fill(); save(); if(f) try { window.paintCoins && window.paintCoins(); } catch(e) {} },
    // túi mang vào ván: tối đa PACK_MAX món. Chưa chọn thì lấy món đang có trước, rồi tới các món còn lại theo thứ tự
    get pack(){ const all = Object.keys(ITEMS); let a = Array.isArray(d.pack) ? d.pack.filter(k => ITEMS[k]) : null;
      if(!a) a = all.filter(k => d.bag[k] > 0).concat(all.filter(k => !(d.bag[k] > 0))).slice(0, PACK_MAX);
      return a.slice(0, PACK_MAX); },
    setPack(a){ d.pack = a.filter(k => ITEMS[k]).slice(0, PACK_MAX); save(); },
    get loa(){ return d.loa==null ? 3 : d.loa; }, addLoa(n){ d.loa = Math.max(0, (d.loa==null ? 3 : d.loa) + n); save(); },   // loa để nói trên kênh Thế giới, tặng sẵn 3 cái
    shopCount(sec, slot, key){ const b = d.shop && d.shop[sec]; return (b && b.slot===slot && b.n[key]) || 0; },
    shopMark(sec, slot, key){ d.shop = d.shop || {}; if(!d.shop[sec] || d.shop[sec].slot!==slot) d.shop[sec] = {slot, n:{}}; d.shop[sec].n[key] = (d.shop[sec].n[key]||0) + 1; save(); } };
})();
const N = TILES.length, JAIL = 33, ISLAND = 18, MULT = [1,3,7,14],   /* tiền thuê theo cấp nhà; trước 1/4/10/20, mô phỏng thấy cứ 5 lần trả thuê có 1 lần mất sạch tiền */ LV = ['Chưa xây','Cấp 1','Cấp 2','Cao ốc'];
const DECIDE = 17, BID_SECS = 17;
const START_CASH = 400, GO_CASH = 200, FUND_ADD = 10,   /* v137: mỗi lần có người qua Xuất phát Quỹ thêm 10 (trước 5), bù một phần thuế đất đã bỏ */ LIMIT_MS = 60*60*1000;
// Ván nhanh: mỗi người khởi đầu với 2 ô cùng một nhóm 3 ô (đã có nửa huy hiệu, còn thiếu 1 ô để săn)
function dealPairs(){
  const gs = {}; TILES.forEach((t,i) => { if(t.k==='land') (gs[t.g] = gs[t.g] || []).push(i); });
  const three = shuffle(Object.keys(gs).filter(k => gs[k].length===3));
  S.players.forEach((p,k) => { if(!three[k]) return; const idx = shuffle(gs[three[k]].slice()); S.owner[idx[0]] = p.id; S.owner[idx[1]] = p.id; });
  log('Ván nhanh: mỗi người có sẵn 2 ô đất cùng nhóm. Cứ 5 vòng tiền thuê tăng thêm 25%.');
}
const limitMs = () => (S && S.rules && S.rules.limit) || LIMIT_MS;
/* v139: độ khó Chơi với máy: 1 Dễ, 2 Trung bình, 3 Cao thủ. Chưa chọn thì theo cấp người chơi (dưới cấp 3: Dễ, dưới cấp 6: Trung bình, còn lại Cao thủ) */
const DIFF_N = ['', 'Dễ', 'Trung bình', 'Cao thủ'];
const gameDiff = () => { try { const v = +localStorage.getItem('lendoi_diff'); if(v>=1 && v<=3) return v; } catch(e) {} try { const L = lvOf(STORE.exp).L; return L>=6 ? 3 : L>=3 ? 2 : 1; } catch(e) { return 1; } };
const gameLen = () => { try { return localStorage.getItem('lendoi_len')==='q' ? 'q' : 'l'; } catch(e) { return 'l'; } };
let S = null, waitResolve = null, askOpen = false, logs = [], chat = [];
const bubbles = new Map();
const EMOJI = ['😀','😂','😭','😡','👍','🎉','💰','🙏'];
let SPEED = HEADLESS ? 0 : 1;
// thoát ván: QUIT bật thì mọi chờ đợi (nghỉ, hỏi, đếm ngược) xong ngay; QUITR là các hộp thoại đang mở, gọi để đóng với lựa chọn mặc định
let QUIT = false; const QUITR = new Set(); const onQuit = fn => { QUITR.add(fn); return () => QUITR.delete(fn); };

const rnd = n => Math.floor(Math.random()*n);
const r5 = x => Math.round(x/5)*5;
let PAUSED = false;
const waitPause = async () => { while(PAUSED && !QUIT) await new Promise(r => setTimeout(r, 200)); };
/* v134: nhịp game Chậm / Vừa / Nhanh. Người mới (dưới cấp 5) mặc định Chậm, sau đó Vừa; ai đã tự chọn thì giữ lựa chọn.
   PACE_K nhân mọi khoảng chờ của ván chơi với máy; NOTE_K nhân thời gian hiện thông báo (cả ván online, vì thông báo chỉ hiện trên máy mình). */
const PACE_K = {slow:1.6, mid:1.25, fast:1}, NOTE_K = {slow:1.25, mid:1.1, fast:1}, PACE_N = {slow:'Chậm', mid:'Vừa', fast:'Nhanh'};
const paceKey = () => { const v = SYS.get('pace'); if(v && PACE_K[v]) return v; try { return lvOf(STORE.exp).L < 5 ? 'slow' : 'mid'; } catch(e) { return 'mid'; } };
const paceK = () => (HEADLESS || NET) ? 1 : PACE_K[paceKey()];
const noteK = () => HEADLESS ? 1 : NOTE_K[paceKey()];
let FF = false; try { FF = localStorage.getItem('lendoi_ff')==='1'; } catch(e) {}   // tua nhanh: lượt của máy chạy nhanh gấp 3
const ffNow = () => FF && S && !S.over && S.players[S.cur] && S.players[S.cur].bot;
const sleep = ms => ((SPEED===0 || QUIT) ? Promise.resolve() : new Promise(r => setTimeout(r, ffNow() ? ms/3 : ms*paceK())).then(waitPause));
const sleepRaw = ms => ((SPEED===0 || QUIT) ? Promise.resolve() : new Promise(r => setTimeout(r, ffNow() ? ms/3 : ms)).then(waitPause));   // bước đi của quân: không đổi theo nhịp game (khớp thời gian trượt trong CSS)
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };
const alive = () => S.players.filter(p => p.alive);
const owned = p => TILES.map((t,i)=>i).filter(i => S.owner[i]===p.id);
const groupIdx = g => TILES.map((t,i)=>i).filter(i => TILES[i].k==='land' && TILES[i].g===g);
// 4 cạnh bàn nằm giữa các góc 0, 11, 22, 33. Chiếm trọn mọi ô đất của 1 cạnh là thắng ngay
const SIDES = [[1,10],[12,21],[23,32],[34,43]].map(([a,b]) => TILES.map((t,i)=>i).filter(i => i>=a && i<=b && TILES[i].k==='land'));
const sideOwned = p => p.alive && SIDES.some(sd => sd.length && sd.every(i => S.owner[i]===p.id));
const ownsGroup = (pid,g) => groupIdx(g).every(i => S.owner[i]===pid);
const lvPaid = lv => lv, nextLv = lv => Math.min(3, lv+1), prevLv = lv => Math.max(0, lv-1), lvAfter = (lv,k) => { for(let j=0;j<k;j++) lv = nextLv(lv); return lv; };
const assetValue = p => owned(p).reduce((s,i)=> s + TILES[i].p + lvPaid(S.level[i])*(TILES[i].b||0), 0);
const debt = p => p.loans.reduce((a,L) => a + L.principal, 0);
const netWorth = p => p.cash + assetValue(p) + (p.startup||0) - debt(p);   // công ty khởi nghiệp cũng tính vào tài sản
const tileValue = i => TILES[i].p + lvPaid(S.level[i])*(TILES[i].b||0);
const isColl = i => { const o = S.owner[i]; return o>=0 && S.players[o].loans.some(L => L.type==='bank' && L.tiles.includes(i)); };
const BANK_RATE = 15, SOCIAL_RATE = 25, LTV = .4, DEBT_CAP = .7, FORECLOSE = .6;   // lãi %/vòng; ngân hàng cho vay 40% giá trị nhà; tổng nợ tối đa 70% tài sản
const loanRate = L => L.type==='bank' ? BANK_RATE : SOCIAL_RATE;
const loanInt = L => Math.max(1, Math.round(L.principal*loanRate(L)/100));
const SOCIAL_MAX = Infinity;   // vay xã hội không giới hạn; bù lại lãi cao và bị đòi gắt nếu 2 vòng không trả
const held = p => p.jail>0 || p.island>0;

const FULL_X = 1.5;   // đủ màu một nhóm: tiền thuê các ô trong nhóm x1,5
const PV = {nau:100, cam:.4, do:.3, vang:.5, xn:50};   // xn: Đất lành qua Xuất phát nhận thêm 50 (nửa bộ 25)
const PERK = {
  nau:{i:'🌾',n:'Phù sa',d:'Qua Xuất phát nhận thêm 100'},
  xn:{i:'🌿',n:'Đất lành',d:'Qua Xuất phát nhận thêm 50, miễn thẻ phạt 5% tài sản, thuế phạt khác giảm 10%',h:'Qua Xuất phát nhận thêm 25, giảm nửa thẻ phạt 5% tài sản, thuế phạt khác giảm 5%'},
  hong:{i:'⛰️',n:'Đường đèo',d:'Ra tù và rời Đảo hoang không mất tiền',h:'Ra tù và rời Đảo hoang chỉ mất một nửa tiền'},
  cam:{i:'🤝',n:'Khách quen',d:'Tiền thuê phải trả cho người khác giảm 40%',h:'Tiền thuê phải trả cho người khác giảm 20%'},
  do:{i:'🏖️',n:'Mùa du lịch',d:'Tiền thuê thu được ở mọi ô đất tăng 30%',h:'Tiền thuê thu được ở mọi ô đất tăng 15%'},
  vang:{i:'🏗️',n:'Thầu xây dựng',d:'Chi phí cất nhà giảm 50%',h:'Chi phí cất nhà giảm 25%'},
  xl:{i:'💼',n:'Trung tâm tài chính',d:'Miễn mọi khoản thuế: ô Thuế thu nhập, thẻ Thuế tăng đột xuất, Khai man thuế, Thanh tra thuế',h:'Mọi khoản thuế giảm một nửa'},   // v148: đủ 3 ô xanh lá miễn mọi khoản thuế
  xd:{i:'👑',n:'Đất vàng',d:'Về nhà được nâng 2 cấp một lần. Nợ được khất thêm 1 vòng trước khi bị đòi gắt hoặc siết nợ',h:'Nợ được khất thêm 1 vòng trước khi bị đòi gắt hoặc siết nợ'}
};
// mức lợi ích: 1 = đủ màu, 0.5 = có 2 trên 3 ô của nhóm 3 ô (Đất vàng: 1 trên 2 ô), 0 = chưa có
const pk = (p, g) => { if(!p.alive) return 0; const idx = groupIdx(g), c = idx.filter(i => S.owner[i]===p.id || (S.rules.teams && S.owner[i]>=0 && S.owner[i]%2===p.id%2 && S.players[S.owner[i]].alive)).length; return c===idx.length ? 1 : ((idx.length===3 && c===2) || (g==='xd' && c===1) ? .5 : 0); };
const perk = (p, g) => pk(p, g)===1;
const perksOf = p => Object.keys(PERK).filter(g => pk(p, g)>0);
const perkText = (p, g) => pk(p, g)===1 ? PERK[g].d : PERK[g].h;
const hongFee = (p, base) => Math.round(base*(1-pk(p,'hong')));
const buildCost = (p, i) => Math.round(TILES[i].b*(1-PV.vang*pk(p,'vang')));
// Khoảnh khắc lớn: dải chữ chạy ngang màn hình kèm pháo giấy, khoảng 1,6 giây, không chặn ván
const BIGQ = []; let bigBusy = false;
function bigMoment(text, color, icon, mute){
  if(HEADLESS) return; BIGQ.push([text, color, icon, mute]); if(bigBusy) return;
  const next = () => {
    const it = BIGQ.shift(); if(!it){ bigBusy = false; return; } bigBusy = true;
    const ov = document.createElement('div'); ov.className = 'bigm'; ov.style.setProperty('--c', it[1] || '#F2A65A');
    let cf = ''; if(!calm()) for(let k=0;k<26;k++) cf += `<i style="left:${Math.round(Math.random()*100)}%;--d:${(Math.random()*.5).toFixed(2)}s;--x:${Math.round(Math.random()*120-60)}px;--r:${Math.round(Math.random()*720-360)}deg;background:${['#FFD23F','#FF5E94','#29D3E8','#86BC82','#FFFDF6'][k%5]}"></i>`;
    ov.innerHTML = `<div class="bigb"><em>${it[2] || '🎉'}</em><b>${esc(it[0])}</b><em>${it[2] || '🎉'}</em></div><div class="bigc">${cf}</div>`;
    document.body.appendChild(ov); if(!it[3]) SFX.play('win', 0, .8);
    setTimeout(() => { ov.remove(); next(); }, Math.round(1750*noteK()));
  };
  next();
}
function checkCombo(p, i){
  if(TILES[i].k==='co'){ if(!utilKing(p) && utilOwned(p).length===1) log(`${p.name} có công ty ${TILES[i].n.indexOf('Điện')>=0 ? 'Điện' : 'Nước'}: ${CUT_CD} vòng 1 lần được cắt ${TILES[i].n.indexOf('Điện')>=0 ? 'điện' : 'nước'} 1 ô đất của người khác, ô đó giảm 50% tiền thuê. Có thêm công ty còn lại thì cắt mất trắng.`);
    if(utilKing(p)){ log(`${p.name} có cả Điện và Nước, thành ⚡ Trùm điện nước: ${CUT_CD} vòng 1 lần cắt điện nước một ô đất của người khác, ô đó không thu được tiền thuê.`); bigMoment(`${p.name}: Trùm điện nước!`, '#F4C542', '⚡'); if(!HEADLESS && !calm()) showBubble(p, '⚡', true); } return; }
  if(TILES[i].k==='air'){ if(airKing(p)){ quest(p, 'airking', 1); log(`${p.name} gom đủ 4 sân bay, thành ✈️ Ông trùm hàng không: dừng ở sân bay của mình là được bay tới ô bất kỳ, không giới hạn.`); bigMoment(`${p.name}: Ông trùm hàng không!`, '#5FA8D3', '✈️'); if(!HEADLESS && !calm()) showBubble(p, '✈️', true); } return; }
  const g = TILES[i].g; if(TILES[i].k!=='land') return;
  const lv = pk(p, g); if(!lv) return;
  if(lv===1){ quest(p, 'set', 1, g); bigMoment(`${p.name} gom đủ nhóm ${GN[g]}!`, G[g], PERK[g].i); }
  log(lv===1 ? `${p.name} gom đủ nhóm ${GN[g]}, nhận huy hiệu ${PERK[g].i} ${PERK[g].n}: ${PERK[g].d}.`
             : `${p.name} có ${groupIdx(g).length===2 ? '1 trên 2' : '2 trên 3'} ô nhóm ${GN[g]}, nhận nửa huy hiệu ${PERK[g].i} ${PERK[g].n}: ${PERK[g].h}.`);
  if(!HEADLESS && !calm()) showBubble(p, PERK[g].i, true);
}
function log(msg){ logs.unshift(msg); if(logs.length>80) logs.pop(); chat.push({sys:true, text:msg, q:++chatSeq}); if(chat.length>160) chat.shift(); if(!HEADLESS){ renderChat(); showAct(msg); } }
function showAct(msg){
  SFX.msg(msg);
  return;   // đã bỏ bong bóng chữ ở góc từng nhân vật; nhật ký vẫn có trong khung chat
  const stage = document.getElementById('stage'); if(!stage || !S) return;
  let p = S.players.slice().sort((a,b) => b.name.length - a.name.length).find(q => msg.startsWith(q.name + ' ')), text = msg;
  if(p) text = msg.slice(p.name.length + 1); else p = S.players[S.cur];
  let el = document.getElementById('act' + p.id);
  if(!el){ el = document.createElement('div'); el.id = 'act' + p.id; stage.appendChild(el); }
  el.className = 'act q' + seatPos(p.id) + (el.classList.contains('on') ? ' on' : '');
  el.style.setProperty('--c', p.color);
  el.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
// tin nhắn của người thật khác: nút Chat nhấp nháy + đếm, popup nhỏ phía trên
function chatPing(p, text, emoji){
  if(HEADLESS || !p || emoji) return; const sh = document.getElementById('sheetC'), btn = document.getElementById('chatBtn'); if(!btn) return;
  if(sh && !sh.hidden) return;
  const n = (+btn.dataset.unread || 0) + 1; btn.dataset.unread = n; btn.classList.add('unread');
  let b = btn.querySelector('.cbn'); if(!b){ b = document.createElement('i'); b.className = 'cbn'; btn.appendChild(b); } b.textContent = n > 9 ? '9+' : n;
  document.querySelectorAll('.chatPop').forEach(e => e.remove());
  const t = document.createElement('button'); t.type = 'button'; t.className = 'chatPop'; t.style.setProperty('--c', p.color || '#5FA8D3');
  t.innerHTML = `<span class="cpa">${AV(p.id)}</span><span class="cpt"><b>${esc(p.name)}</b><small>${esc(String(text).slice(0, 80))}</small></span><i>💬</i>`;
  t.onclick = () => { t.remove(); btn.click(); }; document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3800); setTimeout(() => t.remove(), 4300);
}
function chatSeen(){ const btn = document.getElementById('chatBtn'); if(!btn) return; btn.dataset.unread = 0; btn.classList.remove('unread'); const b = btn.querySelector('.cbn'); if(b) b.remove(); }
function say(p, text, emoji){
  if(p && p.bot && !emoji && typeof text==='string' && !HEADLESS) text = botStyleText(p.name, text);
  if(!HEADLESS && S && !S.over && !NET && !p.bot && !emoji){ const bots = alive().filter(q => q.bot); if(bots.length && Math.random()<.85){ const tl = String(text).toLowerCase(), named = bots.find(q => q.name && q.name.length >= 3 && tl.includes(q.name.toLowerCase())), bq = named || bots[rnd(bots.length)]; setTimeout(() => { if(S && !S.over && bq.alive){ bq.talkAt = null; const r = window.__smartReply ? window.__smartReply(text, 'game') : null; if(r){ say(bq, r.text.replace('{me}', p.name), false); if(r.follow) setTimeout(() => { if(S && !S.over && bq.alive) say(bq, r.follow, false); }, 2500 + Math.random()*2000); } else botTalk(bq, 'reply', true);
      const b2 = bots.filter(q => q!==bq && q.alive); if(b2.length && !named && Math.random() < .3) setTimeout(() => { if(S && !S.over){ const r2 = window.__smartReply(text, 'game'); say(b2[rnd(b2.length)], r2.text, false); } }, 2600 + Math.random()*2000); } }, 1300 + Math.random()*1500); } }
  if(HEADLESS || !S) return;
  chat.push({pid:p.id, text, emoji:!!emoji, q:++chatSeq}); if(chat.length>160) chat.shift(); renderChat(); netSync();
  if(S && p.id!==S.viewer) SFX.play('chat');
  showBubble(p, text, emoji);
  if(S && p.id!==S.viewer && !p.bot) chatPing(p, text, emoji);
}
function react(p, emoji, chance){ if(!HEADLESS && p.bot && p.alive && Math.random()<chance) say(p, emoji, true); }

function baseRent(i, lv){
  const t = TILES[i], base = Math.round(t.p*0.15);   /* bản local: 15% giá đất (trước 30%) */
  return lv ? r5(base*MULT[lv]) : base;
}
function rentOf(i, dice){
  const t = TILES[i], o = S.owner[i], op = S.players[o];
  let r = 0;
  const cp = cutPct(i); if(cp>=100) return 0;                // ô bị cắt cả điện lẫn nước: không thu được tiền thuê
  if(t.k==='land'){ r = baseRent(i,S.level[i]); if(ownsGroup(o, t.g)) r *= FULL_X; r = Math.round(r*(1+PV.do*pk(op,'do'))); }
  else if(t.k==='air'){ const c = TILES.filter((x,j)=>x.k==='air' && S.owner[j]===o).length; r = AIR_RENT[c-1]; }
  else if(t.k==='co'){ const c = TILES.filter((x,j)=>x.k==='co' && S.owner[j]===o).length; r = dice*(c===2?UTIL_X[1]:UTIL_X[0]); }
  r = Math.round(r*rentMul(i));
  if(cp) r = Math.ceil(r*(100-cp)/100);                         // bị cắt điện hoặc nước: giảm 50%
  if(held(op)) r = Math.ceil(r/2);
  if(isColl(i)) r = Math.ceil(r/2);
  return r;
}

function liquidate(p){
  while(p.cash<0){
    const built = owned(p).filter(i=>S.level[i]>0 && !isColl(i)).sort((a,b)=>S.level[b]-S.level[a]);
    if(!built.length) break;
    const i = built[0]; S.level[i] = prevLv(S.level[i]); p.cash += TILES[i].b/2;
    log(`${p.name} bán 1 cấp nhà ở ${TILES[i].n}, thu ${TILES[i].b/2}.`);
  }
  while(p.cash<0){
    const mine = owned(p).filter(i=>!isColl(i)).sort((a,b)=>TILES[a].p-TILES[b].p);
    if(!mine.length) break;
    const i = mine[0]; S.owner[i] = -1; p.cash += TILES[i].p/2;
    log(`${p.name} bán ${TILES[i].n} cho ngân hàng, thu ${TILES[i].p/2}.`);
  }
}
function bankrupt(p){
  p.alive = false; p.outAt = S.turns; p.jail = 0; p.island = 0; p.loans = []; p.startup = 0;
  owned(p).forEach(i => { S.owner[i] = -1; S.level[i] = 0; });
  log(`${p.name} phá sản.`); bigMoment(`${p.name} phá sản!`, '#8792A8', '💥');
  checkOver();
}
const calm = () => !!((window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('perf'));
const TF = (x,y,s) => `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`;
function stageRect(){ return document.getElementById('stage').getBoundingClientRect(); }
let ROTC = false;
const portraitNow = () => { const o = screen.orientation && screen.orientation.type; return !!window.matchMedia && matchMedia('(pointer:coarse)').matches && (o ? o.indexOf('portrait')===0 : matchMedia('(orientation:portrait)').matches); };
const isRot = () => { if(IS_APP) return false; const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA)$/.test(a.tagName);
  if(!typing){ ROTC = portraitNow(); document.body.classList.toggle('rotp', ROTC); } return ROTC && document.body.classList.contains('ingame'); };
if(!HEADLESS){ const rs = () => isRot(); addEventListener('resize', rs); if(screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', rs); rs(); }
function toLocal(vx, vy){ const s = stageRect(); return isRot() ? [vy - s.top, s.right - vx] : [vx - s.left, vy - s.top]; }
const PTC = {}, CAM = {z:1, busy:0}, CORNER3D = {};
const camIdle = () => CAM.z===1 && Date.now() > CAM.busy;
function ptOf(i){
  if(PTC[i]) return PTC[i];
  const e = document.querySelector(`#board .cell[data-i="${i}"]`); if(!e) return null;
  const q = e.getBoundingClientRect(), pt = toLocal(q.left + q.width/2, q.top + q.height/2);
  if(q.width>0 && camIdle()) PTC[i] = pt;
  return pt;
}
function warmPts(){ if(!camIdle()) return; for(let i=0;i<N;i++) ptOf(i); }
function camTo(p){
  const cam = document.getElementById('cam'), st = document.getElementById('stage'); if(!cam || !st || calm() || p.bot || p.id!==S.viewer) return;
  const c = PTC[p.pos]; if(!c) return;
  const z = 1.3, W = st.clientWidth, H = st.clientHeight;
  const tx = Math.max(W - W*z, Math.min(0, W/2 - c[0]*z)), ty = Math.max(H - H*z, Math.min(0, H/2 - c[1]*z));
  CAM.z = z; cam.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${z})`;
}
function camReset(){ const cam = document.getElementById('cam'); if(!cam || CAM.z===1) return; CAM.z = 1; CAM.busy = Date.now() + 420; cam.style.transform = ''; setTimeout(() => { if(CAM.z===1){ const st = document.getElementById('stage'); if(st) st.classList.remove('zooming'); } }, 560); }
const HOUSE_K = [0, 0];   // nhà đứng ngay tâm dải đất phía sau ô (0), số dương là lùi vào trong ô
// Tên ô đất tự co chữ cho vừa khoảng trống giữa ô giá và mép ngoài, không lấn sang ô giá
const FIT_SKIP = new Set(['mv','picking','gkon','zooming']);   // lớp tạm thời, không đổi cỡ chữ tên ô
function fitNames(){
  if(HEADLESS || !S) return;
  const fr = (document.fonts && document.fonts.status) || '', bcls = [...document.body.classList].filter(x => !FIT_SKIP.has(x)).join('.');
  document.querySelectorAll('#board .cell[class*="g-"]').forEach(c => {
    const w = c.querySelector('.nmw'), n = c.querySelector('.nm'); if(!w || !n) return;
    const key = LAY.S + '|' + (c.classList.contains('own') ? 1 : 0) + '|' + fr + '|' + bcls; if(c.dataset.fk === key) return; c.dataset.fk = key;
    n.style.fontSize = ''; let fs = Math.min(parseFloat(getComputedStyle(n).fontSize) || 10, (parseFloat(getComputedStyle(c).fontSize) || 10.6) * .9) * tsxNameK(c), g = 0; n.style.fontSize = fs.toFixed(2) + 'px';
    if(w.clientWidth <= 0 || w.clientHeight <= 0){ delete c.dataset.fk; return; }
    const fitVert = getComputedStyle(n).writingMode.indexOf('vertical')===0, over = () => fitVert ? (n.scrollHeight > w.clientHeight - 2 || n.offsetWidth > w.clientWidth) : (n.scrollWidth > w.clientWidth - 2 || n.offsetHeight > w.clientHeight);
    while(TSX_FIT && over() && fs > 6 && g++ < 60){ fs -= .3; n.style.fontSize = fs.toFixed(2) + 'px'; }
  });
}
function tokenPt(p){
  const c = ptOf(p.pos); if(!c) return null;
  const here = S.players.filter(q => q.alive && q.pos===p.pos), k = here.indexOf(p), n = here.length, step = LAY.tk*.52;
  return [c[0] + (k - (n-1)/2)*step, c[1] + (n>2 ? ((k%2) ? 3 : -3) : 0)];
}
function fxCtx(){
  const board = document.getElementById('board'), layer = document.getElementById('fx'); if(!board || !layer || !layer.animate) return null;
  return {board, layer, centre: ptOf};
}
const tileColor = i => { const t = TILES[i]; return t.k==='land' ? G[t.g] : t.k==='air' ? '#C9D6E2' : '#FFD766'; };
function fxLight(i, big, col){
  if(HEADLESS || !big) return;
  S.landed = {i, at: Date.now()}; renderBoard(); fxSign(i);
}
function fxSign(i){
  if(HEADLESS) return;
  const c = ptOf(i), L = document.getElementById('fx'); if(!c || !L) return;
  const t = TILES[i], o = S.owner[i], prop = t.k==='land' || t.k==='air' || t.k==='co';
  const sub = !prop ? '' : o>=0 ? `của ${esc(S.players[o].name)}${t.k==='co' ? '' : ', thuê ' + rentOf(i,0)}` : `giá ${t.p}`;
  L.querySelectorAll('.sign').forEach(e => e.remove());
  const e = document.createElement('div'); e.className = 'sign'; e.style.cssText = `left:${c[0]}px;top:${c[1]}px`;
  e.innerHTML = `<b>${t.n}</b>${sub ? '<small>' + sub + '</small>' : ''}`; L.appendChild(e); setTimeout(() => e.remove(), 2500);
}
function setRing(pid, secs){ if(HEADLESS || !S) return; S.ring = {pid, start: Date.now(), dur: secs*1000}; renderPlayers(); renderOver(); }
function clearRing(){ if(HEADLESS || !S || !S.ring) return; S.ring = null; renderPlayers(); renderOver(); }
function ringSVG(p){
  const r = S.ring; if(!r || r.pid!==p.id) return ''; const el = Date.now() - r.start; if(el >= r.dur) return '';
  return `<svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="rt" cx="20" cy="20" r="18"/><circle class="rr" cx="20" cy="20" r="18" style="animation-duration:${r.dur}ms;animation-delay:${-el}ms"/></svg>`;
}
function fxNum(p, text, cls){
  const layer = document.getElementById('fx'), c = tokenPt(p); if(!layer || !c) return;
  const num = document.createElement('div');
  num.className = 'fxnum ' + cls; num.textContent = text; num.style.left = c[0] + 'px'; num.style.top = c[1] + 'px';
  layer.appendChild(num); setTimeout(() => num.remove(), 1500);
}
function coin(layer, frames, dur, delay){
  const w = document.createElement('div'); w.className = 'coinw';
  const el = document.createElement('div'); el.className = 'coin'; el.textContent = '₫'; w.appendChild(el); layer.appendChild(w);
  const a = w.animate(frames, {duration:dur, delay, fill:'both'});
  const rx = Math.random()*360, ry = Math.random()*360, rz = Math.random()*360, d = Math.random()<.5 ? -1 : 1;
  el.animate([
    {transform:`perspective(260px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`},
    {transform:`perspective(260px) rotateX(${rx+d*(540+Math.random()*540)}deg) rotateY(${ry+(360+Math.random()*540)}deg) rotateZ(${rz+d*120}deg)`}
  ], {duration:dur, delay, fill:'both', easing:'linear'});
  a.finished.then(() => w.remove()).catch(() => w.remove());
}
function coinRain(c, to, amt){
  const n = Math.max(6, Math.min(30, Math.round(amt/10)));
  for(let k=0;k<n;k++){
    const sc = .65 + Math.random()*.7, x0 = to[0] + (Math.random()-.5)*110, x1 = to[0] + (Math.random()-.5)*26, y0 = -40 - Math.random()*120, y1 = to[1];
    coin(c.layer, [
      {transform:TF(x0,y0,sc), opacity:0, offset:0, easing:'cubic-bezier(.45,0,.95,.6)'},
      {transform:TF(x0+(x1-x0)*.25,y0+(y1-y0)*.12,sc), opacity:1, offset:.12, easing:'cubic-bezier(.45,0,.95,.6)'},
      {transform:TF(x1,y1,sc), opacity:1, offset:.78, easing:'cubic-bezier(.1,.6,.4,1)'},
      {transform:TF(x1+(x1-x0)*.12,y1-16*sc,sc), opacity:1, offset:.89, easing:'cubic-bezier(.5,0,.9,.5)'},
      {transform:TF(x1+(x1-x0)*.18,y1,sc*.7), opacity:0, offset:1}
    ], 950 + Math.random()*450, k*45 + Math.random()*60);
  }
}
function coinStream(c, from, to, amt){
  const n = Math.max(5, Math.min(22, Math.round(amt/12)));
  for(let k=0;k<n;k++){
    const sc = .6 + Math.random()*.55, jx = (Math.random()-.5)*26, jy = (Math.random()-.5)*26;
    const mx = (from[0]+to[0])/2 + (Math.random()-.5)*60, my = (from[1]+to[1])/2 - (50 + Math.random()*80);
    coin(c.layer, [
      {transform:TF(from[0]+jx,from[1]+jy,sc*.4), opacity:0, offset:0, easing:'ease-out'},
      {transform:TF(from[0]+jx,from[1]+jy-14,sc), opacity:1, offset:.14, easing:'cubic-bezier(.3,.2,.5,1)'},
      {transform:TF(mx,my,sc*1.1), opacity:1, offset:.55, easing:'cubic-bezier(.5,0,.8,.6)'},
      {transform:TF(to[0],to[1],sc*.6), opacity:.9, offset:.96},
      {transform:TF(to[0],to[1],sc*.3), opacity:0, offset:1}
    ], 900 + Math.random()*350, k*60 + Math.random()*40);
  }
}
function coinBurst(c, from, amt){
  const n = Math.max(4, Math.min(14, Math.round(amt/14)));
  for(let k=0;k<n;k++){
    const sc = .55 + Math.random()*.5, dir = Math.random()<.5 ? -1 : 1, dx = dir*(25 + Math.random()*70), up = 35 + Math.random()*60, fall = 90 + Math.random()*90;
    coin(c.layer, [
      {transform:TF(from[0],from[1],sc*.4), opacity:0, offset:0, easing:'cubic-bezier(.2,.7,.4,1)'},
      {transform:TF(from[0]+dx*.2,from[1]-up*.5,sc), opacity:1, offset:.12, easing:'cubic-bezier(.2,.7,.4,1)'},
      {transform:TF(from[0]+dx*.6,from[1]-up,sc), opacity:1, offset:.4, easing:'cubic-bezier(.5,0,.9,.5)'},
      {transform:TF(from[0]+dx,from[1]+fall,sc*.8), opacity:0, offset:1}
    ], 850 + Math.random()*300, k*35);
  }
}
function fxLose(p, amt, to){
  if(HEADLESS || !amt) return;
  p.hitAt = Date.now(); czMood(p,'cry',1900); fxNum(p, '−' + amt, ''); SFX.play('lose', 0, S && p.id===S.viewer ? 1 : .8);
  if(calm()) return;
  renderBoard();
  if(amt>=30) showBubble(p, amt>=100 ? '😭' : '😅', true);
  const c = fxCtx();
  if(c && !(to && typeof to==='object')){ const at = c.centre(p.pos); if(at) coinBurst(c, at, amt); }
  if(amt>=100) fxShake(amt);
  try { if(navigator.vibrate) navigator.vibrate(amt>=100 ? [60,40,90] : 40); } catch(e) {}
}
function fxGain(p, amt, fromPos, q){   // q: không phát tiếng xu (đã có tiếng riêng, ví dụ qua Xuất phát)
  if(HEADLESS || !(amt>0)) return;
  p.gainAt = Date.now(); czMood(p,'joy',1900); fxNum(p, '+' + amt, 'gain'); if(!q) SFX.play(amt>=100 ? 'coinbig' : 'coin', 0, S && p.id===S.viewer ? 1 : .8);
  if(calm()) return;
  if(amt>=100 && !q) fxShake(amt);
  const c = fxCtx(); if(!c) return;
  const to = c.centre(p.pos); if(!to) return;
  const from = (fromPos!=null && fromPos!==p.pos) ? c.centre(fromPos) : null;
  if(from) coinStream(c, from, to, amt); else coinRain(c, to, amt);
}
function gain(p, amt, fromPos, q){ amt = Math.round(amt); if(amt>0){ p.cash += amt; fxGain(p, amt, fromPos, q); } }
function collateralFor(p, amt, exclude){
  const free = owned(p).filter(i => !isColl(i) && i!==exclude).sort((a,b) => tileValue(a)-tileValue(b));
  const one = free.find(i => Math.floor(tileValue(i)*LTV) >= amt); if(one!=null) return [one];
  const pick = []; let cap = 0;
  for(const i of free.slice().reverse()){ pick.push(i); cap += Math.floor(tileValue(i)*LTV); if(cap>=amt) return pick; }
  return null;
}
// Hỏi vay đúng số còn thiếu. Trả về true nếu đã vay (tiền mặt được cộng thêm need).
const capOf = i => Math.floor(tileValue(i)*LTV);
const freeTiles = (p, exclude) => owned(p).filter(i => !isColl(i) && i!==exclude);
const socialRoom = p => Math.max(0, SOCIAL_MAX - p.loans.filter(L => L.type==='social').reduce((a,L) => a+L.principal, 0));
// mức nguy hiểm: nợ từ 60% tài sản, hoặc lãi mỗi vòng từ nửa tiền qua Xuất phát
function loanRisk(p, extra, plus){
  const d = debt(p) + extra, it = p.loans.reduce((a,L) => a + loanInt(L), 0) + Math.round(extra*BANK_RATE/100), av = assetValue(p) + (plus || 0);   // plus: giá trị ô đất sắp mua bằng khoản vay này
  return {d, it, risky: extra>0 ? (d >= av*.5 || it >= GO_CASH*.5) : (d >= av*.5 && d>0)};
}
// trần tổng nợ: không ai được nợ quá DEBT_CAP tổng tài sản (đất, nhà, công ty), kể cả khi bị buộc phải trả
function debtRoom(p, plus){
  return Math.max(0, Math.floor((assetValue(p) + (p.startup||0) + (plus||0))*DEBT_CAP) - debt(p));
}
// số tiền tối đa được vay cho việc tự nguyện (nâng cấp, đấu giá): đang sát ngưỡng phá sản thì không được vay
function voluntaryRoom(p, exclude){
  if(p.bot) return 0;
  const room = freeTiles(p, exclude).reduce((a,i) => a + capOf(i), 0) + socialRoom(p);
  // tìm mức vay lớn nhất mà chưa chạm ngưỡng nguy hiểm. Vay xã hội không giới hạn (Infinity) nên phải chặn trên bằng trần nợ,
  // nếu không vòng tìm kiếm chạy mãi và game đứng hình mỗi khi người chơi được hỏi giá đấu
  let lo = 0, hi = Math.max(0, Math.floor(Math.min(room, debtRoom(p))));
  while(lo < hi){ const m = Math.ceil((lo+hi)/2); if(loanRisk(p, m).risky || m > debtRoom(p)) hi = m-1; else lo = m; }
  return lo;
}
async function pickCollateral(p, need, free){
  const one = free.filter(i => capOf(i) >= need), opts = free.slice().sort((a,b) => capOf(a)-capOf(b)).map(i => (
    {k:i, label:TILES[i].n, sub:`Vay tối đa ${capOf(i)}` + (capOf(i) < need ? ', chưa đủ' : ''), disabled: capOf(i) < need, primary: capOf(i) >= need && i===one[0]}));
  if(!one.length){ const set = collateralFor(p, need, null) || []; opts.unshift({k:'set', label:`Thế chấp ${set.length} ô cùng lúc`, sub:set.map(i => `${TILES[i].n} (${capOf(i)})`).join(', '), primary:true, set}); }
  opts.push({k:'back', label:'Quay lại'});
  const c = await ask(`Chọn nhà thế chấp để vay ${need}`,
    `<div class="stats"><div><small>Cần vay</small><b>${need}</b></div><div><small>Lãi mỗi vòng</small><b>${Math.max(1, Math.round(need*BANK_RATE/100))}</b></div></div><p class="bn">Nhà thế chấp chỉ thu nửa tiền thuê, chưa nâng cấp được tới khi trả nợ.</p>`, opts, 20, p.id);
  if(c==='back') return null;
  if(c==='set') return opts[0].set;
  return [c];
}
async function offerLoan(p, need, title, noLabel, exclude, plus){
  const forced = noLabel==='Bán tài sản để trả';
  for(;;){
    const free = freeTiles(p, exclude), bankMax = free.reduce((a,i) => a + capOf(i), 0), room = socialRoom(p);
    const capRoom = debtRoom(p, plus), canBank = bankMax >= need && capRoom >= need, canSoc = room >= need, R = loanRisk(p, need, plus);
    if(!canBank && !canSoc){
      if(!p.bot && !HEADLESS){
        const why = [free.length ? `Nhà còn lại chỉ đủ vay tối đa ${bankMax}` : 'Không còn nhà nào để thế chấp', room<=0 ? `Vay xã hội đã chạm trần ${SOCIAL_MAX}` : `Vay xã hội chỉ còn ${room}`].concat(capRoom < need ? [`Tổng nợ không được quá ${Math.round(DEBT_CAP*100)}% tài sản, chỉ còn vay được ${capRoom}`] : []);
        await ask('⚠️ Không đủ điều kiện vay',
          `<div class="warnbox"><b>${esc(p.name)} cần ${need} nhưng không vay được</b><ul>${why.map(w => `<li>${w}</li>`).join('')}</ul></div><p class="bn">${forced ? 'Game sẽ bán tài sản để trả. Không đủ thì phá sản.' : 'Đã hủy, bạn không mất gì.'}</p>`,
          [{k:'ok', label:'Đã hiểu', primary:true}], 10, p.id);
      }
      return false;
    }
    if(!forced && R.risky){
      // việc tự nguyện mà vay sẽ đẩy tới sát phá sản: không cho vay
      if(!p.bot && !HEADLESS) await ask('⚠️ Không thể vay thêm',
        `<div class="warnbox"><b>Ngân hàng từ chối: sát ngưỡng phá sản</b><ul><li>Nợ sẽ thành <b>${R.d}</b>, lãi ~<b>${R.it}</b>/vòng</li></ul></div><p class="bn">Đã hủy, bạn không mất gì. Trả bớt nợ rồi thử lại.</p>`,
        [{k:'ok', label:'Đã hiểu', primary:true}], 10, p.id);
      return false;
    }
    const ib = Math.max(1, Math.round(need*BANK_RATE/100)), is = Math.max(1, Math.round(need*SOCIAL_RATE/100));
    const warn = R.risky ? `<div class="warnbox"><b>⚠️ Sát ngưỡng phá sản</b><ul><li>Nợ thành <b>${R.d}</b>, lãi ~<b>${R.it}</b>/vòng. Lần sau có thể không vay được</li></ul></div>` : '';
    if(!p.bot) if(S && S.tutm && window.TUTM) window.TUTM.ev('loan');
    const c = await ask(title, `<div class="stats"><div><small>Cần vay</small><b>${need}</b></div><div><small>Vay tối đa</small><b>${Math.min(bankMax, capRoom)}</b></div></div>` + warn, [
      {k:'bank', label:`🏦 Vay ngân hàng ${need}`, sub: canBank ? `Lãi ${ib}/vòng · thế chấp nhà` : `Nhà chỉ đủ vay ${bankMax}`, primary:true, disabled:!canBank},
      {k:'social', label:`🤝 Vay xã hội ${need}`, sub: canSoc ? `Lãi ${is}/vòng · không thế chấp` : `Chỉ còn vay được ${room}`, disabled:!canSoc},
      {k:'no', label:noLabel}], R.risky ? 30 : 25, p.id);
    if(c==='bank'){
      const col = (p.bot || HEADLESS) ? collateralFor(p, need, exclude) : await pickCollateral(p, need, free);
      if(!col) continue;
      p.loans.push({type:'bank', principal:need, tiles:col}); p.cash += need;
      log(`${p.name} vay ngân hàng ${need}, lãi ${ib} mỗi vòng, thế chấp ${col.map(i => TILES[i].n).join(', ')}.`);
    }
    else if(c==='social'){ p.loans.push({type:'social', principal:need}); p.cash += need; log(`${p.name} vay xã hội ${need}, lãi ${is} mỗi vòng.`); }
    else return false;
    render(); return true;
  }
}
// Máy vay: ưu tiên ngân hàng (thế chấp ô ít giá trị nhất), không đủ thì vay xã hội. Không vay khi nợ sẽ quá 60% tài sản.
function botLoan(p, need, why, plus){
  need = Math.ceil(need); if(need<=0) return true;
  if(debt(p) + need > (assetValue(p) + (p.startup||0) + (plus||0))*.6) return false;
  const col = collateralFor(p, need, null);
  if(col && debtRoom(p, plus) >= need){ p.loans.push({type:'bank', principal:need, tiles:col}); p.cash += need; log(`${p.name} vay ngân hàng ${need} ${why}, thế chấp ${col.map(i => TILES[i].n).join(', ')}.`); return true; }
  p.loans.push({type:'social', principal:need}); p.cash += need; log(`${p.name} vay xã hội ${need} ${why}.`); return true;
}
async function rescue(p){
  while(p.cash<0 && p.alive){
    if(!(await offerLoan(p, -p.cash, `${p.name} thiếu ${-p.cash}`, 'Bán tài sản để trả'))) return;
  }
}
// Mỗi lần qua Xuất phát: hiện từng khoản nợ (gốc, lãi). Trả hết, trả riêng từng khoản, chỉ trả lãi, hoặc để sau (lãi cộng dồn vào gốc).
// Nợ xã hội để 2 vòng liền không trả (kể cả lãi) thì bị đòi gắt: phải trả ngay, thiếu tiền thì bán tài sản, không được vay thêm.
// Nợ ngân hàng vượt FORECLOSE giá trị nhà thế chấp thì ngân hàng siết nợ công khai.
const SOC_MISS = 2;
const socMiss = p => SOC_MISS + (pk(p,'xd')>0 ? 1 : 0);   // Đất vàng: khất thêm 1 vòng
const loanName = L => L.type==='bank' ? '🏦 Ngân hàng' : '🤝 Vay xã hội';
async function lapDebt(p){
  if(!p.loans.length) return;
  let act = 'later';
  for(;;){
    if(!p.loans.length){ render(); return; }
    const its = p.loans.map(loanInt), it = its.reduce((a,b) => a+b, 0), bal = debt(p), total = bal + it;
    let c;
    // máy tham: giữ tiền mặt để mua đất, chỉ trả hết khi rất dư, hay khất nợ hơn (dễ bị đòi gắt, siết nợ)
    if(p.bot || HEADLESS) c = p.cash - total >= 450 ? 'pay' : (p.cash - it >= 300 && Math.random() < .55) ? 'int' : 'later';
    else {
      const rows = p.loans.map((L,k) => {
        const col = L.type==='bank' ? L.tiles.reduce((a,i) => a + tileValue(i), 0) : 0;
        const warn = L.type==='bank' ? (L.principal + its[k] > col*FORECLOSE*.9 ? `<em>Sắp bị siết nợ: thế chấp ${L.tiles.map(i => TILES[i].n).join(', ')}</em>` : `<small>Thế chấp ${L.tiles.map(i => TILES[i].n).join(', ')}</small>`)
          : ((L.miss||0) >= socMiss(p)-1 ? `<em>Trễ ${L.miss} vòng. Không trả vòng này sẽ bị đòi gắt</em>` : `<small>${L.miss ? 'Trễ ' + L.miss + ' vòng' : 'Không thế chấp'}</small>`);
        return `<div class="dbrow ${L.type}"><b>${loanName(L)}</b><span><small>Gốc</small>${L.principal}</span><span><small>Lãi</small>${its[k]}</span><span><small>Cần trả</small>${L.principal + its[k]}</span>${warn}</div>`;
      }).join('');
      const opts = [
        {k:'pay', label:`Trả hết ${total}`, sub: p.cash>=total ? `Còn lại ${p.cash-total}` : `Không đủ, đang có ${p.cash}`, primary:p.cash>=total, disabled:p.cash<total},
        {k:'int', label:`Chỉ trả lãi ${it}`, sub: p.cash>=it ? 'Gốc giữ nguyên' : `Không đủ, đang có ${p.cash}`, primary:p.cash<total && p.cash>=it, disabled:p.cash<it}];
      p.loans.forEach((L,k) => { if(p.loans.length>1) opts.push({k:'L'+k, label:`Trả ${loanName(L)} ${L.principal + its[k]}`, disabled:p.cash < L.principal + its[k]}); });
      opts.push({k:'later', label:'Để sau', sub:`Nợ thành ${total}`});
      if(S && S.tutm && window.TUTM) window.TUTM.ev('debt');
      c = await ask('🏦 Trả nợ vòng này',
        `<div class="stats s3"><div><small>Tiền mặt</small><b>${p.cash}</b></div><div><small>Nợ gốc</small><b>${bal}</b></div><div><small>Lãi vòng này</small><b>${it}</b></div></div><div class="dblist">${rows}</div>`, opts, DECIDE + 6);
    }
    if(c==='pay' && p.cash>=total){ p.cash -= total; p.loans = []; log(`${p.name} trả hết nợ ${total} (gốc ${bal}, lãi ${it}).`); render(); return; }
    if(c==='int' && p.cash>=it){ p.cash -= it; p.loans.forEach(L => { L.miss = 0; }); log(`${p.name} trả lãi ${it}, nợ gốc giữ nguyên ${bal}.`); act = 'int'; break; }
    if(/^L\d+$/.test(String(c))){ const k = +String(c).slice(1), L = p.loans[k];
      if(L && p.cash >= L.principal + its[k]){ p.cash -= L.principal + its[k]; p.loans.splice(k, 1); log(`${p.name} trả xong khoản ${L.type==='bank' ? 'vay ngân hàng' : 'vay xã hội'} ${L.principal + its[k]}.`); render(); continue; } }
    break;
  }
  if(act!=='int'){
    const its = p.loans.map(loanInt), it = its.reduce((a,b) => a+b, 0);
    p.loans.forEach((L,k) => { L.principal += its[k]; if(L.type==='social') L.miss = (L.miss||0) + 1; });
    log(`${p.name} chưa trả nợ. Lãi ${it} cộng dồn, nợ thành ${debt(p)}.`);
  }
  for(const L of p.loans.slice()){
    if(L.type==='bank' && L.principal > L.tiles.reduce((a,i) => a+tileValue(i), 0)*FORECLOSE){
      if(pk(p,'xd')>0 && !L.grace){ L.grace = 1; log(`👑 ${p.name} có Đất vàng: ngân hàng khất thêm 1 vòng trước khi siết nợ.`); }
      else await foreclose(p, L);
    }
  }
  // nợ xã hội: quá SOC_MISS vòng không trả, hoặc vượt gấp đôi trần, thì bị đòi gắt
  const hard = p.loans.filter(L => L.type==='social' && ((L.miss||0) >= socMiss(p))), socAll = p.loans.filter(L => L.type==='social').reduce((a,L) => a+L.principal, 0);
  const due = hard;
  if(due.length){
    const amt = due.reduce((a,L) => a+L.principal, 0);
    p.loans = p.loans.filter(L => !due.includes(L));
    log(`⚠️ ${p.name} để nợ xã hội ${amt} quá ${socMiss(p)} vòng: bị đòi gắt, phải trả ngay. Thiếu tiền thì bán tài sản.`);
    if(!HEADLESS && !p.bot) await ask('⚠️ Bị đòi nợ xã hội', `<div class="warnbox"><b>Phải trả ngay ${amt}</b><ul><li>Vay xã hội trễ ${socMiss(p)} vòng</li><li>Thiếu tiền thì bán tài sản, vẫn thiếu thì phá sản</li></ul></div>`, [{k:'ok', label:'Đã hiểu', primary:true}], 10, p.id);
    await pay(p, amt, null, false, true);
  }
  render();
}
// Siết nợ công khai: ngân hàng thu toàn bộ nhà thế chấp của khoản vay, xóa khoản nợ đó (không trả lại tiền thừa), rồi đem từng ô ra đấu giá kín cho những người còn lại
async function foreclose(p, L){
  p.loans.splice(p.loans.indexOf(L), 1);
  const names = L.tiles.map(i => TILES[i].n).join(', ');
  L.tiles.forEach(i => { S.owner[i] = -1; });   // giữ nguyên nhà: bán theo giá thị trường (đất + nhà)
  log(`🔨 Siết nợ công khai: ${p.name} nợ ngân hàng ${L.principal}, vượt ${Math.round(FORECLOSE*100)}% giá trị nhà thế chấp. Ngân hàng thu ${names}, xóa nợ và đem ra đấu giá.`);
  if(!HEADLESS){ SFX.play('lose'); render();
    // popup của ngân hàng (tranh hài) cho mọi người cùng xem, rồi mới đấu giá
    if(S.players.some(q => !q.bot && q.alive)){ const a = (AVMAP && AVMAP[p.id]!=null) ? AVMAP[p.id] : p.id, me = !p.bot && (!NET || p.id===NET.me);
      await ask('🏦 Ngân hàng siết nợ!', `<div class="bankpop"><div class="bpL">${ART.bank(a)}</div><div class="evbox"><b>${esc(p.name)}</b> không trả nổi nợ <b>${L.principal}</b>.<br>Ngân hàng thu <b>${esc(names)}</b> đem đấu giá!</div></div>`,
        [{k:'ok', label: me ? 'Ôi không 😭' : 'Xem đấu giá 🔨', primary:true}], 7, 'all'); }
    else { bigMoment(`Siết nợ! ${p.name} mất ${names}`, '#E0685C', '🔨'); await sleep(1600); } }
  for(const i of L.tiles){ if(S.owner[i]<0) await auction(p, i, false, true); if(S.owner[i]<0) S.level[i] = 0; }
  render();
}
function repay(p, k){
  const L = p.loans[k]; if(!L || p.cash < L.principal) return;
  p.cash -= L.principal; p.loans.splice(k, 1);
  log(`${p.name} trả hết khoản ${L.type==='bank' ? 'vay ngân hàng' : 'vay xã hội'} ${L.principal}.`);
}
async function pay(p, amt, to, silent, noLoan){
  if(to==='fund' && pk(p,'xn')>0) amt *= 1 - .1*pk(p,'xn');      // Đất lành: thuế, phạt nộp vào Quỹ giảm 10% (½ bộ: 5%)
  amt = Math.max(0, Math.round(amt)); if(!amt) return;
  if(!silent) fxLose(p, amt, to);
  p.cash -= amt;
  if(p.cash<0 && p.startup>0) sellStartup(p, 'để trả nợ');
  if(p.cash<0 && !p.bot && !HEADLESS && !noLoan) await rescue(p);
  if(p.cash<0 && p.bot && !noLoan) botLoan(p, -p.cash, 'để trả nợ');
  if(p.cash<0) liquidate(p);
  let paid = amt;
  if(p.cash<0){ paid = Math.max(0, amt + p.cash); p.cash = 0; bankrupt(p);
    if(!p.bot && !HEADLESS) await ask(`${p.name} đã phá sản`, '<div class="warnbox"><b>Hết tiền và tài sản.</b> Đất trở về chưa có chủ.</div>', [{k:'ok', label:'Đã hiểu', primary:true}], 10, p.id); }
  if(to==='fund') S.fund = Math.min(FUND_MAX, S.fund + paid);                             // thuế, phạt, phí ra tù... chảy vào Quỹ phúc lợi
  else if(to) gain(to, paid, p.pos);
}

const SU_GROW = .5, SU_FLAT = .3, SU_OPTS = [100, 200, 300];   // 50% lớn lên x1,5, 30% đứng yên, 20% phá sản
function sellStartup(p, why){
  const v = p.startup||0; if(v<=0) return 0;
  p.startup = 0; p.su0 = 0; p.cash += v;
  log(`${p.name} bán công ty khởi nghiệp, thu về ${v}${why ? ' ' + why : ''}.`);
  if(!HEADLESS){ cornerNote(p, '💰', 'Bán công ty', `Thu về ${v}`, 2400); SFX.play('coinbig'); render(); }
  return v;
}
async function passGo(p){
  const xnB = Math.round(PV.xn*pk(p,'xn'));   // v137: Đất lành
  let got = (S.rules.weekly==='go300' ? 300 : GO_CASH) + (perk(p,'nau') ? PV.nau : 0) + xnB; S.fund = Math.min(FUND_MAX, S.fund + FUND_ADD);
  let msg = `${p.name} qua Xuất phát, nhận ${got}${xnB ? ` (có ${xnB} nhờ huy hiệu Đất lành)` : ''}`;
  if(p.startup>0){                                          // Gọi vốn mạo hiểm: mỗi vòng công ty lớn lên, đứng yên hoặc phá sản
    const r = Math.random(), v0 = p.startup;
    if(r < SU_GROW){ p.startup = Math.round(v0*1.5); msg += `, công ty khởi nghiệp lớn lên ${v0} thành ${p.startup}`; if(!HEADLESS) cornerNote(p, '🚀', 'Khởi nghiệp', `Công ty lớn lên<br><small>${v0} thành ${p.startup}</small>`, 2600); }
    else if(r < SU_GROW + SU_FLAT){ msg += `, công ty khởi nghiệp đứng yên ở ${v0}`; }
    else { p.startup = 0; p.su0 = 0; msg += `, công ty khởi nghiệp phá sản, mất trắng ${v0}`; if(!HEADLESS){ cornerNote(p, '💥', 'Khởi nghiệp', `Công ty phá sản<br><small>Mất trắng ${v0}</small>`, 2600); SFX.play('lose'); } }
    if(p.bot && p.startup>0 && (p.startup >= 2*(p.su0||p.startup) || p.cash < 100)) sellStartup(p);
  }
  if((p.bot || HEADLESS) && canCut(p)){ const ct = botCutTarget(p); if(ct>=0) doCut(p, ct); }
  if(p.tea>0){ got += 100; p.tea--; msg += ', trà sữa thêm 100'; }
  gain(p, got, null, true); if(!p.bot) if(S && S.tutm && window.TUTM) window.TUTM.ev('go');
  log(msg + '.');   // v136: bỏ thuế đất mỗi lần qua Xuất phát (người mới không hiểu vì sao bị trừ tiền)
  p.laps++;
  if(p.alive && p.loans.length) await lapDebt(p);
}
function czFly(p, on){ if(HEADLESS) return; const el = czTk(p), sd = czSh(p); if(el){ el.classList.remove('hop','hop2','landq'); el.classList.toggle('flying', on); } if(sd) sd.classList.toggle('flying', on); }
const STEP_MS = 250;   // v132: một bước của quân như bản cũ (quân, bóng trượt .24s; camera .28s)
async function move(p, steps){
  const fly = !HEADLESS && !p.bot && !p.remote && STORE.wearing('choi') && (!NET || p.id===NET.me);
  if(!HEADLESS){ warmPts(); document.body.classList.add('mv'); }
  if(fly) czFly(p, true);
  try {
  for(let s=0;s<steps;s++){
    const t0 = Date.now(), wait = () => sleepRaw(Math.max(0, STEP_MS - (Date.now() - t0)));   /* v131: nhịp bước đều 260ms, không cộng thêm thời gian vẽ (máy chậm vẽ lâu thì quân khựng mỗi bước) */
    const prevPos = p.pos; p.pos = (p.pos+1)%N;
    if(p.pos===0) await passGo(p);
    if(!p.alive){ czHopEnd(p); return; }
    if(fly){ render(); fxLight(p.pos, false, p.color); if(s===0 || s%2===0) SFX.play('fly', .2, 1); if(!HEADLESS) camTo(p); await wait(); continue; }
    render(); czHop(p, prevPos); fxLight(p.pos, false, p.color); if(s < steps-1) SFX.play('step', .24, S && p.id===S.viewer ? 1 : .8); if(!HEADLESS) camTo(p); await wait();
  }
  } finally { if(!HEADLESS) document.body.classList.remove('mv'); if(fly) czFly(p, false); }
  czHopEnd(p);   // lún xuống đúng lúc có tiếng dừng chân
}
async function advanceTo(p, idx, dice, opt){
  let steps = (idx - p.pos + N) % N; if(!steps) steps = N;
  { const bz = p.boost || 0; if(bz){ p.boost = 0; log(`${p.name} no bụng bánh mì nên đi thêm ${bz} ô.`); } await move(p, steps + bz); } if(p.alive) await land(p, dice, opt);
}
// ----- Đấu trường: thách đấu 1 đối thủ, mỗi bên gieo 1 viên, cao hơn thắng 15% tiền mặt của bên thua (50..300)
async function rkArena(p){
  const foes = S.players.filter(q => q.alive && q.id!==p.id && !mate(p, q)); if(!foes.length) return;
  let tgt = null;
  if(p.bot) tgt = foes.slice().sort((a,b) => b.cash - a.cash)[0];
  else { const c = await ask('⚔️ Đấu trường', `<p style="text-align:center">Mỗi bên gieo 1 viên. <b>Cao hơn</b> lấy <b>15% tiền mặt</b> bên kia.</p>`,
      foes.map((q,n) => ({k:'f'+q.id, label:'⚔️ ' + q.name, sub:'Tiền mặt ' + q.cash, primary:n===0})).concat([{k:'n', label:'Tha cho họ'}]));
    tgt = /^f\d$/.test(String(c)) ? S.players[+String(c).slice(1)] : null; }
  if(!tgt){ log(`${p.name} vào Đấu trường nhưng không thách đấu ai.`); return; }
  let a, b; do { a = 1 + rnd(6); b = 1 + rnd(6); } while(a===b);
  if(!HEADLESS) await showDice(a, b);
  const win = a > b ? p : tgt, lose = win===p ? tgt : p, amt = Math.max(50, Math.min(300, Math.round(lose.cash*.15/10)*10));
  log(`⚔️ ${p.name} (${a}) đấu với ${tgt.name} (${b}): ${win.name} thắng, cướp ${amt} của ${lose.name}.`);
  if(!HEADLESS){ cornerNote(win, '⚔️', 'Thắng đấu trường', `+${amt} từ ${lose.name}`, 2600); fxEmote(lose, 'cry', 300); }
  await pay(lose, amt, win);
}
// ----- Chợ đen: mua cưỡng ép 1 ô chưa xây nhà của đối thủ, giá 130% (trả cho chủ cũ)
async function rkMarket(p){
  const L = TILES.map((t,i) => i).filter(i => TILES[i].k==='land' && S.owner[i]>=0 && S.owner[i]!==p.id && !mate(p, S.players[S.owner[i]]) && !S.level[i]).map(i => ({i, cost:Math.round(priceOf(i)*1.3/10)*10})).filter(x => x.cost <= p.cash);
  if(!L.length){ log(`${p.name} vào Chợ đen nhưng không có món nào vừa túi tiền.`); return; }
  let pick = null;
  if(p.bot){ const own = g => TILES.filter((t,i) => t.g===g && S.owner[i]===p.id).length; L.sort((x,y) => own(TILES[y.i].g) - own(TILES[x.i].g) || x.cost - y.cost); if(p.cash - L[0].cost >= 250) pick = L[0]; }
  else { L.sort((x,y) => y.cost - x.cost); const c = await ask('🕶️ Chợ đen', `<p style="text-align:center">Mua ép 1 ô <b>chưa xây nhà</b>, giá <b>130%</b>. Chủ cũ không được từ chối.</p>`,
      L.slice(0, 6).map((x,n) => ({k:'m'+x.i, label:TILES[x.i].n + ' · ' + x.cost, sub:'Của ' + S.players[S.owner[x.i]].name, primary:n===0})).concat([{k:'n', label:'Thôi, không mua'}]));
    const m = String(c).match(/^m(\d+)$/); pick = m ? L.find(x => x.i===+m[1]) : null; }
  if(!pick){ log(`${p.name} ghé Chợ đen nhưng không mua gì.`); return; }
  const old = S.players[S.owner[pick.i]];
  await pay(p, pick.cost, old); if(!p.alive) return;
  S.owner[pick.i] = p.id; log(`🕶️ ${p.name} mua cưỡng ép ${TILES[pick.i].n} của ${old.name} với giá ${pick.cost}.`); checkCombo(p, pick.i);
  if(!HEADLESS) cornerNote(p, '🕶️', 'Chợ đen', `Cướp ${TILES[pick.i].n}`, 2600);
}
function goJail(p){ if(S.rules.weekly==='nojail'){ log(`${p.name} được ân xá, không bị giam (luật tuần này).`); return; } const rideFrom = p.pos; p.pos = JAIL; policeRide(p, rideFrom, JAIL); p.jail = 1; p.extra = false; log(`${p.name} bị giam ở ô Vào tù.`); fxEmote(p, 'cry', rideFrom===JAIL ? 300 : 2150); }
const nearestAir = pos => { for(let s=1;s<=N;s++){ const i=(pos+s)%N; if(TILES[i].k==='air') return i; } };

const cdHTML = (label, secs) => `<p class="cd">Tự chọn "${label}" sau <b id="cdn">${secs}</b> giây</p><div class="bar"><i style="animation-duration:${secs}s"></i></div>`;
function countdown(secs, onZero){
  let left = secs;
  const iv = setInterval(() => { if(PAUSED) return; left--; if(left>0 && left<=3) SFX.play('tick'); const e = document.getElementById('cdn'); if(e) e.textContent = Math.max(0,left); if(left<=0){ clearInterval(iv); onZero(); } }, 1000);
  return () => clearInterval(iv);
}
let askAbort = null;
// đồng hồ nằm trên nút chính của popup (giống nút Chốt giá): màu đậm rút dần tới khi hết giờ; không có nút chính thì dùng nút cuối (nút tự chọn)
function cdOnBtn(secs){
  const mb = document.getElementById('mBody'), bs = [...document.querySelectorAll('#mOpts button')]; if(!bs.length) return;
  const pb = bs.find(b => b.classList.contains('primary')) || bs[bs.length-1];
  mb.querySelectorAll('.cd, .bar').forEach(e => { e.style.display = 'none'; });
  pb.classList.add('cdbtn'); pb.style.setProperty('--secs', secs + 's');
}
function askLocal(title, body, opts, secs = DECIDE){
  return new Promise(res => {
    askOpen = true;
    const def = opts[opts.length-1];
    let stop = () => {}, unq = () => {};
    const done = k => { unq(); stop(); askAbort = null; clearRing(); askOpen = false; closeModal(); res(k); };
    askAbort = () => { stop(); askAbort = null; clearRing(); askOpen = false; closeModal(); };
    if(!netClient()) setRing(S.cur, secs);
    openModal(title, body + cdHTML(def.label, secs), opts.map(o => ({label:o.label, sub:o.sub, primary:o.primary, disabled:o.disabled, fn:() => done(o.k)})));
    cdOnBtn(secs);
    stop = countdown(secs, () => done(def.k)); unq = onQuit(() => done(def.k));
  });
}
// who: id người cần trả lời (mặc định là người đang tới lượt); 'all' là thông báo chung
function ask(title, body, opts, secs = DECIDE, who){
  if(HEADLESS) return Promise.resolve(opts[0].k);
  if(QUIT) return Promise.resolve(opts[opts.length-1].k);
  if(netHost() && who!=='all'){
    const tp = S.players[who!=null ? who : S.cur];
    if(tp && tp.remote) return remoteAsk(tp, {kind:'ask', title, body:packBody(body), opts:opts.map(o => ({k:o.k, label:o.label, sub:o.sub, primary:o.primary?1:0, disabled:o.disabled?1:0})), secs}, secs);
    if(tp && tp.bot) return Promise.resolve(opts[opts.length-1].k);
  }
  return askLocal(title, body, opts, secs);
}

// ===== Chơi nhiều máy: máy chủ phòng chạy ván, các máy khác chỉ hiển thị và gửi thao tác =====
const seatPos = id => (NET && NET.me>0) ? (id - NET.me + 4) % 4 : id;   // mỗi máy luôn thấy mình ở góc dưới bên trái
let NET = null, chatSeq = 0, netLast = 0, netTimer = null, netLgSeq = -1;
const FXQ = [], FXSEEN = {};   /* chủ phòng: hiệu ứng chờ gửi; khách: lúc vừa thấy hiệu ứng tiền của từng người */
const netHost = () => !!(NET && NET.role==='host' && NET.live);
const netClient = () => !!(NET && NET.role==='client');
function netEmit(topic, data){ try { if(NET && NET.R){ const p = NET.R.emit(topic, data); if(p && p.catch) p.catch(() => {}); } } catch(e) {} }
function safeHTML(h){
  const t = document.createElement('template'); t.innerHTML = String(h || '');
  t.content.querySelectorAll('script,iframe,object,embed,link,meta,img,a,form,input,button,style,base,video,audio,source,foreignObject,textarea,select').forEach(e => e.remove());
  t.content.querySelectorAll('*').forEach(e => { [...e.attributes].forEach(a => { if(/^on/i.test(a.name) || /javascript:|expression\(|url\(/i.test(a.value) || a.name==='href' || a.name==='xlink:href' || a.name==='src') e.removeAttribute(a.name); }); });
  return t.innerHTML;
}
const packBody = b => String(b || '').replace(/<!--([TB])(\d+)-->[\s\S]*?<!--\/\1-->/g, '<!--$1$2--><!--/$1-->');
const unpackBody = b => safeHTML(b).replace(/<!--([TB])(\d+)--><!--\/\1-->/g, (m, k, i) => !TILES[+i] ? '' : k==='B' ? buyInfo(+i) : tileInfo(+i));
function packState(){
  const now = Date.now();
  return {t:S.turns, r:S.round, c:S.cur, f:S.fund, o:S.owner, l:S.level, d:S.dice, ds:S.diceSeq||0, w:S.wait, ov:S.over?1:0, rs:S.reason, wn:S.winner, wt:S.winTeam, tl:limitMs()-(now-S.start), md:S.mode, ru:S.rules, ev:S.ev,
    pe:S.pend ? S.pend.id : 0, pa:S.passed || null, av:S.avs || null, od:S.order || null, oi:S.oi || 0,
    ld:S.landed ? {i:S.landed.i, a:now-S.landed.at} : null, bu:S.built ? {i:S.built.i, a:now-S.built.at} : null,
    rg:S.ring ? {p:S.ring.pid, d:S.ring.dur, l:Math.max(0, S.ring.dur-(now-S.ring.start))} : null,
    p:S.players.map(p => ({n:p.name, b:p.bot?1:0, rm:p.remote?1:0, x:p.pos, c:p.cash, a:p.alive?1:0, j:p.jail, is:p.island, cd:p.card, su:p.startup, sk:p.skip, lo:p.loans, lp:p.laps, ou:p.out, oa:p.outAt, iu:p.itemsUsed, te:p.tea, um:p.umb, lt:p.listedTurn, fu:p.fu||'', fi:p.fi||'', ft:p.fit||''}))};
}
function unpackState(d){
  const now = Date.now();
  const players = (d.p || []).slice(0,4).map((x,i) => ({id:i, name:String(x.n||'').slice(0,20), bot:!!x.b, remote:!!x.rm, color:PC[i], cash:+x.c||0, pos:(+x.x||0)%N, alive:!!x.a, jail:+x.j||0, island:+x.is||0, card:+x.cd||0, startup:+x.su||0, skip:+x.sk||0,
    loans:Array.isArray(x.lo) ? x.lo.map(L => ({type:L.type==='bank'?'bank':'social', principal:+L.principal||0, tiles:Array.isArray(L.tiles)?L.tiles.map(Number):[]})) : [], laps:+x.lp||0, out:x.ou, outAt:x.oa, itemsUsed:+x.iu||0, tea:+x.te||0, umb:+x.um||0, listedTurn:x.lt, freeRent:0, extra:false, reroll:0, fu:String(x.fu||'').slice(0,40), fi:/^\d{8}$/.test(String(x.fi||'')) ? String(x.fi) : '', fit:fitList(x.ft).join('+')}));
  return {net:true, players, owner:(d.o||[]).map(Number), level:(d.l||[]).map(Number), upLap:Array(N).fill(-1), round:+d.r||1, mode:d.md||'friend', rules:Object.assign({}, RULES_DEF, d.ru||{}), ev:d.ev||{}, fund:+d.f||0, cur:+d.c||0, viewer:NET.me,
    over:!!d.ov, reason:d.rs||'', winner:d.wn, winTeam:d.wt, start:now-(((d.ru && d.ru.limit) || LIMIT_MS)-(+d.tl||0)), dice:d.d||[0,0], diceSeq:d.ds, turns:+d.t||0, wait:d.w||null, decks:{chance:[],fortune:[]}, pend:null, passed:d.pa||null, avs:Array.isArray(d.av) ? d.av.slice(0,4).map(Number) : null, order:Array.isArray(d.od) ? d.od.map(Number) : null, oi:+d.oi||0,
    landed:d.ld ? {i:d.ld.i, at:now-d.ld.a} : null, built:d.bu ? {i:d.bu.i, at:now-d.bu.a} : null, ring:d.rg ? {pid:d.rg.p, dur:d.rg.d, start:now-(d.rg.d-d.rg.l)} : null};
}
function netSync(force){
  if(!netHost() || !S) return;
  const now = Date.now();
  if(!force && now-netLast < 170){ if(!netTimer) netTimer = setTimeout(() => { netTimer = null; netSync(true); }, 180); return; }
  netLast = now;
  if(FXQ.length) netEmit('fx', {q:FXQ.splice(0), st:packState()}); else netEmit('st', packState());
  if(chatSeq!==netLgSeq){ netLgSeq = chatSeq; netEmit('lg', {m:chat.slice(-9).map(m => m.sys ? {q:m.q, s:1, t:String(m.text).slice(0,150)} : {q:m.q, p:m.pid, t:String(m.text).slice(0,80), e:m.emoji?1:0})}); }
  if(S.pend) netEmit('pd', S.pend);
}
function remoteAsk(tp, payload, secs){
  return new Promise(res => {
    const id = ++NET.askSeq;
    let pd = Object.assign({id, to:tp.id}, payload);
    if(JSON.stringify(pd).length > 3600) pd = Object.assign({}, pd, {body:''});
    S.pend = pd; setRing(tp.id, secs); netSync(true);
    const def = payload.kind==='bid' ? 0 : payload.opts[payload.opts.length-1].k;
    let fin = false;
    const done = v => { if(fin) return; fin = true; clearTimeout(tm); NET.onAns = null; if(S.pend && S.pend.id===id) S.pend = null; clearRing(); netSync(true); res(v); };
    const tm = setTimeout(() => done(def), (secs+4)*1000);
    NET.onAns = (aid, v) => {
      if(aid!==id) return;
      if(payload.kind==='bid'){ v = Math.floor(+v) || 0; done(v>=payload.floor && v<=payload.maxPay ? v : 0); }
      else { const o = payload.opts.find(x => x.k===v && !x.disabled); done(o ? o.k : def); }
    };
  });
}
// ===== Bản local: không có máy chủ riêng. FBNET chỉ còn để các phần cũ hỏi "có máy chủ không?" và nhận câu trả lời là không =====
const FBNET = (() => {
  const off = () => Promise.reject(Object.assign(new Error('offline'), {code:'bản local không có máy chủ'}));
  return { ok: () => false, db: off, authed: off, uid: () => '', room: async () => PEERNET };
})();
// ===== Phòng chơi chung (PeerJS, như bản Cờ Tỷ Phú cũ): chủ phòng giữ ID phòng trên máy chủ trung gian PeerJS, máy khác nối thẳng vào chủ phòng (WebRTC; cùng wifi thì đi trong mạng nhà).
// Chủ phòng chuyển tiếp mọi tin cho cả phòng. API giống room cũ: join, emit, on, onPeers, peers, leave; tin của chính mình cũng được nhận lại (isMe) =====
const PEERNET = (() => {
  const PFX = 'lendoi-local-v1-';
  const fail = code => Object.assign(new Error(code), {code});
  const lib = () => window.Peer ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = ok; s.onerror = () => no(fail('không tải được thư viện kết nối')); document.head.appendChild(s); });
  const open = id => new Promise((ok, no) => { const pr = id ? new Peer(id) : new Peer();
    const t = setTimeout(() => { pr.destroy(); no(fail('hết giờ kết nối')); }, 12000);
    pr.on('open', () => { clearTimeout(t); ok(pr); });
    pr.on('error', e => { if(pr.open && e.type!=='unavailable-id') return; clearTimeout(t); pr.destroy(); no(fail(e.type==='unavailable-id' ? 'trùng ID phòng' : (e.type || 'lỗi kết nối'))); }); });
  // role: 'host' tạo phòng (giữ ID), 'guest' vào phòng đã có
  async function join(name, role){
    await lib();
    const hub = PFX + String(name).replace(/[^\w-]/g, '_'), hs = {}, pf = [], live = new Set(), backlog = [];
    let gone = false, self = '';
    const fire = (t, data, from) => { const fs = hs[t]; if(!fs) return; const m = {topic:t, data, peer:from, isMe:from===self, sameTab:from===self}; fs.forEach(f => { try { f(m); } catch(e) {} }); };
    const pev = (j, l) => { if(!j.length && !l.length) return; const ev = {joined:j.map(peer => ({peer})), left:l.map(peer => ({peer}))};
      if(!pf.length){ backlog.push(ev); return; } pf.forEach(f => { try { f(ev); } catch(e) {} }); };
    const send = (c, m) => { try { if(c && c.open) c.send(m); } catch(e) {} };
    const api = { on(t, f){ (hs[t] = hs[t] || []).push(f); }, onPeers(f){ pf.push(f); backlog.splice(0).forEach(ev => { try { f(ev); } catch(e) {} }); }, peers(){ return [...live].map(peer => ({peer})); } };
    if(role==='host'){
      const pr = await open(hub), conns = {}; self = hub; live.add(self); pev([self], []);
      const all = m => Object.values(conns).forEach(c => send(c, m));
      pr.on('connection', c => {
        c.on('open', () => { const old = conns[c.peer]; conns[c.peer] = c; if(old && old!==c) try { old.close(); } catch(e) {}
          const isNew = !live.has(c.peer); live.add(c.peer); send(c, {k:'hi', peers:[...live]}); if(isNew){ all({k:'pj', p:c.peer}); pev([c.peer], []); } });
        c._seen = Date.now();
        c.on('data', m => { c._seen = Date.now(); if(gone || !m || m.k!=='e') return; all({k:'e', t:m.t, d:m.d, p:c.peer}); fire(m.t, m.d, c.peer); });
        const bye = () => { if(conns[c.peer]!==c) return; delete conns[c.peer]; live.delete(c.peer); all({k:'pl', p:c.peer}); pev([], [c.peer]); };
        c._bye = bye; c.on('close', bye); c.on('error', bye);
      });
      // nhịp tim: đóng tab hiếm khi báo 'close' ngay, nên im lặng quá 7 giây là coi như đã rời phòng
      const beat = setInterval(() => Object.values(conns).forEach(c => { if(Date.now() - c._seen > 7000){ c._bye(); try { c.close(); } catch(e) {} } else send(c, {k:'pi'}); }), 2000);
      pr.on('disconnected', () => setTimeout(() => { try { if(!gone && pr.disconnected && !pr.destroyed) pr.reconnect(); } catch(e) {} }, 1500));
      return Object.assign(api, { self,
        emit(t, data){ if(gone) return Promise.resolve(); const d = data===undefined ? null : data; all({k:'e', t, d, p:self}); setTimeout(() => fire(t, d, self)); return Promise.resolve(); },
        leave(){ if(gone) return; gone = true; clearInterval(beat); try { pr.destroy(); } catch(e) {} } });
    }
    const pr = await open(null); self = pr.id; let c = null, retry = 0, seen = 0;
    const wire = cx => {
      seen = Date.now();
      cx.on('data', m => { if(gone || cx!==c || !m) return; seen = Date.now();
        if(m.k==='hi'){ const add = m.peers.filter(x => !live.has(x)), rm = [...live].filter(x => !m.peers.includes(x)); add.forEach(x => live.add(x)); rm.forEach(x => live.delete(x)); pev(add, rm); }
        else if(m.k==='pj'){ if(!live.has(m.p)){ live.add(m.p); pev([m.p], []); } }
        else if(m.k==='pl'){ if(live.delete(m.p)) pev([], [m.p]); }
        else if(m.k==='e') fire(m.t, m.d, m.p); });
      // mất chủ phòng: báo cả phòng đã rời, rồi thử nối lại tới khi rời phòng
      const lost = () => { if(gone || cx!==c) return; c = null; const l = [...live]; live.clear(); pev([], l); clearTimeout(retry); retry = setTimeout(reconnect, 2500); };
      cx.on('close', lost); cx.on('error', lost); cx._lost = lost;
    };
    const beat = setInterval(() => { if(!c) return; if(Date.now() - seen > 7000){ const cx = c; cx._lost(); try { cx.close(); } catch(e) {} } else send(c, {k:'pi'}); }, 2000);
    const connect = () => new Promise((ok, no) => { const cx = pr.connect(hub, {reliable:true, serialization:'json'});
      const t = setTimeout(() => { pr.off('error', er); no(fail('không tìm thấy phòng')); }, 9000);
      const er = e => { if(e.type==='peer-unavailable'){ clearTimeout(t); pr.off('error', er); no(fail('không tìm thấy phòng')); } };
      pr.on('error', er);
      cx.on('open', () => { clearTimeout(t); pr.off('error', er); c = cx; wire(cx); ok(); }); });
    const reconnect = () => { if(gone || c) return; try { if(pr.disconnected && !pr.destroyed) pr.reconnect(); } catch(e) {}
      connect().catch(() => { if(!gone) retry = setTimeout(reconnect, 3000); }); };
    try { await connect(); } catch(e) { clearInterval(beat); pr.destroy(); throw e; }
    pr.on('disconnected', () => setTimeout(() => { try { if(!gone && pr.disconnected && !pr.destroyed) pr.reconnect(); } catch(e) {} }, 1500));
    return Object.assign(api, { self,
      emit(t, data){ if(gone) return Promise.resolve(); send(c, {k:'e', t, d:data===undefined ? null : data}); return Promise.resolve(); },
      leave(){ if(gone) return; gone = true; clearTimeout(retry); clearInterval(beat); try { pr.destroy(); } catch(e) {} } });
  }
  // ===== Phòng đang mở, không cần máy chủ: phòng chờ giữ thêm một "đèn hiệu" ở 1 trong SLOTS ID cố định;
  // máy đang tìm phòng gõ cửa cả SLOTS ID cùng lúc, đèn hiệu nào có người thì trả lời thông tin phòng rồi ngắt =====
  const SLOTS = 12, slotId = k => PFX + 'slot-' + k;
  // info() trả về thông tin phòng mới nhất mỗi lần có người hỏi; trả về hàm tắt đèn hiệu
  function beacon(info){
    let pr = null, off = false, t = 0;
    const order = [...Array(SLOTS).keys()].sort(() => Math.random() - .5);
    const claim = async i => { if(off) return; if(i >= SLOTS){ t = setTimeout(() => claim(0), 10000); return; }   /* đủ 12 phòng: chờ chỗ trống */
      try { await lib(); pr = await open(slotId(order[i])); } catch(e) { pr = null; if(!off) claim(i + 1); return; }
      if(off){ pr.destroy(); return; }
      pr.on('connection', c => c.on('open', () => { try { c.send({k:'room', v:info()}); } catch(e) {} setTimeout(() => { try { c.close(); } catch(e) {} }, 1500); }));
      pr.on('disconnected', () => setTimeout(() => { try { if(!off && pr.disconnected && !pr.destroyed) pr.reconnect(); } catch(e) {} }, 1500)); };
    claim(0);
    return () => { off = true; clearTimeout(t); if(pr) try { pr.destroy(); } catch(e) {} };
  }
  async function scan(ms = 5000){
    await lib(); const pr = await open(null), found = {};
    await new Promise(done => {
      let left = SLOTS; const t = setTimeout(done, ms), ends = {};
      const end = k => { if(!ends[k]) return; delete ends[k]; if(--left <= 0){ clearTimeout(t); done(); } };
      // đèn hiệu không có ai: máy chủ PeerJS báo lỗi peer-unavailable kèm ID
      pr.on('error', e => { const m = String(e && e.message || ''); for(const k in ends) if(m.endsWith(slotId(k))) end(k); });
      for(let k = 0; k < SLOTS; k++){ ends[k] = 1; const c = pr.connect(slotId(k), {reliable:true, serialization:'json'});
        c.on('data', m => { if(m && m.k==='room' && m.v && /^\d{5}$/.test(String(m.v.id))) found[m.v.id] = m.v; end(k); });
        c.on('close', () => end(k)); c.on('error', () => end(k)); }
    });
    try { pr.destroy(); } catch(e) {}
    return Object.values(found);
  }
  return {join, beacon, scan};
})();
// ===== Nói chuyện bằng mic khi chơi với bạn (v129): gọi thoại trực tiếp giữa các máy (WebRTC), Firebase chỉ để các máy tìm nhau =====
function micCast(){ if(NET && NET.me>=0) netEmit('mic', {p:NET.me, on:!!(VOICE.live() && VOICE.on())}); }
const VOICE = (() => {
  let R = null, me = '', vref = null, pcs = {}, mic = null, on = false, offs = [];
  const ICE = {iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]};
  const sig = (to, m) => { if(vref) vref.child('sig/' + to).push(Object.assign({f:me}, m)).catch(() => {}); };
  const audioEl = id => { let a = document.getElementById('va-' + id); if(!a){ a = document.createElement('audio'); a.id = 'va-' + id; a.autoplay = true; a.setAttribute('playsinline', ''); a.className = 'vaud'; document.body.appendChild(a); } return a; };
  const track = () => (mic && on) ? mic.getAudioTracks()[0] : null;
  const mk = (id, offerer) => {
    if(pcs[id]) return pcs[id];
    const pc = new RTCPeerConnection(ICE), x = {pc, q:[], tr:null};
    if(offerer){ x.tr = pc.addTransceiver('audio', {direction:'sendrecv'}); if(track()) x.tr.sender.replaceTrack(track()); }
    pc.onicecandidate = e => { if(e.candidate) sig(id, {c:JSON.stringify(e.candidate)}); };
    pc.ontrack = e => { const a = audioEl(id); a.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]); a.play().catch(() => {}); };
    pc.onconnectionstatechange = () => { if(pc.connectionState==='failed' || pc.connectionState==='closed') drop(id); };
    return pcs[id] = x;
  };
  const drop = id => { const x = pcs[id]; if(x){ try { x.pc.close(); } catch(e) {} delete pcs[id]; } const a = document.getElementById('va-' + id); if(a) a.remove(); };
  const flush = async x => { while(x.q.length){ try { await x.pc.addIceCandidate(x.q.shift()); } catch(e) {} } };
  const call = async id => { try { const x = mk(id, true), o = await x.pc.createOffer(); await x.pc.setLocalDescription(o); sig(id, {o:o.sdp}); } catch(e) {} };
  const onSig = async s => {
    const m = s.val(); s.ref.remove().catch(() => {}); if(!m || !m.f || !R) return; const id = m.f;
    try {
      if(m.o){ drop(id); const x = mk(id, false); await x.pc.setRemoteDescription({type:'offer', sdp:m.o});
        x.tr = x.pc.getTransceivers()[0]; if(x.tr){ x.tr.direction = 'sendrecv'; if(track()) await x.tr.sender.replaceTrack(track()); }
        const a = await x.pc.createAnswer(); await x.pc.setLocalDescription(a); sig(id, {a:a.sdp}); flush(x); }
      else if(m.a){ const x = pcs[id]; if(x){ await x.pc.setRemoteDescription({type:'answer', sdp:m.a}); flush(x); } }
      else if(m.c){ const x = pcs[id], c = JSON.parse(m.c); if(x && x.pc.remoteDescription) await x.pc.addIceCandidate(c).catch(() => {}); else if(x) x.q.push(c); }
    } catch(e) {}
  };
  const ui = () => { if(typeof micUI==='function') micUI(); };
  const wake = () => document.querySelectorAll('audio.vaud').forEach(a => { if(a.paused) a.play().catch(() => {}); });
  async function toggle(){
    if(!R) return;
    if(!mic){
      if(NMIC()){ if(!(await micAsk())) return; try { await NMIC().voice({on:true}); } catch(e) {} }
      if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ window.palToast && palToast('Máy này không hỗ trợ mic trong trình duyệt'); return; }
      try { mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}); }
      catch(e){ if(NMIC()) NMIC().voice({on:false}).catch(() => {}); micDenied(e); return; }
      try { if(navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch(e) {}
    }
    on = !on; const t = mic.getAudioTracks()[0]; t.enabled = on;
    Object.values(pcs).forEach(x => { const tr = x.tr || x.pc.getTransceivers()[0]; if(tr) tr.sender.replaceTrack(on ? t : null).catch(() => {}); });
    SYS.set('mic', on); SFX.duck(on && !!SYS.get('duck')); micCast();
    wake(); ui(); micUI(); if(window.palToast) palToast(on ? 'Đã bật mic, mọi người nghe được bạn' : 'Đã tắt mic');
  }
  function start(room){
    if(R || !room || !room.base || typeof RTCPeerConnection==='undefined') return;
    R = room; me = room.self; vref = room.base.child('voice');
    const meRef = vref.child('peers/' + me); meRef.onDisconnect().remove(); meRef.set(1).catch(() => {});
    const pRef = vref.child('peers'), inbox = vref.child('sig/' + me);
    const add = s => { if(s.key!==me){ micCast(); if(me < s.key) call(s.key); } }, del = s => drop(s.key);
    pRef.on('child_added', add); pRef.on('child_removed', del); inbox.on('child_added', onSig);
    offs = [() => pRef.off('child_added', add), () => pRef.off('child_removed', del), () => inbox.off('child_added', onSig), () => { meRef.onDisconnect().cancel(); meRef.remove().catch(() => {}); }];
    document.addEventListener('pointerdown', wake, true); ui();
    if(SYS.get('mic')) toggle(); else micCast();
  }
  function stop(){
    if(!R) return; offs.forEach(f => { try { f(); } catch(e) {} }); offs = [];
    Object.keys(pcs).forEach(drop); if(mic){ mic.getTracks().forEach(t => t.stop()); mic = null; } on = false;
    try { if(navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
    if(NMIC()) NMIC().voice({on:false}).catch(() => {});
    document.removeEventListener('pointerdown', wake, true); R = null; vref = null; ui(); SFX.duck(false); micUI();
  }
  return {start, stop, toggle, live:() => !!R, on:() => on};
})();
function netLeave(){
  VOICE.stop();
  if(!NET) return;
  try { if(NET.regIv) clearInterval(NET.regIv); if(NET.beaconOff) NET.beaconOff(); } catch(e) {}
  ['lobbyIv','hb','helloIv','watch'].forEach(k => { if(NET[k]) clearInterval(NET[k]); });
  try { if(NET.R) NET.R.leave(); } catch(e) {}
  NET = null;
}

// ===== Điện nước: có 1 công ty thì cắt điện (hoặc nước) 1 ô đất của người khác, ô đó chỉ thu 50% tiền thuê.
// Có cả 2 công ty (Trùm điện nước, có huy hiệu) thì cắt cả điện lẫn nước: ô đó không thu được tiền thuê. CUT_CD vòng 1 lần =====
const CUT_CD = 2, UTIL_X = [4, 10];   // tiền thuê công ty: 1 công ty x4 xúc xắc, đủ 2 công ty x10 (khớp phần hướng dẫn)
const utilKing = p => !!p && p.alive && TILES.every((t,j) => t.k!=='co' || S.owner[j]===p.id);
const utilOwned = p => (!p || !p.alive) ? [] : TILES.map((t,j) => j).filter(j => TILES[j].k==='co' && S.owner[j]===p.id);
const cutWhat = p => utilKing(p) ? 'điện nước' : utilOwned(p).some(j => TILES[j].n.indexOf('Điện')>=0) ? 'điện' : 'nước';
const cutPct = i => { const c = S && S.cut; return (c && c.i===i && cutOn(i)) ? (c.pct || 100) : 0; };
const cutWait = p => p.cutLap==null ? 0 : Math.max(0, CUT_CD - ((p.laps||0) - p.cutLap));
const canCut = p => utilOwned(p).length>0 && cutWait(p)===0;
const cutOn = i => { const c = S && S.cut; if(!c || c.i!==i) return false; const by = S.players[c.by]; return !!by && by.alive && S.owner[i]>=0 && S.owner[i]!==c.by && ((by.laps||0) - c.lap) < CUT_CD; };
const cutOK = (p, i) => TILES[i] && TILES[i].k==='land' && S.owner[i]>=0 && S.owner[i]!==p.id && S.players[S.owner[i]].alive && !mate(p, S.players[S.owner[i]]);
function doCut(p, i){
  if(!canCut(p) || !cutOK(p, i)) return false;
  const pct = utilKing(p) ? 100 : 50, what = cutWhat(p);
  S.cut = {i, by:p.id, lap:p.laps||0, pct, what}; p.cutLap = p.laps||0; quest(p, 'cut', 1);
  const op = S.players[S.owner[i]], eff = pct>=100 ? 'không thu được tiền thuê' : 'chỉ thu được 50% tiền thuê';
  log(`${p.name} cắt ${what} ${TILES[i].n} của ${op.name}: ô này ${eff} trong ${CUT_CD} vòng.`);
  if(!HEADLESS){ cornerNote(op, '🔌', `Bị cắt ${what}`, `${TILES[i].n}<br><small>${pct>=100 ? 'Không thu được tiền thuê' : 'Tiền thuê giảm 50%'}</small>`, 3000); SFX.play('saw'); if(!calm()){ showBubble(op, '😱', true); showBubble(p, '😈', true); } render(); }
  return true;
}
function botCutTarget(p){
  const c = TILES.map((t,i) => i).filter(i => cutOK(p, i)); if(!c.length) return -1;
  return c.sort((a,b) => rentOf(b,7) - rentOf(a,7))[0];
}
// ===== Ông trùm hàng không: đủ 4 sân bay thì dừng ở sân bay của mình được bay tới ô bất kỳ, AIR_CD vòng 1 lần =====
const AIR_CD = 2;   // có 3 sân bay: 2 vòng bay 1 lần; đủ 4: bay mọi lúc
const airKing = p => !!p && p.alive && TILES.every((t,j) => t.k!=='air' || S.owner[j]===p.id);
const airCnt = p => (!!p && p.alive) ? TILES.filter((t,j) => t.k==='air' && S.owner[j]===p.id).length : 0;
const flyWait = p => airKing(p) ? 0 : p.flyLap==null ? 0 : Math.max(0, AIR_CD - ((p.laps||0) - p.flyLap));
const canFly = p => airCnt(p)>=3 && flyWait(p)===0;
function botFlyTarget(p){
  const c = TILES.map((t,i) => i).filter(i => (TILES[i].k==='land' || TILES[i].k==='air' || TILES[i].k==='co') && S.owner[i]<0 && i!==p.pos && priceOf(i) <= p.cash - 80);
  if(!c.length) return -1;
  const sc = i => TILES[i].p + (TILES[i].k==='land' ? 250*groupIdx(TILES[i].g).filter(j => S.owner[j]===p.id).length : 0);
  return c.sort((a,b) => sc(b)-sc(a))[0];
}
function pickTile(p, secs, label, ok, cancel){                  // người chơi chạm một ô trên bàn để chọn
  if(QUIT) return Promise.resolve(-1);
  return new Promise(res => {
    const bd = document.getElementById('board'), st = document.getElementById('stage'); let left = secs, done = false;
    const bar = document.createElement('div'); bar.id = 'pickBar'; bar.innerHTML = `<b>${label || '✈️ Chạm vào ô muốn bay tới'}</b><span id="pickCd">${left}</span><button class="btn">${cancel || 'Không bay'}</button>`;
    st.appendChild(bar); document.body.classList.add('picking'); askOpen = true;
    let unq = () => {};
    const finish = v => { if(done) return; done = true; unq(); clearInterval(iv); bd.removeEventListener('click', onC, true); document.body.classList.remove('picking'); bar.remove(); askOpen = false; res(v); }; unq = onQuit(() => finish(-1));
    const onC = e => { const c = e.target.closest('.cell[data-i]'); if(!c) return; e.preventDefault(); e.stopPropagation(); const k = +c.dataset.i; if(ok ? !ok(k) : k===p.pos){ SFX.play('warn'); return; } SFX.play('click'); finish(k); };
    bd.addEventListener('click', onC, true);
    bar.querySelector('button').onclick = () => finish(-1);
    const iv = setInterval(() => { left--; const e = document.getElementById('pickCd'); if(e) e.textContent = Math.max(0,left); if(left<=0) finish(-1); }, 1000);
  });
}
async function airFly(p, dice){
  if(!canFly(p)) return;
  let to = -1;
  if(!HEADLESS && !p.bot && !p.remote && p.id===S.viewer){
    const c = await ask('✈️ Hãng bay riêng', `<p class="bn">Bay tới ô bất kỳ. ${airKing(p) ? 'Đủ 4 sân bay: bay bao nhiêu lần cũng được.' : `Dùng xong chờ ${AIR_CD} vòng.`}</p>`, [{k:'y', label:'Chọn ô để bay', primary:true}, {k:'n', label:'Không bay'}]);
    if(c==='y') to = await pickTile(p, DECIDE);
  } else to = botFlyTarget(p);
  if(to==null || to<0 || to===p.pos || !TILES[to]) return;
  p.flyLap = p.laps||0;
  log(`${p.name} dùng hãng bay riêng, bay thẳng tới ${TILES[to].n}.`);
  if(!HEADLESS){ cornerNote(p, '✈️', 'Hãng bay riêng', `Bay tới ${TILES[to].n}`, 2400); SFX.play('go'); }
  p.pos = to; render(); if(!HEADLESS) await sleep(450);
  await land(p, dice);
}
async function land(p, dice, opt={}){
  const i = p.pos, t = TILES[i];
  render(); fxLight(i, true, p.color); SFX.play('land', 0, S && p.id===S.viewer ? 1 : .9); SFX.tile(t.n); if(!HEADLESS) setTimeout(camReset, 900);
  if(t.k==='land' || t.k==='air' || t.k==='co'){
    const o = S.owner[i];
    if(o<0){
      const price = priceOf(i), can = p.cash >= price, rivals = alive().filter(q => q.id!==p.id);
      let c;
      if(S.rules.weekly==='allbid') c = 'allbid';
      else if(p.bot){
        const iq = botIQ(), mineG = t.k==='land' ? groupIdx(t.g).filter(j => S.owner[j]===p.id).length : 0, keep = iq<=1 ? 150 : (iq>=3 && mineG>0) ? 0 : 80;
        if(iq>=2 && mineG>0 && p.cash < price && price - p.cash <= (iq>=3 ? 250 : 150) && botLoan(p, price - p.cash, `để mua ${t.n}`, price)){ botTalk(p, 'loan'); }
        c = (p.cash >= price && p.cash - price >= keep) ? 'buy' : (rivals.length ? 'auction' : 'skip'); if(c==='buy' && iq<=1 && Math.random() < .25) c = rivals.length ? 'auction' : 'skip';   // v139: máy Dễ đôi khi bỏ qua đất tốt
        if(c==='buy') botTalk(p, 'buy');
      }
      else {
        for(;;){
          const ok = p.cash >= price, lack = price - p.cash, opts = [];
          if(ok) opts.push({k:'buy',label:`💵 Mua ${price}${price!==t.p?' (đang sốt đất)':''}`,primary:true});
          else opts.push({k:'loan',label:`🏦 Vay ${lack} để mua`,primary:true});
          if(rivals.length) opts.push({k:'auction',label:'Mở đấu giá kín'});
          opts.push({k:'skip',label:'Bỏ qua'});
          if(S && S.tutm && window.TUTM) window.TUTM.ev('buy');
          c = await ask(ok ? '' : 'Chưa đủ tiền mua',
            buyInfo(i) + `<p class="buycash">${ok ? `Mua xong còn <b>${p.cash-price}</b>` : `Có <b>${p.cash}</b>, thiếu <b>${lack}</b>`}</p>`, opts);
          if(c!=='loan') break;
          // chọn vay ngân hàng (thế chấp nhà) hay vay xã hội; vay được thì mua luôn, không thì quay lại hỏi tiếp
          if(await offerLoan(p, lack, `Vay ${lack} để mua ${t.n}`, 'Thôi, không vay', null, price) && p.cash >= price){ c = 'buy'; break; }
        }
      }
      if(c==='buy'){ p.cash -= price; S.owner[i] = p.id; quest(p, 'buy', 1); log(`${p.name} mua ${t.n} với giá ${price}.`); if(!HEADLESS) cornerNote(p, '🏠', 'Mua đất', `${esc(t.n)}<br><small>Giá ${price}</small>`); czMood(p,'joy',2200); checkCombo(p, i); }
      else if(c==='allbid') await auction(p, i, true);
      else if(c==='auction') await auction(p, i);
      else { log(`${p.name} bỏ qua ${t.n}.`); if(!p.bot) S.passed = {pid:p.id, i, turn:S.turns}; else if(!HEADLESS) cornerNote(p, '🚶', 'Bỏ qua', `${esc(t.n)}<br><small>Không mua</small>`); }
    } else if(o!==p.id && mate(p, S.players[o])){ log(`${p.name} ghé ${t.n} của đồng đội ${S.players[o].name}, không mất tiền thuê.`); if(!HEADLESS) cornerNote(p, '🤝', 'Đất đồng đội', `${esc(t.n)}<br><small>Không mất tiền thuê</small>`);
    } else if(o!==p.id && cutPct(i)>=100){ log(`${t.n} đang bị cắt điện nước, ${p.name} không phải trả tiền thuê.`); if(!HEADLESS) cornerNote(p, '🔌', 'Mất điện nước', `${t.n}<br><small>Không mất tiền thuê</small>`, 2400);
    } else if(o!==p.id){
      const wanted = leaderId()===p.id;
      const op = S.players[o]; let r = rentOf(i, dice); if(opt.double) r*=2; r = Math.round(r*(1-PV.cam*pk(p,'cam'))); const nbCut = nbOn(p) && op.bot && r>0; if(nbCut) r = Math.round(r*NB_RENT);   // v141: tân thủ giảm 20% tiền thuê trả cho máy
      if(p.umb===2){ r = 0; p.umb = 0; log(`${p.name} vừa ăn phở no nê, được miễn tiền thuê lần này.`); } else if(p.umb){ r = Math.ceil(r/2); p.umb = 0; log(`${p.name} che ô dù, tiền thuê lần này giảm một nửa.`); }
      if(p.freeRent){ p.freeRent = 0; log(`${p.name} dùng lượt miễn tiền thuê ở ${t.n}.`); if(!HEADLESS) cornerNote(p, '🎫', 'Miễn tiền thuê', `${esc(t.n)} của ${esc(op.name)}`); }
      else { log(`${p.name} trả ${r} tiền thuê ${t.n} cho ${op.name}${held(op)?' (chủ đang bị giam, thu một nửa)':''}.`); if(!HEADLESS && r>0) cornerNote(p, '💸', 'Trả tiền thuê', `${esc(t.n)}: −${r}<br><small>cho ${esc(op.name)}${nbCut ? ' · 🍀 tân thủ −20%' : ''}${held(op) ? ' (chủ đang bị giam, thu nửa)' : ''}</small>`); if(r>=80) react(op,'💰',.5); quest(op, 'rent', r); if(r>0){ if(!p.bot) if(S && S.tutm && window.TUTM) window.TUTM.ev('rent'); else if(!op.bot) if(S && S.tutm && window.TUTM) window.TUTM.ev('rentIn'); } if(!p.bot) p.tutRent = 1; await pay(p, r, op);
        if(wanted && op.alive && r>0){ const bn = Math.round(r*.5); gain(op, bn); log(`${op.name} nhận thưởng truy nã ${bn} vì thu được tiền của người dẫn đầu.`); } }
    } else if(t.k==='land') await offerBuild(p, i);
  }
  else if(t.k==='tax'){
    if(perk(p,'xl')){ log(`${p.name} được miễn Thuế thu nhập nhờ huy hiệu Trung tâm tài chính.`); if(!HEADLESS) cornerNote(p, '💼', 'Thuế thu nhập', 'Được miễn nhờ huy hiệu'); }
    else { const rate = pk(p,'xl') ? 5 : 10, x = Math.round(p.cash*rate/100); log(`${p.name} nộp thuế thu nhập ${x} (${rate}% tiền mặt).`); if(!p.bot) if(S && S.tutm && window.TUTM) window.TUTM.ev('tax'); if(!HEADLESS) cornerNote(p, '🧾', 'Thuế thu nhập', `−${x}<br><small>${rate}% tiền mặt, vào Quỹ</small>`); await pay(p, x, 'fund'); }
  }
  else if(t.k==='grave'){ log(`${p.name} bước vào Nghĩa trang, bị ma hù và mất 200.`); if(!HEADLESS) cornerNote(p, '👻', 'Nghĩa trang', 'Bị ma hù: −200'); await pay(p, 200, 'fund'); }
  else if(t.k==='chance' || t.k==='fortune') await drawCard(p, t.k, dice);
  else if(S.mode==='rank' && t.k==='visit') await rkArena(p);
  else if(S.mode==='rank' && t.k==='park') await rkMarket(p);
  else if(S.mode==='rank' && t.k==='gotojail'){ const fine = Math.min(200, Math.round(p.cash*.1/10)*10); if(fine>0){ log(`${p.name} sa vào Ngục tối, bị tịch thu ${fine}.`); await pay(p, fine, 'fund'); } if(p.alive) goJail(p); if(!HEADLESS) cornerNote(p, '💀', 'Ngục tối', fine ? `Mất ${fine} và bị giam` : 'Bị giam', 2400); }
  else if(t.k==='gotojail') goJail(p);
  else if(t.k==='island') await islandLand(p);
  else if(t.k==='startup'){
    if(p.startup>0) log(`${p.name} đã có công ty khởi nghiệp trị giá ${p.startup}.`);
    else {
      const can = SU_OPTS.filter(x => p.cash >= x);
      let pick = 0;
      if(can.length){
        if(p.bot) pick = p.cash >= 750 ? 300 : p.cash >= 480 ? 200 : p.cash >= 260 ? 100 : 0;
        else { const c = await ask('🚀 Gọi vốn mạo hiểm', COMIC.startup(),
            can.map((x,n) => ({k:'s'+x, label:'Rót ' + x, primary:n===can.length-1})).concat([{k:'n', label:'Không đầu tư'}])); pick = /^s\d+$/.test(String(c)) ? +String(c).slice(1) : 0; }
      } else log(`${p.name} không đủ 100 để gọi vốn Khởi nghiệp.`);
      if(pick){ quest(p, 'startup', 1); p.cash -= pick; p.startup = pick; p.su0 = pick; log(`${p.name} rót ${pick} mở công ty khởi nghiệp.`); if(!HEADLESS) cornerNote(p, '🚀', 'Khởi nghiệp', `Rót vốn ${pick}`, 2200); }
    }
  }
  else if(t.k==='fund'){                                     // Hũ vàng: gieo ra đôi nổ hũ (tối đa JACKPOT_MAX), không thì nhận 15%
    const [a,b] = roll2(); if(!HEADLESS) await showDice(a,b);
    if(a===b){ quest(p, 'jackpot', 1); const x = Math.min(S.fund, JACKPOT_MAX); S.fund -= x; gain(p, x); log(`${p.name} gieo đôi ${a} ở Quỹ phúc lợi: NỔ HŨ, ăn ${x}${S.fund ? ` (tối đa ${JACKPOT_MAX}, quỹ còn ${S.fund})` : ''}!`); if(!HEADLESS && x>0) bigMoment(`${p.name} nổ hũ ${x}!`, '#F4C542', '💰'); }
    else { const x = Math.round(S.fund*0.15); S.fund -= x; gain(p, x); log(`${p.name} gieo ${a} và ${b} ở Quỹ phúc lợi, không ra đôi nên nhận ${x} (15% quỹ).`); }
  }
  else if(t.k==='gift') await gift(p, dice);
  if(p.alive && t.k==='air' && p.pos===i && S.owner[i]===p.id) await airFly(p, dice);
  render();
}

// Thông báo nhỏ cạnh avatar người chơi ở các góc (đấu giá mình không tham gia, thẻ Cơ hội/Khí vận của người khác)
/* v134: thông báo góc. Thời gian hiện = 1,5 giây + 40 ms mỗi ký tự (ít nhất 2,4 giây), nhân theo nhịp game.
   Mỗi góc xếp hàng, thông báo sau chờ thông báo trước xong (không đè mất); chạm vào để tắt sớm. Ván với máy chờ đọc xong mới sang lượt kế (waitNotes). */
const NOTEQ = {}, NOTECUR = {};
const noteEnd = () => Math.max(0, ...Object.keys(NOTEQ).map(k => (NOTECUR[k] ? NOTECUR[k].end : Date.now()) + NOTEQ[k].reduce((a,x) => a + x.t, 0)));
function cornerNote(p, ico, title, text, ms){
  if(HEADLESS || !p || !S) return; const st = document.getElementById('stage'); if(!st) return;
  const seat = seatPos(p.id), q = NOTEQ[seat] || (NOTEQ[seat] = []);
  const len = (String(title) + ' ' + String(text).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').length;
  const t = Math.round(Math.max(ms || 0, 2400, 1500 + len*40) * noteK());
  q.push({ico, title, text, t, c:p.color}); if(q.length > 4) q.splice(0, q.length - 4);   // không để dồn quá 4 thông báo chờ ở một góc
  if(!NOTECUR[seat]) noteNext(seat);
}
function noteNext(seat){
  const st = document.getElementById('stage'), q = NOTEQ[seat] || []; NOTECUR[seat] = null;
  if(!st || !q.length) return; const it = q.shift();
  st.querySelectorAll('.cnote.q' + seat).forEach(e => e.remove());
  const e = document.createElement('div'); e.className = 'cnote q' + seat; e.style.setProperty('--c', it.c);
  e.innerHTML = `<i>${it.ico}</i><span><b>${esc(it.title)}</b>${it.text}</span>`; st.appendChild(e);
  const cur = NOTECUR[seat] = {e, end:Date.now() + it.t, t1:null, t2:null};
  const done = () => { if(NOTECUR[seat]!==cur) return; clearTimeout(cur.t1); clearTimeout(cur.t2); e.classList.add('out'); setTimeout(() => e.remove(), 300); NOTECUR[seat] = null; noteNext(seat); };
  cur.t1 = setTimeout(() => e.classList.add('out'), it.t - 300); cur.t2 = setTimeout(done, it.t);
  e.addEventListener('pointerdown', ev => { ev.stopPropagation(); cur.end = Date.now(); done(); });
}
async function waitNotes(cap){   // chờ các thông báo đang hiện đọc gần xong (chừa 0,4 giây cuối), tối đa cap ms; ván online không chờ
  if(HEADLESS || NET || QUIT || ffNow()) return; const until = Math.min(noteEnd() - 400, Date.now() + (cap || 7000));
  while(Date.now() < until && !QUIT){ await new Promise(r => setTimeout(r, 120)); await waitPause(); }
}
const notifyBig = text => { if(S && S.players[S.cur]) cornerNote(S.players[S.cur], '🔨', 'Đấu giá', esc(text), 2800); };
function bidDialog(tn, floor, cash, maxPay, secs, rnd){
  if(S && S.tutm && window.TUTM) window.TUTM.ev('bid');
  return new Promise(res => {
    askOpen = true;
    const body = `<div class="stats s3"><div><small>Giá sàn</small><b>${floor}</b></div><div><small>Tiền mặt</small><b>${cash}</b></div><div><small>Trả được tối đa</small><b>${maxPay}</b></div></div>
      <div class="bidrow"><button class="chip" data-d="-50" aria-label="Giảm 50">−50</button><button class="chip" data-d="-10" aria-label="Giảm 10">−10</button>
        <input class="inp" id="bidIn" type="${SOFTKB ? 'text' : 'number'}" ${SOFTKB ? 'readonly inputmode="none"' : 'inputmode="numeric"'} min="${floor}" max="${maxPay}" step="10" value="${Math.min(floor, maxPay)}" aria-label="Giá muốn trả">
        <button class="chip" data-d="10" aria-label="Tăng 10">+10</button><button class="chip" data-d="50" aria-label="Tăng 50">+50</button><button class="chip" data-d="100" aria-label="Tăng 100">+100</button></div>
      <p id="bidErr" class="bidmsg"></p>
      <p class="cd">Còn <b id="cdn">${secs}</b> giây</p><div class="bar"><i style="animation-duration:${secs}s"></i></div>
      ${badgeHint(TILES.findIndex(x => x.n===tn), true)}`;
    let stop = () => {};
    let unq = () => {};
    const done = v => { unq(); stop(); askAbort = null; askOpen = false; closeModal(); res(v); };
    askAbort = () => { stop(); askAbort = null; askOpen = false; closeModal(); };
    openModal(`Đấu giá ${tn}` + (rnd>1 ? ` (vòng ${rnd})` : ''), (rnd>1 ? '<p class="bn">Đang hòa giá cao nhất. Trả cao hơn hoặc bỏ qua.</p>' : '') + body, [
      {label:'Chốt giá', primary:true, fn: () => {
        const v = Math.floor(+document.getElementById('bidIn').value);
        if(!(v>=floor)){ hint(`Giá thấp nhất là ${floor}.`, true); return; }
        if(v > maxPay){ hint(`Bạn chỉ trả được tối đa ${maxPay} (tiền mặt cộng số còn vay được).`, true); return; }
        done(v); }},
      {label:'Bỏ qua', fn: () => done(0)}], 'bid');
    { const bh = document.querySelector('#mBody .bh'), mo = document.getElementById('mOpts'); if(bh && mo) mo.prepend(bh); }
    // nút Chốt giá làm đồng hồ: màu đậm rút dần từ phải sang trái tới khi hết giờ, bỏ dòng đếm giây và thanh chạy
    { const mb = document.getElementById('mBody'); mb.querySelectorAll('.cd, .bar').forEach(e => { e.style.display = 'none'; });
      const pb = document.querySelector('#mOpts .btn.primary, #mOpts button.primary'); if(pb){ pb.classList.add('cdbtn'); pb.style.setProperty('--secs', secs + 's'); } }   // app: khung huy hiệu sang cột phải, trên nút Chốt giá
    const inp = document.getElementById('bidIn'), msg = document.getElementById('bidErr');
    const hint = (text, warn) => { msg.textContent = text; msg.classList.toggle('warn', !!warn); };
    const check = () => { const v = Math.floor(+inp.value);
      if(v > maxPay) hint(`Vượt mức bạn trả được (${maxPay}).`, true);
      else if(v > cash) hint(`Cao hơn tiền mặt: nếu thắng bạn sẽ cần vay ${v - cash}.`, true);
      else hint('Giá kín. Ai trả cao nhất thì thắng.', false); };
    document.querySelectorAll('.bidrow .chip').forEach(b => b.onclick = () => { const old = Math.floor(+inp.value)||floor, nv = Math.min(maxPay, Math.max(floor, old + (+b.dataset.d))); inp.value = nv; SFX.play('click'); inp.classList.remove('bump'); void inp.offsetWidth; inp.classList.add('bump');
      if(nv===old) hint(+b.dataset.d > 0 ? `Đã tới mức tối đa bạn trả được (${maxPay}).` : `Đã ở giá sàn (${floor}).`, true); else check(); });
    inp.oninput = check; check(); inp.focus(); inp.select();
    stop = countdown(secs, () => done(0)); unq = onQuit(() => done(0));
  });
}
function askBid(q, i, fl2, rnd){
  if(HEADLESS || QUIT) return Promise.resolve(0);
  const t = TILES[i], floor = fl2 || priceOf(i), maxPay = q.cash + voluntaryRoom(q);
  if(maxPay < floor){
    if(rnd>1 || (netHost() && q.remote)) return Promise.resolve(0);
    if(!q.bot && q.id===S.viewer){ cornerNote(q, '🔨', 'Đấu giá', `Chưa đủ tiền tham gia ${esc(t.n)}`, 2600); return Promise.resolve(0); }
    return ask(`Đấu giá ${t.n}`, `<div class="stats"><div><small>Giá sàn</small><b>${floor}</b></div><div><small>${esc(q.name)} trả được tối đa</small><b>${maxPay}</b></div></div><p class="bn">Chưa đủ tiền để tham gia phiên này.</p>`, [{k:0, label:'Đã hiểu', primary:true}], 8, q.id);
  }
  if(netHost() && q.remote) return remoteAsk(q, {kind:'bid', name:t.n, floor, cash:q.cash, maxPay, secs:BID_SECS}, BID_SECS);
  return bidDialog(t.n, floor, q.cash, maxPay, BID_SECS, rnd);
}
async function auction(p, i, all, bank){
  const t = TILES[i], fl = bank ? tileValue(i) : priceOf(i), n = S.players.length, bidders = [];
  for(let k=all?0:1;k<n;k++){ const q = S.players[(p.id+k)%n]; if(q.alive && (!q.bot || q.cash>=fl)) bidders.push(q); }
  if(!bidders.length){ log(`Không ai tham gia đấu giá ${t.n}.`); return; }
  log(bank ? `Ngân hàng đem ${t.n}${S.level[i] ? ' (' + LV[S.level[i]] + ')' : ''} ra đấu giá kín theo giá thị trường ${fl}. Tiền bán về ngân hàng.` : `${p.name} mở đấu giá kín ${t.n}, giá khởi điểm ${fl}.`);
  const humans = bidders.filter(q => !q.bot).length, bids = [];
  if(!HEADLESS && !bidders.some(q => !q.bot && q.id===S.viewer)) cornerNote(p, '🔨', 'Đấu giá', `${esc(t.n)}<br>Giá sàn ${fl}`, 2600);
  for(const q of bidders){
    let bid = 0;
    if(q.bot){
      let v = fl*(0.85+Math.random()*0.45);
      if(t.k==='land' && groupIdx(t.g).filter(j=>j!==i).every(j=>S.owner[j]===q.id)) v = fl*1.6;
      bid = Math.min(q.cash-40, Math.round(v/10)*10); if(bid<fl) bid = 0;
    } else {
      if(humans>1 && !NET) await ask(`Tới lượt ${q.name} nhập giá`, 'Đưa máy cho người này. Những người khác vui lòng không nhìn màn hình.', [{k:'ok',label:`Tôi là ${q.name}`,primary:true}]);
      bid = await askBid(q, i, bank ? fl : undefined);
    }
    bids.push({q, bid});
  }
  let top = bids.filter(b => b.bid>=fl).sort((a,b) => b.bid-a.bid)[0];
  // hòa giá cao nhất: những người hòa đấu tiếp, mỗi vòng phải trả cao hơn, cho tới khi còn đúng một người dẫn đầu
  if(top){
    let tied = bids.filter(b => b.bid===top.bid), rnd = 1;
    while(tied.length>1){
      rnd++; const bt = tied[0].bid, nf = bt + 10, nb = [];
      log(`${tied.map(b => b.q.name).join(' và ')} cùng trả ${bt} cho ${t.n}, đấu tiếp vòng ${rnd}.`);
      if(!HEADLESS) notifyBig(`Hòa giá ${bt}! ${tied.map(b => b.q.name).join(', ')} đấu tiếp vòng ${rnd}`);
      for(const b of tied){
        const q = b.q; let bid = 0;
        if(q.bot){ const cap = Math.min(q.cash-40, Math.round(bt*(1.05+Math.random()*.3)/10)*10); bid = (cap>=nf && Math.random()<.75) ? cap : 0; }
        else { if(humans>1 && !NET) await ask(`Tới lượt ${q.name} nhập giá`, 'Đưa máy cho người này. Những người khác vui lòng không nhìn màn hình.', [{k:'ok',label:`Tôi là ${q.name}`,primary:true}]); bid = await askBid(q, i, nf, rnd); }
        nb.push({b, bid});
      }
      const hi = Math.max(...nb.map(x => x.bid));
      if(hi < nf){ top = tied[Math.floor(Math.random()*tied.length)]; log(`Không ai trả cao hơn ${bt}, bốc thăm: ${top.q.name} thắng ${t.n}.`); break; }
      nb.forEach(x => { if(x.bid>0) x.b.bid = x.bid; });
      tied = nb.filter(x => x.bid===hi).map(x => x.b); top = tied[0];
    }
  }
  log(`Giá đấu ${t.n}: ` + bids.map(b => `${b.q.name} ${b.bid||'không tham gia'}`).join(', ') + '.');
  const fee = (top && !all && !bank) ? Math.round(top.bid*0.1) : 0;
  if(!HEADLESS && S.players.some(x => !x.bot) && humans===0 && !bidders.some(q => q.id===S.viewer)){
    cornerNote(top ? top.q : p, top ? '🎉' : '🔨', top ? 'Thắng đấu giá' : 'Đấu giá', top ? `${esc(t.n)}<br>Giá ${top.bid}` : `${esc(t.n)}<br>Không ai trả giá`, 3000); await sleep(1900);
  } else if(!HEADLESS && S.players.some(x => !x.bot)){
    await ask(`Đấu giá ${t.n}`, top ? `<div class="aucres"><span>🏆</span><div><b>${esc(top.q.name)}</b> thắng<br><strong>${top.bid}</strong>${fee ? `<small>${esc(p.name)} nhận hoa hồng ${fee}</small>` : ''}</div></div>` : `<div class="aucres none"><span>🔨</span><div><b>Không ai mua</b></div></div>`, [{k:'ok',label:'Tiếp tục',primary:true}], DECIDE, 'all');
  }
  if(!top){ log(`Không ai trả giá, ${t.n} vẫn chưa có chủ.`); return; }
  // người thắng thiếu tiền thì vay; không vay thì hủy mua, không bao giờ bị phá sản vì đấu giá
  while(top.q.cash < top.bid){
    const ok = await offerLoan(top.q, top.bid - top.q.cash, `Thiếu ${top.bid - top.q.cash} để trả giá đấu`, 'Hủy mua', undefined);
    if(!ok){ log(`${top.q.name} thắng đấu giá ${t.n} nhưng không trả đủ ${top.bid} nên hủy mua. ${t.n} vẫn chưa có chủ.`); return; }
  }
  top.q.cash -= top.bid;
  S.owner[i] = top.q.id; quest(top.q, 'auction', 1); czMood(top.q,'joy',2200); if(fee) gain(p, fee, top.q.pos); react(top.q,'🎉',.7);
  log(`${top.q.name} thắng đấu giá ${t.n} với giá ${top.bid}.` + (fee ? ` ${p.name} nhận hoa hồng ${fee}.` : ''));
  checkCombo(top.q, i);
}

async function islandLand(p){
  p.island = 4; p.extra = false; quest(p, 'island', 1); fxEmote(p, 'cry', 300);
  const others = alive().filter(q => q.id!==p.id && !held(q));
  let c;
  const fee = hongFee(p,100), free = fee===0;
  if(p.bot){ const iq = botIQ(); c = iq<=1 ? ((free || p.cash>=200) ? 'pay' : 'stay') : iq>=3 ? (others.length && !free && p.cash<500 ? 'drag' : (free || p.cash>=fee ? 'pay' : 'stay')) : ((free || p.cash>=300) ? 'pay' : (others.length ? 'drag' : 'stay')); if(c==='drag') botTalk(p, 'drag', true); }
  else {
    const opts = [];
    if(free) opts.push({k:'pay',label:'Rời đảo miễn phí',sub:'Huy hiệu Đường đèo',primary:true}); else if(p.cash>=fee) opts.push({k:'pay',label:`💵 Nộp ${fee} để đi`,primary:true});
    if(others.length) opts.push({k:'drag',label:'🤝 Kéo 1 người vào',sub:'Mỗi người giam 2 lượt'});
    opts.push({k:'stay',label:'Chịu giam 4 lượt'});
    if(S && S.tutm && window.TUTM) window.TUTM.ev('island');
    c = await ask('🏝️ Đảo hoang: giam 4 lượt','<p class="bn">Đang giam chỉ thu nửa tiền thuê.</p>',opts);
  }
  if(c==='pay'){ if(!free) await pay(p,fee,'fund'); p.island = 0; log(free ? `${p.name} rời Đảo hoang miễn phí nhờ huy hiệu Đường đèo.` : `${p.name} nộp ${fee} để rời Đảo hoang.`); }
  else if(c==='drag'){
    let q;
    if(p.bot) q = others.slice().sort((a,b)=>netWorth(b)-netWorth(a))[0];
    else { const k = await ask('Kéo ai ra Đảo hoang?','<p class="bn">Hai người cùng giam 2 lượt.</p>', others.map(o=>({k:o.id,label:o.name,sub:`Đang ở ${TILES[o.pos].n}`}))); q = S.players[k]; }
    { const rideFrom = q.pos; q.pos = ISLAND; SFX.play('isle'); policeRide(q, rideFrom, ISLAND); fxEmote(q, 'mad', rideFrom===ISLAND ? 300 : 2150); } quest(q, 'island', 1); q.island = 2; p.island = 2; q.extra = false;
    log(`${p.name} kéo ${q.name} vào Đảo hoang, mỗi người bị giam 2 lượt.`);
    render(); await islandNotice(p, q);
  } else log(`${p.name} bị giam ở Đảo hoang 4 lượt.`);
}

const ISLAND_SVG = `<svg viewBox="0 0 320 190" role="img" aria-label="Hòn đảo hoang xơ xác">
  <defs><linearGradient id="isky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#222B36"/><stop offset="1" stop-color="#5D6873"/></linearGradient>
  <linearGradient id="isea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#35596B"/><stop offset="1" stop-color="#1E3542"/></linearGradient></defs>
  <rect width="320" height="190" fill="url(#isky)"/>
  <circle cx="262" cy="38" r="15" fill="#C9CED3" opacity=".35"/>
  <g class="icloud" fill="#3A4450"><ellipse cx="70" cy="34" rx="46" ry="13"/><ellipse cx="104" cy="26" rx="30" ry="11"/><ellipse cx="236" cy="52" rx="40" ry="11"/></g>
  <rect y="118" width="320" height="72" fill="url(#isea)"/>
  <g class="iland">
    <ellipse cx="160" cy="141" rx="92" ry="9" fill="#14242D" opacity=".55"/>
    <path d="M70 140 Q100 108 160 106 Q222 108 250 140 Z" fill="#A8946B"/>
    <path d="M70 140 Q100 122 160 121 Q222 122 250 140 Z" fill="#8C7A55"/>
    <path d="M196 124 l10 -9 l9 4 l5 9 z" fill="#5C6670"/><path d="M96 130 l7 -7 l8 5 l2 6 z" fill="#4A5560"/>
    <g class="ipalm">
      <path d="M150 122 Q146 92 158 62" fill="none" stroke="#5B4630" stroke-width="6" stroke-linecap="round"/>
      <path d="M158 62 Q138 56 124 72" fill="none" stroke="#6E6A3C" stroke-width="4" stroke-linecap="round"/>
      <path d="M158 62 Q176 50 196 66" fill="none" stroke="#6E6A3C" stroke-width="4" stroke-linecap="round"/>
      <path d="M158 62 Q168 78 164 96" fill="none" stroke="#7A6436" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M158 62 Q146 72 140 92" fill="none" stroke="#7A6436" stroke-width="3" stroke-linecap="round"/>
    </g>
    <path d="M212 132 l22 -4 M216 136 l20 -3" stroke="#6B5237" stroke-width="3" stroke-linecap="round"/>
    <text x="118" y="136" font-size="9" font-weight="700" fill="#5E5138" font-family="inherit">SOS</text>
  </g>
  <g class="iwave" fill="none" stroke="#7FA4B6" stroke-width="2" stroke-linecap="round" opacity=".7">
    <path d="M-20 152 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>
    <path d="M-10 170 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" opacity=".6"/>
  </g></svg>`;
function islandNotice(p, q){
  if(HEADLESS) return Promise.resolve();
  if(netHost()){ netEmit('ev', {k:'isle', p:p.id, q:q.id}); if(q.remote) return Promise.resolve(); }
  return new Promise(res => {
    askOpen = true;
    const ov = document.createElement('div'); ov.id = 'islandFx';
    ov.innerHTML = `<div class="isl"><div class="iscene">${ISLAND_SVG}</div><div class="itext"><h3>${esc(q.name)} bị kéo ra Đảo hoang</h3>
      <p>${esc(p.name)} đã kéo ${esc(q.name)} ra đảo cùng. Mỗi người bị giam 2 lượt, nộp 100 để rời đảo sớm.</p><div class="iact"></div></div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));
    if(!calm()) showBubble(q, '😡', true);
    let stop = () => {}, closed = false;
    const finish = () => { if(closed) return; closed = true; stop(); ov.classList.remove('on'); setTimeout(() => { ov.remove(); askOpen = false; res(); }, 220); };
    const act = ov.querySelector('.iact');
    if(q.bot && p.bot){ setTimeout(finish, 2600); return; }
    act.innerHTML = `<button class="btn primary" style="width:100%">Đã hiểu</button><p class="cd">Tự đóng sau <b id="cdn">${DECIDE}</b> giây</p>`;
    const b = act.querySelector('button'); b.onclick = finish; b.focus(); stop = countdown(DECIDE, finish);
  });
}
async function gift(p, dice){
  const r = rnd(6);
  if(r===0){ gain(p, 50); log(`${p.name} mở Hộp quà: nhận 50.`); }
  else if(r===1){ p.extra = true; log(`${p.name} mở Hộp quà: được đi thêm lượt.`); }
  else if(r===2){ p.freeRent = 1; log(`${p.name} mở Hộp quà: miễn tiền thuê lần kế tiếp.`); }
  else if(r===3){ log(`${p.name} mở Hộp quà: bay tới sân bay gần nhất.`); await advanceTo(p, nearestAir(p.pos), dice); }
  else if(r===4){
    const others = alive().filter(q => q.id!==p.id && !held(q));
    if(!others.length){ gain(p, 50); log(`${p.name} mở Hộp quà: nhận 50.`); return; }
    let q;
    if(p.bot) q = others[rnd(others.length)];
    else { const k = await ask('🎁 Đổi chỗ với ai?','', others.map(o=>({k:o.id,label:o.name,sub:`Đang ở ${TILES[o.pos].n}`}))); q = S.players[k]; }
    [p.pos, q.pos] = [q.pos, p.pos]; log(`${p.name} mở Hộp quà: đổi chỗ với ${q.name}.`);
  }
  else { log(`${p.name} mở Hộp quà: mất 30.`); await pay(p, 30, 'fund'); }
}

const money = (name, x) => ({n:name, d:(x>0?`Nhận ${x}`:`Trả ${-x}`), g:x>0?1:0, f: async p => { if(x>0) gain(p, x); else await pay(p,-x,'fund'); }});
// ===== 80 thẻ Cơ hội + 80 thẻ Khí vận. Mỗi ván chỉ bốc ngẫu nhiên POOL_N thẻ mỗi xấp (nửa may, nửa xui) nên các ván không trùng nhau =====
const POOL_N = 24;
const CK = {
  others: p => alive().filter(q => q.id!==p.id),
  rich: () => alive().slice().sort((a,b) => b.cash-a.cash)[0],
  poor: () => alive().slice().sort((a,b) => a.cash-b.cash)[0],
  ti: n => TILES.findIndex(t => t.n===n), tk: k => TILES.findIndex(t => t.k===k),
  back: async (p,d,k) => { p.pos = (p.pos-k+N)%N; await land(p,d); },
  fwd: async (p,d,k) => { await move(p,k); if(p.alive) await land(p,d); },
  go: async (p,d,i) => { if(i>=0) await advanceTo(p,i,d); },
  eachPay: async (p,x) => { for(const q of CK.others(p)) if(p.alive) await pay(p,x,q); },
  eachGive: async (p,x) => { for(const q of CK.others(p)) await pay(q,x,p); },
  roll: async () => { const r = roll2(); if(!HEADLESS) await showDice(r[0], r[1]); return r; },
  up: p => { const L = owned(p).filter(i => TILES[i].k==='land' && S.level[i]<3).sort((a,b) => TILES[b].p-TILES[a].p); if(!L.length){ gain(p,50); return; } S.level[L[0]]++; log(`${TILES[L[0]].n} của ${p.name} được nâng lên ${LV[S.level[L[0]]]} miễn phí.`); },
  down: async (p, any) => { const L = owned(p).filter(i => TILES[i].k==='land' && S.level[i]>0).sort((a,b) => TILES[a].p-TILES[b].p); if(!L.length){ await pay(p,30,'fund'); return; } const k = any ? L[Math.floor(Math.random()*L.length)] : L[0]; S.level[k]--; log(`${TILES[k].n} của ${p.name} tụt xuống ${LV[S.level[k]]}.`); },
  swap: (p,q) => { if(!q || q.id===p.id || held(q)) { gain(p,30); return; } const t = p.pos; p.pos = q.pos; q.pos = t; log(`${p.name} đổi chỗ với ${q.name}.`); },
  free: async (p,d) => { for(let s=1;s<N;s++){ const i=(p.pos+s)%N; if(TILES[i].k==='land' && S.owner[i]<0){ await advanceTo(p,i,d); return; } } gain(p,50); },
  air: async (p,d) => { const A = TILES.map((t,i) => i).filter(i => TILES[i].k==='air'); let k = nearestAir(p.pos);
    if(!p.bot && !HEADLESS){ const c = await ask('✈️ Săn vé 0 đồng', '<p>Chọn sân bay muốn bay tới.</p>', A.map(i => ({k:i, label:TILES[i].n}))); if(A.includes(+c)) k = +c; }
    await advanceTo(p,k,d); },
  su: async (p,f,alt) => { if(p.startup>0){ const v = p.startup; p.startup = Math.max(1, Math.round(v*f)); log(`Công ty khởi nghiệp của ${p.name}: ${v} thành ${p.startup}.`); } else if(alt>0) gain(p,alt); else await pay(p,-alt,'fund'); },
  rnd: (a,b) => a + Math.floor(Math.random()*(b-a+1))
};
const C = (g,n,d,f) => ({n,d,g,f});
const CARDS = {
  chance: [
    money('Trúng thầu căng tin trường',150),
    money('Bán được lô đất view nghĩa trang',120),
    money('Livestream chốt đơn cháy máy',100),
    money('Người yêu cũ trả nợ',80),
    money('Bán hết chậu cây cảnh mùa giãn cách',60),
    money('Nhặt được ví, trả lại, được hậu tạ',50),
    money('Bán áo mưa đúng lúc trời đổ mưa',70),
    money('Trúng gói thầu lát lại vỉa hè',130),
    money('Quay top top được triệu view',90),
    money('Khách sộp boa tiền',40),
    money('Bán được căn hộ full nội thất... tường',110),
    money('Mở quán nhậu đối diện phòng gym',85),
    money('Ngân hàng chuyển nhầm, khỏi trả lại',200),
    money('Giải cứu nông sản lãi to',75),
    money('Tuyển được thực tập sinh giỏi',45),
    {n:'Kỳ lân gọi tên', d:'Công ty khởi nghiệp x2 giá trị, chưa có thì nhận 50', g:1, f: async p => CK.su(p,2,50)},
    {n:'Sếp đi công tác', d:'Được gieo thêm 1 lượt', g:1, f: async p => { p.extra = true; }},
    {n:'Khởi động dự án mới', d:'Tới Xuất phát, nhận 200', g:1, f: async (p,d) => advanceTo(p,0,d)},
    {n:'Săn được vé 0 đồng', d:'Bay tới sân bay bạn chọn', g:1, f: async (p,d) => CK.air(p,d)},
    {n:'Đặt xe công nghệ', d:'Tiến 5 ô', g:1, f: async (p,d) => CK.fwd(p,d,5)},
    {n:'Sếp cho đi nhờ xe', d:'Tiến 3 ô', g:1, f: async (p,d) => CK.fwd(p,d,3)},
    {n:'Đi tắt qua ngõ', d:'Tiến 7 ô', g:1, f: async (p,d) => CK.fwd(p,d,7)},
    {n:'Xe ôm đi đường tắt', d:'Tới ô đất chưa có chủ gần nhất', g:1, f: async (p,d) => CK.free(p,d)},
    {n:'Du lịch Hạ Long', d:'Tới Hạ Long', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Hạ Long'))},
    {n:'Khai trương chi nhánh', d:'Tới Hoàn Kiếm', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Hoàn Kiếm'))},
    {n:'Bắt được taxi giờ cao điểm', d:'Tới Bến Thành', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Bến Thành'))},
    {n:'Nghỉ mát công ty', d:'Tới Nha Trang', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Nha Trang'))},
    {n:'Đi săn mây', d:'Tới Sa Pa', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Sa Pa'))},
    {n:'Thử vận hũ vàng', d:'Tới ô Quỹ phúc lợi', g:1, f: async (p,d) => CK.go(p,d,CK.tk('fund'))},
    {n:'Ý tưởng triệu đô', d:'Tới ô Khởi nghiệp', g:1, f: async (p,d) => CK.go(p,d,CK.tk('startup'))},
    {n:'Luật sư giỏi', d:'Giữ thẻ Ra tù', g:1, f: async p => { p.card++; }},
    {n:'Chia quỹ', d:'Nhận một nửa Quỹ', g:1, f: async p => { const x = Math.round(S.fund/2); S.fund -= x; gain(p,x); }},
    {n:'Ngân hàng tài trợ', d:'Quỹ được bơm thêm 100', g:1, f: async p => { S.fund = Math.min(FUND_MAX, S.fund + 100); }},
    {n:'Thợ xây nhiệt tình', d:'Nâng miễn phí 1 cấp nhà, chưa có đất thì nhận 50', g:1, f: async p => CK.up(p)},
    {n:'Thu hụi', d:'Mỗi người khác nộp bạn 30', g:1, f: async p => CK.eachGive(p,30)},
    {n:'Hợp đồng độc quyền', d:'Mỗi người khác nộp bạn 20', g:1, f: async p => CK.eachGive(p,20)},
    {n:'Chủ nhà đi vắng', d:'Lần trả thuê kế tiếp được miễn', g:1, f: async p => { p.umb = 2; }},
    {n:'Được tặng voucher', d:'Lần trả thuê kế tiếp chỉ trả một nửa', g:1, f: async p => { p.umb = Math.max(p.umb||0, 1); }},
    {n:'Cho thuê chỗ bán trà đá', d:'Nhận 15 cho mỗi ô đất bạn có', g:1, f: async p => gain(p, 15*owned(p).filter(i => TILES[i].k==='land').length)},
    {n:'Đổi vận', d:'Đổi chỗ quân cờ với người giàu nhất', g:1, f: async p => CK.swap(p, CK.others(p).sort((a,b) => b.cash-a.cash)[0])},
    money('Bị phạt nguội',-30),
    money('Chơi tiền ảo theo lời bạn thân',-80),
    money('Mua khóa học làm giàu không khó',-60),
    money('Đặt nhầm 100 ly trà sữa',-50),
    money('Bị khách bom hàng',-40),
    money('Mua nhầm cổ phiếu công ty ma',-90),
    money('Sửa chiếc xe đắp chiếu',-70),
    money('Bị giữ xe vì đỗ sai chỗ',-45),
    money('Thuê KOL quảng cáo, KOL dính phốt',-65),
    money('Mổ trĩ',-35),
    {n:'Thổi nồng độ cồn', d:'Trả 100 và mất lượt kế tiếp', g:0, f: async p => { await pay(p,100,'fund'); if(p.alive) p.skip++; }},
    {n:'Kẹt xe giờ tan tầm', d:'Lùi 3 ô', g:0, f: async (p,d) => CK.back(p,d,3)},
    {n:'Bản đồ chỉ vào ngõ cụt', d:'Lùi 2 ô', g:0, f: async (p,d) => CK.back(p,d,2)},
    {n:'Xe hết xăng giữa cầu', d:'Lùi 4 ô', g:0, f: async (p,d) => CK.back(p,d,4)},
    {n:'Ngủ quên trên xe buýt', d:'Tới ô Công viên', g:0, f: async (p,d) => CK.go(p,d,CK.tk('park'))},
    {n:'Bị kéo đi teambuilding', d:'Tới Vườn thú', g:0, f: async (p,d) => CK.go(p,d,CK.tk('visit'))},
    {n:'Đi công tác hộ sếp', d:'Tới Cà Mau', g:0, f: async (p,d) => CK.go(p,d,CK.ti('Cà Mau'))},
    {n:'Lỡ chuyến tàu', d:'Tới Đảo hoang', g:0, f: async (p,d) => advanceTo(p,ISLAND,d)},
    {n:'Khai man thuế', d:'Vào tù', g:0, f: async p => { if(perk(p,'xl')){ log(`${p.name} được miễn thuế nhờ huy hiệu Trung tâm tài chính, không bị bắt vào tù.`); if(!HEADLESS) cornerNote(p, '💼', 'Miễn thuế', 'Không bị vào tù'); return; } goJail(p); }},
    {n:'Chuyến bay gấp', d:'Tới sân bay gần nhất, có chủ thì trả thuê gấp đôi', g:0, f: async (p,d) => advanceTo(p,nearestAir(p.pos),d,{double:true})},
    {n:'Bảo trì tòa nhà', d:'Trả 5% tổng giá đất và nhà', g:0, f: async p => pay(p, assetValue(p)*0.05*(1-pk(p,'xn')), 'fund')},
    {n:'Sập sàn', d:'Công ty khởi nghiệp mất nửa giá trị, chưa có thì trả 30', g:0, f: async p => CK.su(p,.5,-30)},
    {n:'Mừng cưới bạn thân', d:'Trả 20 cho mỗi người khác', g:0, f: async p => CK.eachPay(p,20)},
    {n:'Bao ăn để xin lỗi', d:'Trả 15 cho mỗi người khác', g:0, f: async p => CK.eachPay(p,15)},
    {n:'Bạn thân vay, mai trả', d:'Đưa 50 cho người nghèo nhất', g:0, f: async p => { const q = CK.others(p).sort((a,b) => a.cash-b.cash)[0]; if(q) await pay(p,50,q); }},
    {n:'Bị đối thủ hớt tay trên', d:'Đưa 40 cho người giàu nhất', g:0, f: async p => { const q = CK.others(p).sort((a,b) => b.cash-a.cash)[0]; if(q) await pay(p,40,q); }},
    {n:'Mưa ngập tới yên xe', d:'Mất lượt kế tiếp', g:0, f: async p => { p.skip++; }},
    {n:'Họp phụ huynh đúng giờ ký hợp đồng', d:'Mất lượt kế tiếp', g:0, f: async p => { p.skip++; }},
    {n:'Thuế tăng đột xuất', d:'Trả 15% tiền mặt', g:0, f: async p => { if(perk(p,'xl')){ log(`${p.name} được miễn thuế nhờ huy hiệu Trung tâm tài chính.`); if(!HEADLESS) cornerNote(p, '💼', 'Miễn thuế', 'Không phải trả'); return; } await pay(p, p.cash*0.15*(pk(p,'xl') ? .5 : 1), 'fund'); }},
    {n:'Cháy hàng, mà là cháy thật', d:'Trả 15% tiền mặt', g:0, f: async p => pay(p, p.cash*0.15, 'fund')},
    {n:'Nhà xuống cấp', d:'Một ô ngẫu nhiên của bạn tụt 1 cấp nhà, chưa có nhà thì trả 30', g:0, f: async p => CK.down(p, true)},
    {n:'Mất ví', d:'Mất 1 thẻ Ra tù, không có thì trả 20', g:0, f: async p => { if(p.card>0) p.card--; else await pay(p,20,'fund'); }},
    {n:'Lãi mẹ đẻ lãi con', d:'Trả 20 cho mỗi khoản nợ, không nợ thì nhận 20', g:0, f: async p => { if(p.loans.length) await pay(p, 20*p.loans.length, 'fund'); else gain(p,20); }},
    {n:'Tung đồng xu với ngân hàng', d:'Một nửa cơ hội nhận 150, một nửa trả 100', g:0, hx:1, f: async p => { if(Math.random()<.5) gain(p,150); else await pay(p,100,'fund'); }},
    {n:'Vé số chiều nay', d:'Gieo xúc xắc: ra đôi nhận 300, không thì trả 20', g:1, hx:1, f: async p => { const r = await CK.roll(); if(r[0]===r[1]) gain(p,300); else await pay(p,20,'fund'); }},
    {n:'Cá cược với sếp', d:'Gieo xúc xắc: tổng chẵn nhận 100, lẻ trả 100', g:0, hx:1, f: async p => { const r = await CK.roll(); if((r[0]+r[1])%2===0) gain(p,100); else await pay(p,100,'fund'); }},
    {n:'Hộp mù hàng hiệu', d:'Ngẫu nhiên từ mất 50 tới nhận 150', g:1, hx:1, f: async p => { const x = CK.rnd(-50,150); log(`Hộp mù của ${p.name}: ${x>=0 ? 'nhận ' + x : 'mất ' + (-x)}.`); if(x>=0) gain(p,x); else await pay(p,-x,'fund'); }},
    {n:'Dịch chuyển tức thời', d:'Bay tới một ô ngẫu nhiên', g:0, hx:1, f: async (p,d) => advanceTo(p, (p.pos + CK.rnd(1,N-1)) % N, d)},
    {n:'Gọi vốn cá mập', d:'Gieo xúc xắc: từ 8 trở lên nhận 180, còn lại trả 40', g:1, hx:1, f: async p => { const r = await CK.roll(); if(r[0]+r[1]>=8) gain(p,180); else await pay(p,40,'fund'); }}
  ],
  fortune: [
    money('Thừa kế từ ông chú chưa gặp bao giờ',150),
    money('Lương tháng 13',100),
    money('Cổ phiếu tăng giá',100),
    money('Trúng xe máy tiệc tất niên',80),
    money('Ăn bám người yêu cũ',60),
    money('Được hoàn thuế',50),
    money('Tìm thấy tiền trong túi áo cũ',50),
    money('Mẹ cho tiền tiêu vặt dù đã 30 tuổi',40),
    money('Thắng giải chạy bộ phong trào',20),
    money('Bốc trúng phong bao to nhất',120),
    money('Được mời trà sữa',30),
    money('Bà ngoại dúi tiền vào tay',70),
    money('Hoàn tiền bảo hiểm',90),
    money('Cho thuê xe máy cũ',45),
    money('Bán đồ cũ lên mạng',55),
    money('Nhịn cà phê cả tháng',35),
    money('Gặp lại bạn cũ nay làm sếp',110),
    money('Mèo hoang mang lộc về nhà',65),
    {n:'Lì xì Tết', d:'Mỗi người khác tặng bạn 20', g:1, f: async p => CK.eachGive(p,20)},
    {n:'Sinh nhật', d:'Mỗi người khác tặng bạn 10', g:1, f: async p => CK.eachGive(p,10)},
    {n:'Thắng cá độ bóng đá', d:'Mỗi người khác nộp bạn 15', g:1, f: async p => CK.eachGive(p,15)},
    {n:'Cho thuê phòng trống', d:'Nhận 15 cho mỗi ô đất bạn có', g:1, f: async p => gain(p, 15*owned(p).filter(i => TILES[i].k==='land').length)},
    {n:'Vợ giữ tiền giùm', d:'Nhận thêm 10% tiền mặt đang có', g:1, f: async p => gain(p, Math.round(p.cash*.1))},
    {n:'Mèo thần tài vẫy tay', d:'Gieo xúc xắc, nhận 10 lần tổng điểm', g:0, hx:1, f: async p => { const r = await CK.roll(); gain(p, 10*(r[0]+r[1])); }},
    {n:'Trời thương', d:'Đang nghèo nhất thì nhận 150, không thì nhận 30', g:1, f: async p => gain(p, CK.poor().id===p.id ? 150 : 30)},
    {n:'Cả làng góp gạo', d:'Tiền mặt dưới 100 thì nhận 200, không thì nhận 20', g:1, f: async p => gain(p, p.cash<100 ? 200 : 20)},
    {n:'Thầy bói phán trúng', d:'Rút thêm 1 thẻ Cơ hội', g:1, f: async (p,d) => drawCard(p,'chance',d)},
    {n:'Quý nhân phù trợ', d:'Lần trả thuê kế tiếp chỉ trả một nửa', g:1, f: async p => { p.umb = Math.max(p.umb||0, 1); }},
    {n:'Xin được vía', d:'Lần trả thuê kế tiếp được miễn', g:1, f: async p => { p.umb = 2; }},
    {n:'Bước chân phải ra đường', d:'Được gieo thêm 1 lượt', g:1, f: async p => { p.extra = true; }},
    {n:'Song hỷ', d:'Nhận 50 và được gieo thêm 1 lượt', g:1, f: async p => { gain(p,50); p.extra = true; }},
    {n:'Được bảo lãnh', d:'Giữ thẻ Ra tù', g:1, f: async p => { p.card++; }},
    {n:'Hàng xóm tốt bụng', d:'Người ít tiền nhất nhận 50', g:1, f: async p => gain(CK.poor(), 50)},
    {n:'Mưa thuận gió hòa', d:'Tất cả mọi người nhận 30', g:1, f: async p => { for(const q of alive()) gain(q,30); }},
    {n:'Phong thủy tốt', d:'Nâng miễn phí 1 cấp nhà, chưa có đất thì nhận 50', g:1, f: async p => CK.up(p)},
    {n:'Nghỉ lễ dài', d:'Tới Đà Lạt', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Đà Lạt'))},
    {n:'Về quê ăn Tết', d:'Tới Xuất phát, nhận 200', g:1, f: async (p,d) => advanceTo(p,0,d)},
    {n:'Trúng vé du lịch', d:'Tới Hội An', g:1, f: async (p,d) => CK.go(p,d,CK.ti('Hội An'))},
    {n:'Tìm được đường tắt', d:'Tiến 4 ô', g:1, f: async (p,d) => CK.fwd(p,d,4)},
    money('Đóng tiền học lại',-100),
    money('Một tuần ba đám cưới',-90),
    money('Rơi điện thoại xuống hồ Gươm',-70),
    money('Ăn buffet quên mang ví',-60),
    money('Quẹt app hẹn hò dính đảo lửa',-50),
    money('Bơm vếu',-50),
    money('Thú cưng cắn nát sofa',-40),
    money('Hỏng điều hòa giữa hè',-60),
    money('Mất xe đạp',-35),
    money('Sâu răng đi viện',-80),
    money('Công ty quỵt lương',-45),
    money('Bị đa cấp dụ mua hàng',-55),
    money('Quên tắt bếp cháy nhà hàng xóm',-75),
    money('Đá bóng vấp cỏ què chân',-30),
    {n:'Bị lừa qua mạng', d:'Trả 15% tiền mặt', g:0, f: async p => pay(p, p.cash*0.15, 'fund')},
    {n:'Trộm viếng', d:'Mất 15% tiền mặt', g:0, f: async p => pay(p, p.cash*0.15, 'fund')},
    {n:'Phí quản lý tòa nhà', d:'Trả 5% tổng giá đất và nhà', g:0, f: async p => pay(p, assetValue(p)*0.05*(1-pk(p,'xn')), 'fund')},
    {n:'Bị hàng xóm câu trộm điện', d:'Trả 10 cho mỗi ô đất bạn có cho người ngẫu nhiên khác', g:0, f: async p => { const o = CK.others(p), q = o[Math.floor(Math.random()*o.length)], x = 10*owned(p).filter(i => TILES[i].k==='land').length; if(q && x) await pay(p, x, q); }},
    {n:'Mừng tân gia', d:'Trả 20 cho mỗi người khác', g:0, f: async p => CK.eachPay(p,20)},
    {n:'Bao cả nhóm đi karaoke', d:'Trả 15 cho mỗi người khác', g:0, f: async p => CK.eachPay(p,15)},
    {n:'Khao lên chức', d:'Trả 25 cho mỗi người khác', g:0, f: async p => CK.eachPay(p,25)},
    {n:'Nghiệp quật', d:'Đang giàu nhất thì trả 100, không thì trả 20', g:0, f: async p => pay(p, CK.rich().id===p.id ? 100 : 20, 'fund')},
    {n:'Của đi thay người', d:'Đang giàu nhất thì chia 30 cho mỗi người, không thì nhận 30', g:0, f: async p => { if(CK.rich().id===p.id) await CK.eachPay(p,30); else gain(p,30); }},
    {n:'Bão về', d:'Mọi người, kể cả bạn, nộp 20 vào Quỹ', g:0, f: async p => { for(const q of alive()) await pay(q,20,'fund'); }},
    {n:'Sao quả tạ chiếu', d:'Mất lượt kế tiếp', g:0, f: async p => { p.skip++; }},
    {n:'Ngủ nướng', d:'Mất lượt kế tiếp', g:0, f: async p => { p.skip++; }},
    {n:'Bước hụt ổ gà', d:'Lùi 1 ô', g:0, f: async (p,d) => CK.back(p,d,1)},
    {n:'Xe thủng lốp', d:'Lùi 2 ô', g:0, f: async (p,d) => CK.back(p,d,2)},
    {n:'Bán hàng rong lấn vỉa hè', d:'Vào tù', g:0, f: async p => goJail(p)},
    {n:'Cãi nhau với hàng xóm vì karaoke', d:'Vào tù', g:0, f: async p => goJail(p)},
    {n:'Say nắng gái xinh bị lừa ra đảo', d:'Tới Đảo hoang nghỉ dưỡng', g:0, f: async (p,d) => advanceTo(p,ISLAND,d)},
    {n:'Bị gọi lên phường', d:'Tới ô Thuế gần nhất', g:0, f: async (p,d) => { for(let s=1;s<N;s++){ const i=(p.pos+s)%N; if(TILES[i].k==='tax'){ await advanceTo(p,i,d); return; } } }},
    {n:'Bị kéo đi xem mắt', d:'Tới ô Công viên', g:0, f: async (p,d) => CK.go(p,d,CK.tk('park'))},
    {n:'Nhà dột', d:'Một ô của bạn tụt 1 cấp nhà, chưa có nhà thì trả 30', g:0, f: async p => CK.down(p)},
    {n:'Lạc đường', d:'Đổi chỗ quân cờ với một người ngẫu nhiên', g:0, f: async p => { const o = CK.others(p); CK.swap(p, o[Math.floor(Math.random()*o.length)]); }},
    {n:'Nhà dính quy hoạch', d:'Giảm cấp ngẫu nhiên 1 nhà hoặc được đền bù 15% nếu chỉ có đất', g:0, f: async p => { const B = owned(p).filter(i => TILES[i].k==='land' && S.level[i]>0); if(B.length) await CK.down(p, true); else { const v = Math.round(assetValue(p)*.15); if(v>0){ gain(p, v); log(`${p.name} được đền bù quy hoạch ${v}.`); } } }},
    {n:'Xổ số kiến thiết', d:'Gieo xúc xắc: từ 9 trở lên nhận 200, còn lại trả 30', g:1, hx:1, f: async p => { const r = await CK.roll(); if(r[0]+r[1]>=9) gain(p,200); else await pay(p,30,'fund'); }},
    {n:'Bốc thăm may mắn', d:'Nhận ngẫu nhiên từ 10 đến 200', g:0, hx:1, f: async p => { const x = CK.rnd(10,200); log(`${p.name} bốc thăm được ${x}.`); gain(p,x); }},
    {n:'Tung đồng xu', d:'Một nửa cơ hội nhận 80, một nửa trả 80', g:1, hx:1, f: async p => { if(Math.random()<.5) gain(p,80); else await pay(p,80,'fund'); }},
    {n:'Xin xăm đầu năm', d:'Gieo xúc xắc: ra đôi được thẻ Ra tù và 100, không thì trả 15', g:0, hx:1, f: async p => { const r = await CK.roll(); if(r[0]===r[1]){ p.card++; gain(p,100); } else await pay(p,15,'fund'); }}
  ]
};
function pickPool(kind){   // mỗi ván: nửa thẻ may, nửa thẻ xui, bốc ngẫu nhiên từ 80 thẻ
  const idx = CARDS[kind].map((c,i) => i), g = shuffle(idx.filter(i => CARDS[kind][i].g)), b = shuffle(idx.filter(i => !CARDS[kind][i].g)), h = POOL_N/2;
  return g.slice(0,h).concat(b.slice(0,h));
}
async function drawCard(p, kind, dice){
  const deck = S.decks[kind];
  S.pool = S.pool || {}; if(!Array.isArray(S.pool[kind]) || !S.pool[kind].length){ S.pool[kind] = pickPool(kind); deck.length = 0; }
  if(!deck.length) deck.push(...shuffle(S.pool[kind].slice()));
  if(nbOn(p) && Math.random() < .5){ const j = deck.map(x => CARDS[kind][x]).map((x,k) => x && x.g ? k : -1).filter(k => k>=0).pop(); if(j!=null && j>=0) deck.push(deck.splice(j, 1)[0]); }   // v141: tân thủ rút thẻ may nhiều hơn
  const c = CARDS[kind][deck.pop()] || CARDS[kind][0];
  log(`${p.name} rút thẻ ${kind==='chance'?'Cơ hội':'Khí vận'}: ${c.n}. ${c.d}.`); quest(p, 'card', 1);
  await showCard(p, kind, c);
  const c0 = p.cash, h0 = (p.jail>0) + (p.island>0) + (p.skip||0);
  await c.f(p, dice);
  if(!HEADLESS && p.alive && !calm()){                         // nhân vật mừng rỡ hoặc mếu máo theo kết quả thật
    const dlt = p.cash - c0, worse = (p.jail>0) + (p.island>0) + (p.skip||0) > h0;
    const lucky = c.hx ? (dlt>0 && !worse) : !!c.g, E = lucky ? ['😆','🤑','🥳','😎','💃'] : ['😭','😱','🥲','💸','🤡'];
    showBubble(p, E[Math.floor(Math.random()*E.length)], true); SFX.play(lucky ? 'coin' : 'cry');
  }
}

function showCard(p, kind, c){
  if(HEADLESS || QUIT) return Promise.resolve();
  if(netHost()) netEmit('ev', {k:'card', pid:p.id, kind, n:c.n, d:c.d});
  SFX.play('card');
  const auto = p.bot || (netHost() && p.remote);
  if(auto && p.id!=null && S && p.id!==S.viewer){ const ch0 = kind==='chance'; cornerNote(p, c.hx ? '🎲' : c.g ? '🥳' : '😭', ch0 ? 'Cơ hội' : 'Khí vận', `${c.n}<br><small>${c.d}.</small>`, 3600); return waitNotes(9000); }
  return new Promise(res => {
    askOpen = true;
    const rkc = S && S.mode==='rank', ch = kind==='chance', dk = rkc ? (ch ? '#B4281E' : '#2C4A8C') : ch ? '#EE8A62' : '#86BC82', nm = ch ? 'Cơ hội' : 'Khí vận', ic = rkc ? (ch ? '⚔️' : '🛡️') : ch ? '❓' : '🍀';
    const ov = document.createElement('div'); ov.id = 'cardFx'; if(rkc) ov.classList.add('rk'); ov.style.setProperty('--dk', dk);
    ov.innerHTML = rkc ? `<div class="flyc"><div class="cf"><div class="hd">${nm}</div><div class="cic rkci">${RKCARD(ch, 'p').replace('viewBox="0 0 70 100"', 'viewBox="11 14 48 58"')}</div><h4>${c.n}</h4><p>${c.d}.</p><div class="who">${esc(p.name)} rút thẻ này</div></div><div class="cb rkcb">${RKCARD(ch, 'q')}</div></div><div class="cardact"></div>`
      : `<div class="flyc"><div class="cf"><div class="hd">${nm}</div><div class="cic">${ic}</div><h4>${c.n}</h4><p>${c.d}.</p><div class="who">${esc(p.name)} rút thẻ này</div></div><div class="cb">${ic}</div></div><div class="cardact"></div>`;
    document.body.appendChild(ov);
    const card = ov.querySelector('.flyc'), act = ov.querySelector('.cardact'), deck = document.getElementById(ch ? 'deckC' : 'deckK');
    const cr = card.getBoundingClientRect(); let dx = 0, dy = 140, s0 = .25;
    if(deck){ const d = deck.getBoundingClientRect(); dx = d.left+d.width/2-(cr.left+cr.width/2); dy = d.top+d.height/2-(cr.top+cr.height/2); s0 = Math.min(d.width,d.height)/Math.min(cr.width,cr.height); if(isRot()) [dx,dy] = [dy,-dx]; }
    requestAnimationFrame(() => ov.classList.add('on'));
    let stop = () => {}, closed = false;
    let unq = () => {};
    const finish = () => { unq();
      if(closed) return; closed = true; stop(); ov.classList.remove('on');
      if(card.animate) card.animate([{opacity:1},{opacity:0}], {duration:180, fill:'forwards'});
      act.innerHTML = '';
      setTimeout(() => { ov.remove(); askOpen = false; res(); }, 200);
    };
    const mood = () => {
      const tone = c.hx ? 'hx' : c.g ? 'good' : 'bad'; ov.classList.add(tone);
      const Q = tone==='good' ? ['Số hưởng!','Ăn mừng thôi!','Giàu tới nơi rồi!','Trời độ!','Lộc lá đầy nhà!'] : tone==='bad' ? ['Đen thôi, đỏ quên đi!','Tiền ơi ở lại!','Xui tận mạng!','Khóc một dòng sông!','Ví ơi, vĩnh biệt!'] : ['Hên xui nha!','Nín thở nào!','Được ăn cả, ngã về không!'];
      const q = document.createElement('div'); q.className = 'cquip'; q.textContent = Q[Math.floor(Math.random()*Q.length)]; ov.appendChild(q);
      SFX.play(tone==='good' ? 'win' : tone==='bad' ? 'lose' : 'dice');
      if(calm()) return;
      const box = document.createElement('div'); box.className = 'cmood';
      const E = tone==='good' ? ['🎉','💰','✨','🤑','🪙','🎊'] : tone==='bad' ? ['💧','😭','💸','💧','🥀','💧'] : ['🎲','❓','🍀','💫'];
      let h = tone==='bad' ? '<b class="ccloud">🌧️</b>' : '';
      for(let k=0;k<18;k++) h += `<i style="left:${(4+Math.random()*92).toFixed(1)}%;--d:${(Math.random()*1.3).toFixed(2)}s;--t:${(1.9+Math.random()*1.6).toFixed(2)}s;--r:${Math.round(-200+Math.random()*400)}deg;font-size:${Math.round(18+Math.random()*16)}px">${E[k%E.length]}</i>`;
      box.innerHTML = h; ov.insertBefore(box, ov.firstChild);
    };
    const after = () => {
      mood();
      if(auto){ setTimeout(finish, 2000); return; }
      act.innerHTML = `<button class="btn primary">Tiếp tục</button><p class="cd">Tự tiếp tục sau <b id="cdn">${DECIDE}</b> giây</p>`;
      const b = act.querySelector('button'); b.onclick = finish; b.focus(); stop = countdown(DECIDE, finish);
    };
    unq = onQuit(finish);
    if(calm() || !card.animate){ after(); return; }
    card.animate([
      {transform:`translate(${dx}px,${dy}px) scale(${s0}) rotateY(180deg)`, offset:0, easing:'cubic-bezier(.2,.7,.3,1)'},
      {transform:`translate(${dx*.45}px,${dy*.45-50}px) scale(${(s0+1)/2}) rotateY(180deg)`, offset:.42, easing:'cubic-bezier(.4,0,.2,1)'},
      {transform:'translate(0px,0px) scale(1.06) rotateY(0deg)', offset:.88, easing:'ease-out'},
      {transform:'translate(0px,0px) scale(1) rotateY(0deg)', offset:1}
    ], {duration:1000, fill:'both'}).finished.then(after).catch(after);
  });
}
function build(p, i){
  const t = TILES[i], c = buildCost(p, i); p.cash -= c; S.level[i] = nextLv(S.level[i]); S.upLap[i] = p.laps; quest(p, 'build', 1); if(S.level[i]===3){ quest(p, 'tower', 1); bigMoment(`${p.name} xây cao ốc ở ${TILES[i].n}!`, p.color, '🏙️', true); if(!HEADLESS) setTimeout(() => SFX.play('hotel'), 1050); }
  log(`${p.name} nâng ${t.n} lên ${LV[S.level[i]]} (tốn ${c}).`); fxBuild(i); czMood(p,'joy',2200);
}
// ----- mô hình trên ô cạnh: máy bay ở sân bay, cỏ bốn lá ở Khí vận, hộp quà ở Cơ hội
const PLANE_COL = [['#F2683A','#FFFFFF','#F2683A'], ['#2B3348','#3A4258','#E0483A'], ['#3B82C4','#FFFFFF','#3B82C4'], ['#3FA66B','#FFFFFF','#F4C542']];
function tileModel(kind, v, ori, flip, LEN){
  if(kind==='tax') return taxBag3D();
  if(kind==='air' && TSX.plane) return plane3D(TSX.plane, v, ori, flip);
  if(kind==='spark') return deco3D('su', TSX.su || 'A');
  if(kind==='fundm') return deco3D('fu', TSX.fu || 'A');
  if(kind==='startup') return cafe3D(ori, LEN);
  if(kind==='grave') return grave3D(ori, LEN);
  if(kind==='volcano'){             // Xếp hạng: núi lửa phun trào thay cho Đảo hoang
    const sc = isoScene(), X = ori!=='y', E = 10, L = (LEN || 44) - E, W = 16, vv = t => flip ? L-t : t, va = vv(0), vb = vv(L+E), v0 = Math.min(va,vb), v1 = Math.max(va,vb), vm = (va+vb)/2;
    const Q = (v,b,z) => X ? sc.P(v,b,z) : sc.P(b,v,z);
    sc.box(X ? {x:v0,y:0,z:0,w:v1-v0,d:W,h:1.4,c:['#4A3434','#3A2828','#2E2020']} : {x:0,y:v0,z:0,w:W,d:v1-v0,h:1.4,c:['#4A3434','#2E2020','#3A2828']}, -10);
    const o = Q(vm, W/2, 1.4), x = o[0], y = o[1], H = 17, R2 = 12;
    const lava = `M${x-1.5} ${y-H+1.5}q-2 5 -5 7.5q-1.5 3.5 -3.5 5.5M${x+1.5} ${y-H+1.5}q1.5 5 4.5 8q2 3 3 5M${x} ${y-H+2}q.6 6 -.6 10`;
    sc.raw(40, `<ellipse cx="${x}" cy="${y}" rx="${R2+2}" ry="7" fill="#2A1A1A" opacity=".5" stroke="none"/>
      <path d="M${x-R2} ${y}Q${x-11} ${y-10} ${x-5} ${y-H}L${x+5} ${y-H}Q${x+11} ${y-10} ${x+R2} ${y}Q${x} ${y+6} ${x-R2} ${y}Z" fill="#3B2B2B"/>
      <path d="M${x} ${y-H}L${x+5} ${y-H}Q${x+11} ${y-10} ${x+R2} ${y}Q${x+9} ${y+4.6} ${x} ${y+5}Z" fill="#2A1E1E" stroke="none"/>
      <path class="rklv" d="${lava}" fill="none" stroke="#FF5A1F" stroke-width="1.8" stroke-linecap="round"/><path d="${lava}" fill="none" stroke="#FFD23F" stroke-width=".7" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="${x}" cy="${y-H}" rx="3.4" ry="1.3" fill="#FF8A2B" stroke="#7A1E0A" stroke-width=".7"/><ellipse class="rkcrater" cx="${x}" cy="${y-H}" rx="6" ry="2.6" fill="#FF5A1F" opacity=".4" stroke="none"/>
      <g class="rkerupt">${[[-2,-5,1.1],[1.5,-7,1],[0,-9,.9],[3,-4,.9],[-3.5,-8,.8],[1,-11,.8]].map(q => `<circle cx="${x+q[0]}" cy="${y-H+q[1]}" r="${q[2]}" fill="#FFB020" stroke="#7A1E0A" stroke-width=".4"/>`).join('')}<path d="M${x-2.5} ${y-H}q2.5-9 5 0" fill="#FF5A1F" opacity=".85" stroke="none"/></g>
      <g class="rksmoke">${[[0,-9,2.6,0],[2,-13,3.2,1],[-1,-17,3.8,2]].map(q => `<circle style="--d:${q[3]}s" cx="${x+q[0]}" cy="${y-H+q[1]}" r="${q[2]}" fill="#8A8A9A" opacity=".5" stroke="none"/>`).join('')}</g>`, [[x-R2-3, y-H-22],[x+R2+3, y+7]]);
    return sc.out(X ? [vm, W/2, 0] : [W/2, vm, 0]);
  }
  const sc = isoScene(), C3 = c => [c, shade(c,.85), shade(c,.7)];
  if(kind==='air'){
    const X = ori!=='y', col = PLANE_COL[v % 4], LEN = 22;
    const bx = (a,b,z,la,lb,h,c) => { const a2 = flip ? LEN-a-la : a; return X ? {x:a2,y:b,z,w:la,d:lb,h,c} : {x:b,y:a2,z,w:lb,d:la,h,c:[c[0],c[2],c[1]]}; };
    const boxes = [bx(2,5,2,16,3,3,[col[1],col[0],shade(col[0],.8)]), bx(18,5.6,2.4,2.6,1.8,2,C3(col[0])), bx(2,6.1,5,3.2,.8,4.2,C3(col[2])), bx(9,0,2.8,3.6,13,.7,C3('#DCE3EC')), bx(2,3.4,4.2,2,6.2,.5,C3('#DCE3EC')), bx(9.6,2.4,1.3,2.6,1.5,1.5,C3(col[2])), bx(9.6,9.1,1.3,2.6,1.5,1.5,C3(col[2]))];
    boxes.sort((a,b) => (a.x+a.w/2+a.y+a.d/2+a.z*.01)-(b.x+b.w/2+b.y+b.d/2+b.z*.01));
    const pts = []; boxes.forEach(b => { [[b.x,b.y,b.z],[b.x+b.w,b.y+b.d,b.z],[b.x,b.y,b.z+b.h],[b.x+b.w,b.y+b.d,b.z+b.h],[b.x+b.w,b.y,b.z+b.h],[b.x,b.y+b.d,b.z]].forEach(p => pts.push(isoP(p[0],p[1],p[2]))); });
    const ctr = X ? sc.P(11,6.5,0) : sc.P(6.5,11,0), dir = (flip ? -1 : 1), ux = (X ? .866 : -.866)*dir, uy = .5*dir;
    sc.raw(-5, `<ellipse cx="${ctr[0]}" cy="${ctr[1]}" rx="11" ry="4.2" fill="rgba(43,58,103,.2)" stroke="none"/>`, [[ctr[0]-11,ctr[1]-4],[ctr[0]+11,ctr[1]+4]]);
    sc.raw(10, `<g class="plane" style="--px:${(ux*70).toFixed(1)}px;--py:${(uy*70).toFixed(1)}px">${boxes.map(isoBox).join('')}</g>`, pts);
    return sc.out(X ? [11,6.5,0] : [6.5,11,0]);
  }
  if(kind==='island'){            // đảo cát giữa biển phủ kín ô và lấn ra viền cỏ phía ngoài: dừa, lều, đá, sóng dồn dập, mây giông có sét và mưa
    const X = ori!=='y', E = 10, L = (LEN || 44) - E, W = 16, I = 0, SH = 6, vv = t => flip ? L-t : t, va = vv(-I), vb = vv(L+E), v0 = Math.min(va,vb), v1 = Math.max(va,vb), vm = (va+vb)/2;
    const Q = (v,b,z) => X ? sc.P(v,b,z) : sc.P(b,v,z), P = (v,b,z) => Q(v,b,z).join(',');
    const bx = (v,b,z,lv,lb,h,c,key) => sc.box(X ? {x:v,y:b,z,w:lv,d:lb,h,c} : {x:b,y:v,z,w:lb,d:lv,h,c:[c[0],c[2],c[1]]}, key);
    const out = t => flip ? L - t : t;                    // t tính từ mép trong của ô ra phía ngoài
    bx(v0,0,0,v1-v0,W,1.4,['#5FB4E0','#3F93C4','#3583B2'],-10);
    const ring = (m, k) => `<polygon class="wave" style="--k:${k}" points="${P(v0+m,m,1.45)} ${P(v1-m,m,1.45)} ${P(v1-m,W-m,1.45)} ${P(v0+m,W-m,1.45)}" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    sc.raw(-5, ring(.8,0) + ring(2.3,1) + ring(3.8,2));
    bx(Math.min(out(9+SH),out(24+SH)),4,1.4,15,8,1.3,['#F3DFA2','#D9B978','#C7A566'],5);
    const palm = (t, b, hh, k) => { const a = Q(out(t),b,2.7), x = a[0], y = a[1]; let lv = ''; [-70,-30,10,50,90,130].forEach(d => { const r = d*Math.PI/180, ex = x+Math.cos(r)*7+(k?1:-1), ey = y-hh+Math.sin(r)*3-1; lv += `<path d="M${x} ${y-hh}Q${((x+ex)/2).toFixed(1)} ${(y-hh-3.4).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="#3F9A45" stroke-width="2.6" stroke-linecap="round"/><path d="M${x} ${y-hh}Q${((x+ex)/2).toFixed(1)} ${(y-hh-3.4).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="#7ED06A" stroke-width="1.2" stroke-linecap="round"/>`; });
      sc.raw((X ? out(t)+b : b+out(t))+.5, `<g class="swayw2"><path d="M${x} ${y}q${k?2:-2} ${-hh/2} 0 ${-hh}" fill="none" stroke="#8A5A34" stroke-width="2.4" stroke-linecap="round"/>${lv}</g>`, [[x-9,y-hh-6],[x+9,y]]); };
    palm(12+SH, 8.4, 11, 0); palm(21+SH, 6.4, 9, 1);
    { const t = out(16.5+SH); sc.raw(t+9+.2, `<polygon points="${P(t-2.4,11,3.6)} ${P(t+2.4,11,3.6)} ${P(t,8.6,9)}" fill="#D2A968"/><polygon points="${P(t+2.4,11,3.6)} ${P(t+2.4,6,3.6)} ${P(t,8.6,9)}" fill="#B88B4A"/>`, [isoP(15,9,9)]); }
    { const r = Math.min(out(L+E-7.5), out(L+E-4)); bx(r,3.4,2.7,3.5,3.4,2.4,['#B9C0CC','#98A1B0','#7F8898'],null); bx(r+.6,4,5.1,2,2,1.4,['#C9D0DA','#A6AEBB','#8B94A3'],null); }
    const fm = Q(out(L+E-5), 11.5, 1.5); sc.raw(800, [0,1,2].map(k => `<circle class="foam" style="--k:${k}" cx="${(fm[0]+(k-1)*3.4).toFixed(1)}" cy="${(fm[1]+(k%2)*1.6).toFixed(1)}" r="2" fill="#FFFFFF" stroke="none"/>`).join(''));
    const c = Q(out(22.5), W/2, 1.4), sk = [c[0], c[1]-30];
    let drops = ''; for(let k=0;k<11;k++) drops += `<path class="drop" style="--k:${k}" d="M${(sk[0]-12+k*2.4).toFixed(1)} ${(sk[1]+5+(k%3)*2).toFixed(1)}l-1.3 4.4" fill="none" stroke="#9ED8EF" stroke-width="1.3"/>`;
    return sc.out(X ? [vm, W/2, 0] : [W/2, vm, 0]);
  }
  if(kind==='power' || kind==='water'){
    // Đế dài 30 x rộng 16, nằm dọc theo chiều dài lô đất và phủ kín phần ô không có giá.
    // v là toạ độ dọc lô, tăng về phía người xem để phần đẹp nhất luôn quay ra trước.
    const X = ori!=='y', L = 30, W = 16;
    const Q = (v,b,z) => X ? sc.P(v,b,z) : sc.P(b,v,z), P = (v,b,z) => Q(v,b,z).join(',');
    const bx = (v,b,z,lv,lb,h,c,key) => sc.box(X ? {x:v,y:b,z,w:lv,d:lb,h,c} : {x:b,y:v,z,w:lb,d:lv,h,c:[c[0],c[2],c[1]]}, key);
    if(kind==='power'){
      bx(0,0,0,L,W,1.6,C3('#B9C4D3'),-10);
      const tower = (v, b, hh, k) => { const a = Q(v,b,1.6), rb = 5.6, rt = 3.7, ty = a[1]-hh;
        sc.raw(v+b, `<path d="M${a[0]-rb} ${a[1]}C${a[0]-rb+1.4} ${a[1]-hh*.5} ${a[0]-rt-.8} ${a[1]-hh*.7} ${a[0]-rt} ${ty}h${rt*2}C${a[0]+rt+.8} ${a[1]-hh*.7} ${a[0]+rb-1.4} ${a[1]-hh*.5} ${a[0]+rb} ${a[1]}A${rb} ${rb*.45} 0 0 1 ${a[0]-rb} ${a[1]}Z" fill="#D5DCE6"/><path d="M${a[0]+.6} ${a[1]+2.4}C${a[0]+1.4} ${a[1]-hh*.5} ${a[0]+1} ${a[1]-hh*.7} ${a[0]+.6} ${ty}h${rt-.6}C${a[0]+rt+.8} ${a[1]-hh*.7} ${a[0]+rb-1.4} ${a[1]-hh*.5} ${a[0]+rb} ${a[1]}A${rb} ${rb*.45} 0 0 1 ${a[0]+.6} ${a[1]+2.4}Z" fill="#AEB9C9" stroke="none"/><ellipse cx="${a[0]}" cy="${ty}" rx="${rt}" ry="${rt*.42}" fill="#7C8799"/><path d="M${a[0]-rb+.9} ${a[1]-hh*.33}q${rb-.9} 2.4 ${rb*2-1.8} 0M${a[0]-rt-.5} ${a[1]-hh*.66}q${rt+.5} 2 ${rt*2+1} 0" fill="none" stroke="#8D97A8" stroke-width=".7"/>`
          + [0,1,2].map(q => `<g class="smoke" style="--k:${q+k}" stroke="none"><circle cx="${a[0]+(q-1)*1.6}" cy="${ty-2.4}" r="${2.6+q*.5}" fill="#FFFFFF"/><circle cx="${a[0]+(q-1)*1.6+2}" cy="${ty-3.6}" r="${2+q*.4}" fill="#F1F4F8"/></g>`).join(''), [[a[0]-rb-2,ty-16],[a[0]+rb+2,a[1]+3]]); };
      tower(6.5, 8, 16, 0); tower(15, 8, 13, 1);
      bx(20.5,2.5,1.6,8,11,5.4,['#EEF2F7','#DCE3EC','#B9C4D3'],null);
      bx(20.5,2.5,7,8,11,.9,C3('#3B82C4'),null);
      const ch = Q(19, 14, 1.6); sc.raw(33.5, `<rect x="${ch[0]-1}" y="${ch[1]-14}" width="2" height="14" fill="#EEF2F7"/><rect x="${ch[0]-1}" y="${ch[1]-14}" width="2" height="2.6" fill="#E0483A"/><rect x="${ch[0]-1}" y="${ch[1]-8.6}" width="2" height="2" fill="#E0483A"/>`, [[ch[0]-2,ch[1]-15]]);
      const bl = Q(24.5, 8, 17.5);
      sc.raw(990, `<g class="bulb"><circle class="bglow2" cx="${bl[0]}" cy="${bl[1]}" r="8.5" fill="#FFE27A" stroke="none"/><path class="bglass" d="M${bl[0]-4.4} ${bl[1]}a4.4 4.4 0 1 1 8.8 0c0 2.4-1.8 3-1.9 5h-5c-.1-2-1.9-2.6-1.9-5z" fill="#DCE3EC"/><rect x="${bl[0]-2}" y="${bl[1]+5}" width="4" height="2.6" rx=".6" fill="#8D97A8"/><path class="bray" d="M${bl[0]} ${bl[1]-7}v-3M${bl[0]-6.4} ${bl[1]-3.6}l-2.4-1.8M${bl[0]+6.4} ${bl[1]-3.6}l2.4-1.8M${bl[0]-7.4} ${bl[1]+2.4}h-3M${bl[0]+7.4} ${bl[1]+2.4}h3" fill="none" stroke="#F4C542" stroke-width="1.4"/></g>`, [[bl[0]-11,bl[1]-11],[bl[0]+11,bl[1]+8]]);
    } else {
      bx(0,0,0,L,W,1.6,C3('#C9B892'),-10);
      bx(1,1,1.6,13,14,7.6,['#5FB4E0','#C9B892','#B3A27C'],-5);                 // hồ chứa phía sau
      bx(14,.6,1.6,2.2,14.8,8.6,['#E9E2CF','#D2C9B0','#BDB399'],null);          // thân đập
      bx(13.4,0,1.6,3.4,3.2,11.6,['#F1EAD8','#DCD3BC','#C8BEA4'],null);
      bx(13.4,12.8,1.6,3.4,3.2,11.6,['#F1EAD8','#DCD3BC','#C8BEA4'],null);
      sc.raw(40, `<polygon points="${P(16.2,4,9.6)} ${P(16.2,12,9.6)} ${P(24,12,1.8)} ${P(24,4,1.8)}" fill="#5FB4E0"/>` + [5,6.6,8.2,9.8,11.2].map((b,k) => `<path class="flow" style="--k:${k}" d="M${P(16.2,b,9.6)}L${P(24,b,1.8)}" fill="none" stroke="#FFFFFF" stroke-width="1.1" stroke-dasharray="3 3" opacity=".9"/>`).join('')
        + `<polygon points="${P(22.5,2,1.7)} ${P(29,2,1.7)} ${P(29,14,1.7)} ${P(22.5,14,1.7)}" fill="#7CC6EA"/>` + [4.5,8,11.5].map((b,k) => { const a = Q(24.2,b,2); return `<circle class="foam" style="--k:${k}" cx="${a[0]}" cy="${a[1]}" r="1.7" fill="#FFFFFF" stroke="none"/>`; }).join(''), [isoP(0,0,0)]);
      const tr = Q(4,13,9.2); sc.raw(17.5, `<rect x="${tr[0]-.9}" y="${tr[1]-5}" width="1.8" height="5" fill="#8A5A34"/><ellipse cx="${tr[0]}" cy="${tr[1]-8.5}" rx="3" ry="5" fill="#4E9A4D"/>`, [[tr[0]-3,tr[1]-14]]);
    }
    return sc.out(X ? [L/2, W/2, 0] : [W/2, L/2, 0]);
  }
  if(kind==='qmark'){
    const hook = 'M-6.5 -17C-6.5 -26 7 -26 7 -17C7 -11.5 .5 -11.5 .5 -5.5';
    sc.raw(1, `<defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7B6CF6"/><stop offset=".35" stop-color="#F0508C"/><stop offset=".7" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FFC53D"/></linearGradient></defs>
      <ellipse class="qsh" cx="0" cy="3" rx="7" ry="2.6" fill="rgba(43,58,103,.25)" stroke="none"/>
      <g class="qm"><path d="${hook}" fill="none" stroke="#2B3A67" stroke-width="8.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${hook}" fill="none" stroke="url(#qg)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M-4.6 -18.6C-4 -22.6 2 -23.6 4.4 -20.6" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
      <circle cx=".5" cy="-.6" r="4.1" fill="url(#qg)" stroke="#2B3A67" stroke-width="1.2"/><ellipse cx="-.9" cy="-2" rx="1.5" ry="1" fill="#FFFFFF" opacity=".8" stroke="none"/></g>`, [[-12,-32],[12,7]]);
    return sc.out([0,3,0]);
  }
  if(kind==='clover'){
    const leaf = r => `<g transform="rotate(${r})"><path d="M0 0C-8 -3 -9 -12 -3.4 -12C-1.2 -12 0 -10.4 0 -9.2C0 -10.4 1.2 -12 3.4 -12C9 -12 8 -3 0 0Z" fill="#5FB85A" stroke="#2F7A3A" stroke-width="1.1"/><path d="M0 -1.5C-4.6 -3.6 -5.6 -9 -3 -9.6" fill="none" stroke="#A8E58F" stroke-width="1.2" stroke-linecap="round"/><path d="M0 0V-8.6" fill="none" stroke="#2F7A3A" stroke-width=".7"/></g>`;
    sc.raw(1, `<ellipse cx="0" cy="1" rx="9" ry="3.4" fill="rgba(43,58,103,.2)" stroke="none"/><g class="clv"><path d="M0 0q2.6 -5 .4 -10" fill="none" stroke="#2F7A3A" stroke-width="1.8" stroke-linecap="round"/><g transform="translate(0.4,-13) scale(1,.86)">${leaf(45)}${leaf(135)}${leaf(225)}${leaf(315)}<circle r="1.3" fill="#2F7A3A" stroke="none"/></g></g>`, [[-13,-26],[13,5]]);
    return sc.out([0,0,0]);
  }
  // hộp quà: thân vàng, nắp rời, ruy băng đỏ và nơ
  const P = (x,y,z) => sc.P(x,y,z).join(','), W = 11, Hh = 7;
  const body = isoBox({x:0,y:0,z:0,w:W,d:W,h:Hh,c:C3('#F4C542')}) + `<polygon points="${P(4.2,W,0)} ${P(6.8,W,0)} ${P(6.8,W,Hh)} ${P(4.2,W,Hh)}" fill="#E0483A"/><polygon points="${P(W,4.2,0)} ${P(W,6.8,0)} ${P(W,6.8,Hh)} ${P(W,4.2,Hh)}" fill="#C63C30"/>`;
  const lid = isoBox({x:-.8,y:-.8,z:Hh,w:W+1.6,d:W+1.6,h:2.6,c:C3('#F9D768')}) + `<polygon points="${P(4.2,-.8,Hh+2.6)} ${P(6.8,-.8,Hh+2.6)} ${P(6.8,W+.8,Hh+2.6)} ${P(4.2,W+.8,Hh+2.6)}" fill="#E0483A"/><polygon points="${P(-.8,4.2,Hh+2.6)} ${P(W+.8,4.2,Hh+2.6)} ${P(W+.8,6.8,Hh+2.6)} ${P(-.8,6.8,Hh+2.6)}" fill="#E0483A"/><polygon points="${P(4.2,W+.8,Hh)} ${P(6.8,W+.8,Hh)} ${P(6.8,W+.8,Hh+2.6)} ${P(4.2,W+.8,Hh+2.6)}" fill="#E0483A"/><polygon points="${P(W+.8,4.2,Hh)} ${P(W+.8,6.8,Hh)} ${P(W+.8,6.8,Hh+2.6)} ${P(W+.8,4.2,Hh+2.6)}" fill="#C63C30"/>`;
  const t = sc.P(W/2,W/2,Hh+2.6);
  const bow = `<ellipse cx="${t[0]-3.6}" cy="${t[1]-2.6}" rx="3.8" ry="2.4" transform="rotate(-25 ${t[0]-3.6} ${t[1]-2.6})" fill="#E0483A"/><ellipse cx="${t[0]+3.6}" cy="${t[1]-2.6}" rx="3.8" ry="2.4" transform="rotate(25 ${t[0]+3.6} ${t[1]-2.6})" fill="#E0483A"/><circle cx="${t[0]}" cy="${t[1]-1.4}" r="1.7" fill="#C63C30"/>`;
  let stars = ''; [[-13,-8,'#3FB5A8'],[12,-12,'#F4C542'],[2,-20,'#E0685C'],[-8,-18,'#F4C542'],[14,-2,'#3FB5A8']].forEach((q,k) => { stars += `<path class="gst" style="--k:${k};--sx:${q[0]}px;--sy:${q[1]}px" d="M${t[0]} ${t[1]-6}l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="${q[2]}" stroke="none"/>`; });
  const c0 = sc.P(W/2,W/2,0);
  sc.raw(1, `<ellipse cx="${c0[0]}" cy="${c0[1]}" rx="11" ry="4.6" fill="rgba(43,58,103,.2)" stroke="none"/><g class="gbox">${body}<g class="lid">${lid}${bow}</g></g>${stars}`, [isoP(0,W,0), isoP(W,0,0), isoP(0,0,Hh+9), isoP(W,W,0), [t[0]-16,t[1]-28],[t[0]+16,t[1]]]);
  return sc.out([W/2,W/2,0]);
}
// ô Khởi nghiệp: quán cà phê cắt lớp kiểu isometric (hai bức tường sau, sàn gạch, quầy, bàn ghế)
function cafe3D(ori, LEN){
  const sc = isoScene(), X = ori!=='y', LT = Math.max(46, LEN || 52), L = 40, W = 16, wt = 1.2, WH = 16, zf = 1.2, ZS = .8;   // sàn L x W đúng tỉ lệ ô đất (dài gấp 2,5 lần rộng); ZS hạ chiều cao để đỡ che ô phía sau
  const Q = (a,b,z) => X ? sc.P(a,b,(z||0)*ZS) : sc.P(b,a,(z||0)*ZS), P = (a,b,z) => Q(a,b,z).join(',');
  const kk = (a,b,z) => a+b+(z||0)*.01;
  const bxc = (a,b,z,la,lb,h,c,k) => sc.box(X ? {x:a,y:b,z:z*ZS,w:la,d:lb,h:h*ZS,c} : {x:b,y:a,z:z*ZS,w:lb,d:la,h:h*ZS,c:[c[0],c[2],c[1]]}, k);
  const bx = (a,b,z,la,lb,h,base,k) => bxc(a,b,z,la,lb,h,[base,shade(base,.85),shade(base,.7)],k);
  const poly = (pts, fill, k, extra) => sc.raw(k, `<polygon points="${pts.map(p => P(p[0],p[1],p[2])).join(' ')}" fill="${fill}" ${extra||''}/>`, pts.map(p => Q(p[0],p[1],p[2])));
  const lw = (a1,a2,z1,z2,col,k,ex) => poly([[a1,wt,z1],[a2,wt,z1],[a2,wt,z2],[a1,wt,z2]], col, k, ex);
  const ew = (b1,b2,z1,z2,col,k,ex) => poly([[wt,b1,z1],[wt,b2,z1],[wt,b2,z2],[wt,b1,z2]], col, k, ex);
  const line = (p,q,col,w,k) => { const s = Q(p[0],p[1],p[2]), e = Q(q[0],q[1],q[2]); sc.raw(k, `<path d="M${s[0]} ${s[1]}L${e[0]} ${e[1]}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`, [s,e]); };
  const blob = (a,b,z,r,col,k) => { const c = Q(a,b,z); sc.raw(k, `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="${col}"/>`, [[c[0]-r,c[1]-r],[c[0]+r,c[1]+r]]); };
  const ell = (a,b,z,r,col,k,ex) => { const c = Q(a,b,z), rx = 1.2247*r, ry = 1.4142*ISOK.y*r; sc.raw(k, `<ellipse cx="${c[0]}" cy="${c[1]}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${col}" ${ex||''}/>`, [[c[0]-rx,c[1]-ry],[c[0]+rx,c[1]+ry]]); };
  // sàn gạch, tường sau
  bxc(0,0,0,L,W,zf,['#EEF0F3','#B98558','#9E7046'],-10);
  bxc(L,0,0,LT-L,W,zf,['#D9B88A','#B98558','#9E7046'],-9.9);                                   // hiên gỗ ngoài trời kéo ra kín mép ngoài
  for(let b=3.2;b<W;b+=3.2) line([L+.2,b,zf+.02],[LT,b,zf+.02],'#B98F5E',.5,-9);
  for(let a=8;a<L;a+=8) line([a,wt,zf+.02],[a,W,zf+.02],'#D3D8DF',.5,-9);
  for(let b=5.5;b<W;b+=4.6) line([wt,b,zf+.02],[L,b,zf+.02],'#D3D8DF',.5,-9);
  bx(0,0,zf,L,wt,4.6,'#B98558',.1); bx(0,wt,zf,wt,W-wt,WH,'#EADBC3',.2);                                  // tường dài phía sau chỉ còn lan can thấp để không che ô bên cạnh
  const wood = '#B98558';
  lw(0,L,zf,zf+4.6,wood,.3); ew(wt,W,zf,zf+4.6,shade(wood,.82),.3);
  line([0,wt,zf+4.6],[L,wt,zf+4.6],'#7A5530',.9,.31); line([wt,wt,zf+4.6],[wt,W,zf+4.6],'#6B4A2A',.9,.31);
  // kệ + cây + biển cốc trên tường đầu
  ew(3.2,13.5,8.4,9.1,'#8A5A32',.45); ew(3.2,13.5,12.2,12.9,'#8A5A32',.45);
  [[4.6,'#E7A15B'],[6.2,'#F2D9A0'],[7.6,'#9EC9B0']].forEach((j,i) => bx(wt,j[0],9.1,1,1.2,1.8,j[1],kk(wt,j[0],9)-.2+.5));
  blob(wt+.6,11.3,11.2,2.1,'#58A85A',.6); blob(wt+.6,12.2,10.3,1.6,'#6DBB62',.61);
  blob(wt+.6,5.6,14.5,1.7,'#58A85A',.62); ew(5.6,11.6,13.4,15.6,'#7A5530',.46);
  { const c = Q(wt, 8.6, 14.5); sc.raw(.65, `<g transform="translate(${c[0]} ${c[1]})"><path d="M-3.2 -1.8h5.6v2.6a2.8 2.8 0 0 1 -5.6 0z" fill="#FFFFFF"/><path d="M2.4 -.9a1.6 1.6 0 0 1 0 3" fill="none" stroke="#FFFFFF" stroke-width="1"/><path class="cfs" d="M-1.6 -3q-1 -1.2 0 -2.4" fill="none" stroke="#FFFFFF" stroke-width=".7" opacity=".8"/><path class="cfs" style="animation-delay:.6s" d="M.6 -3q-1 -1.2 0 -2.4" fill="none" stroke="#FFFFFF" stroke-width=".7" opacity=".8"/></g>`, [[c[0]-5,c[1]-7],[c[0]+5,c[1]+4]]); }
  // quầy bar + máy pha + tủ bánh
  bxc(3.2,1.5,zf,15,3.4,4.2,['#E2B77E','#C58B52','#9F6A3A'],kk(10,3,0));
  bx(4.6,2.2,zf+4.2,4.2,2.2,3.2,'#8A929C',kk(6,3,6)); bx(5.2,2.6,zf+7.4,3,1.4,1,'#3A4450',kk(6,3,9)); blob(7.8,3.6,zf+6.2,.55,'#E0483A',kk(8,4,7));
  sc.raw(kk(7,3,10), `<path class="cfs" d="M${Q(6.4,3.3,zf+8.6).join(' ')}q-1.2 -2 0 -3.6" fill="none" stroke="#FFFFFF" stroke-width=".8" opacity=".8"/>`, [Q(6.4,3.3,zf+8.6)]);
  bxc(11.5,1.6,zf+4.2,6,3,3.8,['#D8EEF8','#B7DCEB','#98C6DA'],kk(14,3,8));
  [[12.4,2.6],[14.2,2.9],[16,2.7]].forEach((p,i) => blob(p[0],p[1]+1.2,zf+6.4,.95,['#E3A857','#F2C98A','#D98E48'][i],kk(p[0],p[1],9)+.3));
  bx(9.8,1.9,zf+4.2,1.1,1.1,1.3,'#FFFFFF',kk(10,2,6));
  // bàn ghế
  const chair = (a,b,backSide) => {
    bx(a+1,b+1,zf,.7,.7,1.6,'#9F6A3A',kk(a+1,b+1,0)+.6);
    bxc(a,b,zf+1.6,2.6,2.6,.7,['#E8BC84','#C58B52','#9F6A3A'],kk(a+1.3,b+1.3,2)+.6);
    if(backSide==='a') bx(a,b,zf+2.3,.6,2.6,3.2,'#B97F48',kk(a,b+1.3,5)+.6);
    else bx(a,b+2,zf+2.3,2.6,.6,3.2,'#B97F48',kk(a+1.3,b+2.6,5)+.6);
  };
  const table = (a,b,k) => {
    ell(a,b,zf,1.6,'rgba(43,58,103,.18)',k-.4,'stroke="none"');
    line([a,b,zf],[a,b,zf+3.1],'#6B4A2A',1.4,k-.3);
    ell(a,b,zf+2.9,2.6,'#A87444',k-.2); ell(a,b,zf+3.7,2.6,'#E3B27A',k-.1);
  };
  table(29,9.4,kk(29,9.4,0)); chair(24.5,8.1,'a'); chair(27.8,12.2,'b');
  table(15,10,kk(15,10,0)); chair(10.6,8.7,'a'); chair(13.8,12.8,'b');
  // hiên: bàn có dù, ghế, chậu cây
  { const ta = (L+LT)/2 + .5, tb = 8.4;
    table(ta,tb,kk(ta,tb,0)); chair(ta-4.6,tb-1.3,'a'); chair(ta-1.2,tb+2.8,'b');
    line([ta,tb,zf+3.7],[ta,tb,zf+11.5],'#6B4A2A',.9,kk(ta,tb,9)+.5);
    ell(ta,tb,zf+11,5.2,'#D9534A',kk(ta,tb,11)+.6); ell(ta,tb,zf+12.3,3.5,'#F08A6E',kk(ta,tb,11)+.61,'stroke="none"'); ell(ta,tb,zf+13.3,1.5,'#FFF1E0',kk(ta,tb,11)+.62,'stroke="none"');
    [[LT-2.2,1.4],[LT-2.2,W-2.6],[L+1,1.4]].forEach(p => { bx(p[0],p[1],zf,1.6,1.6,1.8,'#C9773F',kk(p[0],p[1],0)+.7); blob(p[0]+.8,p[1]+.8,zf+3.4,1.7,'#58A85A',kk(p[0],p[1],3)+.71); blob(p[0]+1.3,p[1]+.6,zf+4.6,1.2,'#6DBB62',kk(p[0],p[1],3)+.72); }); }
  // laptop (khởi nghiệp) + cốc cà phê
  bx(28.2,8.8,zf+3.8,1.9,1.5,.3,'#8F98A3',kk(29,9.5,6)+.7); bx(28.2,8.8,zf+4.1,1.9,.25,1.5,'#2B3340',kk(29,9,6)+.65);
  line([28.5,9.1,zf+4.4],[29.6,9.1,zf+4.4],'#6FD0F2',.5,kk(29,9,6)+.8);
  { const c = Q(15,10,zf+3.8); sc.raw(kk(15,10,6)+.9, `<path d="M${c[0]-1.8} ${c[1]-1.6}h3.6v1.8a1.8 1.8 0 0 1 -3.6 0z" fill="#FFFFFF"/><path class="cfs" d="M${c[0]-.6} ${c[1]-2.4}q-1 -1.2 0 -2.4" fill="none" stroke="#FFFFFF" stroke-width=".7" opacity=".85"/>`, [[c[0]-3,c[1]-6],[c[0]+3,c[1]+1]]); }
  // chậu cây
  const plant = (a,b,k) => { bx(a,b,zf,2.4,2.4,2.2,'#B9603F',k); blob(a+1.2,b+1.2,zf+4,2.2,'#58A85A',k+.1); blob(a+.2,b+.6,zf+3.2,1.7,'#6DBB62',k+.12); blob(a+2.2,b+1.8,zf+3,1.6,'#4A9650',k+.12); };
  plant(1.8,12,kk(3,13.2,0)); plant(34,12,kk(35,13.2,0));
  const o = sc.out(X ? [LT/2, W/2, 0] : [W/2, LT/2, 0]); o.svg = o.svg.replace('stroke-width="1" stroke-linejoin','stroke-width=".55" stroke-linejoin'); return o;
}
// ô Nghĩa trang: khu mộ isometric có nhà mộ đá, cây khô, bia mộ, hàng rào sắt và vài bóng ma bay qua bay lại
function grave3D(ori, LEN){
  // a chạy từ mép trong (0) ra mép ngoài (A). Bia mộ nằm phía trong bàn, nhà mộ đứng sát mép ngoài, cửa quay ra ngoài
  const sc = isoScene(), X = ori!=='y', A = Math.max(46, LEN || 52), W = 16, zs = 2.2;
  const Q = (a,b,z) => X ? sc.P(a,b,z) : sc.P(b,a,z), P = (a,b,z) => Q(a,b,z).join(',');
  const kk = (a,b,z) => a+b+(z||0)*.01;
  const bxc = (a,b,z,la,lb,h,c,k) => sc.box(X ? {x:a,y:b,z,w:la,d:lb,h,c} : {x:b,y:a,z,w:lb,d:la,h,c:[c[0],c[2],c[1]]}, k);
  const bx = (a,b,z,la,lb,h,base,k) => bxc(a,b,z,la,lb,h,[base,shade(base,.8),shade(base,.62)],k);
  const poly = (pts, fill, k, extra) => sc.raw(k, `<polygon points="${pts.map(p => P(p[0],p[1],p[2])).join(' ')}" fill="${fill}" ${extra||''}/>`, pts.map(p => Q(p[0],p[1],p[2])));
  const line = (p,q,col,w,k) => { const s = Q(p[0],p[1],p[2]), e = Q(q[0],q[1],q[2]); sc.raw(k, `<path d="M${s[0]} ${s[1]}L${e[0]} ${e[1]}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`, [s,e]); };
  const ell = (a,b,z,r,col,k,ex) => { const c = Q(a,b,z), rx = 1.2247*r, ry = 1.4142*ISOK.y*r; sc.raw(k, `<ellipse cx="${c[0]}" cy="${c[1]}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${col}" ${ex||''}/>`, [[c[0]-rx,c[1]-ry],[c[0]+rx,c[1]+ry]]); };
  // nền cỏ tối, loang vài mảng đất và rêu
  bxc(0,0,0,A,W,zs,['#4E6038','#2B3224','#222819'],-10);
  [[6,4,3.4,'#566B3D'],[20,12,3.8,'#465733'],[30,5,3.2,'#566B3D'],[A-9,13,3,'#465733'],[13,9,2.6,'#5C7041']].forEach((s,i) => ell(s[0],s[1],zs+.02,s[2],s[3],-9.6+i*.01,'stroke="none"'));
  // lối đi lát đá từ phía trong ra tới cửa nhà mộ
  const m0 = A-14;
  for(let a=2.6, i=0; a<m0-1; a+=3.3, i++) ell(a, 8.2+Math.sin(i*1.1)*1.5, zs+.04, 1.45+(i%3)*.12, i%2 ? '#77705F' : '#8A8371', -9+i*.01, 'stroke="#55503F" stroke-width=".35"');
  // nhà mộ đá mái dốc sát mép ngoài
  const cx0 = A-13, cx1 = A-2.4, cb0 = 2.4, cb1 = 11, wh = 6.8, zt = zs+wh, mid = (cb0+cb1)/2;
  bx(cx0-.6,cb0-.6,zs,cx1-cx0+1.2,cb1-cb0+1.2,.8,'#6F7780',kk(cx0,cb0,0)+.9);                                   // bậc thềm
  bx(cx0,cb0,zs+.8,cx1-cx0,cb1-cb0,wh-.8,'#8B939D',kk(A-8,6,0)+1);
  [1.9,3.6,5.2].forEach(z => line([cx0,cb1,zs+z],[cx1,cb1,zs+z],'#6C747E',.35,kk(A-8,6,0)+1.01));                // mạch đá
  [1.9,3.6,5.2].forEach(z => line([cx1,cb0,zs+z],[cx1,cb1,zs+z],'#5A626C',.35,kk(A-8,6,0)+1.01));
  poly([[cx1,cb0,zt],[cx1,cb1,zt],[cx1,mid,zt+4.4]], '#7B838D', kk(A-2,6,12)+1.1);                              // đầu hồi
  poly([[cx0-.8,cb1+.8,zt-.4],[cx1+.8,cb1+.8,zt-.4],[cx1+.8,mid,zt+4.4],[cx0-.8,mid,zt+4.4]], '#4C5563', kk(A-8,10,12)+1.2);   // mái
  poly([[cx0-.8,cb1+.8,zt-.4],[cx1+.8,cb1+.8,zt-.4],[cx1+.8,cb1+.8,zt+.4],[cx0-.8,cb1+.8,zt+.4]], '#39404C', kk(A-8,10,12)+1.25,'stroke="none"');
  for(let a=cx0+1;a<cx1;a+=2.2) line([a,cb1+.6,zt-.2],[a+.3,mid+.2,zt+4.1],'#3B4350',.45,kk(A-8,10,12)+1.3);
  line([cx1+.8,mid,zt+4.4],[cx1+.8,mid,zt+6.6],'#C9CED6',.8,kk(A-2,6,14)+1.5); line([cx1+.8,mid-.9,zt+5.8],[cx1+.8,mid+.9,zt+5.8],'#C9CED6',.8,kk(A-2,6,14)+1.5);   // thánh giá trên nóc
  // cửa vòm có ánh đèn le lói, khung đá, cửa sổ hẹp
  poly([[cx1,mid-2.2,zs+.8],[cx1,mid+2.2,zs+.8],[cx1,mid+2.2,zs+3.8],[cx1,mid+1.1,zs+5],[cx1,mid-1.1,zs+5],[cx1,mid-2.2,zs+3.8]], '#14161D', kk(A-2,6,6)+1.4);
  poly([[cx1,mid-1.2,zs+.8],[cx1,mid+1.2,zs+.8],[cx1,mid+1.2,zs+2.6],[cx1,mid-1.2,zs+2.6]], '#F2B544', kk(A-2,6,6)+1.41, 'stroke="none" opacity=".55" class="glamp"');
  poly([[cx1,mid-3,zs+.8],[cx1,mid-2.2,zs+.8],[cx1,mid-2.2,zs+3.8],[cx1,mid-1.1,zs+5],[cx1,mid-1.1,zs+5.8],[cx1,mid-3,zs+4.4]], '#A2A9B2', kk(A-2,6,6)+1.38,'stroke="none"');
  poly([[cx1,mid+2.2,zs+.8],[cx1,mid+3,zs+.8],[cx1,mid+3,zs+4.4],[cx1,mid+1.1,zs+5.8],[cx1,mid+1.1,zs+5],[cx1,mid+2.2,zs+3.8]], '#A2A9B2', kk(A-2,6,6)+1.38,'stroke="none"');
  [cx0+2.4, cx0+6.2].forEach(a => poly([[a,cb1,zs+2.8],[a+1.6,cb1,zs+2.8],[a+1.6,cb1,zs+5.2],[a+.8,cb1,zs+6],[a,cb1,zs+5.2]], '#171A21', kk(a,cb1,4)+1.4));
  // cây khô đứng cạnh nhà mộ
  { const t = Q(A-17.5,3,zs), c = '#2A2833';
    const br = (x0,y0,pts,w) => `<path d="M${x0} ${y0}${pts}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let g = br(t[0],t[1],'q-1.5 -5 1.5 -8q2 -4 -1 -7',2) + br(t[0]-.3,t[1]-7.5,'q-4 -1.5 -7 -4.5q-1.5 -1.5 -1 -4',1) + br(t[0]-2,t[1]-10.6,'q-3 0 -4.6 -2.4',.8) + br(t[0]+.3,t[1]-14,'q-2.4 -2.4 -2.4 -6',.9) + br(t[0]+.3,t[1]-14,'q3 -1.6 5 -5.6q.8 -1.6 0 -3.2',.9) + br(t[0]+1,t[1]-10,'q4 -.8 7 -4q1.6 -1.6 1.6 -4',1) + br(t[0]+3,t[1]-11,'q2.4 0 4 1.6',.7);
    sc.raw(kk(A-17.5,3,6)+.4, g, [[t[0]-9,t[1]-21],[t[0]+10,t[1]]]); }
  // bia mộ: bia vòm, bia thánh giá, có nấm đất và hoa phía trước
  const slab = (a,b,h,base,k,deco) => {
    const bf = b+1, w = 2.5, dk = shade(base,.55);
    poly([[a+w,b,zs],[a+w,bf,zs],[a+w,bf,zs+h],[a+w,b,zs+h]], shade(base,.72), k);                              // cạnh bên
    const p0 = Q(a,bf,zs), p1 = Q(a,bf,zs+h), pc = Q(a+w/2,bf,zs+h+1.5), p2 = Q(a+w,bf,zs+h), p3 = Q(a+w,bf,zs);
    sc.raw(k+.01, `<path d="M${p0[0]} ${p0[1]}L${p1[0]} ${p1[1]}Q${pc[0]} ${pc[1]} ${p2[0]} ${p2[1]}L${p3[0]} ${p3[1]}Z" fill="${base}"/>`, [p0,p1,pc,p2,p3]);
    line([a+w/2,bf+.02,zs+h-.3],[a+w/2,bf+.02,zs+h-1.9],dk,.45,k+.02); line([a+w/2-.5,bf+.02,zs+h-.9],[a+w/2+.5,bf+.02,zs+h-.9],dk,.45,k+.02);   // khắc thánh giá
    line([a+.45,bf+.02,zs+h-2.6],[a+w-.45,bf+.02,zs+h-2.6],dk,.35,k+.02);
    ell(a+w/2,bf+2.5,zs+.05,1.9,'#5E4A33',k+.03,'stroke="#3E301F" stroke-width=".35"'); ell(a+w/2-.2,bf+2.3,zs+.3,1.2,'#73593D',k+.04,'stroke="none"');   // nấm đất
    if(deco){ const f = Q(a+w/2+.3,bf+.9,zs+.6); sc.raw(k+.05, `<circle cx="${f[0]}" cy="${f[1]}" r=".8" fill="${deco}" stroke="none"/><circle cx="${(f[0]-1).toFixed(1)}" cy="${(f[1]+.3).toFixed(1)}" r=".6" fill="#F4E9C8" stroke="none"/>`, [f]); }
  };
  const cross = (a,b,h,base,k) => { bx(a+.8,b,zs,.9,.9,h,base,k); bx(a,b,zs+h-2.2,2.5,.9,.9,base,k+.01); ell(a+.95,b+2.6,zs+.05,1.4,'#5E4A33',k+.02,'stroke="#3E301F" stroke-width=".35"'); };
  const S0 = [[3,2,4.8,'#A9B1BC','#E0685C'],[8,9.6,4.4,'#8C94A0',''],[13,2.6,5,'#9AA58F','#F4C542'],[18,10,4.2,'#A9B1BC',''],[23,2.2,4.6,'#8794AB','#E0685C'],[28,9.8,4.8,'#9AA58F',''],[33,2.8,4.4,'#8C94A0','#F4C542']];
  S0.filter(s => s[0] < m0-6.5 || (s[1] > 9 && s[0] < m0-2.5)).forEach((s,i) => { const k = kk(s[0],s[1],0)+2; if(i%4===3) cross(s[0],s[1],s[2]+1,s[3],k); else slab(s[0],s[1],s[2],s[3],k,s[4]); });
  // hàng rào sắt mép trước, trụ đá hai đầu
  { const f0 = 1.2, f1 = m0-1.6;
    for(let a=f0;a<=f1;a+=1.5){ line([a,W-.5,zs],[a,W-.5,zs+3.4],'#15171D',.6,kk(a,W,0)+3); const q = Q(a,W-.5,zs+3.4); sc.raw(kk(a,W,0)+3.01, `<path d="M${q[0]} ${(q[1]-1.2).toFixed(1)}l.6 1.2h-1.2z" fill="#15171D" stroke="none"/>`, [[q[0]-1,q[1]-1.4],[q[0]+1,q[1]]]); }
    line([f0,W-.5,zs+2.6],[f1,W-.5,zs+2.6],'#15171D',.6,kk((f0+f1)/2,W,0)+3.02); line([f0,W-.5,zs+.8],[f1,W-.5,zs+.8],'#15171D',.6,kk((f0+f1)/2,W,0)+3.02);
    [f0-1.2, f1+.2].forEach(a => { bx(a,W-1.5,zs,1.5,1.5,4,'#7B838D',kk(a,W,0)+3.1); bx(a-.2,W-1.7,zs+4,1.9,1.9,.6,'#A2A9B2',kk(a,W,0)+3.11); }); }
  // đèn đá cạnh lối vào
  { const la = m0-2.4, lb = 12.6; bx(la,lb,zs,1,1,2.6,'#7B838D',kk(la,lb,0)+2.5); bx(la-.3,lb-.3,zs+2.6,1.6,1.6,1.5,'#F2B544',kk(la,lb,3)+2.5); bx(la-.5,lb-.5,zs+4.1,2,2,.5,'#4C5563',kk(la,lb,5)+2.5);
    const g = Q(la+.5,lb+.5,zs+3.3); sc.raw(kk(la,lb,5)+2.6, `<circle class="glamp" cx="${g[0]}" cy="${g[1]}" r="4.2" fill="#F8D477" stroke="none" opacity=".28"/>`, [[g[0]-4.2,g[1]-4.2],[g[0]+4.2,g[1]+4.2]]); }
  // cỏ khô và sương là là mặt đất
  [[5,13.4],[17,14.2],[26,7.4],[A-16,13.6],[10,6.6],[22,14]].forEach(s => { const q = Q(s[0],s[1],zs); sc.raw(kk(s[0],s[1],0)+2.4, `<path d="M${q[0]} ${q[1]}l-1 -3M${q[0]} ${q[1]}l.2 -3.6M${q[0]} ${q[1]}l1.2 -2.8" fill="none" stroke="#2F3A22" stroke-width=".6" stroke-linecap="round"/>`, [[q[0]-2,q[1]-4],[q[0]+2,q[1]]]); });
  [[9,8,5.5,0],[23,6,6.5,-2.2],[m0-5,11,5,-4]].forEach(s => { const c = Q(s[0],s[1],zs+1.2); sc.raw(kk(s[0],s[1],0)+6, `<ellipse class="gfog" style="--del:${s[3]}s" cx="${c[0]}" cy="${c[1]}" rx="${(s[2]*1.3).toFixed(1)}" ry="${(s[2]*.42).toFixed(1)}" fill="#E8F1F4" stroke="none" opacity=".2"/>`, [[c[0]-s[2]*1.3,c[1]-s[2]*.42],[c[0]+s[2]*1.3,c[1]+s[2]*.42]]); });
  // hai bóng ma: chui lên từ mộ, lượn một vòng rồi chui xuống lại
  const ghost = (a,b,sz,da,db,dur,del) => {
    const c = Q(a,b,zs+4), d = Q(a+da,b+db,zs+4), gx = (d[0]-c[0]).toFixed(1), gy = (d[1]-c[1]).toFixed(1);
    const g = `<g class="gh" style="--gx:${gx}px;--gy:${gy}px;--dur:${dur}s;--del:${del}s"><g class="gb" style="--del:${del}s"><g transform="translate(${c[0]} ${c[1]}) scale(${sz})"><path d="M0 -9C-4.6 -9 -5.8 -4.4 -5.8 -.4L-5.8 5.6Q-4.8 4.6 -3.8 5.8Q-2.8 4.4 -1.8 5.8Q-.9 4.6 0 5.8Q.9 4.6 1.8 5.8Q2.8 4.4 3.8 5.8Q4.8 4.6 5.8 5.6L5.8 -.4C5.8 -4.4 4.6 -9 0 -9z" fill="#DDF1FA" fill-opacity=".9" stroke="#8FC6DE" stroke-width=".7"/><path d="M-3 -6.4C-3.6 -4.6 -3.9 -2 -3.8 .6" fill="none" stroke="#FFFFFF" stroke-width=".8" stroke-linecap="round" opacity=".8"/><ellipse cx="-2.1" cy="-4.2" rx="1.1" ry="1.6" fill="#10131B" stroke="none"/><ellipse cx="2.1" cy="-4.2" rx="1.1" ry="1.6" fill="#10131B" stroke="none"/><ellipse cx="0" cy="-.4" rx="1.1" ry="1.7" fill="#10131B" stroke="none"/></g></g></g>`;
    sc.raw(kk(a,b,0)+8, g, [[Math.min(c[0],d[0])-7*sz,Math.min(c[1],d[1])-22*sz],[Math.max(c[0],d[0])+7*sz,Math.max(c[1],d[1])+7*sz]]);
  };
  ghost(12.6,4.6,.62,7,3,7,0); ghost(25.2,12,.54,-7,-4,8.4,-3.6);
  const o = sc.out(X ? [A/2, W/2, 0] : [W/2, A/2, 0]); o.svg = o.svg.replace('stroke-width="1" stroke-linejoin','stroke-width=".55" stroke-linejoin'); return o;
}
const TILE3D = {}, RIM_EXT = .058;   // phần tiện ích lấn ra viền cỏ, tính theo bề rộng bàn cờ

const BN = {'An Giang':'AN GIANG','Cà Mau':'CÀ MAU','Langbiang':'LANG BIANG','Đà Lạt':'ĐÀ LẠT','Sa Pa':'SA PA','Quảng Bình':'QUẢNG BÌNH','Hạ Long':'HẠ LONG','Nhà thờ Đức Bà':'ĐỨC BÀ',
  'Công ty Điện':'ĐIỆN','Công ty Nước':'NƯỚC','Thuế thu nhập':'THUẾ','Nghĩa trang':'NGHĨA TRANG','Quỹ phúc lợi':'QUỸ','Hộp quà bí ẩn':'HỘP QUÀ','Khởi nghiệp':'KHỞI NGHIỆP'};
const boardName = n => BN[n] || String(n).replace(/^Sân bay /, '');
// Trạng thái động của ô góc: công viên đổi thời tiết mỗi nửa vòng, xe chở tiền tới ngân hàng mỗi 1/3 vòng
const CFX = {game:null, truck:-1, truckAt:0, wx:-1};
// Trời ngày đêm luân phiên theo thời gian chơi (đứng yên khi tạm dừng): ngày 90 giây, hoàng hôn, đêm 60 giây, bình minh
const SKY = {t:0, night:false, CYCLE:195};
const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a)/(b - a)));
function skyPaint(){
  const sk = typeof document!=='undefined' && document.getElementById('sky'); if(!sk) return;
  const t = SKY.t % SKY.CYCLE;
  const dusk = ramp(t, 82, 94) * (1 - ramp(t, 100, 112));          // ngày 0-85, hoàng hôn 85-110
  const night = ramp(t, 98, 112) * (1 - ramp(t, 168, 182));        // đêm 112-168
  const dawn = ramp(t, 166, 176) * (1 - ramp(t, 180, 195));        // bình minh 168-195
  const L = sk.children; L[1].style.opacity = dusk.toFixed(2); L[2].style.opacity = night.toFixed(2); L[3].style.opacity = dawn.toFixed(2);
  sk.style.setProperty('--sunY', Math.round(ramp(t, 70, 108)*130) + 'px');
  SKY.night = night > .5;
}
function skyTick(){ if(!S || S.over || PAUSED || document.hidden) return; const g = document.getElementById('game'); if(!g || g.hidden) return; SKY.t += 4; skyPaint(); }
const PERF = {done:false};
function perfGuard(){
  if(HEADLESS || PERF.done || PERF.busy) return; clearTimeout(PERF.t);
  if(document.visibilityState!=='visible' || PAUSED){ PERF.t = setTimeout(perfGuard, 3000); return; }
  PERF.busy = true; let nf = 0; const t0 = performance.now();
  const step = () => { nf++; if(nf < 90){ requestAnimationFrame(step); return; }
    const fps = 90000 / (performance.now() - t0); PERF.done = true; PERF.busy = false; PERF.fps = Math.round(fps);
    if(fps < 40) document.body.classList.add('lite');
    else { PERF.done = false; clearTimeout(PERF.t); PERF.t = setTimeout(perfGuard, 45000); } };   // máy còn mượt thì 45 giây sau đo lại, tới lúc giật thì chuyển chế độ nhẹ
  requestAnimationFrame(step);
}
function cornerState(kind){
  const n = S.players.length || 4, ph = Math.floor(S.turns*3/n);
  if(CFX.game !== S.start){ CFX.game = S.start; CFX.truck = ph; CFX.truckAt = 0; CFX.kind = ''; CFX.plane = 0; CFX.wx = -1; }
  if(ph !== CFX.truck){          // mỗi 1/3 vòng diễn một cảnh, luân phiên: xe chở tiền, máy bay cất cánh, áp giải trộm
    CFX.truck = ph; CFX.truckAt = Date.now();
    const r = ((ph % 3) + 3) % 3; CFX.kind = r===0 ? 'truck' : r===1 ? 'plane' : 'police'; CFX.plane = (Math.floor(ph/3) % 4 + 4) % 4;
    if(CFX.kind==='truck') SFX.amb('coinbig', 1.4, .7); else if(CFX.kind==='plane') SFX.amb('whoosh', .5, .6); else SFX.amb('warn', .4, .5);
  }
  const el = Date.now() - CFX.truckAt;
  if(kind==='park'){ let w = Math.floor(S.turns*2/n) % 4; w = SKY.night ? 3 : (w===3 ? 0 : w); if(w !== CFX.wx){ CFX.wx = w; if(w===1) SFX.amb('island', 0, .5); } return {c:'wx' + w, ev:0}; }
  if(kind==='gotojail') return (CFX.kind==='police' && CFX.truckAt && el < 6600) ? {c:'deliver', ev:el} : {c:'', ev:0};
  if(kind==='go') return (CFX.kind==='truck' && CFX.truckAt && el < 4600) ? {c:'deliver', ev:el} : {c:'', ev:0};
  return {c:'', ev:0};
}
// Cảm xúc của nhân vật: khóc khi bị giam hoặc bị đày, tức giận khi bị người khác kéo vào
function fxEmote(p, kind, delay){
  if(HEADLESS) return;
  setTimeout(() => {
    if(!S || !p.alive) return;
    const c = ptOf(p.pos), L = document.getElementById('fx'); if(!c || !L) return;
    const e = document.createElement('div'); e.className = 'emo ' + kind; e.style.cssText = `left:${c[0]}px;top:${c[1] - LAY.tk*.55}px;--z:${(LAY.tk/36).toFixed(2)}`;
    if(kind==='cry'){
      let t = ''; for(let k=0;k<10;k++) t += `<i class="tear" style="--s:${k%2 ? 1 : -1};--h:${14+Math.round(Math.random()*16)}px;--w:${10+Math.round(Math.random()*12)}px;animation-delay:${(k*.16).toFixed(2)}s"></i>`;
      e.innerHTML = t + '<b class="etx">HU HU HU…</b><span class="pud"></span>';
      SFX.play('cry');
    } else {
      e.innerHTML = '<b class="vein v1">💢</b><b class="vein v2">💢</b><i class="steam s1"></i><i class="steam s2"></i><b class="etx">GRRR!</b>';
    }
    L.appendChild(e);
    const tk = document.querySelector(`.tk[data-p="${p.id}"]`); if(tk){ tk.classList.add(kind==='cry' ? 'sob' : 'rage'); czSync(tk, p); setTimeout(() => { tk.classList.remove('sob','rage'); czSync(tk, p); }, 3200); }
    setTimeout(() => e.remove(), 3400);
  }, delay || 0);
}
let PCAR = null;
function policeCarSVG(){
  if(PCAR) return PCAR;
  const sc = isoScene(), cb = (x,y,z,w,d,h,c,k) => sc.box({x,y,z,w,d,h,c:[c, shade(c,.85), shade(c,.7)]}, k);
  cb(0,0,1,14,6,2.6,'#2B3348',1); cb(4.4,-.06,1,5,6.12,2.6,'#FFFFFF',2); cb(3.6,.5,3.6,6.6,5,2.2,'#3A4258',3); cb(5.4,1.2,5.8,1.5,3.6,.9,'#E0483A',4); cb(6.9,1.2,5.8,1.5,3.6,.9,'#3B82C4',5);
  const wl = (x,y) => { const a = sc.P(x,y,1.1); return `<circle cx="${a[0]}" cy="${a[1]}" r="1.5" fill="#1B2030"/><circle cx="${a[0]}" cy="${a[1]}" r=".6" fill="#C9D1DE" stroke="none"/>`; };
  sc.raw(9, wl(2.6,6) + wl(11.4,6));
  return PCAR = sc.out([7,3,0]);
}
// Xe cảnh sát chở người chơi tới ô Vào tù hoặc Đảo hoang (quân cờ ẩn đi trong lúc xe chạy)
function policeRide(p, from, to){
  if(HEADLESS || from===to) return;
  const a = ptOf(from), b = ptOf(to), L = document.getElementById('fx'); if(!a || !b || !L) return;
  p.rideUntil = Date.now() + 2000;
  const m = policeCarSVG(), e = document.createElement('div'); e.className = 'pride';
  e.style.cssText = `left:${a[0]}px;top:${a[1]}px;width:${(LAY.S*.085).toFixed(1)}px`;
  e.innerHTML = `<span class="prav" style="--c:${p.color}">${AV(p.id, undefined, 'cry')}</span><i class="prl r"></i><i class="prl b"></i>` + m.svg;
  L.appendChild(e); SFX.play('warn', 0, .7); SFX.play('warn', .7, .7);
  try { e.animate([{left:a[0]+'px', top:a[1]+'px'},{left:b[0]+'px', top:b[1]+'px'}], {duration:1700, delay:200, easing:'ease-in-out', fill:'forwards'}); } catch(err) { e.style.left = b[0]+'px'; e.style.top = b[1]+'px'; }
  setTimeout(() => { e.remove(); p.rideUntil = 0; if(S && !HEADLESS) render(); }, 2050);
}
function fxBuild(i){ if(!HEADLESS) S.built = {i, at: Date.now()}; fxBuildDust(i); }
// popup nâng cấp nhà: 4 thẻ nhà các cấp (hình, tiền thuê), cấp hiện tại và cấp sắp lên, tiền thuê tăng thêm bao nhiêu
function upgradeCard(p, i, lv, max, c){
  const t = TILES[i], to = lvAfter(lv, 1), r0 = baseRent(i, lv), r1 = baseRent(i, to);
  const cards = [0,1,2,3].map(l => { const st = l===lv ? 'cur' : (l>lv && l<=lvAfter(lv, max)) ? 'nx' : l<lv ? 'done' : '';
    return `<div class="lvc ${st}">${l===lv ? '<em>Đang ở</em>' : l===to ? '<em>Lên</em>' : ''}<small>${l ? LV[l] : 'Đất nền'}</small><span class="lvi">${l ? houseSVG(t.g, l, 'x', false, null, t.n) : '🚩'}</span><b>${baseRent(i,l)}</b></div>`; }).join('<i class="upar">›</i>');
  return `<div class="upg" style="--g:${G[t.g]}"><div class="buylv">${cards}</div>
    <div class="upgsum"><span>Tiền thuê</span><b>${r0}</b><em>➜</em><b class="nw">${r1}</b><u>+${r1 - r0}</u></div>
    <div class="upgmeta"><span>Phí nâng <b>${c}</b></span><span>${esc(p.name)} có <b>${p.cash}</b></span></div></div>`;
}
async function offerBuild(p, i){
  const t = TILES[i], lv = S.level[i];
  if(lv>=3){ log(`${p.name} về ${t.n}, ô này đã là cao ốc.`); return; }
  if(isColl(i)){ log(`${p.name} về ${t.n}, ô này đang bảo đảm khoản vay nên chưa nâng cấp được.`); return; }
  if(S.upLap[i]===p.laps && lv>0){ log(`${p.name} về ${t.n}, ô này đã nâng cấp trong vòng này rồi.`); return; }
  const c = buildCost(p, i), max = Math.min(perk(p,'xd') ? 2 : 1, 3-lv);
  let n = 0;
  if(p.bot){ const iq = botIQ(), keep = iq<=1 ? 250 : iq>=3 ? 100 : 150, mx = iq<=1 ? 1 : max; for(let k=mx;k>=1;k--) if(p.cash - c*k >= keep){ n = k; break; } }   // v139: Dễ nâng 1 cấp, giữ nhiều tiền; Cao thủ nâng mạnh
  else {
    const opts = [];
    for(let k=1;k<=max;k++){ const short = c*k - p.cash;
      opts.push({k, label:`Nâng lên ${LV[lvAfter(lv,k)]}`, sub: k>1 ? `Tốn ${c*k} · thuê +${baseRent(i,lvAfter(lv,k)) - baseRent(i,lv)}` + (short>0 ? ` · thiếu ${short}` : '') : (short>0 ? `Thiếu ${short}, cần vay` : ''), primary:k===1}); }
    opts.push({k:0, label:'Không nâng cấp'});
    if(S && S.tutm && window.TUTM) window.TUTM.ev('build');
    n = await ask(`Về nhà: ${t.n}`, upgradeCard(p, i, lv, max, c), opts);
    if(n && p.cash < c*n){
      const ok = await offerLoan(p, c*n - p.cash, `Thiếu ${c*n - p.cash} để nâng cấp`, 'Thôi, không nâng cấp', i);
      if(!ok) n = 0;
    }
  }
  if(!n){ log(`${p.name} về ${t.n}, không nâng cấp.`); return; }
  for(let k=0;k<n;k++) if(S.level[i]<3 && p.cash>=buildCost(p,i)) build(p, i);
  if(!HEADLESS && p.bot) cornerNote(p, '🏗️', 'Nâng cấp nhà', `${esc(t.n)}: ${LV[S.level[i]]}<br><small>Tốn ${c*n}</small>`);
  render();
}

// ----- Rao bán theo giá yêu cầu
const canList = p => !!(S.wait && S.wait.pid===p.id && !S.over && p.alive && p.listedTurn!==S.turns);
const sellable = (p, i) => S.owner[i]===p.id && S.level[i]===0 && !isColl(i);
// ----- Trao đổi đất: mỗi lượt được đề nghị 1 lần, chỉ đổi ô chưa xây và không bị ngân hàng giữ
const canTrade = p => !!(S.wait && S.wait.pid===p.id && S.wait.mode==='roll' && !S.over && p.alive && p.tradedTurn!==S.turns);
function tradeVal(q, i, hold){            // q coi ô i đáng bao nhiêu: hold = đang giữ (mất đi thì tiếc), ngược lại = sắp nhận
  const t = TILES[i]; let f = 1;
  if(t.k==='land'){ const idx = groupIdx(t.g), c = idx.filter(j => S.owner[j]===q.id && j!==i).length;
    if(hold) f = c+1===idx.length ? 3.2 : (idx.length===3 && c===1) ? 1.7 : 1.05;
    else f = c+1===idx.length ? 2.2 : (idx.length===3 && c===1) ? 1.5 : 1; }
  else if(t.k==='air'){ f = 1 + .25*TILES.filter((x,j) => x.k==='air' && S.owner[j]===q.id && j!==i).length; }
  else if(t.k==='co'){ f = TILES.some((x,j) => x.k==='co' && S.owner[j]===q.id && j!==i) ? 1.5 : 1; }
  return t.p*f;
}
// tỉ số lợi/thiệt của q khi nhận give + cash và nhả take cho p; càng cao q càng dễ gật
function tradeRatio(q, p, give, take, cash){
  let keep = tradeVal(q, take, true); const t = TILES[take];
  if(botIQ()>=2 && t.k==='land'){ const idx = groupIdx(t.g); if(idx.filter(j => S.owner[j]===p.id).length+1===idx.length) keep *= 1.6; }   // nhả ô này là p đủ nhóm
  const get = (give>=0 ? tradeVal(q, give, false) : 0) + cash;
  return get / Math.max(1, keep);
}
const tradeMargin = () => [0, .95, 1.1, 1.25][botIQ()] || 1.1;
const tradeText = (p, q, give, take, cash) => `${p.name} lấy ${TILES[take].n}` + (give>=0 ? `, đưa ${TILES[give].n}` : '') + (cash>0 ? `, trả thêm ${cash}` : cash<0 ? `, nhận thêm ${-cash}` : '');
async function runTrade(p, q, give, take, cash){
  if(!(p.bot || canTrade(p)) || !q || !q.alive || q.id===p.id || !sellable(q, take) || (give>=0 && !sellable(p, give)) || (cash>0 && p.cash<cash) || (cash<0 && q.cash<-cash)) return false;
  p.tradedTurn = S.turns; log(`${p.name} đề nghị đổi đất với ${q.name}: ${tradeText(p, q, give, take, cash)}.`);
  let yes;
  if(q.bot) yes = tradeRatio(q, p, give, take, cash) + (Math.random()*.1 - .05) >= tradeMargin();
  else yes = (await ask(`🤝 ${p.name} muốn đổi đất`, `<div class="stats"><div><small>${esc(q.name)} nhả</small><b style="font-size:15px">${TILES[take].n}</b></div><div><small>${esc(q.name)} nhận</small><b style="font-size:15px">${give>=0 ? TILES[give].n : 'Không có đất'}</b></div><div><small>Tiền</small><b style="font-size:15px">${cash>0 ? '+' + cash : cash<0 ? '−' + (-cash) : '0'}</b></div></div>`,
    [{k:'y', label:'Đồng ý đổi', primary:true}, {k:'n', label:'Từ chối'}], 20, q.id)) === 'y';
  if(yes){
    S.owner[take] = p.id; if(give>=0) S.owner[give] = q.id; p.cash -= cash; q.cash += cash;
    log(`${q.name} đồng ý. ${tradeText(p, q, give, take, cash)}.`); checkCombo(p, take); if(give>=0) checkCombo(q, give); quest(p, 'trade', 1); quest(q, 'trade', 1);
    if(!HEADLESS){ showBubble(p, '🤝', true); showBubble(q, '🤝', true); SFX.play('buy'); }
  } else { log(`${q.name} từ chối đổi đất.`); if(!HEADLESS && q.bot) botTalk(q, 'no', true); }
  render();
  if(!p.bot) await ask(yes ? '🤝 Đổi thành công' : '🙅 Bị từ chối', `<p>${yes ? esc(tradeText(p, q, give, take, cash)) + '.' : esc(q.name) + ' không chịu. Thử thêm tiền hoặc ô họ cần.'}</p>`, [{k:'ok', label:'Tiếp tục', primary:true}], 6, p.id);
  return yes;
}
// Người chơi soạn đề nghị: chọn ô đưa đi và số tiền thêm bớt, có báo trước máy dễ gật hay không
async function proposeTrade(p, take){
  if(HEADLESS || askOpen || !canTrade(p)) return;
  const q = S.players[S.owner[take]]; if(!q || q.id===p.id || !q.alive || !sellable(q, take)) return;
  const mineT = owned(p).filter(i => sellable(p, i)), T = {give:-1, cash:Math.max(0, Math.min(p.cash, Math.round(TILES[take].p/10)*10))};
  const draw = () => {
    const r = tradeRatio(q, p, T.give, take, T.cash), m = tradeMargin(), odds = !q.bot ? '' : r >= m+.08 ? '<b class="od hi">Dễ đồng ý</b>' : r >= m-.04 ? '<b class="od mid">Năm ăn năm thua</b>' : '<b class="od lo">Khó đồng ý</b>';
    const card = (i, on, tag) => { const t = TILES[i]; return `<${tag} class="trc ${on ? 'on' : ''}" ${tag==='button' ? `type="button" data-tg="${i}"` : ''} style="--g:${t.g ? G[t.g] : '#8A96A3'}"><i></i><b>${t.k==='air' ? t.n.replace(/^Sân bay /,'') : t.k==='co' ? t.n.replace(/^Công ty /,'') : t.n}</b><em>${t.p}</em>${on && tag==='button' ? '<u>✓</u>' : ''}</${tag}>`; };
    const money = T.cash>0 ? `Bạn trả thêm <b>${T.cash}</b>` : T.cash<0 ? `Bạn nhận thêm <b>${-T.cash}</b>` : 'Không kèm tiền';
    return `<div class="tr2"><div class="trcol"><small>Bạn nhận</small>${card(take, true, 'span')}<span class="trwho">của ${esc(q.name)}</span></div>
        <div class="trarr">⇄</div>
        <div class="trcol give"><small>Bạn đưa (chạm để chọn)</small><div class="trgive"><button type="button" class="trc none ${T.give<0 ? 'on' : ''}" data-tg="-1"><b>Không<br>đưa đất</b>${T.give<0 ? '<u>✓</u>' : ''}</button>${mineT.map(i => card(i, T.give===i, 'button')).join('')}</div></div></div>
      <div class="trmoney"><button type="button" class="chip" data-tc="-50">−50</button><button type="button" class="chip" data-tc="-10">−10</button><span class="${T.cash>0 ? 'pay' : T.cash<0 ? 'get' : ''}">💰 ${money}</span><button type="button" class="chip" data-tc="10">+10</button><button type="button" class="chip" data-tc="50">+50</button></div>
      ${odds ? `<div class="trodds"><small>${esc(q.name)}:</small>${odds}</div>` : ''}`;
  };
  closeModal();
  const pr = askLocal(`🤝 Đổi đất với ${q.name}`, `<div id="trBox">${draw()}</div>`, [{k:'go', label:'Gửi đề nghị', primary:true}, {k:'x', label:'Thôi'}], 45);
  const mb = document.getElementById('mBody');
  mb.onclick = e => { const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.tg!=null) T.give = +b.dataset.tg; else if(b.dataset.tc!=null) T.cash = Math.max(-q.cash, Math.min(p.cash, T.cash + (+b.dataset.tc))); else return;
    SFX.play('click'); const bx = document.getElementById('trBox'); if(bx) bx.innerHTML = draw(); };
  const c = await pr; mb.onclick = null;
  if(c!=='go'){ render(); return; }
  if(netClient()){ netEmit('req', {k:'trade', take, give:T.give, cash:T.cash}); return; }
  await runTrade(p, q, T.give, take, T.cash); render();
}
// Máy mức Vừa trở lên chủ động xin đổi khi chỉ còn thiếu đúng 1 ô là đủ nhóm
async function botTrade(p){
  if(!p.bot || !p.alive || botIQ()<2 || S.over) return;
  if(p.tradeTry!=null && S.round - p.tradeTry < 3) return;
  if(Math.random() > (botIQ()>=3 ? .35 : .2)) return;
  let take = -1;
  TILES.forEach((t,i) => { if(t.k!=='land') return; const o = S.owner[i]; if(o<0 || o===p.id) return; const q = S.players[o]; if(!q.alive || mate(p, q) || !sellable(q, i)) return;
    const idx = groupIdx(t.g); if(idx.filter(j => S.owner[j]===p.id).length+1 !== idx.length) return; if(take<0 || t.p > TILES[take].p) take = i; });
  if(take<0) return; p.tradeTry = S.round;
  const q = S.players[S.owner[take]];
  const spare = owned(p).filter(i => sellable(p, i) && !(TILES[i].k==='land' && (TILES[i].g===TILES[take].g || groupIdx(TILES[i].g).filter(j => S.owner[j]===p.id).length>=2))).sort((a,b) => tradeVal(q, b, false) - tradeVal(q, a, false));
  const give = spare.length ? spare[0] : -1;
  let cash = Math.round((TILES[take].p*1.5 - (give>=0 ? tradeVal(q, give, false) : 0))/10)*10; cash = Math.max(0, Math.min(cash, p.cash - 80)); if(p.cash < 80) cash = 0;
  if(q.bot && tradeRatio(q, p, give, take, cash) < tradeMargin()) return;
  if(!HEADLESS) botTalk(p, 'deal', true);
  await runTrade(p, q, give, take, cash);
}
function botValue(q, i){
  if(i<0) return 40;
  const t = TILES[i]; let f = .9 + Math.random()*.25;
  if(t.k==='land'){ const idx = groupIdx(t.g), c = idx.filter(j => S.owner[j]===q.id).length; if(c+1===idx.length) f = 2.2; else if(idx.length===3 && c===1) f = 1.5; }
  else if(t.k==='air'){ f += .25*TILES.filter((x,j) => x.k==='air' && S.owner[j]===q.id).length; }
  else if(t.k==='co'){ if(TILES.some((x,j) => x.k==='co' && S.owner[j]===q.id)) f = 1.5; }
  return Math.round(t.p*f);
}
function askPrice(p, name, ref){
  if(QUIT) return Promise.resolve(0);
  return new Promise(res => {
    askOpen = true;
    const body = `<div class="stats"><div><small>Giá gốc</small><b>${ref}</b></div><div><small>${esc(p.name)} đang có</small><b>${p.cash}</b></div></div>
      <div class="bidrow"><button class="chip" data-d="-50" aria-label="Giảm 50">−50</button><button class="chip" data-d="-10" aria-label="Giảm 10">−10</button>
        <input class="inp" id="bidIn" type="${SOFTKB ? 'text' : 'number'}" ${SOFTKB ? 'readonly inputmode="none"' : 'inputmode="numeric"'} min="1" step="10" value="${ref}" aria-label="Giá rao bán">
        <button class="chip" data-d="10" aria-label="Tăng 10">+10</button><button class="chip" data-d="50" aria-label="Tăng 50">+50</button></div>
      <p id="bidErr" class="bidmsg">Ai bấm mua trước thì được. Không ai mua thì hủy.</p>`;
    let unq = () => {};
    const done = v => { unq(); askOpen = false; closeModal(); res(v); }; unq = onQuit(() => done(0));
    openModal(`Rao bán ${name}`, body, [
      {label:'Rao bán', primary:true, fn: () => { const v = Math.floor(+document.getElementById('bidIn').value); if(!(v>=1)){ const m = document.getElementById('bidErr'); m.textContent = 'Hãy nhập giá lớn hơn 0.'; m.classList.add('warn'); return; } done(v); }},
      {label:'Thôi', fn: () => done(0)}]);
    const inp = document.getElementById('bidIn');
    document.querySelectorAll('.bidrow .chip').forEach(b => b.onclick = () => { inp.value = Math.max(1, (Math.floor(+inp.value)||ref) + (+b.dataset.d)); });
    inp.focus(); inp.select();
  });
}
async function listForSale(p, i){
  if(HEADLESS || askOpen || !canList(p)) return;
  const isCard = i<0; if(isCard ? p.card<1 : !sellable(p, i)) return;
  stopEndTimer();
  const name = isCard ? 'thẻ Ra tù miễn phí' : TILES[i].n, price = await askPrice(p, name, isCard ? 50 : TILES[i].p);
  if(price>0){ if(netClient()){ netEmit('req', {k:'sell', i, price}); return; } await runSale(p, i, price); }
  render(); if(S.wait && S.wait.mode==='end' && S.wait.pid===p.id) startEndTimer(p);
}
async function runSale(p, i, price){
  const isCard = i<0, name = isCard ? 'thẻ Ra tù miễn phí' : TILES[i].n;
  p.listedTurn = S.turns; log(`${p.name} rao bán ${name} với giá ${price}.`);
  let buyer = null; const n = S.players.length;
  for(let k=1;k<n && !buyer;k++){
    const q = S.players[(p.id+k)%n]; if(!q.alive) continue;
    let yes;
    if(q.bot) yes = q.cash - price >= 80 && price <= botValue(q, i);
    else yes = q.cash >= price && (await ask(`${p.name} rao bán ${name}`, `<div class="stats"><div><small>Giá bán</small><b>${price}</b></div><div><small>${esc(q.name)} đang có</small><b>${q.cash}</b></div></div>`,
      [{k:'y', label:`${q.name} mua`, primary:true}, {k:'n', label:'Không mua'}], 15, q.id)) === 'y';
    if(yes) buyer = q;
  }
  if(buyer){
    buyer.cash -= price;
    if(isCard){ p.card--; buyer.card++; } else S.owner[i] = buyer.id;
    gain(p, price, buyer.pos); log(`${buyer.name} mua ${name} của ${p.name} với giá ${price}.`);
    if(!isCard) checkCombo(buyer, i);
    render();
    await ask('Đã bán', `<div class="stats"><div><small>Người mua</small><b>${esc(buyer.name)}</b></div><div><small>Bạn nhận</small><b>${price}</b></div></div>`, [{k:'ok', label:'Tiếp tục', primary:true}], 6, p.id);
  } else {
    log(`Không ai mua ${name} với giá ${price}.`);
    await ask('Không ai mua', '<p class="bn">Lượt sau thử rao giá khác nhé.</p>', [{k:'ok', label:'Đóng', primary:true}], 6, p.id);
  }
}

// ----- Túi đồ: dùng vật phẩm trong lượt của mình
function applyBright(){
  if(HEADLESS) return; let d = document.getElementById('dimmer'); if(!d){ d = document.createElement('div'); d.id = 'dimmer'; document.body.appendChild(d); }
  const b = SYS.get('bright'); d.style.opacity = (b==null ? 0 : Math.max(0, Math.min(.6, 1 - b))).toFixed(2);
}
function openSystem(){
  if(askOpen) return;
  const sw = (id, on) => `<button type="button" class="tgl ${on?'on':''}" id="${id}" role="switch" aria-checked="${on?'true':'false'}"><i></i></button>`;
  const vs = (id, label, v) => `<label class="sysvsl"><span>${label}</span><input type="range" id="${id}" min="0" max="100" value="${Math.round(v*100)}" aria-label="${label}"><b id="${id}v">${Math.round(v*100)}</b></label>`;
  const line = (ic, label, ctl) => `<div class="sysline"><span class="sysic">${ic}</span><b>${label}</b><span class="sysend">${ctl}</span></div>`;
  const a = `<div class="sysgrp"><div class="tag">Âm thanh</div>${vs('vMas','🔊 Tổng',SFX.vol('master'))}${vs('vMus','🎵 Nhạc',SFX.vol('mus'))}${vs('vSfx','🔔 Hiệu ứng',SFX.vol('sfx'))}${line('🔇','Tắt tiếng', sw('swMute', SFX.vol('master')<=0))}</div>`;
  const b = `<div class="sysgrp"><div class="tag">Màn hình</div>${window.FS_ && !window.FS_.app() ? line('⛶','Toàn màn hình', sw('swFs', window.FS_.on())) : ''}${line('🔋','Tiết kiệm pin', sw('swEco', !!SYS.get('eco')))}${vs('vBri','☀️ Độ sáng', SYS.get('bright')==null ? 1 : SYS.get('bright'))}</div>`;
  const pk0 = paceKey(), c = `<div class="sysgrp"><div class="tag">Nhịp game</div><div class="pacerow" role="radiogroup" aria-label="Nhịp game">${['slow','mid','fast'].map(k => `<button type="button" class="pacebtn ${k===pk0 ? 'on' : ''}" data-pace="${k}" role="radio" aria-checked="${k===pk0}">${{slow:'🐢',mid:'🚶',fast:'🐇'}[k]} ${PACE_N[k]}</button>`).join('')}</div><p class="pacenote">Chậm: máy đi thong thả, thông báo hiện lâu hơn để kịp đọc. Ván online đi theo nhịp chung của phòng.</p></div>`;
  openModal('⚙️ Hệ thống', `<div class="sysgrid"><div>${a}</div><div>${b}${c}</div></div>`, [{label:'📖 Hướng dẫn', fn: () => { closeModal(); setTimeout(openGuide, 80); }}, {label:'Xong', primary:true, fn: closeModal}], 'one sys');
  const $$ = id => document.getElementById(id); let tm = null;
  $$('vBri').min = 40; $$('vBri').oninput = () => { const v = Math.max(40, +$$('vBri').value); SYS.set('bright', v/100); $$('vBriv').textContent = v; applyBright(); };
  [['vMas','master'],['vMus','mus'],['vSfx','sfx']].forEach(x => { $$(x[0]).oninput = () => { SFX.setVol(x[1], $$(x[0]).value/100); $$(x[0]+'v').textContent = $$(x[0]).value; if(x[1]!=='mus'){ clearTimeout(tm); tm = setTimeout(() => SFX.play('coin'), 120); } $$('swMute').classList.toggle('on', SFX.vol('master')<=0); }; });
  $$('swMute').onclick = () => { const mute = SFX.vol('master')>0; SFX.setVol('master', mute ? 0 : 1); $$('vMas').value = mute ? 0 : 100; $$('vMasv').textContent = mute ? 0 : 100; $$('swMute').classList.toggle('on', mute); $$('swMute').setAttribute('aria-checked', mute); };
  const flip = (id, k, fn) => { $$(id).onclick = () => { const v = !SYS.get(k); SYS.set(k, v); $$(id).classList.toggle('on', v); $$(id).setAttribute('aria-checked', v); if(fn) fn(v); }; };
  flip('swEco','eco', () => SYS.set('ecoUser', true));
  if($$('swFs')) $$('swFs').onclick = () => { closeModal(); window.FS_.toggle(); };
  document.querySelectorAll('.pacebtn').forEach(x => x.onclick = () => { SYS.set('pace', x.dataset.pace); document.querySelectorAll('.pacebtn').forEach(y => { const on = y===x; y.classList.toggle('on', on); y.setAttribute('aria-checked', on); }); });

  micUI();
}
function openGuide(){
  const steps = [
    ['📖','Câu chuyện','Hổ, Trâu, Voi và Gà rời quê lên phố lập nghiệp. Bốn bạn đi dọc ba miền, mua đất, dựng nhà, ai lên đời trước thì thắng.'],
    ['🎯','Mục tiêu','Mua đất, xây nhà, thu tiền thuê. Hết ván ai có tổng tài sản lớn nhất là người thắng.'],
    ['🎲','Bắt đầu','Chọn nhân vật, rồi mỗi người gieo một viên: ai cao hơn đi trước, bằng nhau thì gieo lại.'],
    ['⏱','Lượt đi','Bấm GIEO trong 17 giây, hết giờ game tự gieo. Ra đôi được đi thêm, ba lần đôi liên tiếp thì vào tù.'],
    ['🏠','Mua đất','Dừng ở ô chưa có chủ: mua, mở đấu giá kín, hoặc bỏ qua. Có 17 giây để quyết.'],
    ['🔨','Xây nhà','Về lại đất của mình thì nâng 1 cấp, tối đa 3 cấp (cấp 3 là cao ốc địa danh). Số trên ô là tiền thuê người khác phải trả.'],
    ['🏅','Huy hiệu','Gom đủ một nhóm màu để nhận huy hiệu có lợi ích riêng. Đủ 2 huy hiệu là thắng sớm.'],
    ['🏦','Vay tiền','Thiếu tiền thì vay ngân hàng (thế chấp nhà) hoặc vay xã hội. Bán đất, trả nợ, dùng vật phẩm làm trước khi gieo.'],
    ['🚓','Tù và đảo','Vào tù hay bị kéo ra Đảo hoang thì xe cảnh sát chở đi. Nộp tiền hoặc gieo đôi để ra sớm.'],
    ['❓','Ô đặc biệt','Dấu hỏi là Cơ hội, cỏ bốn lá là Khí vận, hộp quà cho quà ngẫu nhiên. Chạm vào ô bất kỳ để xem tác dụng.'],
    ['🎒','Vật phẩm','Mua ở Cửa hàng bằng xu, mở Túi đồ trong ván để dùng. Mỗi ván tối đa 3 món.'],
    ['🤝','Đổi đất','Tới lượt mình, chạm thẻ người chơi khác rồi bấm Đổi ở ô muốn lấy. Mỗi lượt đề nghị được 1 lần.'],
    ['🏆','Kết thúc','Ván nhanh 20 vòng, ván dài 60 vòng. 3 vòng cuối tiền thuê gấp đôi. Thắng ngay nếu gom đủ 3 nhóm màu hoặc chiếm trọn đất 1 cạnh bàn. Thắng được xu và EXP để lên cấp.']
  ];
  openModal('📖 Hướng dẫn', '<button type="button" class="btn primary" id="tutOn" style="width:100%;margin-bottom:8px">🎓 Chơi lại ván hướng dẫn</button><div class="guide">' + steps.map((x,k) => `<div class="gstep"><span class="gic">${x[0]}</span><div><b>${k+1}. ${x[1]}</b><span>${x[2]}</span></div></div>`).join('') + '</div>', [{label:'Đã hiểu', primary:true, fn: closeModal}], 'one sys gd');
  const tb = document.getElementById('tutOn'); if(tb) tb.onclick = () => { TUT.reset(); try { window.TUTM && window.TUTM.again(); } catch(e) {} tb.textContent = '✓ Ván Chơi với máy tới sẽ có hướng dẫn'; tb.disabled = true; SFX.play('pop'); };
}
function openBag(){
  if(HEADLESS || askOpen || !S) return;
  if(S.mode==='rank'){ openModal('🎒 Túi đồ', '<p class="bn" style="margin:0">Trận xếp hạng không dùng vật phẩm, để mọi người thi đấu công bằng.</p>', [{label:'Đã hiểu', primary:true, fn: closeModal}]); return; }
  const p = S.players[S.viewer], myTurn = !!(S.wait && S.wait.pid===p.id && !S.over), left = ITEM_MAX - p.itemsUsed;
  stopEndTimer();
  const rows = Object.keys(ITEMS).map(k => { const it = ITEMS[k], n = STORE.has(k);
    const ok = myTurn && left>0 && n>0 && ((k!=='dice' && k!=='banhmi') || S.wait.mode==='roll') && ((k!=='fruit' && k!=='ot') || alive().some(q => q.id!==p.id));
    const why = n<1 ? 'Chưa có, mua ở Cửa hàng' : !myTurn ? 'Chờ tới lượt bạn' : left<1 ? `Đã dùng đủ ${ITEM_MAX} món ván này` : (k==='dice' && S.wait.mode!=='roll') ? 'Dùng trước khi gieo' : '';
    return `<div class="asrow"><span class="as"><span class="bagi">${it.i}</span><span class="an"><b>${it.n} × ${n}</b><small>${ok ? it.d : why}</small></span></span><button class="btn mini" data-use="${k}" ${ok?'':'disabled'}>Dùng</button></div>`; }).join('');
  closeBagFan();
  const btn = document.getElementById('bagBtn'), host = btn.offsetParent || btn.parentNode, keys = STORE.pack, n = Math.max(2, keys.length);
  const cx = btn.offsetLeft + btn.offsetWidth/2, cy = btn.offsetTop + btn.offsetHeight/2;
  const R = Math.max(92, Math.min(128, cx - 30, host.clientWidth - cx - 30, cy - 110)), sz = Math.max(30, Math.min(46, Math.floor(Math.PI*.89*R/(n-1)) - 5));
  const info = {};
  const its = keys.map((k, x) => { const it = ITEMS[k], c = STORE.has(k);
    const ok = myTurn && left>0 && c>0 && ((k!=='dice' && k!=='banhmi') || S.wait.mode==='roll') && ((k!=='fruit' && k!=='ot') || alive().some(q => q.id!==p.id));
    const why = c<1 ? 'Chưa có, mua ở Cửa hàng' : !myTurn ? 'Chờ tới lượt bạn' : left<1 ? `Đã dùng đủ ${ITEM_MAX} món ván này` : (k==='dice' && S.wait.mode!=='roll') ? 'Dùng trước khi gieo' : '';
    info[k] = {it, c, ok, why};
    const a = Math.PI*(.945 - .89*x/(n-1)), dx = Math.cos(a)*R, dy = -Math.sin(a)*R;
    return `<button class="bfi ${c<1?'none':''} ${ok?'ok':''}" data-k="${k}" aria-label="${it.n}, có ${c}" style="--x:${dx.toFixed(1)}px;--y:${dy.toFixed(1)}px;--d:${x*28}ms;--s:${sz}px"><span>${it.i}</span>${c>0?`<i>${c}</i>`:''}</button>`; }).join('');
  const stars = [0,1,2,3,4,5,6].map(x => { const a = Math.PI*(.06 + x*.147), r = R + (x%2 ? 34 : -34); return `<em style="left:${(Math.cos(a)*r).toFixed(0)}px;top:${(-Math.sin(a)*r).toFixed(0)}px;animation-delay:${x*.23}s">✦</em>`; }).join('');
  const f = document.createElement('div'); f.id = 'bagFan'; f.style.setProperty('--cx', cx+'px'); f.style.setProperty('--cy', cy+'px');
  const cw = Math.min(250, host.clientWidth - 16), cl = Math.max(8, Math.min(host.clientWidth - cw - 8, cx - cw/2));
  f.innerHTML = `<div class="bfc" style="left:${cl}px;width:${cw}px;bottom:${(host.clientHeight - cy + R + sz/2 + 12).toFixed(0)}px;--tx:${(cx - cl).toFixed(0)}px"></div><div class="bfo">${stars}${its}<button class="bfh" aria-label="Đóng túi đồ">🎒</button><b class="bfl">Còn ${Math.max(0,left)} lượt dùng</b></div>`;
  host.appendChild(f);
  const card = f.querySelector('.bfc');
  const pick = k => { f.querySelectorAll('.bfi').forEach(b => b.classList.toggle('on', b.dataset.k===k));
    if(!k){ card.innerHTML = '<p>✨ Chạm một món để xem và dùng</p>'; return; }
    const d = info[k];
    card.innerHTML = `<div class="bft"><span>${d.it.i}</span><div><b>${d.it.n} × ${d.c}</b><small>${d.it.d}</small>${d.ok ? '' : `<small class="w">${d.why}</small>`}</div></div><button class="btn primary" data-use="${k}" ${d.ok?'':'disabled'}>Dùng</button>`; };
  pick(keys.find(k => info[k].ok) || '');
  f.onclick = async e => {
    const u = e.target.closest('[data-use]'); if(u){ if(u.disabled) return; f.remove(); await useItem(u.dataset.use); if(S && S.wait && S.wait.mode==='end' && S.wait.pid===p.id && !endTimer) startEndTimer(p); return; }
    const b = e.target.closest('.bfi'); if(b){ pick(b.dataset.k); return; }
    if(e.target.closest('.bfc')) return;
    closeBagFan(true);
  };
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('open')));
}
function closeBagFan(resume){
  const f = document.getElementById('bagFan'); if(!f) return; f.remove();
  if(resume && S && S.wait && S.wait.mode==='end') startEndTimer(S.players[S.viewer]);
}
// ----- Khung truyện hài khi dùng vật phẩm
const IFX = (() => {
  const S0 = 'stroke="#2B3A67" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  return {
    whole:`<svg viewBox="0 0 60 50" aria-hidden="true"><ellipse cx="30" cy="25" rx="27" ry="22" fill="#6DB868" ${S0}/><g fill="none" stroke="#2F7A3A" stroke-width="3.2" stroke-linecap="round"><path d="M14 8q-5 17 0 34"/><path d="M24 4q-4 21 0 42"/><path d="M36 4q4 21 0 42"/><path d="M46 8q5 17 0 34"/></g><path d="M9 16q4-8 12-10" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" opacity=".75"/></svg>`,
    melon:`<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M2 5A30 30 0 0 0 62 5Z" fill="#86BC82" ${S0}/><path d="M7.5 5A24.5 24.5 0 0 0 56.5 5Z" fill="#FFFDF6"/><path d="M10.5 5A21.5 21.5 0 0 0 53.5 5Z" fill="#E0685C" ${S0}/><g fill="#2B3A67"><ellipse cx="21" cy="12" rx="1.6" ry="2.4"/><ellipse cx="32" cy="18" rx="1.6" ry="2.4"/><ellipse cx="43" cy="12" rx="1.6" ry="2.4"/><ellipse cx="26.5" cy="20" rx="1.4" ry="2.1"/><ellipse cx="37.5" cy="20" rx="1.4" ry="2.1"/></g></svg>`,
    splat:`<svg viewBox="0 0 60 66" aria-hidden="true"><path d="M30 6Q36 2 39 9Q48 6 47 15Q57 17 51 25Q59 33 49 36Q52 46 42 45Q40 55 31 49Q22 56 20 46Q9 48 13 38Q2 34 10 27Q3 18 13 16Q12 6 22 10Q25 3 30 6Z" fill="#E0685C" ${S0}/><path d="M18 46v10q0 4 3 4t3-4v-9M40 46v7q0 3 2.5 3t2.5-3v-8" fill="#E0685C" ${S0}/><path d="M14 22q7-7 16-6" fill="none" stroke="#86BC82" stroke-width="5" stroke-linecap="round"/><g fill="#2B3A67"><ellipse cx="24" cy="26" rx="1.8" ry="2.6"/><ellipse cx="36" cy="22" rx="1.8" ry="2.6"/><ellipse cx="33" cy="36" rx="1.8" ry="2.6"/><ellipse cx="43" cy="31" rx="1.6" ry="2.3"/><ellipse cx="22" cy="38" rx="1.6" ry="2.3"/></g><path d="M24 14q3-3 7-1" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`,
    cup:`<svg viewBox="0 0 40 58" aria-hidden="true"><path d="M23 14L29 1" fill="none" stroke="#E0685C" stroke-width="4" stroke-linecap="round"/><path d="M8 16H32L29 51Q20 56 11 51Z" fill="#EBC9A0" ${S0}/><path d="M9.5 30H30.5L29 51Q20 56 11 51Z" fill="#C99A6B"/><rect x="5" y="11" width="30" height="6" rx="3" fill="#FFFDF6" ${S0}/><g fill="#2B3A67"><circle cx="15" cy="46" r="2.4"/><circle cx="21" cy="48" r="2.4"/><circle cx="26" cy="45" r="2.4"/><circle cx="18" cy="40" r="2.2"/><circle cx="24" cy="39" r="2.2"/></g></svg>`,
    umb:`<svg viewBox="0 0 70 62" aria-hidden="true"><path d="M35 28V52q0 7-6 7" fill="none" ${S0}/><path d="M3 30Q35-10 67 30Q59 23 51 30Q43 23 35 30Q27 23 19 30Q11 23 3 30Z" fill="#5FA8D3" ${S0}/><path d="M35 7V2" fill="none" ${S0}/><path d="M19 30Q22 14 35 8M51 30Q48 14 35 8" fill="none" stroke="#2B3A67" stroke-width="1.4" opacity=".55"/></svg>`,
    die:`<svg viewBox="0 0 44 44" aria-hidden="true"><rect x="4" y="4" width="36" height="36" rx="9" fill="#F4C542" ${S0}/><path d="M9 12q4-5 12-5" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".8"/><g fill="#FFFDF6" stroke="#2B3A67" stroke-width="1.4"><circle cx="14" cy="14" r="3.2"/><circle cx="30" cy="14" r="3.2"/><circle cx="22" cy="22" r="3.2"/><circle cx="14" cy="30" r="3.2"/><circle cx="30" cy="30" r="3.2"/></g></svg>`
  };
})();
function itemFx(k, pid, tid){
  if(HEADLESS || !S) return;
  const p = S.players[pid], q = tid>=0 ? S.players[tid] : null; if(!p) return;
  document.querySelectorAll('#itemFx').forEach(e => e.remove());
  let scene, word, cap;
  if(k==='fruit'){
    if(!q) return;
    let drops = '';
    for(let n=0;n<16;n++){ const a = Math.round(n*360/16 + Math.random()*14), d = 60 + Math.round(Math.random()*90), z = 7 + Math.round(Math.random()*9); drops += `<i style="--a:${a}deg;--d:${d}px;width:${z}px;height:${z}px;animation-delay:${(1.66 + Math.random()*.12).toFixed(2)}s"></i>`; }
    scene = `<div class="ifA">${AV(p.id)}</div><div class="melon">${IFX.whole}</div><div class="ifB">${AV(q.id)}<div class="splat">${IFX.splat}</div><div class="dizzy">✦ ✧ ✦</div></div>
      <div class="juice">${drops}<u class="ch c1">${IFX.melon}</u><u class="ch c2">${IFX.melon}</u><u class="ch c3">${IFX.melon}</u></div><i class="spd s1"></i><i class="spd s2"></i><i class="spd s3"></i>`;
    word = 'BỐP!'; cap = `${esc(p.name)} ném dưa trúng mặt ${esc(q.name)}. ${esc(q.name)} nghỉ 1 lượt!`;
  } else if(k==='tea'){
    scene = `<div class="ifC">${AV(p.id)}<div class="cup">${IFX.cup}</div></div><b class="ifw w2">ỰC!</b>`;
    word = 'ỰC ỰC!'; cap = `${esc(p.name)} làm ly trà sữa: 2 lần qua Xuất phát tới nhận thêm 100`;
  } else if(k==='umb'){
    scene = `<div class="ifC">${AV(p.id)}<div class="umbr">${IFX.umb}</div></div><i class="ifcn c1">₫</i><i class="ifcn c2">₫</i><i class="ifcn c3">₫</i>`;
    word = 'CHE!'; cap = `${esc(p.name)} bật ô: tiền thuê lần tới chỉ trả một nửa`;
  } else if(k==='dice'){
    scene = `<div class="ifC">${AV(p.id)}<div class="gdie">${IFX.die}</div></div><i class="spk2 k1">✦</i><i class="spk2 k2">✧</i><i class="spk2 k3">✦</i>`;
    word = 'LẦN NỮA!'; cap = `${esc(p.name)} cầm Xúc xắc vàng: lượt này được gieo lại 1 lần`;
  } else if(ITEMS[k]){
    scene = `<div class="ifC">${AV(p.id)}<div class="gfood">${ITEMS[k].i}</div></div>` + (q ? `<div class="ifB">${AV(q.id)}<div class="dizzy">✦ ✧ ✦</div></div>` : '');
    word = {banhmi:'MĂM MĂM!', cafe:'TỈNH NGỦ!', ot:'CAY QUÁ!', dua:'MÁT RƯỢI!', pho:'NO NÊ!'}[k] || 'NGON!';
    cap = `${esc(p.name)} dùng ${ITEMS[k].n}${q ? ' mời ' + esc(q.name) : ''}`;
  } else return;
  const ov = document.createElement('div'); ov.id = 'itemFx'; ov.className = 'k-' + k;
  ov.innerHTML = `<div class="ifp"><div class="ifs">${scene}<b class="ifw">${word}</b></div><div class="ifcap">${cap}</div></div>`;
  document.body.appendChild(ov); ov.onclick = () => ov.remove();
  { const T = (n, ms) => setTimeout(() => SFX.play(n), ms);
    if(k==='fruit'){ T('whoosh', 620); T('splat', 1660); T('chat', 1950); } else if(k==='tea') T('slurp', 250); else if(k==='umb') T('umbrella', 150); else if(k==='dice'){ T('sparkle', 80); T('dice', 350); } }
  setTimeout(() => ov.remove(), k==='fruit' ? 5200 : 3600);
}
// ----- Nhiệm vụ hằng ngày và thành tích (lưu trên máy)
const QUEST = (() => {
  // 6 nhiệm vụ mỗi ngày: 5 việc cố định và 1 việc đổi theo ngày. r = xu, x = kinh nghiệm
  const DAILY = [{k:'login', n:'Vào game hôm nay', g:1, r:10, x:20}, {k:'play', n:'Chơi xong 2 ván', g:2, r:20, x:40}, {k:'buy', n:'Mua 5 ô đất', g:5, r:15, x:30},
    {k:'rent', n:'Thu 500 tiền thuê', g:500, r:15, x:30}, {k:'card', n:'Rút 3 thẻ Cơ hội hoặc Khí vận', g:3, r:10, x:20}];
  const DALT = [{k:'win', n:'Về nhất 1 ván', g:1, r:25, x:50}, {k:'gift', n:'Tặng 1 món quà cho bạn bè', g:1, r:15, x:30}, {k:'build', n:'Xây 3 cấp nhà', g:3, r:15, x:30}, {k:'item', n:'Dùng 1 vật phẩm', g:1, r:15, x:30},
    {k:'auction', n:'Thắng 1 phiên đấu giá', g:1, r:20, x:40}, {k:'trade', n:'Đổi đất thành công 1 lần', g:1, r:20, x:40}, {k:'tower', n:'Xây 1 cao ốc', g:1, r:25, x:50},
    {k:'set', n:'Gom đủ 1 nhóm màu', g:1, r:25, x:50}, {k:'startup', n:'Rót vốn Khởi nghiệp 1 lần', g:1, r:15, x:30}, {k:'cut', n:'Cắt điện nước 1 lần', g:1, r:15, x:30}];
  // mỗi cấp 1 nhiệm vụ, tính theo tổng thành tích từ trước tới giờ; mở khi bạn đạt cấp đó
  const LQ = [['play',1,'Chơi xong 1 ván'],['buy',10,'Mua tổng 10 ô đất'],['rent',1000,'Thu tổng 1.000 tiền thuê'],['build',10,'Xây tổng 10 cấp nhà'],['win',3,'Về nhất 3 ván'],
    ['set',3,'Gom đủ 3 nhóm màu'],['item',10,'Dùng 10 vật phẩm'],['card',30,'Rút 30 thẻ Cơ hội hoặc Khí vận'],['play',20,'Chơi 20 ván'],['tower',5,'Xây 5 cao ốc'],
    ['startup',5,'Rót vốn Khởi nghiệp 5 lần'],['win',10,'Về nhất 10 ván'],['rent',10000,'Thu tổng 10.000 tiền thuê'],['trade',5,'Đổi đất thành công 5 lần'],['jackpot',3,'Nổ hũ Quỹ 3 lần'],
    ['play',50,'Chơi 50 ván'],['set',15,'Gom đủ 15 nhóm màu'],['friend',5,'Kết bạn với 5 người'],['gift',20,'Tặng 20 món quà cho bạn bè'],['win',25,'Về nhất 25 ván'],
    ['tower',20,'Xây 20 cao ốc'],['rent',40000,'Thu tổng 40.000 tiền thuê'],['airking',1,'Thành Ông trùm hàng không 1 lần'],['cut',5,'Cắt điện nước 5 lần'],['play',100,'Chơi 100 ván'],
    ['buy',400,'Mua tổng 400 ô đất'],['win',50,'Về nhất 50 ván'],['set',40,'Gom đủ 40 nhóm màu'],['marry',1,'Kết hôn với một người bạn'],['play',200,'Chơi 200 ván']]
    .map((q,n) => ({L:n+1, k:q[0], g:q[1], n:q[2], r:20 + 10*(n+1), x:100 + 50*(n+1)}));
  const KEY = 'lendoi_quest', today = () => Math.floor((Date.now() + 7*36e5)/864e5);       // ngày tính theo giờ Việt Nam
  let d = {}; try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {} };
  const roll = () => { const t = today(); if(d.day!==t){ d.day = t; d.dp = {}; d.dc = {}; } d.ap = d.ap || {}; d.lc = d.lc || {}; d.dp = d.dp || {}; d.dc = d.dc || {}; if(!d.dp.login){ d.dp.login = 1; save(); } };
  const daily = () => { roll(); return DAILY.concat([DALT[d.day % DALT.length], DALT[(d.day + 5) % DALT.length]]); };   // 2 việc đổi theo ngày
  return {
    add(k, n){ roll(); d.dp[k] = (d.dp[k]||0) + n; d.ap[k] = (d.ap[k]||0) + n; save(); },
    list(){ roll(); const lv = lvOf(STORE.exp).L;
      return {daily: daily().map(q => ({id:'d:'+q.k, n:q.n, g:q.g, r:q.r, x:q.x, v:Math.min(q.g, d.dp[q.k]||0), got:!!d.dc[q.k]})),
              level: LQ.map(q => ({id:'l:'+q.L, L:q.L, n:q.n, g:q.g, r:q.r, x:q.x, v:Math.min(q.g, d.ap[q.k]||0), got:!!d.lc[q.L], lock:q.L > lv}))}; },
    claim(id){ roll(); const L = this.list(), q = L.daily.concat(L.level).find(x => x.id===id); if(!q || q.got || q.lock || q.v<q.g) return null; if(id[0]==='d') d.dc[id.slice(2)] = 1; else d.lc[q.L] = 1; save(); return {r:q.r, x:q.x}; },
    ready(){ const L = this.list(); return L.daily.concat(L.level).filter(x => !x.got && !x.lock && x.v>=x.g).length; }
  };
})();
// ----- Danh hiệu: nhiệm vụ dài hạn, mở khóa huy chương để đeo (lưu trên máy)
const RAR = {1:{n:'Thường', c:'#5FA8D3'}, 2:{n:'Hiếm', c:'#8E5CF0'}, 3:{n:'Huyền thoại', c:'#E3A21A'}};
const TITLES = [
  {id:'tanbinh', n:'Tân binh lên đời', i:'🐣', r:1, k:'play', g:1, d:'Chơi xong 1 ván'},
  {id:'chamchi', n:'Nhà đầu tư chăm chỉ', i:'📅', r:3, k:'play', g:1000, d:'Chơi xong 1000 ván'},
  {id:'taiba', n:'Nhà đầu tư tài ba', i:'🏆', r:2, k:'wm', g:3, d:'Về nhất ở cả 3 chế độ: Chơi với máy, Chơi với bạn, Xếp hạng'},
  {id:'trum', n:'Ông trùm địa ốc', i:'🗺️', r:3, k:'sets', g:8, d:'Gom đủ cả 8 nhóm màu (mỗi nhóm ít nhất 1 lần, cộng dồn qua các ván)'},
  {id:'caooc', n:'Vua cao ốc', i:'🏙️', r:2, k:'tower', g:50, d:'Xây 50 cao ốc'},
  {id:'thantai', n:'Thần tài gõ cửa', i:'💰', r:2, k:'rent', g:50000, d:'Thu tổng cộng 50.000 tiền thuê'},
  {id:'daugia', n:'Thánh đấu giá', i:'🔨', r:2, k:'auction', g:30, d:'Thắng 30 phiên đấu giá'},
  {id:'laibuon', n:'Lái buôn đất', i:'🤝', r:1, k:'trade', g:50, d:'Đổi đất thành công 50 lần'},
  {id:'chuoi', n:'Chuỗi thắng', i:'🔥', r:3, k:'streak', g:5, d:'Thắng 5 ván liên tiếp'},
  {id:'kimcuong', n:'Kim cương bất bại', i:'💎', r:3, k:'rpMax', g:700, d:'Đạt hạng Kim cương trong Xếp hạng (700 điểm)'},
  {id:'dao', n:'Cư dân Đảo hoang', i:'🏝️', r:1, k:'island', g:30, d:'Bị giam ở Đảo hoang 30 lần'},
  {id:'lentay', n:'Đang lên tay', i:'🔥', r:1, k:'streak', g:3, d:'Thắng 3 ván liên tiếp'},
  {id:'muadat', n:'Tay chơi bất động sản', i:'🏘️', r:1, k:'buy', g:100, d:'Mua tổng 100 ô đất'},
  {id:'kientruc', n:'Kiến trúc sư', i:'🏗️', r:1, k:'build', g:100, d:'Xây tổng 100 cấp nhà'},
  {id:'rutthe', n:'Bậc thầy rút thẻ', i:'🃏', r:1, k:'card', g:100, d:'Rút 100 thẻ Cơ hội hoặc Khí vận'},
  {id:'vatpham', n:'Vua vật phẩm', i:'🎒', r:1, k:'item', g:50, d:'Dùng 50 vật phẩm'},
  {id:'nohu', n:'Vua nổ hũ', i:'🎰', r:2, k:'jackpot', g:10, d:'Nổ hũ Quỹ 10 lần'},
  {id:'thienthan', n:'Thiên thần khởi nghiệp', i:'🚀', r:2, k:'startup', g:25, d:'Rót vốn Khởi nghiệp 25 lần'},
  {id:'catdien', n:'Bậc thầy cắt điện', i:'⚡', r:2, k:'cut', g:20, d:'Cắt điện nước 20 lần'},
  {id:'huyenthoai', n:'Huyền thoại bàn cờ', i:'👑', r:3, k:'win', g:100, d:'Về nhất 100 ván'}
];
const TITLE = (() => {
  const KEY = 'lendoi_titles'; let d = {c:{}, sets:{}, wm:{}, got:{}, wear:'', st:0};
  try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if(r) d = Object.assign(d, r); } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {} };
  const val = t => t.k==='sets' ? Object.keys(d.sets).length : t.k==='wm' ? Object.keys(d.wm).length : (d.c[t.k] || 0);
  const check = () => {
    const fresh = TITLES.filter(t => !d.got[t.id] && val(t) >= t.g); if(!fresh.length) return;
    fresh.forEach(t => { d.got[t.id] = Date.now(); }); save();
    if(!HEADLESS){ const quiet = !!(S && S.over); fresh.forEach((t,k) => setTimeout(() => { bigMoment(`Danh hiệu mới: ${t.n}`, RAR[t.r].c, t.i, quiet); if(!quiet) SFX.play('levelup', .2); }, k*1900)); }   // hết trận: để tiếng bục vinh danh phát trọn
  };
  return {
    add(k, n, x){ if(k==='set'){ if(!x) return; d.sets[x] = 1; } else d.c[k] = (d.c[k] || 0) + n; save(); check(); },
    result(mode, won){ const m = mode==='rank' ? 'rank' : mode==='friend' ? 'friend' : 'bot'; if(won){ d.wm[m] = 1; d.st = (d.st || 0) + 1; } else d.st = 0; d.c.streak = Math.max(d.c.streak || 0, d.st); save(); check(); },
    rp(v){ d.c.rpMax = Math.max(d.c.rpMax || 0, v); save(); check(); },
    list: () => TITLES.map(t => Object.assign({}, t, {v:Math.min(t.g, val(t)), got:!!d.got[t.id]})),
    count: () => TITLES.filter(t => d.got[t.id]).length,
    worn: () => (d.wear && d.got[d.wear]) ? TITLES.find(t => t.id===d.wear) || null : null,
    setWear(id){ d.wear = d.wear===id ? '' : id; save(); }
  };
})();
const ttMini = t => t ? `<i class="ttmini r${t.r}" title="${t.n}">${t.i}</i>` : '';
const fmtN = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function quest(p, k, n, x){ if(HEADLESS || !p || p.bot || (NET && p.id!==NET.me)) return; QUEST.add(k, n); TITLE.add(k, n, x); }
const botIQ = () => (S && S.iq) || 2;
const BOTSAY = {
  buy:['Đất này của tui nha!', 'Chốt đơn!', 'Lại thêm một sổ đỏ'], loan:['Vay chút, lời nhiều', 'Liều ăn nhiều!'],
  deal:['Đổi đất với tui không?', 'Có kèo thơm nè'], no:['Không nha!', 'Mơ đi bạn ơi', 'Kèo này lỗ lắm'],
  item:['Mời bạn xơi nha 😆', 'Nghỉ chút cho khoẻ', 'Đừng giận tui nha'], drag:['Ra đảo chơi với tui', 'Có bạn có bè cho vui'],
  sad:['Ơ kìa…', 'Xui dữ vậy trời'], reply:['Nói ít thôi, gieo đi', 'Chờ đó, tui gỡ lại', 'Haha để xem', 'Ai sợ ai', 'Bình tĩnh nào bạn ơi']
};
function botTalk(p, kind, force){
  if(HEADLESS || !p || !p.bot || !p.alive || botIQ()<2) return;
  if(!force && Math.random() > (botIQ()>=3 ? .5 : .25)) return;
  if(p.talkAt!=null && S.turns - p.talkAt < 3) return; p.talkAt = S.turns;
  const L = BOTSAY[kind] || BOTSAY.reply; say(p, L[rnd(L.length)], false);
}
// v139: máy dùng vật phẩm theo độ khó. Trung bình: ô dù, cà phê, hoa quả. Cao thủ: thêm tô phở, ớt, xúc xắc vàng, trà sữa, dừa; xem tiền thuê sắp phải trả để phòng thủ, nhắm người dẫn đầu
function botRisk(p){   // tiền thuê dự kiến (trung bình E, lớn nhất M) nếu gieo lượt tới
  let E = 0, M = 0;
  for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ const d = a+b, i = (p.pos+d)%N, o = S.owner[i]; if(o==null || o<0 || o===p.id) continue;
    const q = S.players[o]; if(!q || !q.alive || mate(p, q)) continue; let r = 0; try { r = rentOf(i, d); } catch(e) {} E += r/36; M = Math.max(M, r); }
  return {E, M};
}
function botItems(p){
  if(HEADLESS || !p.bot || !p.bag || S.mode==='rank' || botIQ()<2 || p.itemsUsed>=ITEM_MAX) return;
  const iq = botIQ(), has = k => (p.bag[k]||0) > 0, use = (k, t) => { if(applyItem(p, k, t==null ? -1 : t)){ p.bag[k]--; return true; } return false; };
  const foes = alive().filter(q => q.id!==p.id && !mate(p, q) && !q.skip && !held(q)), lead = foes.slice().sort((a,b) => netWorth(b)-netWorth(a))[0];
  // 1. phòng thủ: sắp phải trả tiền thuê lớn
  if(!p.umb && (has('pho') || has('umb'))){ const R = botRisk(p);
    if(iq>=3 && has('pho') && (R.M>=250 || R.E>=70) && use('pho')){ botTalk(p, 'item'); return; }
    if(has('umb') && (iq>=3 ? (R.M>=150 || R.E>=40) : R.E>=70) && use('umb')) return; }
  // 2. thiếu tiền mặt
  if(has('cafe') && p.cash < (iq>=3 ? 150 : 100) && use('cafe')) return;
  // 3. đầu ván: trà sữa (2 lần qua Xuất phát thêm 100)
  if(iq>=3 && has('tea') && S.round <= Math.max(3, Math.round((S.rules.rounds || ROUND_LIMIT)/3)) && use('tea')) return;
  // 4. xúc xắc vàng: cầm sẵn khi đường phía trước nhiều ô đắt
  if(iq>=3 && has('dice') && !p.reroll){ const R = botRisk(p); if(R.M>=200 && use('dice')) return; }
  if(!lead) return;
  // 5. tấn công người dẫn đầu
  if(has('fruit') && netWorth(lead) > netWorth(p)*(iq>=3 ? 1 : 1.2) && Math.random() < (iq>=3 ? .45 : .2) && use('fruit', lead.id)){ botTalk(p, 'item', true); return; }
  if(iq>=3 && has('ot')){ const back = (lead.pos - 3 + N) % N; if((S.owner[back]===p.id || Math.random() < .15) && use('ot', lead.id)){ botTalk(p, 'item', true); return; } }
}
// máy Cao thủ cầm Xúc xắc vàng: gieo lại khi sắp vào ô xấu
async function botReroll(p, a, b){
  const i = (p.pos + a + b) % N, t = TILES[i], o = S.owner[i], q = o>=0 ? S.players[o] : null;
  let r = 0; if(q && q.alive && o!==p.id && !mate(p, q)) try { r = rentOf(i, a+b); } catch(e) {}
  if(!(t.k==='gotojail' || t.k==='grave' || r >= 120)) return [a, b];
  p.reroll = 0; const [c, d] = roll2(); await showDice(c, d); log(`${p.name} dùng Xúc xắc vàng, gieo lại được ${c} và ${d}.`); return [c, d];
}
function applyItem(p, k, t){
  if(p.itemsUsed>=ITEM_MAX || S.mode==='rank' || !ITEMS[k]) return false;
  if(k==='fruit'){ const q = S.players[t]; if(!q || !q.alive || q.id===p.id) return false; q.skip++; log(`${p.name} mời ${q.name} giỏ hoa quả, ${q.name} sẽ nghỉ 1 lượt.`); if(!HEADLESS) showBubble(q, '🍉', true); }
  else if(k==='tea'){ p.tea += 2; log(`${p.name} uống trà sữa: 2 lần qua Xuất phát kế tiếp nhận thêm 100.`); if(!HEADLESS) showBubble(p, '🧋', true); }
  else if(k==='umb'){ p.umb = 1; log(`${p.name} mở ô dù: lần trả tiền thuê kế tiếp chỉ trả một nửa.`); if(!HEADLESS) showBubble(p, '☂️', true); }
  else if(k==='dice'){ p.reroll = 1; log(`${p.name} cầm Xúc xắc vàng: lượt này được gieo lại 1 lần.`); if(!HEADLESS) showBubble(p, '🎲', true); }
  else if(k==='banhmi'){ p.boost = 2; log(`${p.name} ăn bánh mì: lượt này đi thêm 2 ô.`); if(!HEADLESS) showBubble(p, '🥖', true); }
  else if(k==='cafe'){ gain(p, 60); log(`${p.name} uống cà phê sữa đá, tỉnh táo nhận 60.`); if(!HEADLESS) showBubble(p, '☕', true); }
  else if(k==='ot'){ const q = S.players[t]; if(!q || !q.alive || q.id===p.id) return false; q.pos = (q.pos - 3 + N) % N; log(`${p.name} mời ${q.name} ăn ớt hiểm, ${q.name} cay quá lùi 3 ô.`); if(!HEADLESS) showBubble(q, '🌶️', true); }
  else if(k==='dua'){ p.card = (p.card||0) + 1; log(`${p.name} uống dừa tươi, nhận 1 thẻ Ra tù.`); if(!HEADLESS) showBubble(p, '🥥', true); }
  else if(k==='pho'){ p.umb = 2; log(`${p.name} ăn tô phở: lần trả tiền thuê kế tiếp được miễn.`); if(!HEADLESS) showBubble(p, '🍜', true); }
  p.itemsUsed++; quest(p, 'item', 1); render();
  if(!HEADLESS && p.bot){ const tq = (k==='fruit' || k==='ot') ? S.players[t] : null; cornerNote(p, ITEMS[k].i, ITEMS[k].n, tq ? `Mời ${esc(tq.name)}` : esc(ITEMS[k].d)); }   // v139
  if(!HEADLESS){ const tt = (k==='fruit' || k==='ot') ? t : -1; itemFx(k, p.id, tt); if(netHost()) netEmit('ev', {k:'item', it:k, p:p.id, t:tt}); }
  return true;
}
async function useItem(k){
  const p = S.players[S.viewer]; if(!S.wait || S.wait.pid!==p.id || p.itemsUsed>=ITEM_MAX || STORE.has(k)<1) return;
  let t = -1;
  if(k==='fruit' || k==='ot'){
    const others = alive().filter(q => q.id!==p.id);
    t = await askLocal(k==='ot' ? '🌶️ Mời ai ăn ớt?' : '🍉 Mời ai ăn hoa quả?', `<p class="bn" style="margin:0">${k==='ot' ? 'Người đó sẽ lùi 3 ô.' : 'Người được mời sẽ nghỉ 1 lượt.'}</p>`, others.map(o => ({k:o.id, label:o.name})).concat([{k:-1, label:'Thôi, không dùng'}]));
    if(t<0) return;
  }
  if(netClient()){ netEmit('req', {k:'item', it:k, t}); STORE.give(k, -1); closeModal(); return; }
  if(applyItem(p, k, t)) STORE.give(k, -1);
  closeModal(); render();
  if(S.wait && S.wait.mode==='end' && S.wait.pid===p.id) startEndTimer(p);
}

let endTimer = null, endLeft = 0;
function paintEnd(){ const b = document.getElementById('endBtn'); if(b) b.textContent = endLeft>0 ? `Xong ${endLeft}` : 'Xong'; }
function stopEndTimer(){ if(endTimer){ clearInterval(endTimer); endTimer = null; } endLeft = 0; paintEnd(); clearRing(); }
function startEndTimer(p){
  stopEndTimer(); endLeft = DECIDE; paintEnd(); setRing(p.id, DECIDE);
  endTimer = setInterval(() => {
    endLeft--; if(endLeft>0 && endLeft<=3) SFX.play('tick'); paintEnd();
    if(endLeft<=0 && waitResolve){ if(!askOpen) closeModal(); log(`${p.name} không thao tác trong ${DECIDE} giây, tự chuyển lượt.`); waitResolve('ok'); }
  }, 1000);
}
const SAVE_KEY = 'lendoi_save';
let LASTGAME = null;
function saveGame(){
  if(HEADLESS || !S || S.over) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({v:4, at:Date.now(), elapsed:Date.now()-S.start, last:LASTGAME, S:Object.assign({}, S, {wait:null, ring:null, landed:null, built:null, pend:null, passed:null})})); } catch(e) {}
}
function loadSave(){ try { const r = localStorage.getItem(SAVE_KEY); if(!r) return null; const d = JSON.parse(r); return (d && d.v===4 && d.S && Array.isArray(d.S.players)) ? d : null; } catch(e) { return null; } }
function clearSave(){ try { localStorage.removeItem(SAVE_KEY); } catch(e) {} }
function waitAction(p, mode){
  if(HEADLESS) return Promise.resolve('ok');
  if(QUIT) return Promise.resolve('quit');
  return new Promise(res => {
    S.wait = {pid:p.id, mode};
    if(mode==='roll' && p.id===S.viewer) profClose();
    let idle = null, tk = null;
    waitResolve = v => { clearTimeout(idle); clearInterval(tk); if(mode==='roll') clearRing(); stopEndTimer(); S.wait = null; waitResolve = null; render(); res(v); };
    if(mode==='roll') setRing(p.id, TURN_SECS);
    render();
    if(mode==='end') startEndTimer(p);
    else {
      // hết 17 giây mà chưa gieo thì game tự gieo; đồng hồ đứng lại khi tạm dừng hoặc đang mở popup
      let left = TURN_SECS;
      if(!p.bot && !NET && !(S && S.net)) saveGame();
      tk = setInterval(() => {
        if(PAUSED || askOpen) return;
        left--; if(left>0 && left<=3 && (!NET || p.id===NET.me)) SFX.play('tick');
        if(left<=0 && waitResolve && S.wait && S.wait.pid===p.id){
          log(`${p.name} hết ${TURN_SECS} giây, game tự gieo.`);
          if(S.mode==='rank' && !p.bot && !NET){ p.idle = (p.idle||0) + 1;
            if(p.idle===RANK_PEN.afkTurns-1) cornerNote(p, '⚠️', 'Cảnh báo treo máy', `Thêm 1 lượt không gieo sẽ bị trừ ${-RANK_PEN.afk} điểm hạng`, 3600);
            if(p.idle>=RANK_PEN.afkTurns && !S.afkPen){ S.afkPen = true; log(`${p.name} treo máy ${RANK_PEN.afkTurns} lượt liền, bị phạt ${-RANK_PEN.afk} điểm hạng khi hết trận.`); cornerNote(p, '⛔', 'Bị phạt treo máy', `Hết trận bị trừ ${-RANK_PEN.afk} điểm hạng, không nhận xu`, 4200); } }
          if(netHost() && p.remote){ p.miss = (p.miss||0) + 1; if(p.miss>=3){ p.afk = true; p.bot = true; p.remote = false; log(`${p.name} vắng mặt quá lâu, máy chơi hộ cho tới khi quay lại.`); } }
          waitResolve('ok');
        }
      }, 1000);
    }
  });
}
/* mỗi viên: 60% ra số bé (1-3), 40% ra số lớn (4-6) */
const DIE_SMALL = .6, die = () => (Math.random() < DIE_SMALL ? 1 : 4) + rnd(3);
const roll2 = () => [die(), die()];
/* v141: Bùa may mắn tân thủ. 3 ván Chơi với máy đầu tiên (người chơi dưới cấp 4): xúc xắc hên hơn, rút thẻ tốt nhiều hơn, tiền thuê giảm 20%, vốn đầu +200, ván đầu máy chơi mức Dễ */
const NB_GAMES = 3, NB_RENT = .8;
const nbOn = p => !!(S && S.nb && p && p.nbh);
const nbCount = () => { try { return +localStorage.getItem('lendoi_nb') || 0; } catch(e) { return NB_GAMES; } };
function nbScore(p, d){   // ô sắp tới tốt hay xấu cho người mới
  const i = (p.pos + d) % N, t = TILES[i], o = S.owner[i]; let sc = 0;
  if(p.pos + d >= N) sc += 1.5;
  if((t.k==='land' || t.k==='air' || t.k==='co') && o<0) sc += p.cash >= priceOf(i) ? 3 : 1;
  else if(o===p.id && t.k==='land') sc += 2;
  else if(o>=0 && o!==p.id){ let r = 0; try { r = rentOf(i, d); } catch(e) {} sc -= r/40; }
  if(t.k==='gotojail') sc -= 5; else if(t.k==='island') sc -= 4; else if(t.k==='grave') sc -= 3; else if(t.k==='tax') sc -= 1; else if(t.k==='chance' || t.k==='fortune' || t.k==='fund' || t.k==='gift') sc += 1;
  return sc;
}
function tutRoll(p){   // v142: ván hướng dẫn, lượt gieo đầu của người chơi dừng ở 1 ô đất trống vừa túi tiền
  S.tutRoll = 1; const L = [];
  for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ if(a===b) continue; const i = (p.pos+a+b)%N, t = TILES[i]; if(t.k==='land' && S.owner[i]<0 && priceOf(i) <= p.cash) L.push([a,b]); }
  return L.length ? L[rnd(L.length)] : roll2();
}
const luckyRoll = p => { const c = [roll2(), roll2()]; if(Math.random() > .4) return c[0]; return c.reduce((best, x) => nbScore(p, x[0]+x[1]) > nbScore(p, best[0]+best[1]) ? x : best); };

async function turn(p){
  if(nbOn(p) && !p.nbTold && !HEADLESS){ p.nbTold = 1; cornerNote(p, '🍀', 'Bùa may mắn tân thủ', `Ván ${S.nbN}/${NB_GAMES}: xúc xắc hên hơn, thẻ tốt hơn, tiền thuê trả máy giảm 20%<br><small>Tặng thêm 200 vốn</small>`, 6000); }   // v141
  if(p.skip>0){ p.skip--; log(`${p.name} mải ăn hoa quả nên nghỉ lượt này.`); if(!HEADLESS){ showBubble(p, '🍉', true); await sleep(900); } return; }
  if(p.island>0){
    const fee = hongFee(p,100), free = fee===0;
    const payIt = (free || p.cash>=fee) && (p.bot ? (free || p.cash>=300) :
      (await ask(`🏝️ Còn giam ${p.island} lượt`, '', [{k:'pay',label: free ? 'Rời đảo miễn phí' : `💵 Nộp ${fee} để đi`,sub: free ? 'Huy hiệu Đường đèo' : '',primary:true},{k:'stay',label:'Ở lại lượt này'}]))==='pay');
    if(payIt){ if(!HEADLESS && p.bot) cornerNote(p, '🏝️', 'Rời Đảo hoang', free ? 'Miễn phí nhờ huy hiệu' : `Nộp ${fee}`); if(!free) await pay(p,fee,'fund'); p.island = 0; log(free ? `${p.name} rời Đảo hoang miễn phí nhờ huy hiệu Đường đèo.` : `${p.name} nộp ${fee} để rời Đảo hoang.`); }
    else { p.island--; log(`${p.name} ở lại Đảo hoang${p.island?`, còn ${p.island} lượt`:', lượt sau được đi'}.`); return; }
  }
  if(p.jail>0){
    let c; const fee = hongFee(p,100), fee2 = hongFee(p,50), free = fee===0;
    if(p.bot && !p.card && !free && botIQ()>=3 && p.bag && p.bag.dua>0 && S.mode!=='rank' && p.itemsUsed<ITEM_MAX && applyItem(p, 'dua', -1)) p.bag.dua--;   // v139
    if(p.bot) c = free ? 'pay' : p.card ? 'card' : (p.cash>=400 ? 'pay' : 'roll');
    else {
      const opts = [];
      if(p.card) opts.push({k:'card',label:'🎫 Dùng thẻ Ra tù',primary:true});
      if(free) opts.unshift({k:'pay',label:'Ra tù miễn phí',sub:'Huy hiệu Đường đèo',primary:true}); else if(p.cash>=fee) opts.push({k:'pay',label:`💵 Nộp ${fee} ra ngay`});
      opts.push({k:'roll',label:'🎲 Gieo tìm đôi',sub:'Ra đôi là được ra'});
      if(S && S.tutm && window.TUTM) window.TUTM.ev('jail');
      c = await ask('🚓 Đang bị giam', p.jail>=2 ? `<p class="bn">Lượt 2: không ra đôi thì nộp ${fee2} rồi đi.</p>` : '', opts);
    }
    if(c==='card'){ p.card--; p.jail = 0; log(`${p.name} dùng thẻ Ra tù miễn phí.`); }
    else if(c==='pay'){ if(!free) await pay(p,fee,'fund'); p.jail = 0; log(free ? `${p.name} ra tù miễn phí nhờ huy hiệu Đường đèo.` : `${p.name} nộp ${fee} để ra tù.`); }
    else {
      const [a,b] = roll2(); await showDice(a,b);
      if(a===b){ p.jail = 0; log(`${p.name} gieo đôi ${a}, được ra tù.`); await move(p,a+b); if(p.alive) await land(p,a+b); }
      else if(p.jail>=2){ log(`${p.name} gieo ${a} và ${b}, hết 2 lượt nên ${free?'được':`nộp ${fee2} và`} ra tù.`); if(!free) await pay(p,fee2,'fund'); if(p.alive){ p.jail = 0; await move(p,a+b); if(p.alive) await land(p,a+b); } }
      else { p.jail++; log(`${p.name} gieo ${a} và ${b}, chưa ra được tù.`); }
      return;
    }
  }
  let dbl = 0;
  while(p.alive && !S.over){
    if(p.bot){ await sleep(560); botItems(p); await botTrade(p); if(S.over || !p.alive) break; }
    else if(await waitAction(p,'roll')==='quit'){ S.over = true; S.reason = 'manual'; return; }
    let [a,b] = (S.tutm && !p.bot && !S.tutRoll) ? tutRoll(p) : nbOn(p) ? luckyRoll(p) : roll2(); await showDice(a,b); log(`${p.name} gieo ${a} và ${b}.`);
    if(p.reroll && !p.bot){
      p.reroll = 0;
      const c = await ask('🎲 Xúc xắc vàng', `<div class="stats"><div><small>Vừa gieo được</small><b>${a+b}${a===b?' (đôi)':''}</b></div><div><small>Sẽ tới ô</small><b style="font-size:14px">${TILES[(p.pos+a+b)%N].n}</b></div></div>`, [{k:'re', label:'Gieo lại', primary:true}, {k:'keep', label:'Giữ kết quả này'}]);
      if(c==='re'){ [a,b] = roll2(); await showDice(a,b); log(`${p.name} dùng Xúc xắc vàng, gieo lại được ${a} và ${b}.`); }
    } else if(p.reroll && p.bot) [a,b] = await botReroll(p, a, b);
    if(a===b){ dbl++; if(dbl===3){ log(`${p.name} gieo đôi 3 lần liên tiếp.`); goJail(p); break; } }
    await move(p, a+b); if(!p.alive) break;
    await land(p, a+b);
    if(!HEADLESS) await sleep(p.bot ? 450 : 350);   // v134: nghỉ một nhịp sau khi dừng ô cho tiền bay về và kịp đọc thông báo
    if(!p.alive || held(p)) break;
    if(a!==b && !p.extra) break;
    p.extra = false; log(`${p.name} được đi thêm lượt.`); if(!HEADLESS) cornerNote(p, '🎲', 'Đi thêm lượt', a===b ? `Gieo đôi ${a}` : 'Được đi tiếp');
  }
  p.extra = false;
}
async function endOfTurn(p){
  if(!p.alive || S.over) return;
  await sleep(p.bot ? 300 : 700); await waitNotes();   // v134: chờ thông báo đọc xong mới sang lượt kế. Không còn bước chờ bấm Xong: bán đất, trả nợ, dùng vật phẩm làm trước khi gieo
}
function checkOver(){
  if(S.over) return;
  const al = alive(), R = S.rules;
  if(al.length<=1 || (R.teams && al.every(q => q.id%2===al[0].id%2))){ S.over = true; S.reason = 'last'; }
  else if(!HEADLESS && Date.now()-S.start >= limitMs()){ S.over = true; S.reason = 'time'; }
  else if(R.goalNet || R.goalSets || R.side){
    if(R.teams){ for(const tm of [0,1]) if(al.filter(q => q.id%2===tm).reduce((a,q) => a+netWorth(q), 0) >= R.goalNet){ S.over = true; S.reason = 'goal'; S.winTeam = tm; break; } }
    else { const w = al.find(q => (R.goalNet && netWorth(q) >= R.goalNet) || (R.goalSets && Object.keys(PERK).filter(g => pk(q,g)===1).length >= R.goalSets) || (R.side && sideOwned(q))); if(w){ S.over = true; S.reason = 'goal'; S.winner = w.id; S.goalWhy = (R.goalNet && netWorth(w) >= R.goalNet) ? 'net' : (R.side && sideOwned(w)) ? 'side' : 'sets'; } }
  }
}
function finalRank(){
  const ps = S.players.slice();
  if(S.rules.teams){
    const score = tm => ps.filter(p => p.id%2===tm && p.alive).reduce((a,p) => a+netWorth(p), 0);
    if(S.winTeam==null) S.winTeam = score(0) >= score(1) ? 0 : 1;
    const wt = S.winTeam;
    return ps.sort((a,b) => ((b.id%2===wt)-(a.id%2===wt)) || (b.alive-a.alive) || (netWorth(b)-netWorth(a)));
  }
  return ps.sort((a,b) => ((b.id===S.winner)-(a.id===S.winner)) || (b.alive-a.alive) || (a.alive ? netWorth(b)-netWorth(a) : (b.outAt||0)-(a.outAt||0)));
}
async function eliminate(p, round){
  p.alive = false; p.out = 'cut'; p.outAt = S.turns; p.jail = 0; p.island = 0; p.loans = [];
  owned(p).forEach(i => { S.owner[i] = -1; S.level[i] = 0; });
  log(`${p.name} bị loại ở vòng ${round} vì tổng tài sản thấp nhất.`); render();
  if(!HEADLESS) await ask(`Sinh tồn vòng ${round}`, `<div class="warnbox"><b>${esc(p.name)} bị loại</b>Tài sản thấp nhất bàn, đất trở về chưa có chủ.</div>`, [{k:'ok', label:'Tiếp tục', primary:true}], 6, 'all');
}
async function globalEvent(){
  const k = ['fest','storm','harvest','audit','boom'][rnd(5)]; let title, text;
  if(k==='fest'){ const gs = Object.keys(PERK), g = gs[rnd(gs.length)]; S.ev.fest = {g, until:S.round+1}; title = `Lễ hội ${GN[g]}`; text = `Đất ${GN[g]} thu thuê gấp đôi trong 2 vòng.`; }
  else if(k==='storm'){ const gs = Object.keys(PERK), g = gs[rnd(gs.length)], road = Math.random() < .5; S.ev.storm = {g, until:S.round+1}; title = road ? `Sửa đường qua ${GN[g]}` : `Mưa bão ngập ${GN[g]}`; text = `Đất ${GN[g]} giảm 30% tiền thuê trong 2 vòng.`; }
  else if(k==='harvest'){ alive().forEach(p => gain(p, 100)); title = 'Trúng mùa'; text = 'Mỗi người nhận 100.'; }
  else if(k==='audit'){ alive().forEach(p => { if(perk(p,'xl')) return; p.cash -= Math.round(p.cash*(pk(p,'xl') ? .05 : .1)); }); title = 'Thanh tra thuế'; text = 'Mỗi người nộp 10% tiền mặt.' + (alive().some(p => pk(p,'xl')>0) ? ' Ai có huy hiệu Trung tâm tài chính được miễn (nửa bộ: nộp 5%).' : ''); }
  else { S.ev.boom = {until:S.round+1}; title = 'Sốt đất'; text = 'Đất chưa có chủ đắt gấp rưỡi trong 2 vòng.'; }
  log(`Sự kiện vòng ${S.round}: ${title}. ${text}`); render();
  if(!HEADLESS && S.players.some(p => !p.bot && p.alive)) await ask(`⚡ Sự kiện: ${title}`, ART.ev(k) + `<div class="evbox">${text}</div>`, [{k:'ok', label:'Tiếp tục', primary:true}], 6, 'all');
}
const FUND_ROUND = 50, JACKPOT_MAX = 300, FUND_MAX = 500;   // quỹ đầy 500 thì tiền thuế, phạt chảy về ngân hàng   // mỗi vòng mới Quỹ được bơm thêm 50; nổ hũ ăn tối đa 300, phần còn lại để lại trong quỹ
async function roundStart(){
  const R = S.rules, done = S.round - 1;
  S.fund = Math.min(FUND_MAX, S.fund + FUND_ROUND); log(`Vòng ${S.round}: Quỹ phúc lợi được bơm thêm ${FUND_ROUND}, quỹ đang có ${S.fund}${S.fund>=FUND_MAX ? ' (đã đầy)' : ''}.`);
  if(R.cut.includes(done) && alive().length>2){ const low = alive().slice().sort((a,b) => netWorth(a)-netWorth(b))[0]; await eliminate(low, done); checkOver(); if(S.over) return; }
  if(R.events && done%5===0) await globalEvent();
  if(R.finale && S.round === R.rounds - R.finale + 1){
    log(`Còn ${R.finale} vòng cuối: mọi tiền thuê gấp đôi.`);
    if(!HEADLESS && S.players.some(p => !p.bot && p.alive)) await ask(`🔥 ${R.finale} vòng cuối`, '<div class="evbox">Tiền thuê gấp đôi tới hết ván. Vẫn còn cơ hội lật kèo!</div>', [{k:'ok', label:'Chiến thôi', primary:true}], 6, 'all');
  }
}
function newGame(cfg){
  QUIT = false; QUITR.clear();
  logs = []; chat = []; bubbles.forEach(b => { clearTimeout(b.t); b.el.remove(); }); bubbles.clear();
  S = { players: cfg.map((c,i)=>({id:i,name:c.name,bot:c.bot,remote:!!c.remote,fu:c.fu||'',fi:c.fi||'',fit:c.bot ? '' : (c.remote ? (typeof c.fit==='string' ? c.fit : '') : STORE.fit),color:PC[i],cash:START_CASH,pos:0,alive:true,jail:0,island:0,card:0,startup:0,freeRent:0,extra:false,loans:[],laps:0,listedTurn:-1,skip:0,tea:0,umb:0,reroll:0,itemsUsed:0})),
    owner: Array(N).fill(-1), level: Array(N).fill(0), upLap: Array(N).fill(-1), round: 1, mode: 'bot', order: cfg.map((c,i) => i), oi: 0, avs: null, rules: Object.assign({}, RULES_DEF), ev: {}, fund: 100, cur: 0, viewer: Math.max(0, cfg.findIndex(c => !c.bot)), over: false, reason: '', start: Date.now(), dice: [0,0], turns: 0, wait: null,
    decks: {chance: shuffle(CARDS.chance.map((c,i)=>i)), fortune: shuffle(CARDS.fortune.map((c,i)=>i))} };
}
// Đầu ván: N lá bài úp, mặt dưới ghi lượt 1..N. Mỗi người lật 1 lá trong 5 giây, hết giờ game tự chia lá còn lại
async function decideOrder(){
  const ids = S.players.map(p => p.id); let rank;
  if(HEADLESS) rank = shuffle(ids.slice());
  else {
    const ov = document.createElement('div'); ov.id = 'orderFx'; ov.innerHTML = '<div class="ordp"></div>'; document.body.appendChild(ov); SFX.play('shuffle');
    const isHuman = id => !S.players[id].bot && (!NET || id===S.viewer);
    const r = await orderCards(ov.firstChild, ids, isHuman);
    rank = ids.slice().sort((a,b) => r[a]-r[b]); ov.remove();
  }
  S.order = rank; S.oi = 0; S.cur = rank[0];
  log('Thứ tự đi: ' + rank.map(id => S.players[id].name).join(', ') + '.');
}
function ordGuest(d){
  const g = (Array.isArray(d.g) ? d.g : []).slice(0, 4), own = Array.isArray(d.own) ? d.own : [], me = NET ? NET.me : -1;
  if(!g.length) return;
  const av = id => { try { return AV(+id); } catch(e) { return '🙂'; } };
  let ov = document.getElementById('orderFx');
  if(ov && ov.dataset.flip) return;
  if(!ov){
    ov = document.createElement('div'); ov.id = 'orderFx'; ov.dataset.guest = '1'; ov.innerHTML = '<div class="ordp"></div>'; document.body.appendChild(ov); SFX.play('shuffle');
    ov.firstChild.innerHTML = `<h3>Lật bài chọn lượt đi</h3><p class="ordsub">Chọn 1 lá bài. Còn <b id="ordCd"></b> giây</p><div class="ocards">${g.map((id,k) => `<button class="ocard free" data-k="${k}" aria-label="Lá bài ${k+1}"><i class="of">🎴</i><i class="ob"><small>Lượt</small></i><span class="ow"></span></button>`).join('')}</div><p class="ordturn" id="ordTurn">Chạm 1 lá bài</p>`;
    ov.querySelectorAll('.ocard').forEach((c,k) => { c.onclick = () => { if(!c.classList.contains('free')) return; ov.querySelectorAll('.ocard').forEach(x => x.classList.remove('free')); SFX.play('click'); netEmit('ordp', {k}); }; });
    ov._kill = setTimeout(() => ov.remove(), 15000);
  }
  const cards = [...ov.querySelectorAll('.ocard')], mine = own.indexOf(me) >= 0;
  cards.forEach((c,k) => { const o = own[k]; if(o!=null && !c.dataset.o){ c.dataset.o = '1'; c.classList.remove('free'); c.disabled = true; c.querySelector('.ow').innerHTML = av(o); const f = c.querySelector('.of'); f.innerHTML = av(o); f.classList.add('who'); }
    if(mine) c.classList.remove('free'); });
  const cd = ov.querySelector('#ordCd'); if(cd) cd.textContent = Math.max(0, +d.left || 0);
  if(d.flip && Array.isArray(d.vals)){
    ov.dataset.flip = '1'; clearTimeout(ov._kill);
    cards.forEach((c,k) => { c.querySelector('.ob').innerHTML = `<small>Lượt</small>${+d.vals[k] || ''}`; });
    ov.querySelector('.ordsub').textContent = 'Mở bài!';
    setTimeout(() => { SFX.play('shuffle'); cards.forEach(c => c.classList.add('flip')); const k = own.indexOf(me); const t = ov.querySelector('#ordTurn'); if(t) t.innerHTML = k>=0 ? `Bạn đi lượt <b>${+d.vals[k]}</b>` : ''; }, 350);
    setTimeout(() => ov.remove(), 2600);
  }
}
function orderCards(box, g, isHuman){
  return new Promise(res => {
    const vals = shuffle(g.map((id,k) => k+1)), owner = [], r = {}; let left = 5, done = false;
    const isRemote = id => netHost() && !!S.players[id].remote;
    const cast = () => { if(netHost()) netEmit('ord', {g, own:owner.slice(0, g.length), left, flip:done, vals:done ? vals : null}); };
    box.innerHTML = `<h3>Lật bài chọn lượt đi</h3><p class="ordsub">Chọn 1 lá bài. Còn <b id="ordCd">${left}</b> giây</p><div class="ocards">${g.map((id,k) => `<button class="ocard free" data-k="${k}" aria-label="Lá bài ${k+1}"><i class="of">🎴</i><i class="ob"><small>Lượt</small>${vals[k]}</i><span class="ow"></span></button>`).join('')}</div><p class="ordturn" id="ordTurn"></p>`;
    const cards = [...box.querySelectorAll('.ocard')], turn = box.querySelector('#ordTurn'), cd = box.querySelector('#ordCd');
    const freeIdx = () => cards.map((c,k) => owner[k]==null ? k : -1).filter(k => k>=0);
    const take = (k, id) => { if(done || owner[k]!=null || r[id]!=null) return; owner[k] = id; r[id] = vals[k]; cards[k].classList.remove('free'); cards[k].disabled = true; cards[k].querySelector('.ow').innerHTML = AV(id); { const f = cards[k].querySelector('.of'); if(f){ f.innerHTML = AV(id); f.classList.add('who'); } } SFX.play('click');
      if(isHuman(id)) cards.forEach(c => c.classList.remove('free'));
      cast(); if(g.every(q => r[q]!=null)) finish(); };
    const any = id => { const f = freeIdx(); if(f.length) take(f[Math.floor(Math.random()*f.length)], id); };
    const finish = async () => { if(done) return; g.forEach(id => { if(r[id]==null) any(id); }); done = true; clearInterval(iv); if(NET) NET.ordTake = null; cast();
      box.querySelector('.ordsub').textContent = 'Mở bài!'; await sleep(350); SFX.play('shuffle'); cards.forEach(c => c.classList.add('flip'));
      const me = g.find(isHuman); turn.innerHTML = me!=null ? `<b style="color:${S.players[me].color}">${esc(S.players[me].name)}</b> đi lượt ${r[me]}` : '';
      await sleep(2100); res(r); };
    if(netHost()){ NET.ordTake = (k, id) => { if(isRemote(id) && cards[k]) take(k, id); }; cast(); }
    const iv = setInterval(() => { left--; cast(); cd.textContent = Math.max(0, left); if(left<=3 && left>0) SFX.play('tick'); if(left<=0) finish(); }, 1000);
    const me = g.find(isHuman); turn.innerHTML = me!=null ? `<b style="color:${S.players[me].color}">${esc(S.players[me].name)}</b>, chạm 1 lá bài` : '';
    cards.forEach((c,k) => { c.onclick = () => { if(me!=null) take(k, me); }; });
    g.filter(id => !isHuman(id) && !isRemote(id)).forEach((id,n) => setTimeout(() => any(id), 700 + n*650 + Math.random()*500));
  });
}
async function run(maxTurns){
  const S0 = S;
  while(S===S0 && !S.over){
    const p = S.players[S.cur];
    if(p.alive){ S.turns++; if(!p.bot && !NET) S.viewer = p.id;
      // lưới an toàn: lỡ có lỗi lạ trong một lượt thì ghi lại và chơi tiếp, không để cả ván đứng im
      try { render(); await turn(p); await endOfTurn(p); }
      catch(e){ if(HEADLESS) throw e; console.error('Lỗi trong lượt của ' + p.name, e); try { if(askAbort) askAbort(); } catch(x) {} S.wait = null; waitResolve = null; log(`Có lỗi nhỏ trong lượt của ${p.name}, game tự chuyển lượt.`); }
      checkOver(); }
    S.oi = ((S.oi||0) + 1) % S.players.length; S.cur = (S.order || [])[S.oi] != null ? S.order[S.oi] : S.oi;
    if(S.oi===0 && !S.over){ S.round++; if(S.round > S.rules.rounds){ S.over = true; S.reason = 'round'; } else await roundStart(); }
    if(maxTurns && S.turns>=maxTurns && !S.over){ S.over = true; S.reason = 'cap'; }
  }
  if(S!==S0) return;
  render();
  if(!HEADLESS && S.lateSave){ S.lateSave = false; if(S.reason==='manual'){ S.over = false; S.turns++; saveGame(); S.over = true; } }
  if(!HEADLESS){ if(S.restart && window.restartGame){ clearSave(); window.restartGame(); } else if(S.leave && window.goHome) window.goHome(); else if(!S.shown) showResult(); }
}

/* ---------- giao diện ---------- */
const LAY = {S:300, tk:30, hw:12, tilt:52};
function insets(){
  let pr = document.getElementById('saProbe');
  if(!pr){ pr = document.createElement('div'); pr.id = 'saProbe'; pr.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.documentElement.appendChild(pr); }
  const c = getComputedStyle(pr); return {t:parseFloat(c.paddingTop)||0, r:parseFloat(c.paddingRight)||0, b:parseFloat(c.paddingBottom)||0, l:parseFloat(c.paddingLeft)||0};
}
function fit(){
  MOD.ok = false;
  for(const k in PTC) delete PTC[k];
  { const cam = document.getElementById('cam'); if(cam){ cam.style.transform = ''; CAM.z = 1; CAM.busy = Date.now() + 420; } }
  const st = document.getElementById('stage'), b = document.getElementById('board'); if(!st || !b) return;
  const W = st.clientWidth, H = st.clientHeight, portrait = H > W, sa = insets(), rot = isRot();
  const test = /[?&]bar=1/.test(location.search); if(test) sa.t = 75;
  // thanh trên của app: khi xoay bằng CSS nó nằm ở mép trái, khi máy nằm ngang thật nó nằm ở mép trên
  const lx = IS_APP ? sa.l : (rot ? (sa.t > 20 ? Math.max(96, sa.t + 20) : 0) : 0), rx = IS_APP ? sa.r : (rot ? sa.b : 0);
  const bar = !IS_APP && !rot && !portrait && sa.t > 40;
  st.style.setProperty('--lx', lx + 'px'); st.style.setProperty('--rx', rx + 'px'); if(IS_APP){ st.style.setProperty('--plx', Math.round(sa.l*.2) + 'px'); st.style.setProperty('--prx', Math.round(sa.r*.35) + 'px'); } st.style.setProperty('--stH', H + 'px');
  st.classList.toggle('appbar', bar);
  LAY.tilt = portrait ? 40 : (bar || IS_APP ? 62 : 57); /* app: nghiêng thêm để bàn thấp hơn mà không nhỏ đi */ setIsoTilt(LAY.tilt); st.style.setProperty('--ik', (1/Math.cos(LAY.tilt*Math.PI/180)).toFixed(3)); b.style.transform = `rotateX(${LAY.tilt}deg) rotateZ(45deg)`; st.classList.toggle('tall', portrait); st.classList.toggle('narrow', !portrait && W < 770); document.body.classList.toggle('wide', !portrait);
  const k2 = Math.cos(LAY.tilt*Math.PI/180)*Math.SQRT2;
  const padT = portrait ? 150 : (bar ? 50 : IS_APP ? 30 : 8), padB = portrait ? 150 : 8, availH = Math.max(120, H - padT - padB);
  const side = Math.floor(Math.min((W - lx - rx - (portrait ? 10 : (bar ? 150 : 24)))/Math.SQRT2, availH/k2));
  const cx = W/2 + (lx - rx)/2, cy = padT + availH/2 - 6;
  LAY.S = side; LAY.tk = Math.max(20, Math.min(40, side*.072)); LAY.hw = Math.max(8, side*.036);
  b.style.width = side + 'px'; b.style.height = side + 'px'; b.style.left = (cx - side/2) + 'px'; b.style.top = (cy - side/2) + 'px';
  b.style.fontSize = Math.max(5, side/46) + 'px';
  { const gd = document.getElementById('ground'), gs = side*1.1; gd.style.width = gs + 'px'; gd.style.height = gs + 'px'; gd.style.left = (cx - gs/2) + 'px'; gd.style.top = (cy - gs/2) + 'px'; gd.style.transform = b.style.transform; }
  { const hw = side*Math.SQRT2/2, hh = hw*Math.cos(LAY.tilt*Math.PI/180) + 6;
    LAY.stash = stashLayout(W, H, cx, cy, hw, hh, lx, rx, bar, portrait);
    for(let q=0;q<4;q++) st.style.setProperty('--st'+q, (LAY.stash[q] ? LAY.stash[q].off : 70) + 'px'); }
  const mid = document.getElementById('mid'); mid.style.left = cx + 'px'; mid.style.top = cy + 'px'; mid.style.setProperty('--ms', Math.max(.55, Math.min(1.2, side/430)));
  st.style.setProperty('--tk', LAY.tk + 'px'); st.style.setProperty('--hw', LAY.hw + 'px'); st.style.setProperty('--cy', cy + 'px'); st.style.setProperty('--hsw', Math.max(24, side*.084) + 'px'); st.style.setProperty('--bursty', (cy/H*100) + '%');
}
const ROOF = {nau:'#D9B86A',xn:'#A4764F',hong:'#8A6B56',cam:'#EFCB5E',do:'#DF6F61',vang:'#EE8A62',xl:'#9CCDE4',xd:'#D0584D'};
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, Math.round(v*f))); return '#' + [n>>16, (n>>8)&255, n&255].map(v => c(v).toString(16).padStart(2,'0')).join(''); };
// gom các khối và hình phụ, vẽ từ xa tới gần, tự tính khung hình
function isoScene(){
  const it = [], pts = [];
  const add = (k, svg, ps) => { it.push({k, svg}); (ps || []).forEach(p => pts.push(p)); };
  return {
    P: (x,y,z) => isoP(x,y,z).map(v => +v.toFixed(1)),
    box(b, k){ add(k!=null ? k : b.x+b.w/2+b.y+b.d/2+b.z*.01, isoBox(b), [[b.x,b.y,b.z],[b.x+b.w,b.y,b.z],[b.x,b.y+b.d,b.z],[b.x+b.w,b.y+b.d,b.z],[b.x,b.y,b.z+b.h],[b.x+b.w,b.y,b.z+b.h],[b.x,b.y+b.d,b.z+b.h],[b.x+b.w,b.y+b.d,b.z+b.h]].map(p => isoP(p[0],p[1],p[2]))); },
    raw(k, svg, ps){ add(k, svg, ps); },
    out(anchor, pad){
      it.sort((a,b) => a.k-b.k);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(q => { x0 = Math.min(x0,q[0]); x1 = Math.max(x1,q[0]); y0 = Math.min(y0,q[1]); y1 = Math.max(y1,q[1]); });
      pad = pad==null ? 2 : pad; x0 -= pad; y0 -= pad; const w = x1-x0+pad, h = y1-y0+pad;
      const a = anchor ? isoP(anchor[0], anchor[1], anchor[2]||0) : [x0+w/2, y1];
      return {svg:`<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="100%" style="display:block;overflow:visible" aria-hidden="true"><g stroke="#2B3A67" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">${it.map(x => x.svg).join('')}</g></svg>`, ax:(a[0]-x0)/w*100, ay:(a[1]-y0)/h*100, w, h};
    }
  };
}
const ROOFH = {nau:5, hong:5, xn:13, cam:8, do:8, vang:7, xd:9};
function house3D(g, lv, ori, back, col){
  // Nhà kiểu hiện đại: khối hộp tường trắng, mái phẳng viền đậm, cửa sổ sáng đèn, cánh phụ thấp có mái cỏ.
  // Cấp 1: một tầng. Cấp 2: hai tầng. Cấp 3: thêm cánh phụ. Cấp 4: ba tầng có lan can sân thượng. Cấp 5: cao ốc kính.
  if(lv===3) lv = 4;   // cấp 3 dùng mẫu nhà của cấp 4 cũ
  const sc = isoScene(), X = ori!=='y', tower = lv>=5, nf = tower ? 5 : lv>=4 ? 3 : lv>=2 ? 2 : 1, hasWing = lv>=3, fh = 7;
  const ML = tower ? 13 : 14, WL = 12, Dp = 16, a0 = (hasWing && back) ? WL : 0, wa = back ? 0 : ML, H = nf*fh;
  const rc = col || ROOF[g] || '#DF6F61', wL = tower ? '#DDF0F8' : '#FFFFFF', wR = tower ? '#B5D9EA' : '#DAD6F2', glow = tower ? '#FFFDF6' : '#FFE9B0';
  const P = (a,b,z) => (X ? sc.P(a,b,z) : sc.P(b,a,z)).join(',');
  const box = (a,b,z,la,lb,h,c,key) => sc.box(X ? {x:a,y:b,z,w:la,d:lb,h,c:[c[0],c[1],c[2]]} : {x:b,y:a,z,w:lb,d:la,h,c:[c[0],c[2],c[1]]}, key);
  const side = (a1,a2,z1,z2,b,col,extra) => `<polygon points="${P(a1,b,z1)} ${P(a2,b,z1)} ${P(a2,b,z2)} ${P(a1,b,z2)}" fill="${col}" ${extra||''}/>`;      // mặt dọc theo chiều dài
  const end = (b1,b2,z1,z2,a,col,extra) => `<polygon points="${P(a,b1,z1)} ${P(a,b2,z1)} ${P(a,b2,z2)} ${P(a,b1,z2)}" fill="${col}" ${extra||''}/>`;        // mặt đầu hồi
  // khối chính
  box(a0, 0, 0, ML, Dp, H, [wL, wL, wR], 10);
  let deco = '';
  for(let f2=0; f2<nf; f2++){
    const z1 = f2*fh + 2, z2 = z1 + 3.6;
    if(tower) deco += side(a0+1.5, a0+ML-1.5, z1, z2, Dp, glow) + end(1.5, Dp-1.5, z1, z2, a0+ML, glow);
    else {
      deco += side(a0+2, a0+5.6, z1, z2, Dp, glow) + side(a0+8, a0+11.6, z1, z2, Dp, glow);
      if(back || !hasWing || f2>0) deco += end(5, 11, z1, z2, a0+ML, glow);
    }
  }
  if(!hasWing && !back) deco += end(9.5, 13.5, 0, 5.2, a0+ML, '#7A5A46');             // cửa chính ở mặt quay vào giữa bàn
  sc.raw(600, deco);
  // mái phẳng viền đậm
  box(a0-1, -1, H, ML+2, Dp+2, 1.7, [rc, shade(rc,.6), shade(rc,.48)], 700);
  sc.raw(701, `<polygon points="${P(a0+.6,.6,H+1.7)} ${P(a0+ML-.6,.6,H+1.7)} ${P(a0+ML-.6,Dp-.6,H+1.7)} ${P(a0+.6,Dp-.6,H+1.7)}" fill="${shade(rc,1.12)}" stroke="none"/>`);
  if(lv===4){ let rail = ''; for(let k2=0;k2<=4;k2++){ const t = a0 + k2*ML/4; rail += `<path d="M${P(t,Dp,H+1.7)}L${P(t,Dp,H+4.4)}" fill="none" stroke-width="1"/>`; } rail += `<path d="M${P(a0,Dp,H+4.4)}L${P(a0+ML,Dp,H+4.4)}L${P(a0+ML,0,H+4.4)}" fill="none" stroke-width="1.2"/>`; sc.raw(710, rail, [isoP(0,0,H+5)]); }
  if(tower){ const q = sc.P.apply(null, X ? [a0+ML/2, Dp/2, H+1.7] : [Dp/2, a0+ML/2, H+1.7]); sc.raw(720, `<path d="M${q[0]} ${q[1]}V${q[1]-10}" fill="none"/><path d="M${q[0]} ${q[1]-10}l7 2.4l-7 2.6z" fill="#E0685C"/>`, [[q[0],q[1]-11],[q[0]+8,q[1]]]); }
  // cánh phụ thấp, mái cỏ, cửa ga-ra
  if(hasWing){
    const wh = fh*.92, wb0 = 3;
    box(wa, wb0, 0, WL, Dp-wb0, wh, ['#FFFFFF', wL, wR], back ? 5 : 300);
    let wd = side(wa+2, wa+WL-2, 0, 4.8, Dp, '#4A5578');
    for(let k3=1;k3<4;k3++) wd += `<path d="M${P(wa+2,Dp,k3*1.2)}L${P(wa+WL-2,Dp,k3*1.2)}" fill="none" stroke="#8C97B8" stroke-width=".7"/>`;
    if(!back) wd += end(wb0+3, wb0+6.6, 0, 5.2, wa+WL, '#7A5A46') + end(wb0+8.4, wb0+11.4, 2, 4.8, wa+WL, glow);
    wd += `<polygon points="${P(wa+1.2,wb0+1.2,wh)} ${P(wa+WL-1.2,wb0+1.2,wh)} ${P(wa+WL-1.2,Dp-1.2,wh)} ${P(wa+1.2,Dp-1.2,wh)}" fill="#8FCB6B"/>`;
    sc.raw(back ? 6 : 650, wd);
  }
  return sc.out([13, 8, 0]);
}
// ----- cao ốc đặc thù cho từng địa danh (cấp 5)
const LMKEY = {'Chùa Một Cột':'chua','Bến Thành':'ben','Nguyễn Huệ':'bitex','Nhà thờ Đức Bà':'church','Đà Nẵng':'dragon','Hội An':'hoian','Hạ Long':'halong','Nha Trang':'hands','Đà Lạt':'dome','Lũng Cú':'flag','Yên Bái':'terrace','Sa Pa':'cable','Langbiang':'peaks','Đắk Lắk':'rong'};
const LMGRP = {vang:'bud', xd:'tru', do:'cot', xl:'l81', nau:'cantho', cam:'hue'};
const lmKey = (g, nm) => LMKEY[nm] || LMGRP[g] || null;
function landmark3D(key, ori, back){
  const sc = isoScene(), X = ori!=='y', W = '#FFE9B0';
  const Q = (a,b,z) => X ? sc.P(a,b,z) : sc.P(b,a,z), P = (a,b,z) => Q(a,b,z).join(',');
  const bx = (a,b,z,la,lb,h,base,k) => { const c = [base, shade(base,.85), shade(base,.7)]; sc.box(X ? {x:a,y:b,z,w:la,d:lb,h,c} : {x:b,y:a,z,w:lb,d:la,h,c:[c[0],c[2],c[1]]}, k); };
  const kk = (a,b,z) => a+b+z*.01+.004;
  const poly = (pts, fill, k, extra) => sc.raw(k, `<polygon points="${pts.map(p => P(p[0],p[1],p[2])).join(' ')}" fill="${fill}" ${extra||''}/>`, pts.map(p => Q(p[0],p[1],p[2])));
  const sideW = (a1,a2,z1,z2,b,col,k) => poly([[a1,b,z1],[a2,b,z1],[a2,b,z2],[a1,b,z2]], col, k, 'stroke="none"');
  const endW = (b1,b2,z1,z2,a,col,k) => poly([[a,b1,z1],[a,b2,z1],[a,b2,z2],[a,b1,z2]], col, k, 'stroke="none"');
  const flag = (a,b,z,hh,k) => { const p = Q(a,b,z); sc.raw(k, `<path d="M${p[0]} ${p[1]}V${p[1]-hh}" fill="none" stroke="#6B4A1A" stroke-width="1.4"/><path d="M${p[0]} ${p[1]-hh}l9 2.6l-9 3.2z" fill="#E0483A"/><path d="M${p[0]+3.6} ${p[1]-hh+3}l.5 1.1 1.2.1-.9.8.3 1.2-1.1-.6-1.1.6.3-1.2-.9-.8 1.2-.1z" fill="#FFD23F" stroke="none"/>`, [[p[0]-1,p[1]-hh-1],[p[0]+10,p[1]]]); };
  let anchor = [13,8,0];
  if(key==='bud'){            // tòa nhà hình nụ sen kính xanh, cạnh là tháp be hai bên, đế thấp
    bx(1,1,0,25,14,3,'#8C7A6A',1);
    const tiers = [[7,3,12,10,10],[7.5,3.5,15.2,9,9],[8.2,4.2,18.4,7.6,7.6],[9,5,21.6,6,6],[10,6,24.8,4,4]];
    let z = 3; [[6,2.5,11,11,7],[6.4,3,14.4,10.2,7],[7,3.5,17.8,9,7],[7.8,4.2,21.2,7.4,7],[8.8,5.2,24.6,5.4,7],[9.8,6.2,28,3.4,5]].forEach((t,i) => { const h = t[2]-z+ (i==5?4:0); });
    const lv = [[6,3,3,10,10,7],[6.5,3.5,10,9,9,7],[7.2,4.2,17,7.6,7.6,7],[8,5,24,6,6,7],[9,6,31,4,4,6]];
    lv.forEach((t,i) => { bx(t[0],t[1],t[2],t[3],t[4],t[5]+.2,i%2 ? '#3E5F96' : '#2E4A7A', 10+i*2); });
    lv.forEach((t,i) => { const zz = t[2]+1.4; sideW(t[0]+1,t[0]+t[3]-1,zz,zz+4,t[1]+t[4],i%2 ? '#8FB8E8' : '#7FA6DC',10.5+i*2); endW(t[1]+1,t[1]+t[4]-1,zz,zz+4,t[0]+t[3],'#6C94C9',10.6+i*2); sideW(t[0]+3,t[0]+4,zz,zz+4,t[1]+t[4],W,10.7+i*2); });
    bx(16,4,3,6,8,24,'#E8CFA0',30); sideW(16.8,21.2,6,9,12,W,30.5); sideW(16.8,21.2,12,15,12,W,30.6); sideW(16.8,21.2,18,21,12,W,30.7); endW(4.8,11.2,8,11,22,W,30.8); endW(4.8,11.2,15,18,22,W,30.9);
    bx(15.6,3.6,27,6.8,8.8,1.4,'#7A5A46',31);
  }
  else if(key==='dome'){      // mái vòm cánh sen vàng, đáy kính
    bx(2,2,0,22,12,6,'#5E9C9A',1); sideW(4,22,1.5,4.5,14,'#BFE3E0',1.5); endW(3.5,12.5,1.5,4.5,24,'#9ACFCB',1.6);
    const c = Q(13,8,6.2); let petals = '';
    for(let k=0;k<8;k++){ const a = k*Math.PI/4+.3; petals += `<path d="M${c[0]} ${c[1]-5}L${(c[0]+Math.cos(a)*14).toFixed(1)} ${(c[1]-5+Math.sin(a)*8.4).toFixed(1)}" fill="none" stroke="#B9822E" stroke-width="1"/>`; }
    sc.raw(20, `<path d="M${c[0]-14.6} ${c[1]-4}A14.6 12 0 0 1 ${c[0]+14.6} ${c[1]-4}V${c[1]+1}A14.6 7 0 0 1 ${c[0]-14.6} ${c[1]+1}Z" fill="#6FA9A4"/><path d="M${c[0]-14.6} ${c[1]-4}A14.6 12 0 0 1 ${c[0]+14.6} ${c[1]-4}A14.6 8 0 0 1 ${c[0]-14.6} ${c[1]-4}Z" fill="#EEC34A"/><ellipse cx="${c[0]}" cy="${c[1]-6.5}" rx="10" ry="5.4" fill="#F7D96E"/><ellipse cx="${c[0]}" cy="${c[1]-6.5}" rx="5.6" ry="2.9" fill="#CFE6EE"/>${petals}`, [[c[0]-15,c[1]-18],[c[0]+15,c[1]+9]]);
  }
  else if(key==='tru'){       // Tháp Rùa trên gò cỏ giữa hồ
    bx(0,0,0,26,16,1,'#9CB8C6',1);
    const c = Q(13,8,1); sc.raw(2, `<ellipse cx="${c[0]}" cy="${c[1]}" rx="17" ry="8.6" fill="#6FA84C"/><ellipse cx="${c[0]}" cy="${c[1]-1.2}" rx="14" ry="7" fill="#82BC5A" stroke="none"/>`, [[c[0]-18,c[1]-9],[c[0]+18,c[1]+9]]);
    const T = '#E8DDB8';
    bx(8,3.4,2,10,9.2,6.4,T,10); bx(8.7,4.1,8.4,8.6,7.8,6,T,12); bx(9.4,4.8,14.4,7.2,6.4,5.6,T,14);
    [[2,8,0],[8.4,14.4,0],[14.4,20,0]].forEach((r,i) => { const z1 = r[0]+1.2, z2 = r[1]-1.4, inset = i*.7, s = 8+0; sideW(9.4+inset,10.8+inset,z1,z2,12.6-inset,'#7A6A4A',20+i); sideW(12.2+inset,13.6+inset,z1,z2,12.6-inset,'#7A6A4A',20.1+i); sideW(15+inset-.2,16.2+inset,z1,z2,12.6-inset,'#7A6A4A',20.2+i); });
    bx(7.4,2.8,8.4-1,11.4,10.4,1.1,'#B9A878',16); bx(8.1,3.5,14.4-1,9.8,9,1.1,'#B9A878',17); bx(8.8,4.2,20,8.4,7.6,1.4,'#8B7A55',18);
    bx(10.2,5.6,21.4,5.6,4.8,2.2,'#D9CCA2',19); bx(11.4,6.6,23.6,3.2,2.8,1.4,'#8B7A55',19.5);
    const t = Q(13,8,25.2); sc.raw(40, `<path d="M${t[0]} ${t[1]-6}V${t[1]}" stroke="#8B7A55" stroke-width="1.2"/>`, [[t[0]-2,t[1]-7],[t[0]+2,t[1]]]);
  }

  else if(key==='chua'){      // Chùa Một Cột: cột đá giữa ao sen, nhà gỗ mái ngói cong
    bx(0,0,0,26,16,1,'#7FB4C8',1);
    const c = Q(13,8,1); let lot = ''; [[-9,2],[8,3],[-6,-3],[10,-2],[-1,5]].forEach(q => { lot += `<ellipse cx="${c[0]+q[0]}" cy="${c[1]+q[1]}" rx="2.6" ry="1.2" fill="#F2A6C0" stroke="none"/>`; });
    sc.raw(2, lot, [[c[0]-12,c[1]-3],[c[0]+12,c[1]+8]]);
    bx(11.4,6.4,1,3.2,3.2,8,'#9A9A8E',10); bx(7.2,2.2,9,11.6,11.6,1.6,'#6B4A2A',11);
    bx(8.4,3.4,10.6,9.2,9.2,4.4,'#8A4A2A',12); sideW(10,17,11.6,14,12.6,'#3E2414',12.5);
    bx(5.6,.8,15,14.8,14.8,1.2,'#B5543A',13); bx(7.2,2.4,16.2,11.6,11.6,1.6,'#C4603F',14); bx(9.6,4.8,17.8,6.8,6.8,1.6,'#B5543A',15); bx(11.4,6.6,19.4,3.2,3.2,1.2,'#8E3A2A',16);
    for(let i=0;i<4;i++) bx(22.4+i*0,3+i*2.4,1+i*1.6,3,2,1.6,'#D9CFB0',20+i);
  }
  else if(key==='ben'){       // chợ Bến Thành: tháp đồng hồ, hai cánh mái ngói đỏ
    bx(1,1,0,24,14,5,'#EAD9A8',1); sideW(2,5,1,3.4,15,'#2F4A8A',2); sideW(21,24,1,3.4,15,'#2F4A8A',2.1); sideW(6,9,1,3.4,15,'#2F4A8A',2.2); sideW(17,20,1,3.4,15,'#2F4A8A',2.3);
    bx(1,2,5,6,12,2.4,'#B5543A',3); bx(19,2,5,6,12,2.4,'#B5543A',3.1);
    bx(9,5,5,8,6,12,'#EAD9A8',10); sideW(11,15,5.4,9.4,11,'#3A3A3A',10.5); sideW(11.4,14.6,13,15.6,11,'#F4EEDC',10.6); endW(6,10,7,11,17,'#2F4A8A',10.7);
    bx(8.2,4.2,17,9.6,7.6,1.2,'#B5543A',11); bx(10,5.8,18.2,6,4.4,1.8,'#C4603F',12); bx(12,7,20,2,2,1.4,'#8E3A2A',13);
  }
  else if(key==='bitex'){     // Bitexco: thân kính xanh thon, sân đáp trực thăng nhô ra
    bx(3,2,0,20,12,3,'#3A4658',1);
    [[7,4,3,12,8,12],[7.6,4.4,15,11,7.4,10],[8.4,5,25,9.4,6,8],[9.2,5.6,33,7.4,4.8,6],[10.2,6.2,39,5,3.6,4]].forEach((t,i) => { bx(t[0],t[1],t[2],t[3],t[4],t[5],i%2 ? '#4A6384' : '#3F566F',10+i*2); for(let r=0;r<3;r++) sideW(t[0]+.8,t[0]+t[3]-.8,t[2]+1.2+r*3,t[2]+2.4+r*3,t[1]+t[4],'#9DB8D6',10.5+i*2+r*.01); });
    const h = Q(23.4,8.6,27); sc.raw(25, `<ellipse cx="${h[0]}" cy="${h[1]}" rx="7.4" ry="3.6" fill="#C9D1DE"/><ellipse cx="${h[0]}" cy="${h[1]}" rx="4.4" ry="2.1" fill="#E0483A" stroke="none"/>`, [[h[0]-8,h[1]-4],[h[0]+8,h[1]+4]]);
  }
  else if(key==='church'){    // Nhà thờ Đức Bà: gạch đỏ, hai tháp chuông nhọn
    bx(2,2,0,17,12,2,'#B9B2A6',1); bx(3,3.4,2,15,9.2,10,'#D98A4A',2); bx(3,3.4,12,15,9.2,2,'#E8793A',3);
    [[3.8,6],[10,12],[14.6,17]].forEach((r,i) => { sideW(r[0],r[1],4,9,12.6,'#F4E6C8',4+i*.01); });
    bx(19,2.4,2,5,4.4,14,'#D98A4A',10); bx(19,9.2,2,5,4.4,14,'#D98A4A',10.1);
    const pyr = (a,b,w,d,z0,hh,col,k) => { const m = [a+w/2,b+d/2,z0+hh]; poly([[a+w,b,z0],[a+w,b+d,z0],m], shade(col,.7), k); poly([[a,b+d,z0],[a+w,b+d,z0],m], col, k+.001); const t = Q(m[0],m[1],m[2]); sc.raw(k+.002, `<path d="M${t[0]} ${t[1]}v-5M${t[0]-1.6} ${t[1]-3.4}h3.2" stroke="#6B6B6B" stroke-width="1" fill="none"/>`, [[t[0]-2,t[1]-6],[t[0]+2,t[1]]]); };
    pyr(18.6,2,5.8,5.2,16,16,'#A9B0B8',11); pyr(18.6,8.8,5.8,5.2,16,16,'#A9B0B8',11.2);
    endW(3.4,5.6,5,10,24,'#F4E6C8',12); endW(10.4,12.4,5,10,24,'#F4E6C8',12.1); endW(11.2,12.6,3,8,24,'#2B3A67',12.2);
    endW(6.6,9.6,6,9,24.0,'#FFF3D0',12.3);
  }
  else if(key==='dragon'){    // cầu Rồng: mặt cầu, hai vòm rồng vàng, đầu rồng ở đầu cầu
    bx(0,0,0,26,16,1.4,'#5FB4E0',1); bx(5,5,1.4,3,6,3,'#C9CED6',5); bx(18,5,1.4,3,6,3,'#C9CED6',5.1);
    bx(0,4.6,4.4,26,6.8,1.6,'#4A5568',6);
    let arcs = ''; const A = (a1,a2,h,w) => { const p = Q(a1,5.2,6), q = Q(a2,5.2,6), p2 = Q(a1,10.8,6), q2 = Q(a2,10.8,6), m = [(p[0]+q[0])/2,(p[1]+q[1])/2-h], m2 = [(p2[0]+q2[0])/2,(p2[1]+q2[1])/2-h]; arcs += `<path d="M${p[0]} ${p[1]}Q${m[0]} ${m[1]-h*.5} ${q[0]} ${q[1]}" fill="none" stroke="#D9A82A" stroke-width="${w+1.8}"/><path d="M${p[0]} ${p[1]}Q${m[0]} ${m[1]-h*.5} ${q[0]} ${q[1]}" fill="none" stroke="#F4C542" stroke-width="${w}"/><path d="M${p2[0]} ${p2[1]}Q${m2[0]} ${m2[1]-h*.5} ${q2[0]} ${q2[1]}" fill="none" stroke="#D9A82A" stroke-width="${w+1.8}"/><path d="M${p2[0]} ${p2[1]}Q${m2[0]} ${m2[1]-h*.5} ${q2[0]} ${q2[1]}" fill="none" stroke="#F4C542" stroke-width="${w}"/>`; };
    A(.5,13.5,20,1.8); A(12.5,25.5,16,1.8);
    const hd = Q(1.5,8,8); sc.raw(30, `<ellipse cx="${hd[0]}" cy="${hd[1]-3}" rx="6.4" ry="4.4" fill="#F4C542"/><path d="M${hd[0]-3} ${hd[1]-6.4}l-3 -5l5 2zM${hd[0]+1} ${hd[1]-7}l0 -5l3.4 3.4z" fill="#D9A82A"/><circle cx="${hd[0]+2}" cy="${hd[1]-4}" r="1" fill="#2B3A67" stroke="none"/>`, [[hd[0]-8,hd[1]-13],[hd[0]+8,hd[1]+2]]);
    sc.raw(29, arcs, [Q(0,0,0),Q(26,16,26)]);
  }
  else if(key==='hoian'){     // phố cổ Hội An: nhà vàng mái ngói, đèn lồng đỏ
    bx(0,0,0,26,16,1.4,'#C9A56F',1);
    bx(1,3,1.4,11,11,8,'#E8C24A',10); bx(.2,2.2,9.4,12.6,12.6,2,'#B5543A',11); bx(2.4,4.4,11.4,8.2,8.2,1.4,'#C4603F',12);
    bx(14,4,1.4,10,9,5.6,'#E2B93C',20); bx(13.2,3.2,7,11.6,10.6,1.8,'#B5543A',21); bx(15.2,5.2,8.8,7.6,6.6,1.2,'#C4603F',22);
    sideW(2.4,5.2,3,7,14,'#6B3A22',10.5); sideW(7.4,10.4,3,7,14,'#6B3A22',10.6); sideW(15.4,18.4,2.6,5.4,13,'#6B3A22',20.5); sideW(20,23,2.6,5.4,13,'#6B3A22',20.6);
    let ln = ''; [[4.6,14.4,8.4],[8.8,14.4,8.4],[17,13.4,6.4],[21.4,13.4,6.4]].forEach(q => { const p = Q(q[0],q[1]+.4,q[2]); ln += `<circle cx="${p[0]}" cy="${p[1]+1.4}" r="1.5" fill="#E0483A"/>`; });
    sc.raw(40, ln, [Q(0,0,0),Q(26,16,10)]);
  }
  else if(key==='halong'){    // nhà hát Hạ Long: hai vỏ trắng như đĩa bay
    bx(2,2,0,22,12,4,'#2E4A7A',1);
    const c = Q(12,8,4.4), c2 = Q(19,6,11);
    sc.raw(20, `<ellipse cx="${c[0]}" cy="${c[1]+2}" rx="15" ry="7.6" fill="#C9D1DE"/><ellipse cx="${c[0]}" cy="${c[1]}" rx="15" ry="7.6" fill="#F4F7FA"/><ellipse cx="${c[0]}" cy="${c[1]-.4}" rx="10.4" ry="5" fill="#E8EEF4" stroke="none"/><ellipse cx="${c2[0]}" cy="${c2[1]+1.6}" rx="9.4" ry="4.6" fill="#C9D1DE"/><ellipse cx="${c2[0]}" cy="${c2[1]}" rx="9.4" ry="4.6" fill="#FFFFFF"/><path d="M${c2[0]-3} ${c2[1]}q6 -2 13 1.6" fill="none" stroke="#2B3348" stroke-width="2.2"/>`, [[c[0]-16,c[1]-8],[c[0]+16,c[1]+10],[c2[0]-10,c2[1]-6]]);
  }
  else if(key==='hands'){     // cầu Vàng Nha Trang: hai bàn tay đá nâng cây cầu
    bx(0,0,0,26,16,3,'#4E8A4A',1);
    bx(1,4,3,7,8,4,'#B0B8AB',5); bx(18,4,3,7,8,4,'#B0B8AB',5.1);
    [[1,3.4,12],[2.8,3.4,15],[4.6,3.4,13],[6.4,3.4,10],[18,3.4,10],[19.8,3.4,13],[21.6,3.4,15],[23.4,3.4,12]].forEach((f,i) => { bx(f[0],f[1]+.6,7,1.4,1.4,f[2],'#C9CFC4',10+i*.1); bx(f[0],f[1]+4.4,7,1.4,1.4,f[2]-1,'#BFC7BA',10.05+i*.1); });
    bx(2,6,18,22,4,1.4,'#E2B93C',20);
    const rl = Q(2,10.4,19.4), rl2 = Q(24,10.4,19.4); sc.raw(25, `<path d="M${rl[0]} ${rl[1]}L${rl2[0]} ${rl2[1]}" stroke="#D9A82A" stroke-width="1.2"/>`, [rl,rl2]);
    bx(12,7.4,3,1.4,1.4,15,'#3F8F5A',21);
  }
  else if(key==='cot'){       // cột cờ Chùa Một Cột: ba tầng đế vuông, tháp lục giác, cờ đỏ
    bx(2,0,0,22,16,3.2,'#D9B98A',1); bx(4.4,2.2,3.2,17.2,11.6,3.2,'#CDAA78',2); bx(6.8,4.4,6.4,12.4,7.2,3.2,'#BE9A68',3);
    bx(10,5.8,9.6,6,4.4,20,'#C9A56F',4);
    [[2,9],[11,18],[16,26]].forEach((r,i) => { sideW(11,13,10+r[0]*.8,11.4+r[0]*.8,10.2,'#5B4326',5+i*.1); });
    bx(9.4,5.2,29.6,7.2,5.6,1.2,'#8E6B3E',6); flag(13,8,31,16,7);
    anchor = [13,8,0];
  }
  else if(key==='l81'){       // tháp kính siêu cao Landmark 81
    bx(3,1,0,20,14,3,'#7B8794',1);
    [[7,3,3,12,10,10,'#5FA79A'],[7.6,3.6,13,10.8,8.8,10,'#4F988C'],[8.4,4.4,23,9.2,7.2,10,'#5FA79A'],[9.2,5,33,7.6,6,8,'#4F988C']].forEach((t,i) => { bx(t[0],t[1],t[2],t[3],t[4],t[5],t[6],10+i*2); for(let r=0;r<3;r++){ sideW(t[0]+1,t[0]+t[3]-1,t[2]+1.4+r*3,t[2]+2.8+r*3,t[1]+t[4],i%2 ? '#D8F4EE' : '#BFE8E0',10.5+i*2+r*.01); } endW(t[1]+1,t[1]+t[4]-1,t[2]+1.4,t[2]+8,t[0]+t[3],'#8FD0C4',10.6+i*2); });
    bx(10.4,6.2,41,5,4.4,3,'#3F7F76',20); const t = Q(13,8,44); sc.raw(21, `<path d="M${t[0]} ${t[1]}V${t[1]-9}" stroke="#E0483A" stroke-width="1.2"/>`, [[t[0]-1,t[1]-10],[t[0]+1,t[1]]]);
  }
  else if(key==='cantho'){    // cầu dây văng: mặt cầu dài và hai trụ tháp có dây
    bx(0,4.4,0,26,7.2,2.4,'#B9B2A6',1);
    const py = a => { bx(a,3.6,2.4,2.4,2,24,'#D9D4C8',5+a); bx(a,11.6,2.4,2.4,2,24,'#D9D4C8',5.1+a); bx(a,3.6,22,2.4,10,2,'#C9C4B8',5.2+a); };
    py(6); py(18);
    let cab = ''; [[7.2,-1],[19.2,1]].forEach(p => { for(let k=1;k<=4;k++){ const a1 = p[0]+.6, a2 = p[0]+p[1]*k*2.6, z = 23-k*1.2; const A = Q(a1,12,z+1), B = Q(a2,12,2.4); cab += `<path d="M${A[0]} ${A[1]}L${B[0]} ${B[1]}" stroke="#F4EEDC" stroke-width=".7"/>`; } });
    sc.raw(30, cab, [Q(0,0,0),Q(26,16,28)]);
  }
  else if(key==='hue'){       // Ngọ Môn: đế đỏ, lầu mái vàng hai tầng
    bx(1,2,0,24,12,6,'#B23A2E',1);
    [[3,6.5],[11,15],[19,23]].forEach((r,i) => { sideW(r[0]+.6,r[1]-.6,1.4,5.4,14,'#4B1E18',2+i*.1); });
    bx(5,4,6,16,8,6,'#C9473A',10); sideW(7,19,7.4,10.6,12,'#4B1E18',10.5);
    bx(3.6,2.6,12,18.8,10.8,1.8,'#E8B93C',11); bx(6.2,4.2,13.8,13.6,7.6,5,'#C9473A',12); sideW(8,18,15,17.6,11.8,'#4B1E18',12.5);
    bx(4.6,3.2,18.8,16.8,9.6,1.8,'#E8B93C',13); bx(9,5.4,20.6,8,5.2,1.6,'#F2CB57',14);
  }
  else if(key==='flag'){      // cột cờ Lũng Cú: tháp đá bát giác trên đỉnh núi, cột cờ rất cao
    bx(2,0,0,22,16,2.8,'#8A8F7A',1); bx(4.6,2.4,2.8,16.8,11.2,3.2,'#9AA088',2); bx(7.2,4.8,6,11.6,6.4,3.4,'#A9AF97',3);
    bx(10,6,9.4,6,4,6,'#B7BCA6',4); sideW(11.4,14.6,11,13.4,10,'#4B4F43',5);
    flag(13,8,15.4,34,6); anchor = [13,8,0];
  }
  else if(key==='terrace'){   // ruộng bậc thang Yên Bái
    [[1,1,24,14,'#7DAF45'],[3,2.6,20,10.8,'#A8C54C'],[5,4.2,16,7.6,'#D8B84A'],[7,5.8,12,4.4,'#8DBA4B']].forEach((t,i) => { bx(t[0],t[1],i*3.4,t[2],t[3],3.4,t[4],1+i); });
    bx(15,6,13.6,4.4,3.6,3.4,'#8A5A34',10); poly([[14.4,5.6,17],[19.8,5.6,17],[17.1,6,19.8]],'#C9A25A',11,'stroke="none"');
    const t = Q(8,8,13.6); sc.raw(12, `<path d="M${t[0]-6} ${t[1]-1}q6 -4 12 0" fill="none" stroke="#E8F3C8" stroke-width="1"/><path d="M${t[0]-5} ${t[1]+2}q5 -3 10 0" fill="none" stroke="#E8F3C8" stroke-width="1"/>`, [[t[0]-7,t[1]-5],[t[0]+7,t[1]+3]]);
  }
  else if(key==='cable'){     // ga cáp treo Sa Pa trên núi đá phủ mây
    bx(0,0,0,26,16,3,'#8A8F98',1); bx(3,2,3,20,12,4,'#A7ADB6',2); bx(6,4,7,14,8,4,'#D6DBE2',3);
    bx(8,4.6,11,10,6.8,8,'#E8F0F7',10); sideW(9,17,13,17,11.4,'#5FA8D3',11); endW(5.4,10.4,13,17,18,'#4A8EB8',11.1);
    poly([[7.4,4,19],[18.6,4,19],[18.6,11.4,19],[7.4,11.4,19]],'#C9473A',12,'stroke="none"'); bx(9,5,19,8,5.4,2,'#F4F7FA',13);
    const c0 = Q(24,8,26), c1 = Q(4,8,44); sc.raw(30, `<path d="M${c0[0]} ${c0[1]}L${c1[0]} ${c1[1]}" stroke="#2B3A67" stroke-width=".8"/><rect x="${((c0[0]+c1[0])/2-2.4).toFixed(1)}" y="${((c0[1]+c1[1])/2).toFixed(1)}" width="4.8" height="4" rx="1" fill="#F2A65A"/>`, [[c1[0]-3,c1[1]-2],[c0[0]+3,c0[1]+4]]);
  }
  else if(key==='peaks'){     // hai đỉnh Langbiang phủ thông
    const pk = (a,b,w,hh,col,k) => { poly([[a,b,0],[a+w,b,0],[a+w/2,b+w/2,hh]], shade(col,.8), k+.1, 'stroke="none"'); poly([[a+w,b,0],[a+w,b+w,0],[a+w/2,b+w/2,hh]], shade(col,.65), k+.2); poly([[a,b+w,0],[a+w,b+w,0],[a+w/2,b+w/2,hh]], col, k+.3); };
    bx(0,0,0,26,16,1.6,'#6E9E4A',1); pk(11,1,15,26,'#5F9A55',5); pk(1,2,13,18,'#4E8A4A',3);
    [[8,12],[18,13],[22,12],[4,13]].forEach((t,i) => { const a = Q(t[0],t[1],1.6); sc.raw(40+i, `<path d="M${a[0]} ${a[1]-8}l3 7h-6z" fill="#2F7A3A"/><path d="M${a[0]} ${a[1]-11}l2.6 6h-5.2z" fill="#3F9A45"/>`, [[a[0]-4,a[1]-12],[a[0]+4,a[1]]]); });
  }
  else {                      // nhà rông Tây Nguyên: sàn cao trên cột, mái dựng đứng rất cao
    bx(0,0,0,26,16,1.2,'#7DAF45',1);
    [[5,3],[5,12],[20,3],[20,12],[12.5,3],[12.5,12]].forEach((p,i) => { bx(p[0],p[1],1.2,1.4,1.4,8,'#8A5A34',3+i*.01); });
    bx(3.4,2.4,9.2,19.2,11.2,1.2,'#A87C4A',10);
    bx(6,4,10.4,14,8,5,'#B88A52',11); sideW(8,18,11.6,14.6,12,'#5A3A1E',11.5);
    const a0 = 4.4, a1 = 21.6, b0 = 3, b1 = 13, zr = 15.4, zt = 40;
    poly([[a0,b0,zr],[a1,b0,zr],[(a0+a1)/2+4,8,zt],[(a0+a1)/2-4,8,zt]], '#C9A25A', 20, 'stroke="none"');
    poly([[a1,b0,zr],[a1,b1,zr],[(a0+a1)/2+4,8,zt]], '#A8803E', 21);
    poly([[a0,b1,zr],[a1,b1,zr],[(a0+a1)/2+4,8,zt],[(a0+a1)/2-4,8,zt]], '#D9B46A', 22);
    const a = Q(13,8,zt+1); sc.raw(30, `<path d="M${a[0]-4} ${a[1]}L${a[0]-6.4} ${a[1]-6}M${a[0]+4} ${a[1]}L${a[0]+6.4} ${a[1]-6}" stroke="#6B4A1A" stroke-width="1.4" fill="none"/>`, [[a[0]-8,a[1]-8],[a[0]+8,a[1]]]);
  }
  return sc.out(anchor);
}
function cityKit(ori, sc0){
  const sc = sc0 || isoScene(), X = ori!=='y';
  const Q = (a,b,z) => X ? sc.P(a,b,z) : sc.P(b,a,z), P = (a,b,z) => Q(a,b,z).join(',');
  const f = v => (+v).toFixed(1);
  const bx = (a,b,z,la,lb,h,base,k) => { const c = [base, shade(base,.86), shade(base,.7)]; sc.box(X ? {x:a,y:b,z,w:la,d:lb,h,c} : {x:b,y:a,z,w:lb,d:la,h,c:[c[0],c[2],c[1]]}, k); };
  const poly = (pts, fill, k, extra) => sc.raw(k, `<polygon points="${pts.map(p => P(p[0],p[1],p[2])).join(' ')}" fill="${fill}" ${extra||''}/>`, pts.map(p => Q(p[0],p[1],p[2])));
  const sideW = (a1,a2,z1,z2,b,col,k,ex) => poly([[a1,b,z1],[a2,b,z1],[a2,b,z2],[a1,b,z2]], col, k, ex || 'stroke="none"');   // mặt trước (dọc chiều dài)
  const endW  = (b1,b2,z1,z2,a,col,k,ex) => poly([[a,b1,z1],[a,b2,z1],[a,b2,z2],[a,b1,z2]], col, k, ex || 'stroke="none"');   // mặt đầu hồi
  const line = (p1, p2, col, w, k) => { const A = Q(p1[0],p1[1],p1[2]), B = Q(p2[0],p2[1],p2[2]); sc.raw(k, `<path d="M${f(A[0])} ${f(A[1])}L${f(B[0])} ${f(B[1])}" fill="none" stroke="${col}" stroke-width="${w}"/>`, [A,B]); };
  const E = (a,b,z,r) => { const c = Q(a,b,z); return {x:c[0], y:c[1], rx:1.2247*r, ry:ISOK.y*1.4142*r}; };
  const U = ISOK.z;
  const cyl = (a,b,z,r,h,col,k,top) => { const e = E(a,b,z,r), t = E(a,b,z+h,r), rx = e.rx, ry = e.ry;
    sc.raw(k, `<path d="M${f(e.x-rx)} ${f(e.y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(e.x+rx)} ${f(e.y)}L${f(t.x+rx)} ${f(t.y)}A${f(rx)} ${f(ry)} 0 0 0 ${f(t.x-rx)} ${f(t.y)}Z" fill="${col}"/>`
      + `<path d="M${f(e.x)} ${f(e.y+ry)}A${f(rx)} ${f(ry)} 0 0 0 ${f(e.x+rx)} ${f(e.y)}L${f(t.x+rx)} ${f(t.y)}L${f(t.x)} ${f(t.y+ry)}Z" fill="${shade(col,.8)}" stroke="none"/>`
      + `<ellipse cx="${f(t.x)}" cy="${f(t.y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${top || shade(col,1.12)}"/>`, [[e.x-rx,e.y+ry],[t.x+rx,t.y-ry]]); };
  const dome = (a,b,z,r,hh,col,k) => { const e = E(a,b,z,r), H = hh*U;
    sc.raw(k, `<path d="M${f(e.x-e.rx)} ${f(e.y)}A${f(e.rx)} ${f(H)} 0 0 1 ${f(e.x+e.rx)} ${f(e.y)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(e.x-e.rx)} ${f(e.y)}Z" fill="${col}"/>`
      + `<path d="M${f(e.x+e.rx*.15)} ${f(e.y-H*.98)}A${f(e.rx)} ${f(H)} 0 0 1 ${f(e.x+e.rx)} ${f(e.y)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(e.x+e.rx*.2)} ${f(e.y+e.ry*.98)}Q${f(e.x+e.rx*.55)} ${f(e.y-H*.3)} ${f(e.x+e.rx*.15)} ${f(e.y-H*.98)}Z" fill="${shade(col,.82)}" stroke="none"/>`
      + `<ellipse cx="${f(e.x-e.rx*.38)}" cy="${f(e.y-H*.55)}" rx="${f(e.rx*.16)}" ry="${f(H*.18)}" fill="#FFFFFF" opacity=".45" stroke="none"/>`, [[e.x-e.rx,e.y-H],[e.x+e.rx,e.y+e.ry]]); };
  const onion = (a,b,z,r,hh,col,k) => { const e = E(a,b,z,r), H = hh*U, x = e.x, y = e.y, w = e.rx;
    sc.raw(k, `<path d="M${f(x-w*.75)} ${f(y)}C${f(x-w*1.25)} ${f(y-H*.45)} ${f(x-w*.35)} ${f(y-H*.72)} ${f(x)} ${f(y-H)}C${f(x+w*.35)} ${f(y-H*.72)} ${f(x+w*1.25)} ${f(y-H*.45)} ${f(x+w*.75)} ${f(y)}Z" fill="${col}"/>`
      + `<path d="M${f(x)} ${f(y-H)}C${f(x+w*.35)} ${f(y-H*.72)} ${f(x+w*1.25)} ${f(y-H*.45)} ${f(x+w*.75)} ${f(y)}L${f(x+w*.2)} ${f(y)}C${f(x+w*.5)} ${f(y-H*.4)} ${f(x+w*.2)} ${f(y-H*.7)} ${f(x)} ${f(y-H)}Z" fill="${shade(col,.8)}" stroke="none"/>`, [[x-w,y-H],[x+w,y]]); };
  const cone = (a,b,z,r,hh,col,k) => { const e = E(a,b,z,r), H = hh*U, x = e.x, y = e.y;
    sc.raw(k, `<path d="M${f(x-e.rx)} ${f(y)}L${f(x)} ${f(y-H)}L${f(x+e.rx)} ${f(y)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(x-e.rx)} ${f(y)}Z" fill="${col}"/>`
      + `<path d="M${f(x)} ${f(y+e.ry)}L${f(x)} ${f(y-H)}L${f(x+e.rx)} ${f(y)}A${f(e.rx)} ${f(e.ry)} 0 0 1 ${f(x)} ${f(y+e.ry)}Z" fill="${shade(col,.78)}" stroke="none"/>`, [[x-e.rx,y-H],[x+e.rx,y+e.ry]]); };
  const pyr = (a,b,la,lb,z,hh,col,k) => { const m = [a+la/2, b+lb/2, z+hh];      // chóp 4 mặt (thấy 2 mặt)
    poly([[a+la,b,z],[a+la,b+lb,z],m], shade(col,.72), k); poly([[a,b+lb,z],[a+la,b+lb,z],m], col, k+.001); };
  const tree = (a,b,z,r,col,k) => { const p = Q(a,b,z); sc.raw(k, `<rect x="${f(p[0]-.9)}" y="${f(p[1]-4)}" width="1.8" height="4" fill="#8A5A34" stroke="none"/><circle cx="${f(p[0])}" cy="${f(p[1]-4-r*.8)}" r="${r}" fill="${col}"/>`, [[p[0]-r,p[1]-4-r*1.8],[p[0]+r,p[1]]]); };
  const palm = (a,b,z,hh,k) => { const p = Q(a,b,z), H = hh*U, t = [p[0]+1.5, p[1]-H];
    sc.raw(k, `<path d="M${f(p[0])} ${f(p[1])}Q${f(p[0]-1)} ${f(p[1]-H*.5)} ${f(t[0])} ${f(t[1])}" fill="none" stroke="#8A5A34" stroke-width="1.6"/><path d="M${f(t[0])} ${f(t[1])}q-5 -1 -7 3M${f(t[0])} ${f(t[1])}q5 -1 7 3M${f(t[0])} ${f(t[1])}q-2 -4 -6 -4M${f(t[0])} ${f(t[1])}q2 -4 6 -4" fill="none" stroke="#3F9A45" stroke-width="1.8"/>`, [[t[0]-8,t[1]-5],[t[0]+8,p[1]]]); };
  return {sc, Q, P, f, bx, poly, sideW, endW, line, E, U, cyl, dome, onion, cone, pyr, tree, palm, X};
}
/* ----- ô Thuế: bọc tiền đặt trên viền cỏ phía ngoài ô (chạm mặt bàn), có người đứng trên ô thì mờ đi để không che quân cờ.
   TAX_STYLE chọn mẫu: A bao bố cổ điển · B túi lụa vàng · C đống của cải · D bao tiền mặt mếu · E bao thủng rơi xu · F bao tiền dán hoá đơn */
const TAX_STYLE = 'G';
function taxBag3D(style){
  style = style || TAX_STYLE;
  const sc = isoScene(), o = sc.P(0,0,0), x = o[0], y = o[1], f = v => (+v).toFixed(1);
  const coin = (cx, cy, r, k) => `<g class="tbc" style="--k:${k||0}" stroke="#8A6A26" stroke-width=".6"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${r}" ry="${f(r*.5)}" fill="#C99A2E"/><ellipse cx="${f(cx)}" cy="${f(cy-r*.28)}" rx="${r}" ry="${f(r*.5)}" fill="#F4C542"/><ellipse cx="${f(cx)}" cy="${f(cy-r*.28)}" rx="${f(r*.55)}" ry="${f(r*.26)}" fill="none" stroke="#C99A2E" stroke-width=".6"/></g>`;
  const stack = (cx, cy, n, r) => { let s = ''; for(let i=0;i<n;i++) s += `<ellipse cx="${f(cx)}" cy="${f(cy-i*1.5)}" rx="${r}" ry="${f(r*.5)}" fill="${i%2 ? '#E8B93C' : '#F4C542'}"/>`; return s + `<ellipse cx="${f(cx)}" cy="${f(cy-(n-1)*1.5)}" rx="${f(r*.55)}" ry="${f(r*.26)}" fill="none" stroke="#C99A2E" stroke-width=".6"/>`; };
  const spark = (sx, sy, k) => `<path class="tbs" style="--k:${k}" d="M${f(sx)} ${f(sy-2.4)}L${f(sx+.7)} ${f(sy-.7)}L${f(sx+2.4)} ${f(sy)}L${f(sx+.7)} ${f(sy+.7)}L${f(sx)} ${f(sy+2.4)}L${f(sx-.7)} ${f(sy+.7)}L${f(sx-2.4)} ${f(sy)}L${f(sx-.7)} ${f(sy-.7)}Z" fill="#FFF3A0" stroke="none"/>`;
  const dollar = (cx, cy, s, col) => `<text x="${f(cx)}" y="${f(cy)}" text-anchor="middle" font-family="Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="${s}" fill="${col}" stroke="#FFF7DA" stroke-width=".8" paint-order="stroke">$</text>`;
  // thân bao: đáy phẳng chạm đất ở g, cao h, rộng w
  const sack = (cx, g, w, h, body, dark, hi) => `<path d="M${f(cx-w*.3)} ${f(g-h)}C${f(cx-w)} ${f(g-h*.72)} ${f(cx-w*1.04)} ${f(g-h*.12)} ${f(cx-w*.8)} ${f(g)}L${f(cx+w*.8)} ${f(g)}C${f(cx+w*1.04)} ${f(g-h*.12)} ${f(cx+w)} ${f(g-h*.72)} ${f(cx+w*.3)} ${f(g-h)}Z" fill="${body}"/>`
    + `<path d="M${f(cx+w*.12)} ${f(g-h*.98)}C${f(cx+w*.85)} ${f(g-h*.68)} ${f(cx+w*.9)} ${f(g-h*.1)} ${f(cx+w*.66)} ${f(g-.2)}L${f(cx+w*.2)} ${f(g-.2)}C${f(cx+w*.5)} ${f(g-h*.25)} ${f(cx+w*.5)} ${f(g-h*.7)} ${f(cx+w*.12)} ${f(g-h*.98)}Z" fill="${dark}" stroke="none"/>`
    + `<ellipse cx="${f(cx-w*.42)}" cy="${f(g-h*.55)}" rx="${f(w*.14)}" ry="${f(h*.17)}" fill="${hi}" opacity=".7" stroke="none"/>`;
  const neck = (cx, top, w, body, tie) => `<path d="M${f(cx-w*.36)} ${f(top-4)}L${f(cx-w*.28)} ${f(top)}L${f(cx+w*.28)} ${f(top)}L${f(cx+w*.36)} ${f(top-4)}L${f(cx+w*.14)} ${f(top-2.6)}L${f(cx)} ${f(top-4.6)}L${f(cx-w*.14)} ${f(top-2.6)}Z" fill="${body}"/><path d="M${f(cx-w*.32)} ${f(top-.4)}Q${f(cx)} ${f(top+1.4)} ${f(cx+w*.32)} ${f(top-.4)}" fill="none" stroke="${tie}" stroke-width="1.8"/>`;
  let s = `<ellipse class="tbsh" cx="${f(x)}" cy="${f(y)}" rx="12" ry="3.4" fill="rgba(43,58,103,.25)" stroke="none"/>`, top = y - 26;
  if(style==='A'){          // bao bố cổ điển buộc dây đỏ, đống xu dưới chân
    const g = y, h = 17, w = 8.4;
    s += `<g class="tbag">${sack(x, g, w, h, '#D9B77A', '#B9925A', '#F3DFB0')}${neck(x, g-h, w, '#D9B77A', '#B5442E')}${dollar(x-.6, g-4.2, 10, '#3E7A2E')}</g>${coin(x-10, g+.4, 2.8, 0)}${coin(x+10.5, g-.2, 2.6, 1)}${coin(x+8.4, g+1.6, 2.4, 2)}${spark(x-8, g-18, 0)}${spark(x+9, g-20, 1)}`;
    top = g - h - 6;
  } else if(style==='B'){   // túi lụa vàng sang trọng, nơ đỏ, mặt dây hình đồng xu
    const g = y, h = 16, w = 8;
    s += `<g class="tbag">${sack(x, g, w, h, '#F2C14E', '#D9A030', '#FFF0B8')}${neck(x, g-h, w, '#F2C14E', '#E0483A')}<path d="M${f(x-4)} ${f(g-h-1)}l-4 3l1 -4zM${f(x+4)} ${f(g-h-1)}l4 3l-1 -4z" fill="#E0483A"/><circle cx="${f(x)}" cy="${f(g-6.4)}" r="4.4" fill="#E0483A"/><circle cx="${f(x)}" cy="${f(g-6.4)}" r="3.2" fill="#F4C542" stroke="none"/>${dollar(x, g-4.2, 6.4, '#B5442E')}</g>${coin(x-10, g+.2, 2.6, 0)}${coin(x+10, g+.4, 2.6, 1)}${spark(x-9, g-16, 0)}${spark(x+8, g-21, 1)}${spark(x+12, g-9, 2)}`;
    top = g - h - 6;
  } else if(style==='C'){   // đống của cải: bao tiền nhỏ, chồng xu, xấp tiền giấy, thỏi vàng
    const g = y;
    s += `<g class="tbag">${stack(x-9, g, 6, 3.2)}<path d="M${f(x+3)} ${f(g-1)}l9 -3l4 2.4l-9 3z" fill="#7FBF6A"/><path d="M${f(x+3)} ${f(g-3)}l9 -3l4 2.4l-9 3z" fill="#8FD07A"/><path d="M${f(x+3)} ${f(g-5)}l9 -3l4 2.4l-9 3z" fill="#9FE08A"/><circle cx="${f(x+9.5)}" cy="${f(g-5.4)}" r="1.4" fill="#5FA84C" stroke="none"/>`
      + `${sack(x, g-1, 6.4, 13, '#D9B77A', '#B9925A', '#F3DFB0')}${neck(x, g-14, 6.4, '#D9B77A', '#B5442E')}${dollar(x-.4, g-4.6, 8, '#3E7A2E')}<path d="M${f(x-14)} ${f(g+1)}l4 -2.6h6l-4 2.6z" fill="#F4C542"/><path d="M${f(x-14)} ${f(g+1)}h6v1.4h-6z" fill="#D9A030"/></g>${spark(x-11, g-14, 0)}${spark(x+10, g-15, 1)}`;
    top = g - 21;
  } else if(style==='D'){   // bao tiền có mặt mếu vì phải nộp thuế, giọt mồ hôi
    const g = y, h = 17, w = 8.6;
    s += `<g class="tbag">${sack(x, g, w, h, '#E8C26A', '#C99A44', '#FFF3C9')}${neck(x, g-h, w, '#E8C26A', '#B5442E')}<circle cx="${f(x-3)}" cy="${f(g-9)}" r="1.6" fill="#2B3A67" stroke="none"/><circle cx="${f(x+3)}" cy="${f(g-9)}" r="1.6" fill="#2B3A67" stroke="none"/><circle cx="${f(x-2.5)}" cy="${f(g-9.5)}" r=".5" fill="#FFFFFF" stroke="none"/><circle cx="${f(x+3.5)}" cy="${f(g-9.5)}" r=".5" fill="#FFFFFF" stroke="none"/><path d="M${f(x-2.4)} ${f(g-4.4)}q2.4 -2.2 4.8 0" fill="none" stroke="#2B3A67" stroke-width="1.1"/><path d="M${f(x-5)} ${f(g-11.6)}l2.6 -1M${f(x+5)} ${f(g-11.6)}l-2.6 -1" stroke="#2B3A67" stroke-width=".9"/><path class="tbsw" d="M${f(x+7.4)} ${f(g-14)}q1.6 2.6 0 3.4q-1.6 -.8 0 -3.4z" fill="#8FD3F0"/><ellipse cx="${f(x-5.4)}" cy="${f(g-6.4)}" rx="1.4" ry=".8" fill="#F49AB8" stroke="none"/><ellipse cx="${f(x+5.4)}" cy="${f(g-6.4)}" rx="1.4" ry=".8" fill="#F49AB8" stroke="none"/></g>${coin(x-10.6, g+.4, 2.6, 0)}${coin(x+10.6, g+.2, 2.6, 1)}`;
    top = g - h - 6;
  } else if(style==='E'){   // bao thủng một lỗ, xu cứ rơi ra thành đống
    const g = y, h = 17, w = 8.4;
    s += `<g class="tbag">${sack(x, g, w, h, '#D9B77A', '#B9925A', '#F3DFB0')}${neck(x, g-h, w, '#D9B77A', '#3E7FCB')}${dollar(x-1.6, g-6, 9, '#3E7A2E')}<path d="M${f(x+4.4)} ${f(g-5.6)}l1.6 -1.4l1.4 1.2l1.2 -1l.6 2.2l-1.6 1.2l-1.6 -.6l-1.4 .8z" fill="#5A3A22"/></g>`
      + `<g class="tbdrip"><g class="tbd" style="--k:0">${coin(x+9.4, g-4, 1.8, 0)}</g><g class="tbd" style="--k:1">${coin(x+9.4, g-4, 1.8, 0)}</g></g>${stack(x+11, g+1, 3, 3)}${coin(x+14.6, g+2, 2.2, 1)}${coin(x-10, g+.6, 2.6, 2)}`;
    top = g - h - 6;
  } else if(style==='F'){   // bao tiền xanh, dán phiếu "TAX" và dấu đỏ
    const g = y, h = 17, w = 8.6;
    s += `<g class="tbag">${sack(x, g, w, h, '#86C46A', '#5FA84C', '#D8F2C8')}${neck(x, g-h, w, '#86C46A', '#F4C542')}<path d="M${f(x-5.4)} ${f(g-12)}l9 -1.4l1.4 8.4l-9 1.4z" fill="#FFFDF6"/><text x="${f(x+.4)}" y="${f(g-8.6)}" text-anchor="middle" font-family="Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="3.6" fill="#2B3A67" stroke="none" transform="rotate(-9 ${f(x)} ${f(g-9)})">TAX</text><path d="M${f(x-3.4)} ${f(g-6.4)}h6M${f(x-3.2)} ${f(g-5.2)}h4.4" stroke="#9AA6BC" stroke-width=".5" transform="rotate(-9 ${f(x)} ${f(g-6)})"/><circle cx="${f(x+3.4)}" cy="${f(g-5.4)}" r="2.2" fill="none" stroke="#E0483A" stroke-width=".9"/></g>${coin(x-10.4, g+.4, 2.6, 0)}${coin(x+10.6, g+.2, 2.6, 1)}${spark(x-8, g-19, 0)}${spark(x+10, g-17, 1)}`;
    top = g - h - 6;
  } else if(style==='G'){   // theo mẫu: bao vàng mù tạt đáy phình, miệng túm nhăn, dây thừng nâu thắt nơ, ký hiệu tiền xanh lá lớn
    const g = y;
    const body = `M${f(x-4.8)} ${f(g-21)}C${f(x-9)} ${f(g-18.6)} ${f(x-13.4)} ${f(g-10)} ${f(x-13.6)} ${f(g-3.4)}C${f(x-13.8)} ${f(g-.2)} ${f(x-9)} ${f(g+.8)} ${f(x)} ${f(g+.8)}C${f(x+9)} ${f(g+.8)} ${f(x+13.8)} ${f(g-.2)} ${f(x+13.6)} ${f(g-3.4)}C${f(x+13.4)} ${f(g-10)} ${f(x+9)} ${f(g-18.6)} ${f(x+4.8)} ${f(g-21)}Z`;
    s += `<g class="tbag"><path d="${body}" fill="#D4AE48" stroke="#8A6A26" stroke-width=".8"/>`
      + `<path d="M${f(x+3.6)} ${f(g-20.4)}C${f(x+8.6)} ${f(g-17)} ${f(x+12.6)} ${f(g-10)} ${f(x+12.8)} ${f(g-3.6)}C${f(x+12.8)} ${f(g-1)} ${f(x+10)} ${f(g+.2)} ${f(x+6)} ${f(g+.5)}C${f(x+9.4)} ${f(g-3)} ${f(x+9)} ${f(g-12)} ${f(x+3.6)} ${f(g-20.4)}Z" fill="#B08C34" stroke="none"/>`
      + `<path d="M${f(x+9.6)} ${f(g-12)}c1.4 1.6 1.8 4.4 1 6.2c-.8 -1.6 -1.6 -3.4 -1 -6.2z" fill="#8F7028" stroke="none"/>`
      + `<path d="M${f(x-10)} ${f(g-12.6)}q-1.6 4 -.6 7.4M${f(x-6.6)} ${f(g-17)}q-2.6 3 -3.2 6M${f(x-2)} ${f(g-1.6)}q4 -1.4 8 -.4" fill="none" stroke="#B9953C" stroke-width=".7"/>`
      + `<ellipse cx="${f(x-3)}" cy="${f(g-1.6)}" rx="5" ry="1" fill="#F0D57E" stroke="none"/><ellipse cx="${f(x-7)}" cy="${f(g-11)}" rx="2" ry="3.6" fill="#E6C866" opacity=".8" stroke="none"/>`
      + `<path d="M${f(x-4.6)} ${f(g-21.2)}C${f(x-7.4)} ${f(g-23.2)} ${f(x-8.6)} ${f(g-26.4)} ${f(x-6.6)} ${f(g-27.8)}C${f(x-4.8)} ${f(g-26.4)} ${f(x-3.8)} ${f(g-29.6)} ${f(x-1.4)} ${f(g-29.2)}C${f(x+.6)} ${f(g-30.8)} ${f(x+3)} ${f(g-28.8)} ${f(x+4.4)} ${f(g-29.4)}C${f(x+7.2)} ${f(g-29.6)} ${f(x+8.8)} ${f(g-26.6)} ${f(x+6.8)} ${f(g-25.4)}C${f(x+5.8)} ${f(g-24)} ${f(x+5.4)} ${f(g-22.6)} ${f(x+4.6)} ${f(g-21.2)}Z" fill="#DDB955" stroke="#8A6A26" stroke-width=".8"/>`
      + `<path d="M${f(x-2.4)} ${f(g-28.6)}q.6 3.4 -.6 6.6M${f(x+1.4)} ${f(g-29)}q.8 3.6 .2 7.2M${f(x+4.6)} ${f(g-28)}q-.2 2.8 -.8 5.6" fill="none" stroke="#B08C34" stroke-width=".7"/><path d="M${f(x+5.8)} ${f(g-26.4)}c1 1.2 .6 3 -.6 4.6l-.4 -2.4z" fill="#B08C34" stroke="none"/>`
      + `<path d="M${f(x-5.4)} ${f(g-21.6)}Q${f(x)} ${f(g-19.4)} ${f(x+5.4)} ${f(g-21.6)}" fill="none" stroke="#6E4520" stroke-width="2"/>`
      + `<path d="M${f(x-1.4)} ${f(g-20.6)}c-2.6 -1.2 -6.6 -.6 -7.6 1.6c1.8 1 5.2 .2 7.2 -1M${f(x-.4)} ${f(g-20.4)}c.6 1.8 .4 3.6 -.4 5.2M${f(x+.8)} ${f(g-20.4)}c1.2 1.4 1.4 3.2 .8 4.8" fill="none" stroke="#6E4520" stroke-width="1.3"/>`
      + `<text x="${f(x-.2)}" y="${f(g-3.6)}" text-anchor="middle" font-family="Arial Black,Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="16" fill="#3E7A22" stroke="none" transform="rotate(-10 ${f(x)} ${f(g-9)})">$</text>`
      + `<text x="${f(x-1)}" y="${f(g-4.4)}" text-anchor="middle" font-family="Arial Black,Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="16" fill="#5BA332" stroke="#3E7A22" stroke-width=".5" transform="rotate(-10 ${f(x)} ${f(g-9)})">$</text></g>`
      + `${coin(x+13.6, g+1.6, 2.4, 1)}${spark(x-11, g-20, 0)}${spark(x+10, g-25, 1)}`;
    top = g - 31;
  }
  s += `<g class="tbpop"><text x="${f(x)}" y="${f(top-2)}" text-anchor="middle" font-family="Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="8" fill="#E0483A" stroke="#FFFFFF" stroke-width="2" paint-order="stroke">−10%</text></g>`;
  sc.raw(10, s, [[x-16,top-10],[x+17,y+4]]);
  return sc.out([0,0,0], 1);
}

/* Ô Startup: biểu tượng lấp lánh nổi giữa ô, thay emoji tên lửa.
   STARTUP_STYLE chọn mẫu: A bóng đèn ý tưởng · B kim cương · C biểu đồ tăng trưởng */
const STARTUP_STYLE = 'A';
function startup3D(style){
  style = style || STARTUP_STYLE;
  const sc = isoScene(), o = sc.P(0,0,0), x = o[0], g = o[1], f = v => (+v).toFixed(1);
  const spark = (sx, sy, r, k) => `<path class="sus" style="--k:${k}" d="M${f(sx)} ${f(sy-r)}L${f(sx+r*.3)} ${f(sy-r*.3)}L${f(sx+r)} ${f(sy)}L${f(sx+r*.3)} ${f(sy+r*.3)}L${f(sx)} ${f(sy+r)}L${f(sx-r*.3)} ${f(sy+r*.3)}L${f(sx-r)} ${f(sy)}L${f(sx-r*.3)} ${f(sy-r*.3)}Z" fill="#FFF6B8" stroke="#F2B53A" stroke-width=".4"/>`;
  const shadow = `<ellipse cx="${f(x)}" cy="${f(g)}" rx="9" ry="3.6" fill="#2B3A67" opacity=".18"/>`;
  let s = '', top;
  if(style==='A'){                                    // bóng đèn ý tưởng phát sáng, tia sáng xoay
    const cy = g - 24;
    s += `<defs><radialGradient id="suA" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#FFF2A6"/><stop offset="1" stop-color="#F7C948"/></radialGradient><radialGradient id="suAg"><stop offset="0" stop-color="#FFF3A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFF3A0" stop-opacity="0"/></radialGradient></defs>`;
    s += shadow + `<g class="sub">`;
    s += `<circle class="sug" cx="${f(x)}" cy="${f(cy)}" r="20" fill="url(#suAg)" stroke="none"/>`;
    let rays = ''; for(let k=0;k<10;k++){ const a = k*Math.PI/5, r1 = 13.5, r2 = k%2 ? 17 : 19; rays += `M${f(x+Math.cos(a)*r1)} ${f(cy+Math.sin(a)*r1)}L${f(x+Math.cos(a)*r2)} ${f(cy+Math.sin(a)*r2)}`; }
    s += `<path class="sur" d="${rays}" stroke="#F2B53A" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
    s += `<path d="M${f(x-10.5)} ${f(cy)}A10.5 10.5 0 1 1 ${f(x+10.5)} ${f(cy)}C${f(x+10.5)} ${f(cy+5)} ${f(x+5.2)} ${f(cy+7)} ${f(x+5)} ${f(cy+11)}L${f(x-5)} ${f(cy+11)}C${f(x-5.2)} ${f(cy+7)} ${f(x-10.5)} ${f(cy+5)} ${f(x-10.5)} ${f(cy)}Z" fill="url(#suA)" stroke="#2B3A67" stroke-width="1"/>`;
    s += `<path d="M${f(x-3.4)} ${f(cy+10)}L${f(x-2.6)} ${f(cy+1)}L${f(x-1.2)} ${f(cy+3.2)}L${f(x)} ${f(cy+.4)}L${f(x+1.2)} ${f(cy+3.2)}L${f(x+2.6)} ${f(cy+1)}L${f(x+3.4)} ${f(cy+10)}" fill="none" stroke="#E0883A" stroke-width=".9" stroke-linejoin="round"/>`;
    s += `<ellipse cx="${f(x-4.6)}" cy="${f(cy-4.6)}" rx="2.4" ry="3.6" transform="rotate(35 ${f(x-4.6)} ${f(cy-4.6)})" fill="#FFFFFF" opacity=".9" stroke="none"/>`;
    for(let k=0;k<3;k++) s += `<rect x="${f(x-5.2)}" y="${f(cy+11+k*2.1)}" width="10.4" height="2.1" rx="1" fill="${k%2 ? '#8E9BB0' : '#C3CEDA'}" stroke="#2B3A67" stroke-width=".7"/>`;
    s += `<path d="M${f(x-3)} ${f(cy+17.3)}Q${f(x)} ${f(cy+20)} ${f(x+3)} ${f(cy+17.3)}Z" fill="#2B3A67"/>`;
    s += spark(x-15, cy-11, 3, 0) + spark(x+15, cy-6, 2.4, 1) + spark(x+11, cy+12, 2, 2) + `</g>`;
    top = cy - 20;
  } else if(style==='B'){                             // kim cương nhiều mặt, ánh cầu vồng
    const cy = g - 22;
    s += `<defs><radialGradient id="suBg"><stop offset="0" stop-color="#BFF3FF" stop-opacity=".9"/><stop offset="1" stop-color="#BFF3FF" stop-opacity="0"/></radialGradient></defs>`;
    s += shadow + `<g class="sub"><circle class="sug" cx="${f(x)}" cy="${f(cy)}" r="19" fill="url(#suBg)" stroke="none"/>`;
    const P = (dx, dy) => `${f(x+dx)} ${f(cy+dy)}`;
    const face = (pts, col) => `<path d="M${pts.map(p => P(p[0],p[1])).join('L')}Z" fill="${col}" stroke="#2B3A67" stroke-width=".8" stroke-linejoin="round"/>`;
    s += face([[-13,-3],[-7,-10],[7,-10],[13,-3]], '#9FE7FF');
    s += face([[-7,-10],[-3,-3],[3,-3],[7,-10]], '#E4FBFF');
    s += face([[-13,-3],[-7,-10],[-3,-3]], '#7AD3F5') + face([[13,-3],[7,-10],[3,-3]], '#6BB8F0');
    s += face([[-13,-3],[0,14],[-3,-3]], '#5FB6F2') + face([[-3,-3],[0,14],[3,-3]], '#B6EEFF') + face([[3,-3],[0,14],[13,-3]], '#4C8FE0');
    s += `<path class="sush" d="M${P(-9,-6)}L${P(-5,-9)}" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/><path d="M${P(-6,0)}L${P(-2,8)}" stroke="#FFD1F2" stroke-width="1.1" stroke-linecap="round" opacity=".9"/><path d="M${P(5,0)}L${P(2,7)}" stroke="#C9B6FF" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>`;
    s += spark(x-14, cy-12, 3, 0) + spark(x+14, cy-11, 2.6, 1) + spark(x+10, cy+10, 2, 2) + spark(x-11, cy+8, 1.8, 3) + `</g>`;
    top = cy - 19;
  } else {                                            // biểu đồ tăng trưởng: ba cột, mũi tên vàng vút lên, xu
    const b = g - 2;
    s += `<defs><radialGradient id="suCg"><stop offset="0" stop-color="#FFF3A0" stop-opacity=".85"/><stop offset="1" stop-color="#FFF3A0" stop-opacity="0"/></radialGradient></defs>`;
    s += shadow + `<g class="sub"><circle class="sug" cx="${f(x)}" cy="${f(b-15)}" r="20" fill="url(#suCg)" stroke="none"/>`;
    const bar = (bx, h, c1, c2) => `<path d="M${f(bx)} ${f(b)}V${f(b-h)}L${f(bx+2.4)} ${f(b-h-1.4)}H${f(bx+7.6)}V${f(b-1.4)}L${f(bx+5.2)} ${f(b)}Z" fill="${c2}" stroke="#2B3A67" stroke-width=".8" stroke-linejoin="round"/><rect x="${f(bx)}" y="${f(b-h)}" width="5.2" height="${h}" fill="${c1}" stroke="#2B3A67" stroke-width=".8"/>`;
    s += bar(x-11, 8, '#7FD36E', '#4FA845') + bar(x-3.6, 14, '#5BC0F0', '#3A8FCF') + bar(x+3.8, 21, '#B38CF2', '#7E5BC9');
    s += `<path d="M${f(x-14)} ${f(b-12)}L${f(x-6)} ${f(b-19)}L${f(x-1)} ${f(b-16)}L${f(x+9)} ${f(b-29)}" fill="none" stroke="#2B3A67" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="M${f(x-14)} ${f(b-12)}L${f(x-6)} ${f(b-19)}L${f(x-1)} ${f(b-16)}L${f(x+9)} ${f(b-29)}" fill="none" stroke="#F7C948" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="M${f(x+12.5)} ${f(b-33)}L${f(x+3.6)} ${f(b-30.6)}L${f(x+10.6)} ${f(b-23.8)}Z" fill="#F7C948" stroke="#2B3A67" stroke-width=".9" stroke-linejoin="round"/>`;
    s += spark(x-12, b-27, 3, 0) + spark(x+15, b-18, 2.4, 1) + spark(x-15, b-4, 1.8, 2) + `</g>`;
    top = b - 36;
  }
  sc.raw(10, s, [[x-21,top-2],[x+21,g+4]]);
  return sc.out([0,0,0], 1);
}

/* Bảng chỉnh chữ trên ô đất: font, cỡ, độ đậm, giãn chữ, kiểu chữ, màu, hướng chữ; giá tiền chỉnh riêng từng đường (cạnh bàn cờ); từng ô đất có thể chỉnh riêng tên và giá (TSX.tiles, khoá là số thứ tự ô).
   Mở bằng tycoonroad.html?chu=1 (nhớ trong trình duyệt này, nút "Aa" góc trái). Kiểu đã chỉnh lưu ở localStorage 'ld_tsx'.
   Bấm "Sao chép mã" rồi gửi mã cho người dựng để đặt làm mặc định (sửa TSX_DEF bên dưới). */
const TSX_DEF = {"home": "2", "plane": "D", "font": "Barlow Condensed", "weight": 800, "size": 120, "fit": true, "spacing": 3, "upper": true, "effect": "colored", "stroke": 0.8, "color": "black", "dirTB": "up", "dirLR": "down", "special": false, "ps": {"b": {"font": "Fredoka", "weight": 600, "size": 75, "spacing": 3, "dir": "down", "color": ""}, "l": {"font": "Fredoka", "weight": 600, "size": 80, "spacing": 3, "dir": "up", "color": ""}, "t": {"font": "Fredoka", "weight": 600, "size": 75, "spacing": 3, "dir": "down", "color": ""}, "r": {"font": "Fredoka", "weight": 600, "size": 75, "spacing": 3, "dir": "up", "color": ""}}, "tiles": {}};   // kiểu Hùng chỉnh ngày 2026-11-01
const TSX_SIDES = ['b','l','t','r'], TSX_P = {font:'', weight:800, size:100, spacing:6, dir:'up', color:''};
const TSX_FONTS = ['Barlow Condensed','Oswald','Bebas Neue','Anton','Teko','Saira Condensed','Lilita One','Fredoka','Baloo 2','Bungee','Russo One','Archivo Black','Lexend','Be Vietnam Pro','Josefin Sans'];
const tsxDef = () => JSON.parse(JSON.stringify(TSX_DEF));
let TSX = (() => { try { return Object.assign(tsxDef(), JSON.parse(localStorage.getItem('ld_tsx') || '{}')); } catch(e){ return tsxDef(); } })();
TSX.ps = TSX.ps || {}; TSX.tiles = TSX.tiles || {};
TSX_SIDES.forEach(k => {                                 // mã cũ chỉnh giá chung cho cả bốn đường thì chép sang từng đường
  const old = TSX.pSize!=null ? {font:TSX.pFont||'', weight:TSX.pWeight, size:TSX.pSize, spacing:TSX.pSpacing, dir:TSX.pDir, color:TSX.pColor||''} : {};
  TSX.ps[k] = Object.assign({}, TSX_P, old, TSX.ps[k] || {}); });
['pFont','pWeight','pSize','pSpacing','pDir','pColor'].forEach(k => delete TSX[k]);
let TSX_FIT = TSX.fit;
function tsxFont(f){
  if(!f || document.getElementById('tsxf-' + f.replace(/\W/g,''))) return;
  const l = document.createElement('link'); l.id = 'tsxf-' + f.replace(/\W/g,''); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g,'+') + ':wght@400;500;600;700;800;900&display=swap';
  l.onload = () => { if(document.fonts) document.fonts.ready.then(tsxRefit); };
  document.head.appendChild(l);
}
function tsxNameK(c){ const o = TSX.tiles[c.dataset.i]; return (TSX.size || 100) / 100 * (o && o.nSize ? o.nSize : 100) / 100; }   // fitNames nhân cỡ chữ tên ô với số này
function tsxPlanes(){ if(typeof TILE3D==='undefined' || typeof MOD==='undefined') return; Object.keys(TILE3D).forEach(k => { if(/^(air|spark|fundm)/.test(k)) delete TILE3D[k]; }); MOD.ok = false; if(typeof renderModels==='function') renderModels(); }
function tsxRefit(){ document.querySelectorAll('#board .cell').forEach(c => { delete c.dataset.fk; }); if(typeof fitNames === 'function') fitNames(); }
function tsxCSS(){
  const t = TSX, D = 'color-mix(in srgb,var(--g,#2B3A67) 55%,#1a1a2e)', s = t.stroke;
  const colOf = c => c==='dark' ? D : c==='black' ? '#161616' : c==='group' ? 'var(--g,#2B3A67)' : '#fff';
  const sel = t.special ? '#board .cell' : '#board .cell[class*="g-"]';
  const fx = (up, cc) => {                             // chữ dọc bị xoay 180 độ nên bóng đổ phải lật chiều
    const col = colOf(cc || t.color);
    const dy = v => (up ? -v : v) + 'px', ring = c => `-${s}px -${s}px 0 ${c},${s}px -${s}px 0 ${c},-${s}px ${s}px 0 ${c},${s}px ${s}px 0 ${c},0 ${s}px 0 ${c},0 -${s}px 0 ${c},${s}px 0 0 ${c},-${s}px 0 0 ${c}`;
    if(t.effect==='none') return `color:${col}!important;text-shadow:none!important;background:none!important`;
    if(t.effect==='outline') return `color:${col}!important;text-shadow:${ring(D)},0 ${dy(s+2)} 0 ${D}!important;background:none!important`;
    if(t.effect==='colored') return `color:${t.color==='black' ? '#0B0B0B' : D}!important;text-shadow:${ring('#fff')},0 ${dy(s+.5)} 0 #fff!important;background:none!important`;
    if(t.effect==='block') return `color:${col}!important;text-shadow:0 ${dy(1)} 0 ${D},0 ${dy(2)} 0 ${D},0 ${dy(3)} 0 ${D},0 ${dy(4)} 0 ${D},-1px 0 0 ${D},1px 0 0 ${D},0 ${dy(-1)} 0 ${D},0 ${dy(5)} 2px rgba(0,0,0,.35)!important;background:none!important`;
    if(t.effect==='glow') return `color:${col}!important;text-shadow:0 0 ${s+2}px ${D},0 0 ${s*2+4}px ${D},0 0 2px ${D}!important;background:none!important`;
    if(t.effect==='pill') return `color:${col==='#fff' ? '#fff' : '#fff'}!important;text-shadow:none!important;background:${D}!important;padding:2px 5px!important;border-radius:6px;box-shadow:0 ${dy(3)} 0 color-mix(in srgb,var(--g,#2B3A67) 30%,#000)`;
    return '';
  };
  const dir = up => up ? 'writing-mode:vertical-rl!important;transform:rotate(180deg)!important;white-space:nowrap' : 'writing-mode:horizontal-tb!important;transform:none!important';
  const base = `font-family:'${t.font}',"Barlow Condensed",Oswald,sans-serif!important;font-weight:${t.weight}!important;letter-spacing:${(t.spacing/100).toFixed(2)}em!important;text-transform:${t.upper ? 'uppercase' : 'none'}!important`;
  const up1 = t.dirTB==='up', up2 = t.dirLR==='up';
  const pcolOf = c => c==='white' ? 'color:#fff!important;text-shadow:0 0 2px #2B3A67,0 1px 0 #2B3A67!important;' : c==='dark' ? 'color:#1F2A4D!important;' : c==='red' ? 'color:#D93A2F!important;' : '';
  const price = k => { const q = t.ps[k], up = q.dir==='up', narrow = (k==='b' || k==='t') && up;   // đường trên/dưới: dải giá thấp, chữ dọc phải nhỏ hơn
    const pcol = q.color==='white' ? 'color:#fff!important;text-shadow:0 0 2px #2B3A67,0 1px 0 #2B3A67!important;' : q.color==='dark' ? 'color:#1F2A4D!important;' : q.color==='red' ? 'color:#D93A2F!important;' : '';
    return `html body #board .cell.s-${k} .band .bv{font-family:'${q.font || t.font}',"Barlow Condensed",Oswald,sans-serif!important;font-weight:${q.weight}!important;letter-spacing:${(q.spacing/100).toFixed(2)}em!important;white-space:nowrap;${pcol}font-size:${(q.size/100*(narrow ? .78 : 1)).toFixed(2)}em!important;${dir(up)}}
body.tsx-hl-${k} #board .cell.s-${k} .band{outline:3px solid #FF3D9A!important;outline-offset:-2px}`; };
  return `html body ${sel} .nm{${base}}
html body ${sel}.s-b .nm,html body ${sel}.s-t .nm{${dir(up1)};${fx(up1)}}
html body ${sel}.s-l .nm,html body ${sel}.s-r .nm{${dir(up2)};${fx(up2)}}
${TSX_SIDES.map(price).join('\n')}
${Object.keys(t.tiles).map(i => {                      // chỉnh riêng từng ô: đè lên kiểu chung của đường
    const o = t.tiles[i], c = document.querySelector(`#board .cell[data-i="${i}"]`); if(!c) return '';
    const sd = ([...c.classList].find(x => /^s-[bltr]$/.test(x)) || 's-b').slice(2), q = t.ps[sd], S2 = `html body #board .cell.cell[data-i="${i}"][class*="s-"]`;
    const nUp = o.nDir ? o.nDir==='up' : ((sd==='b' || sd==='t') ? up1 : up2), pUp = o.pDir ? o.pDir==='up' : q.dir==='up';
    const nm = (o.nDir || o.nColor ? `${dir(nUp)};${fx(nUp, o.nColor)};` : '') + (o.nFont ? `font-family:'${o.nFont}',"Barlow Condensed",sans-serif!important;` : '');
    const pv = (o.pFont ? `font-family:'${o.pFont}',"Barlow Condensed",sans-serif!important;` : '') + pcolOf(o.pColor) + (o.pDir ? dir(pUp) + ';' : '')
      + (o.pSize || o.pDir ? `font-size:${(q.size/100*((sd==='b' || sd==='t') && pUp ? .78 : 1)*(o.pSize || 100)/100).toFixed(2)}em!important;` : '');
    return (nm ? `${S2} .nm{${nm}}` : '') + (pv ? `${S2} .band .bv{${pv}}` : ''); }).join('\n')}
${TSX_TSEL!=null ? `html body #board .cell[data-i="${TSX_TSEL}"]{outline:3px dashed #FF3D9A!important;outline-offset:-3px}` : ''}`;
}
function tsxApply(save){
  let st = document.getElementById('tsx-css'); if(!st){ st = document.createElement('style'); st.id = 'tsx-css'; document.head.appendChild(st); }
  else document.head.appendChild(st);                   // luôn nằm cuối để thắng các luật trước
  tsxFont(TSX.font); TSX_SIDES.forEach(k => tsxFont(TSX.ps[k].font)); Object.values(TSX.tiles).forEach(o => { tsxFont(o.nFont); tsxFont(o.pFont); });
  st.textContent = tsxCSS(); TSX_FIT = TSX.fit;
  if(save) try { localStorage.setItem('ld_tsx', JSON.stringify(TSX)); } catch(e){}
  tsxRefit();
}
let TSX_PAUSE = false, TSX_PCUR = 'all', TSX_TSEL = null, TSX_PICK = null;
function tsxPause(on){                                 // tạm dừng ván chơi với máy khi đang mở bảng chỉnh (ván online không dừng được)
  if(on){ if(typeof S==='undefined' || !S || S.over || NET || S.net || PAUSED) return; PAUSED = true; TSX_PAUSE = true; }
  else if(TSX_PAUSE){ TSX_PAUSE = false; PAUSED = false; }
}
function tsxClose(){ const p = document.getElementById('tsx-panel'); if(p) p.remove(); tsxPause(false); TSX_PICK = null; if(TSX_TSEL!=null){ TSX_TSEL = null; tsxApply(false); } }
if(typeof document !== 'undefined') document.addEventListener('click', e => {                // đang chọn ô trên bàn: bấm vào ô nào thì chọn ô đó, không mở bảng thông tin ô
  if(!TSX_PICK || e.target.closest('#tsx-panel,#tsx-btn')) return;
  const c = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest('#board .cell[data-i]')).find(Boolean);
  e.preventDefault(); e.stopPropagation(); const f = TSX_PICK; TSX_PICK = null; f(c ? c.dataset.i : null);
}, true);
function tsxPanel(){
  let p = document.getElementById('tsx-panel'); if(p){ tsxClose(); return; }
  tsxPause(true);
  p = document.createElement('div'); p.id = 'tsx-panel'; p.setAttribute('data-notr', '');
  p.style.cssText = 'position:fixed;right:10px;top:10px;bottom:10px;width:min(300px,calc(100vw - 20px));overflow:auto;z-index:100000;background:#FFFDF6;border:2.5px solid #2B3A67;border-radius:14px;box-shadow:0 5px 0 #2B3A67;padding:10px 12px;font:600 13px "Be Vietnam Pro",system-ui,sans-serif;color:#2B3A67';
  const row = (lab, el) => { const d = document.createElement('label'); d.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0'; const s = document.createElement('span'); s.textContent = lab; d.append(s, el); return d; };
  const head = t => { const h = document.createElement('div'); h.textContent = t; h.style.cssText = 'margin:12px 0 2px;font-weight:800;font-size:14px;border-bottom:1.5px solid #E3DCC8;padding-bottom:3px'; return h; };
  const B = k => typeof k === 'string' ? {get:() => TSX[k], set:v => { TSX[k] = v; }} : k;
  const sel = (k, opts) => { k = B(k); const s = document.createElement('select'); s.style.cssText = 'max-width:160px;font:inherit;padding:2px 4px;border:1.5px solid #2B3A67;border-radius:7px;background:#fff'; opts.forEach(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; const e = document.createElement('option'); e.value = v; e.textContent = l; if(v===k.get()) e.selected = true; s.appendChild(e); }); s.onchange = () => { k.set(s.value); tsxApply(true); }; return s; };
  const rng = (k, min, max, step, unit) => { k = B(k); const w = document.createElement('span'); w.style.cssText = 'display:flex;align-items:center;gap:6px'; const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = k.get(); r.style.width = '110px'; const o = document.createElement('b'); o.style.cssText = 'min-width:42px;text-align:right'; o.textContent = k.get() + unit; r.oninput = () => { k.set(+r.value); o.textContent = r.value + unit; tsxApply(true); }; w.append(r, o); return w; };
  const chk = k => { k = B(k); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!k.get(); c.onchange = () => { k.set(c.checked); tsxApply(true); }; return c; };
  const btn = (t, f, main) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = `font:inherit;padding:6px 10px;border:2px solid #2B3A67;border-radius:9px;background:${main ? '#FFD66B' : '#F3EFE4'};cursor:pointer;flex:1`; b.onclick = f; return b; };
  const title = document.createElement('div'); title.textContent = TSX_PAUSE ? 'Chỉnh chữ ô đất  ⏸ đang tạm dừng ván' : 'Chỉnh chữ ô đất'; title.style.cssText = 'font-weight:900;font-size:16px';
  const dirs = [['up','Chéo lên  /'],['down','Chéo xuống  \\']];
  // máy bay ở bốn sân bay: chọn mẫu, bấm thử cất cánh
  const pl = sel({get:() => TSX.plane, set:v => { TSX.plane = v; tsxPlanes(); }}, [['','Cũ (khối hộp)'],['A','A Phản lực chở khách'],['B','B Cánh quạt cổ điển'],['C','C Máy bay đồ chơi'],['D','D Phản lực thương gia']]);
  const fly = btn('Thử cất cánh', () => document.querySelectorAll('.t3.t-air').forEach(x => { x.classList.remove('fly'); void x.offsetWidth; x.style.setProperty('--ev', 0); x.classList.add('fly'); setTimeout(() => x.classList.remove('fly'), 5200); }));
  fly.style.flex = '0 0 auto'; fly.style.fontSize = '12px';
  p.append(title,
    head('Trang chủ'), row('Phương án', sel({get:() => TSX.home || '', set:v => { TSX.home = v; hskinApply(); }}, [['','Như hiện tại'],['1','1 Gọn'],['2','2 Sự kiện làm chủ'],['3','3 Ô vuông'],['4','4 Sân khấu']])),
    row('Nền ô Hồ sơ', sel({get:() => TSX.pbg || '', set:v => { TSX.pbg = v; hskinBg(); }}, [['','Tự đổi theo tuần'],['1','1 Sân khấu vàng'],['2','2 Hoàng hôn thành phố'],['3','3 Đêm phép thuật'],['4','4 Phòng tiệc']])),
    head('Máy bay sân bay'), row('Mẫu', pl), fly,
    head('Tên ô'),
    row('Font', sel('font', TSX_FONTS)),
    row('Cỡ chữ', rng('size', 50, 180, 5, '%')),
    row('Tự co cho vừa ô', chk('fit')),
    row('Độ đậm', rng('weight', 400, 900, 100, '')),
    row('Giãn chữ', rng('spacing', -5, 30, 1, '')),
    row('Chữ in hoa', chk('upper')),
    row('Kiểu chữ', sel('effect', [['outline','Viền màu nhóm'],['block','Khối 3D'],['colored','Chữ màu, viền trắng'],['glow','Phát sáng'],['pill','Nhãn nền màu'],['none','Trơn']])),
    row('Độ dày viền', rng('stroke', 0.5, 3, 0.25, 'px')),
    row('Màu chữ', sel('color', [['white','Trắng'],['dark','Sẫm theo nhóm'],['group','Màu nhóm'],['black','Đen']])),
    row('Hướng cạnh trên/dưới', sel('dirTB', dirs)),
    row('Hướng cạnh trái/phải', sel('dirLR', dirs)),
    row('Áp cả ô đặc biệt', chk('special')),
    head('Giá tiền từng đường'));
  // chọn đường: tên ô đầu và cuối của mỗi cạnh để dễ nhận ra; chọn xong viền hồng nhấp nháy các ô giá của đường đó
  const sideName = k => { const cs = [...document.querySelectorAll(`#board .cell.s-${k}[class*="g-"]`)].map(c => c.getAttribute('aria-label')); return cs.length ? cs[0] + ' … ' + cs[cs.length-1] : k; };
  const tabs = document.createElement('div'); tabs.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:6px 0';
  const pbox = document.createElement('div');
  const pk = f => ({get:() => TSX.ps[TSX_PCUR==='all' ? 'b' : TSX_PCUR][f], set:v => (TSX_PCUR==='all' ? TSX_SIDES : [TSX_PCUR]).forEach(k => { TSX.ps[k][f] = v; })});
  const fillP = () => { pbox.innerHTML = '';
    pbox.append(row('Font', sel(pk('font'), [['','Giống tên ô']].concat(TSX_FONTS))), row('Cỡ chữ', rng(pk('size'), 50, 180, 5, '%')), row('Độ đậm', rng(pk('weight'), 400, 900, 100, '')),
      row('Giãn chữ', rng(pk('spacing'), -5, 30, 1, '')), row('Hướng', sel(pk('dir'), dirs)), row('Màu', sel(pk('color'), [['','Như game'],['dark','Xanh đậm'],['red','Đỏ'],['white','Trắng viền']]))); };
  const pick = k => { TSX_PCUR = k; [...tabs.children].forEach(b => { b.style.background = b.dataset.k===k ? '#FFD66B' : '#F3EFE4'; }); fillP();
    TSX_SIDES.forEach(s => document.body.classList.remove('tsx-hl-' + s)); clearTimeout(tsxPanel.hl);
    (k==='all' ? TSX_SIDES : [k]).forEach(s => document.body.classList.add('tsx-hl-' + s));
    tsxPanel.hl = setTimeout(() => TSX_SIDES.forEach(s => document.body.classList.remove('tsx-hl-' + s)), 1600); };
  [['all','Cả 4 đường']].concat(TSX_SIDES.map(k => [k, sideName(k)])).forEach(([k, l]) => { const b = document.createElement('button'); b.dataset.k = k; b.textContent = l; b.style.cssText = 'font:inherit;font-size:12px;padding:4px 7px;border:1.5px solid #2B3A67;border-radius:8px;background:#F3EFE4;cursor:pointer;flex:1 1 45%'; b.onclick = () => pick(k); tabs.appendChild(b); });
  p.append(tabs, pbox); pick(TSX_PCUR);
  // từng ô đất: chọn trong danh sách hoặc bấm "Chọn trên bàn" rồi bấm vào ô; ô đã chỉnh riêng có dấu •
  p.append(head('Chỉnh riêng từng ô'));
  const CORNER = ['go','visit','park','gotojail','fortune','chance','tax'];
  const cells = [...document.querySelectorAll('#board .cell[data-i]')].filter(c => c.querySelector('.nm') && !(typeof TILES!=='undefined' && TILES[c.dataset.i] && CORNER.includes(TILES[c.dataset.i].k)));
  const tsel = document.createElement('select'); tsel.style.cssText = 'flex:1;min-width:0;font:inherit;padding:3px 4px;border:1.5px solid #2B3A67;border-radius:7px;background:#fff';
  const fillList = () => { tsel.innerHTML = '<option value="">— chọn ô —</option>' + cells.map(c => `<option value="${c.dataset.i}"${c.dataset.i===TSX_TSEL ? ' selected' : ''}>${TSX.tiles[c.dataset.i] ? '• ' : ''}${c.getAttribute('aria-label')}</option>`).join(''); };
  const pickBtn = btn('Chọn trên bàn', () => { pickBtn.textContent = 'Bấm vào một ô…'; TSX_PICK = i => { pickBtn.textContent = 'Chọn trên bàn'; if(i!=null && cells.some(c => c.dataset.i===i)) selT(i); }; });
  pickBtn.style.flex = '0 0 auto'; pickBtn.style.fontSize = '12px';
  const trow = document.createElement('div'); trow.style.cssText = 'display:flex;gap:6px;align-items:center;margin:6px 0'; trow.append(tsel, pickBtn);
  const tbox = document.createElement('div');
  const tk = f => ({get:() => (TSX.tiles[TSX_TSEL] || {})[f] || (/Size$/.test(f) ? 100 : ''),
                   set:v => { const o = TSX.tiles[TSX_TSEL] = TSX.tiles[TSX_TSEL] || {}; if(v==='' || (/Size$/.test(f) && +v===100)) delete o[f]; else o[f] = v; if(!Object.keys(o).length) delete TSX.tiles[TSX_TSEL]; fillList(); }});
  const fd = [['','Theo đường'],['up','Chéo lên  /'],['down','Chéo xuống  \\']], ff = [['','Theo chung']].concat(TSX_FONTS);
  const fillT = () => { tbox.innerHTML = ''; if(TSX_TSEL==null) return;
    const sub = t => { const d = document.createElement('div'); d.textContent = t; d.style.cssText = 'margin:8px 0 0;font-weight:800;font-size:12px;opacity:.75'; return d; };
    tbox.append(sub('Tên ô này'), row('Cỡ chữ', rng(tk('nSize'), 40, 200, 5, '%')), row('Hướng', sel(tk('nDir'), fd)), row('Font', sel(tk('nFont'), ff)),
      row('Màu chữ', sel(tk('nColor'), [['','Theo chung'],['white','Trắng'],['dark','Sẫm theo nhóm'],['group','Màu nhóm'],['black','Đen']])),
      sub('Giá ô này'), row('Cỡ chữ', rng(tk('pSize'), 40, 200, 5, '%')), row('Hướng', sel(tk('pDir'), fd)), row('Font', sel(tk('pFont'), ff)),
      row('Màu', sel(tk('pColor'), [['','Theo đường'],['dark','Xanh đậm'],['red','Đỏ'],['white','Trắng viền']])));
    const clr = btn('Bỏ chỉnh riêng ô này', () => { delete TSX.tiles[TSX_TSEL]; tsxApply(true); fillList(); fillT(); }); clr.style.marginTop = '6px'; clr.style.width = '100%'; tbox.appendChild(clr); };
  const selT = i => { TSX_TSEL = i || null; tsel.value = i || ''; fillT(); tsxApply(false); };
  tsel.onchange = () => selT(tsel.value);
  fillList(); p.append(trow, tbox); fillT();
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px;margin-top:14px;flex-wrap:wrap';
  bar.append(
    btn('Sao chép mã', () => { const s = JSON.stringify(TSX); (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => alert('Đã chép mã kiểu chữ'), () => prompt('Chép mã này:', s)); }, true),
    btn('Mặc định', () => { TSX = tsxDef(); TSX_SIDES.forEach(k => { TSX.ps[k] = Object.assign({}, TSX_P, TSX.ps[k] || {}); }); tsxApply(true); p.remove(); tsxPanel(); }),
    btn('Đóng', tsxClose),
    btn('Tắt chế độ chỉnh', () => { try { localStorage.removeItem('tr_tsx_on'); } catch(e){} tsxClose(); const a = document.getElementById('tsx-btn'); if(a) a.remove(); }));
  p.appendChild(bar);
  document.body.appendChild(p);
}
(function(){
  const on = () => {
    tsxApply(false);
    let ed = false; try { if(/[?&]chu=1/.test(location.search)) localStorage.setItem('tr_tsx_on', '1'); ed = localStorage.getItem('tr_tsx_on')==='1'; } catch(e){}
    if(!ed || document.getElementById('tsx-btn')) return;
    const b = document.createElement('button'); b.id = 'tsx-btn'; b.setAttribute('data-notr', ''); b.textContent = 'Aa'; b.title = 'Chỉnh chữ ô đất';
    b.style.cssText = 'position:fixed;left:10px;top:50%;z-index:100000;width:44px;height:44px;border-radius:50%;border:2.5px solid #2B3A67;background:#FFD66B;font:900 16px system-ui;color:#2B3A67;box-shadow:0 3px 0 #2B3A67;cursor:pointer';
    b.onclick = tsxPanel; document.body.appendChild(b);
  };
  if(typeof document === 'undefined') return;           // chạy không màn hình (giả lập) thì bỏ qua
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', on); else on();
})();

/* Máy bay trên ô Sân bay: 4 mẫu thay cho máy bay khối hộp cũ.
   PLANE_STYLE: A phản lực chở khách · B cánh quạt cổ điển · C máy bay đồ chơi · D phản lực hạng thương gia.
   Dài 22 đơn vị dọc ô (đuôi a=0, mũi a=22), rộng 13 (tâm b=6.5); giữ nhóm .plane và --px/--py cho cảnh cất cánh. */
const PLANE_STYLE = 'A';
function plane3D(style, v, ori, flip){
  style = style || PLANE_STYLE;
  const sc = isoScene(), X = ori!=='y', LEN = 22, col = PLANE_COL[v % 4], f = n => (+n).toFixed(1);
  const W = (a,b,z) => { const a2 = flip ? LEN-a : a; return X ? [a2,b,z] : [b,a2,z]; };
  const items = [], pts = [];
  const poly = (ps, fill, extra) => { const w = ps.map(p => W(p[0],p[1],p[2])), q = w.map(p => isoP(p[0],p[1],p[2]));
    q.forEach(p => pts.push(p)); const k = w.reduce((s,p) => s + p[0] + p[1] + p[2]*.01, 0) / w.length;
    items.push({k, s:`<polygon points="${q.map(p => f(p[0]) + ',' + f(p[1])).join(' ')}" fill="${fill}" ${extra||''}/>`}); };
  const box = (a,b,z,la,lb,h,c) => { const a2 = flip ? LEN-a-la : a, s = X ? {x:a2,y:b,z,w:la,d:lb,h,c} : {x:b,y:a2,z,w:lb,d:la,h,c:[c[0],c[2],c[1]]};
    [[s.x,s.y,s.z],[s.x+s.w,s.y+s.d,s.z],[s.x,s.y,s.z+s.h],[s.x+s.w,s.y+s.d,s.z+s.h],[s.x+s.w,s.y,s.z+s.h],[s.x,s.y+s.d,s.z]].forEach(p => pts.push(isoP(p[0],p[1],p[2])));
    items.push({k:s.x+s.w/2+s.y+s.d/2+(s.z+s.h/2)*.01, s:isoBox(s)}); };
  const C3 = c => [c, shade(c,.86), shade(c,.72)], B = 6.5;
  // thân: hộp giữa + vát trên/dưới cho tròn trịa; mũi và đuôi là chóp bốn mặt
  const body = (a0, a1, r, zc, c, belly) => { const h = r*.72;
    box(a0, B-r, zc-h, a1-a0, 2*r, 2*h, C3(c));
    box(a0+.3, B-r*.68, zc+h, a1-a0-.6, r*1.36, r*.32, C3(shade(c,1.04)));
    box(a0+.4, B-r*.68, zc-h-r*.28, a1-a0-.8, r*1.36, r*.28, C3(belly || shade(c,.9))); };
  const cone = (a, tip, r, zc, tz, c) => { const h = r*.72, T = [tip, B, tz];
    poly([[a,B-r,zc+h],[a,B+r,zc+h],T], shade(c,1.02)); poly([[a,B+r,zc-h],[a,B+r,zc+h],T], shade(c,.86));
    poly([[a,B-r,zc-h],[a,B-r,zc+h],T], shade(c,.78)); poly([[a,B-r,zc-h],[a,B+r,zc-h],T], shade(c,.7)); };
  const wings = (aR, chord, sweep, tipC, span, r, z, c, th) => [-1,1].forEach(s => {
    const b0 = B + s*r*.95, b1 = B + s*span, le0 = aR+chord, le1 = aR+chord-sweep, te1 = le1-tipC;
    poly([[aR,b0,z+th],[le0,b0,z+th],[le1,b1,z+th],[te1,b1,z+th]], c);
    poly([[le0,b0,z],[le0,b0,z+th],[le1,b1,z+th],[le1,b1,z]], shade(c,.8)); });
  const fin = (a0, a1, top, back, z, c, w) => [-1,1].forEach(s => poly([[a0,B+s*w,z],[a1,B+s*w,z],[a0+back+ (a1-a0)*.35,B+s*w,top],[a0+back,B+s*w,top]], s>0 ? shade(c,.86) : shade(c,.75)));
  const windows = (a0, a1, r, z, n, c) => [-1,1].forEach(s => { for(let i=0;i<n;i++){ const a = a0 + (a1-a0)*i/(n-1 || 1);
    poly([[a-.35,B+s*(r+.02),z],[a+.35,B+s*(r+.02),z],[a+.35,B+s*(r+.02),z+.75],[a-.35,B+s*(r+.02),z+.75]], c, 'stroke="none"'); } });
  const stripe = (a0, a1, r, z, h, c) => [-1,1].forEach(s => poly([[a0,B+s*(r+.03),z],[a1,B+s*(r+.03),z],[a1,B+s*(r+.03),z+h],[a0,B+s*(r+.03),z+h]], c, 'stroke="none"'));
  const engine = (a, b, z, len, r, c) => { box(a, b-r, z-r*.8, len, 2*r, 1.6*r, C3(c)); poly([[a+len+.02,b-r*.7,z-r*.55],[a+len+.02,b+r*.7,z-r*.55],[a+len+.02,b+r*.7,z+r*.55],[a+len+.02,b-r*.7,z+r*.55]], '#2B3A67', 'stroke="none"'); };
  const disc = (a, zc, r, extra) => { const ps = []; for(let i=0;i<16;i++){ const t = i/16*Math.PI*2; ps.push([a, B+Math.cos(t)*r, zc+Math.sin(t)*r]); } poly(ps, 'rgba(255,255,255,.55)', extra || 'class="prop" stroke="#2B3A67" stroke-width=".6"'); };
  let fx = '';
  if(style==='A'){            // phản lực chở khách: thân trắng dài, cánh xuôi, hai động cơ, đuôi và sọc màu hãng
    const r = 1.35, zc = 4.4, c0 = col[0]==='#2B3348' ? '#2B3348' : col[0];
    wings(8.4, 4.4, 3.4, 1.6, 6.3, r, 3.7, '#DCE3EC', .45);
    engine(9.2, 3.2, 3.1, 2.6, .75, '#C3CEDA'); engine(9.2, 9.8, 3.1, 2.6, .75, '#C3CEDA');
    body(4, 18, r, zc, '#FFFFFF', '#DCE3EC'); stripe(4.6, 17.4, r, zc-.55, .35, c0); windows(6, 16.4, r, zc+.05, 8, '#3A4E7A');
    cone(18, 21.8, r, zc, zc-.2, '#FFFFFF'); poly([[18.2,B-r*.8,zc+.75],[18.2,B+r*.8,zc+.75],[19.6,B+r*.45,zc+.55],[19.6,B-r*.45,zc+.55]], '#2B3A67', 'stroke="none"');
    cone(4, .6, r, zc, zc+.7, '#FFFFFF');
    wings(1.2, 2.2, 1.6, 1, 3.2, .5, zc+.3, '#DCE3EC', .3);
    fin(1.4, 4.6, zc+5.6, -.4, zc+.9, c0, .22);
  } else if(style==='B'){     // cánh quạt cổ điển: thân màu hãng, cánh cao trên lưng, cánh quạt quay, bánh xe
    const r = 1.6, zc = 4.6, c0 = col[0], c1 = col[2]===col[0] ? '#FFF3D6' : col[2];
    [[11.5,4.6],[11.5,8.4]].forEach(p => { box(p[0], p[1]-.15, 1.2, .3, .3, 2.2, C3('#3D4A63')); box(p[0]-.7, p[1]-.45, .2, 1.4, .9, 1.4, C3('#2B3348')); });
    body(4.5, 17, r, zc, c0, shade(c0,.85)); stripe(5, 16.5, r, zc-.3, .5, c1); windows(10, 15.5, r, zc+.25, 4, '#BFE3F2');
    cone(17, 19.6, r, zc, zc, shade(c0,1.05)); cone(4.5, 1.2, r, zc, zc+.9, c0);
    wings(10.5, 3.4, .6, 2.8, 6.4, .1, zc+r*.95, '#FFF3D6', .5);
    wings(1.6, 1.8, .4, 1.4, 3, .5, zc+.6, '#FFF3D6', .3);
    fin(1.6, 4.4, zc+4.6, .3, zc+1, c0, .22);
    box(19.4, B-.35, zc-.35, .6, .7, .7, C3('#9AA6B2')); disc(20.2, zc, 2.6);
  } else if(style==='C'){     // máy bay đồ chơi: thân bầu bĩnh, buồng lái kính tròn, cánh ngắn, sao lấp lánh
    const r = 2.1, zc = 4.8, c0 = col[0]==='#2B3348' ? '#7A6CF0' : col[0];
    wings(9, 4.2, 1.2, 3.2, 5.8, r, 3.6, '#FFFFFF', .7);
    body(6, 15.5, r, zc, c0, shade(c0,.8)); body(7, 14.5, r*1.08, zc, c0, shade(c0,.8));
    cone(15.5, 19.2, r, zc, zc-.3, c0); cone(6, 2.4, r, zc, zc+1, c0);
    poly([[12,B-1.2,zc+r*.75+.3],[12,B+1.2,zc+r*.75+.3],[14.6,B+.9,zc+r*.6],[14.6,B-.9,zc+r*.6]], '#BFE8FF', 'stroke="#2B3A67" stroke-width=".7"');
    poly([[12.4,B-.6,zc+r*.75+.32],[13.4,B-.4,zc+r*.7+.3],[13.4,B,zc+r*.7+.3],[12.4,B-.2,zc+r*.75+.32]], '#FFFFFF', 'stroke="none"');
    wings(2.6, 2, .6, 1.4, 3.6, .8, zc+.8, '#FFFFFF', .4);
    fin(2.4, 5.4, zc+5, .2, zc+1.2, '#FFFFFF', .26);
    box(19, B-.4, zc-.6, .7, .8, .8, C3('#F4C542')); disc(19.9, zc-.2, 2.2);
    const s = (a,b,z,k) => { const p = isoP(...W(a,b,z)); pts.push([p[0]-3,p[1]-3],[p[0]+3,p[1]+3]); fx += `<path class="psp" style="--k:${k}" d="M${f(p[0])} ${f(p[1]-2.6)}L${f(p[0]+.8)} ${f(p[1]-.8)}L${f(p[0]+2.6)} ${f(p[1])}L${f(p[0]+.8)} ${f(p[1]+.8)}L${f(p[0])} ${f(p[1]+2.6)}L${f(p[0]-.8)} ${f(p[1]+.8)}L${f(p[0]-2.6)} ${f(p[1])}L${f(p[0]-.8)} ${f(p[1]-.8)}Z" fill="#FFF3A0" stroke="none"/>`; };
    s(16,1.5,9,0); s(4,11.5,10,1); s(11,12,6,2);
  } else {                    // phản lực thương gia: thân thon xanh đậm, sọc vàng, đuôi chữ T, động cơ sau đuôi, đầu cánh dựng
    const r = 1.15, zc = 4.4, c0 = '#1F2A44', gold = '#F4C542';
    wings(9.5, 3.6, 3.2, 1.3, 6, r, 3.9, '#E8ECF2', .35);
    [-1,1].forEach(s => poly([[9.9,B+s*6,4.25],[11.2,B+s*6,4.25],[10.4,B+s*6.1,6.4],[9.6,B+s*6.1,6.4]], gold));
    body(4.2, 17.6, r, zc, '#F4F6FA', '#DCE3EC'); stripe(4.6, 17, r, zc-.4, .45, c0); stripe(4.6, 17, r, zc+.1, .18, gold); windows(10, 15.6, r, zc+.35, 5, '#2B3A67');
    cone(17.6, 21.6, r, zc, zc-.1, '#F4F6FA'); poly([[17.8,B-r*.75,zc+.7],[17.8,B+r*.75,zc+.7],[19.2,B+r*.4,zc+.5],[19.2,B-r*.4,zc+.5]], '#2B3A67', 'stroke="none"');
    cone(4.2, .8, r, zc, zc+.6, '#F4F6FA');
    engine(3.4, B-1.85, zc+.5, 3.2, .65, '#C3CEDA'); engine(3.4, B+1.85, zc+.5, 3.2, .65, '#C3CEDA');
    fin(1.2, 4.2, zc+5, -.6, zc+.8, c0, .2);
    poly([[.6,B-2.8,zc+5],[2.2,B-2.8,zc+5],[2.6,B+2.8,zc+5],[1,B+2.8,zc+5]].map(p => p), gold);
  }
  items.sort((a,b) => a.k - b.k);
  const ctr = X ? sc.P(11,6.5,0) : sc.P(6.5,11,0), dir = (flip ? -1 : 1), ux = (X ? .866 : -.866)*dir, uy = .5*dir;
  sc.raw(-5, `<ellipse cx="${ctr[0]}" cy="${ctr[1]}" rx="11" ry="4.2" fill="rgba(43,58,103,.2)" stroke="none"/>`, [[ctr[0]-11,ctr[1]-4],[ctr[0]+11,ctr[1]+4]]);
  sc.raw(10, `<g class="plane" stroke-width=".42" style="--px:${(ux*70).toFixed(1)}px;--py:${(uy*70).toFixed(1)}px">${items.map(x => x.s).join('')}${fx}</g>`, pts);
  return sc.out(X ? [11,6.5,0] : [6.5,11,0]);
}

/* Ô Startup và ô Quỹ (Fund): đồ vật đứng trên mặt ô (không lơ lửng), 5 mẫu mỗi ô, chọn trong bảng Aa (TSX.su, TSX.fu).
   Startup: A laptop biểu đồ · B mầm cây nảy xu · C cúp vàng · D huy hiệu nổi mũi tên · E toà kính mini
   Fund:    A heo đất · B hũ quyên góp · C két sắt · D huy hiệu nổi trái tim · E rương báu */
function deco3D(kind, style){
  const sc = isoScene(), f = v => (+v).toFixed(1), it = [], pts = [];
  const C3 = c => [c, shade(c,.86), shade(c,.72)];
  const box = (x,y,z,w,d,h,c,band) => { const s = {x,y,z,w,d,h,c:C3(c),band};
    [[x,y,z],[x+w,y+d,z],[x,y,z+h],[x+w,y+d,z+h],[x+w,y,z+h],[x,y+d,z]].forEach(p => pts.push(isoP(...p)));
    it.push({k:x+w/2+y+d/2+(z+h/2)*.01, s:isoBox(s)}); };
  const poly = (ps, fill, ex, k) => { const q = ps.map(p => isoP(...p)); q.forEach(p => pts.push(p));
    it.push({k:k!=null ? k : ps.reduce((s,p) => s+p[0]+p[1]+p[2]*.01, 0)/ps.length, s:`<polygon points="${q.map(p => f(p[0])+','+f(p[1])).join(' ')}" fill="${fill}" ${ex||''}/>`}); };
  const E = (x,y,z,r) => { const c = isoP(x,y,z); return {x:c[0], y:c[1], rx:1.2247*r, ry:ISOK.y*1.4142*r}; };
  const cyl = (x,y,z,r,h,col,k,top) => { const e = E(x,y,z,r), t = E(x,y,z+h,r);
    [[e.x-e.rx,e.y+e.ry],[t.x+t.rx,t.y-t.ry]].forEach(p => pts.push(p));
    it.push({k:k!=null ? k : x+y+(z+h/2)*.01, s:`<path d="M${f(e.x-e.rx)} ${f(e.y)}A${f(e.rx)} ${f(e.ry)} 0 0 0 ${f(e.x+e.rx)} ${f(e.y)}L${f(t.x+t.rx)} ${f(t.y)}A${f(t.rx)} ${f(t.ry)} 0 0 0 ${f(t.x-t.rx)} ${f(t.y)}Z" fill="${col}"/>`
      + `<path d="M${f(e.x)} ${f(e.y+e.ry)}A${f(e.rx)} ${f(e.ry)} 0 0 0 ${f(e.x+e.rx)} ${f(e.y)}L${f(t.x+t.rx)} ${f(t.y)}A${f(t.rx)} ${f(t.ry)} 0 0 0 ${f(t.x)} ${f(t.y+t.ry)}Z" fill="${shade(col,.82)}" stroke="none"/>`
      + `<ellipse cx="${f(t.x)}" cy="${f(t.y)}" rx="${f(t.rx)}" ry="${f(t.ry)}" fill="${top || shade(col,1.12)}"/>`}); };
  const raw = (k, s, bb) => { bb.forEach(p => pts.push(p)); it.push({k, s}); };
  const spark = (x, y, r, n) => `<path class="dsp" style="--k:${n}" d="M${f(x)} ${f(y-r)}L${f(x+r*.3)} ${f(y-r*.3)}L${f(x+r)} ${f(y)}L${f(x+r*.3)} ${f(y+r*.3)}L${f(x)} ${f(y+r)}L${f(x-r*.3)} ${f(y+r*.3)}L${f(x-r)} ${f(y)}L${f(x-r*.3)} ${f(y-r*.3)}Z" fill="#FFF6B8" stroke="#F2B53A" stroke-width=".4"/>`;
  const coins = (x, y, n, r) => { for(let i=0;i<n;i++) cyl(x, y, i*.9, r, .9, i%2 ? '#E8B93C' : '#F4C542', x+y+i*.01+.001, '#FFE27A'); };
  const o = isoP(0,0,0);
  raw(-50, `<ellipse cx="${f(o[0])}" cy="${f(o[1])}" rx="13" ry="5.2" fill="#2B3A67" opacity=".16" stroke="none"/>`, [[o[0]-13,o[1]-5],[o[0]+13,o[1]+5]]);
  if(kind==='su'){
    if(style==='A'){          // laptop mở, màn hình sáng biểu đồ đi lên
      box(-6,-4,0,12,9,1,'#C3CEDA'); poly([[-5,-3,1.02],[5,-3,1.02],[5,2.6,1.02],[-5,2.6,1.02]], '#8E9BB0', 'stroke="none"');
      poly([[-2,3.2,1.03],[2,3.2,1.03],[2,4.4,1.03],[-2,4.4,1.03]], '#A8B4C6', 'stroke="none"');
      poly([[-6,-4,1],[6,-4,1],[6,-5.4,11],[-6,-5.4,11]], '#2B3A67', '', 1);
      poly([[-5.2,-4.05,2],[5.2,-4.05,2],[5.2,-5.25,10.2],[-5.2,-5.25,10.2]], '#5FD3F5', 'stroke="none"', 1.01);
      const a = [[-4,-4.2,3.4],[-1.5,-4.4,5.6],[.6,-4.5,4.8],[3.6,-4.8,8.4]].map(p => isoP(...p));
      raw(1.02, `<polyline points="${a.map(p => f(p[0])+','+f(p[1])).join(' ')}" fill="none" stroke="#FFFFFF" stroke-width="1.4"/><circle cx="${f(a[3][0])}" cy="${f(a[3][1])}" r="1.3" fill="#FFE27A" stroke="none"/>`, a);
    } else if(style==='B'){   // chậu cây nảy mầm, lá là đồng xu vàng
      cyl(0,0,0,4.2,4.4,'#C8794A',0,'#7A4A2A');
      const t = isoP(0,0,4.4), s = [t[0], t[1]-2];
      raw(5, `<path d="M${f(s[0])} ${f(s[1]+1)}C${f(s[0]-1)} ${f(s[1]-6)} ${f(s[0]+2)} ${f(s[1]-9)} ${f(s[0]+.5)} ${f(s[1]-15)}" fill="none" stroke="#3E8E3A" stroke-width="1.8"/>
        <path d="M${f(s[0]+.3)} ${f(s[1]-8)}c-6 -1 -8 -6 -7 -8c4 0 7 3 7 8z" fill="#7ED06A"/><path d="M${f(s[0]+.6)} ${f(s[1]-11)}c5 -2 8 -1 9 1c-3 3 -7 2 -9 -1z" fill="#5BB55A"/>
        <circle cx="${f(s[0]+.5)}" cy="${f(s[1]-17.5)}" r="3.4" fill="#F4C542" stroke="#C99A2E"/><text x="${f(s[0]+.5)}" y="${f(s[1]-16.2)}" text-anchor="middle" font-size="4" font-weight="900" fill="#8A6A1E" stroke="none">$</text>
        ${spark(s[0]-6, s[1]-15, 2.4, 0)}${spark(s[0]+7, s[1]-18, 2, 1)}`, [[s[0]-9,s[1]-22],[s[0]+10,s[1]+2]]);
      coins(5.5, 3, 3, 1.6);
    } else if(style==='C'){   // cúp vàng trên đế, ngôi sao giữa cúp
      box(-3.6,-3.6,0,7.2,7.2,2.2,'#2B3A67'); box(-2.6,-2.6,2.2,5.2,5.2,1.2,'#3D4A63');
      const t = isoP(0,0,3.4);
      raw(5, `<path d="M${f(t[0]-1)} ${f(t[1])}h2l-.4 -4h-1.2z" fill="#E8B93C"/>
        <path d="M${f(t[0]-6.5)} ${f(t[1]-14)}h13c0 6 -2.6 9.6 -6.5 10.2c-3.9 -.6 -6.5 -4.2 -6.5 -10.2z" fill="#F4C542"/>
        <path d="M${f(t[0]+1)} ${f(t[1]-14)}h5.5c0 6 -2.6 9.6 -6.5 10.2c2.6 -1.6 1 -6 1 -10.2z" fill="#E0A82E" stroke="none"/>
        <path d="M${f(t[0]-6.4)} ${f(t[1]-12.6)}c-3.6 0 -3.6 4.6 .6 5.4M${f(t[0]+6.4)} ${f(t[1]-12.6)}c3.6 0 3.6 4.6 -.6 5.4" fill="none" stroke="#E8B93C" stroke-width="1.6"/>
        <ellipse cx="${f(t[0])}" cy="${f(t[1]-14)}" rx="6.5" ry="1.6" fill="#FFE27A"/>
        <path d="M${f(t[0])} ${f(t[1]-12)}l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="#FFFFFF" stroke="none"/>
        ${spark(t[0]-8, t[1]-17, 2.2, 0)}${spark(t[0]+8.5, t[1]-12, 1.8, 1)}`, [[t[0]-11,t[1]-20],[t[0]+11,t[1]]]);
    } else if(style==='D'){   // huy hiệu tròn nổi trên mặt ô, mũi tên đi lên
      cyl(0,0,0,7,1.6,'#E0A82E',0,'#F4C542'); cyl(0,0,1.6,5.4,.5,'#F4C542',.5,'#FFE27A');
      poly([[-3.4,1.8,2.11],[-.4,-1.2,2.11],[1.2,.4,2.11],[3.6,-2.2,2.11],[2.4,-3.2,2.11],[5.2,-4.6,2.11],[4.6,-1.4,2.11],[3.6,-2.2,2.11],[1.2,.4,2.11],[-.4,-1.2,2.11],[-3.4,1.8,2.11]], '#3E8E3A', 'stroke="#2B3A67" stroke-width=".6" stroke-linejoin="round"', 3);
      const t = isoP(0,0,2); raw(4, spark(t[0]-9, t[1]-6, 2.2, 0) + spark(t[0]+9, t[1]-3, 1.8, 1), [[t[0]-12,t[1]-9],[t[0]+12,t[1]]]);
    } else {                  // toà kính mini, cửa sổ sáng, cờ trên nóc
      box(-6,-5,0,12,10,1,'#9AA4AE'); box(-3.5,-3.5,1,7,7,13,'#7FC8E8'); box(-2.6,-2.6,14,5.2,5.2,2.4,'#5FA8D3');
      for(let z=3; z<14; z+=2.4){ poly([[-3.2,3.52,z],[3.2,3.52,z],[3.2,3.52,z+1.2],[-3.2,3.52,z+1.2]], '#E6F7FF', 'stroke="none"', 3.6+z*.01); poly([[3.52,-3.2,z],[3.52,3.2,z],[3.52,3.2,z+1.2],[3.52,-3.2,z+1.2]], '#C4EBFA', 'stroke="none"', 3.6+z*.01); }
      const t = isoP(0,0,16.4); raw(20, `<path d="M${f(t[0])} ${f(t[1])}V${f(t[1]-7)}" stroke="#3D4A63" stroke-width="1"/><path d="M${f(t[0])} ${f(t[1]-7)}l5 1.4l-5 1.4z" fill="#E0483A"/>${spark(t[0]-9, t[1]+2, 2, 0)}`, [[t[0]-11,t[1]-8],[t[0]+6,t[1]]]);
    }
  } else {
    if(style==='A'){          // heo đất hồng, có đồng xu đang rơi vào khe
      const t = isoP(0,0,0);
      raw(5, `<g><ellipse cx="${f(t[0]-3)}" cy="${f(t[1]-1.4)}" rx="1.6" ry="2.4" fill="#E58AA6"/><ellipse cx="${f(t[0]+4)}" cy="${f(t[1]-.6)}" rx="1.6" ry="2.4" fill="#E58AA6"/>
        <ellipse cx="${f(t[0])}" cy="${f(t[1]-7.5)}" rx="10" ry="7.4" fill="#F7A8C0"/><path d="M${f(t[0]+2)} ${f(t[1]-14.6)}c5 1 8 4 8 8c0 3 -3 6 -7 7c3 -3 3 -10 -1 -15z" fill="#E58AA6" stroke="none"/>
        <ellipse cx="${f(t[0]+9.4)}" cy="${f(t[1]-7.6)}" rx="2.4" ry="3" fill="#F28FAF"/><circle cx="${f(t[0]+9.1)}" cy="${f(t[1]-8.4)}" r=".5" fill="#2B3A67" stroke="none"/><circle cx="${f(t[0]+9.1)}" cy="${f(t[1]-6.6)}" r=".5" fill="#2B3A67" stroke="none"/>
        <circle cx="${f(t[0]+5.6)}" cy="${f(t[1]-10.6)}" r=".9" fill="#2B3A67" stroke="none"/><path d="M${f(t[0]+2.4)} ${f(t[1]-14.2)}l1.4 -3.4l2.4 2.6z" fill="#F28FAF"/>
        <path d="M${f(t[0]-10)} ${f(t[1]-8)}c-2 -1 -2.6 1 -1 1.6c1.4 .6 .6 2.4 -.8 1.6" fill="none" stroke="#E58AA6" stroke-width="1"/>
        <path d="M${f(t[0]-2.6)} ${f(t[1]-14.6)}h4.4" stroke="#2B3A67" stroke-width="1.2"/></g>
        <g class="dcoin"><ellipse cx="${f(t[0]-.4)}" cy="${f(t[1]-17.6)}" rx="2.6" ry="2.6" fill="#F4C542" stroke="#C99A2E"/><text x="${f(t[0]-.4)}" y="${f(t[1]-16.3)}" text-anchor="middle" font-size="3.4" font-weight="900" fill="#8A6A1E" stroke="none">$</text></g>`, [[t[0]-12,t[1]-21],[t[0]+12,t[1]+1]]);
    } else if(style==='B'){   // hũ quyên góp bằng kính, đầy xu, nhãn trái tim
      const t = isoP(0,0,0);
      raw(5, `<path d="M${f(t[0]-6.4)} ${f(t[1]-15)}h12.8v-1.8h-12.8z" fill="#E0483A"/><path d="M${f(t[0]-6)} ${f(t[1]-13.2)}c-1.4 2 -1.4 11 0 13c3.2 1.4 8.8 1.4 12 0c1.4 -2 1.4 -11 0 -13z" fill="#D8F1FA" opacity=".9"/>
        ${[0,1,2,3,4,5].map(i => `<ellipse cx="${f(t[0]-3.2+(i%3)*3.2)}" cy="${f(t[1]-2-Math.floor(i/3)*2.2)}" rx="2.2" ry="1.1" fill="${i%2 ? '#E8B93C' : '#F4C542'}" stroke="#C99A2E" stroke-width=".4"/>`).join('')}
        <path d="M${f(t[0])} ${f(t[1]-6.4)}c-1.6 -2.6 -5 -1 -3.4 1.6l3.4 3l3.4 -3c1.6 -2.6 -1.8 -4.2 -3.4 -1.6z" fill="#E0483A" stroke="#FFFFFF" stroke-width=".7"/>
        <path d="M${f(t[0]-4.6)} ${f(t[1]-12)}v9" stroke="#FFFFFF" stroke-width="1" opacity=".8"/>
        <g class="dcoin"><ellipse cx="${f(t[0]+1)}" cy="${f(t[1]-19)}" rx="2.2" ry="2.2" fill="#F4C542" stroke="#C99A2E"/></g>${spark(t[0]+8, t[1]-14, 2, 0)}`, [[t[0]-9,t[1]-22],[t[0]+10,t[1]+1]]);
    } else if(style==='C'){   // két sắt: mặt trước có vô lăng khoá và tay nắm vàng
      box(-5,-4.5,0,10,9,11,'#6E7B91');
      const P = (x,z) => isoP(x, 4.52, z), c = P(0,5.6);
      poly([[-4,4.52,1],[4,4.52,1],[4,4.52,10],[-4,4.52,10]], '#8794AA', 'stroke="#2B3A67" stroke-width=".6"', 5);
      raw(5.1, `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="3.2" ry="3.4" fill="#F4C542" stroke="#2B3A67" stroke-width=".7"/><ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="1.4" ry="1.5" fill="#E0A82E"/>
        ${[0,60,120].map(a => `<path d="M${f(c[0])} ${f(c[1])}l${f(Math.cos(a*Math.PI/180)*3)} ${f(Math.sin(a*Math.PI/180)*3.2)}M${f(c[0])} ${f(c[1])}l${f(-Math.cos(a*Math.PI/180)*3)} ${f(-Math.sin(a*Math.PI/180)*3.2)}" stroke="#2B3A67" stroke-width=".6"/>`).join('')}
        <path d="M${f(P(3,7.4)[0])} ${f(P(3,7.4)[1])}v3.6" stroke="#F4C542" stroke-width="1.4"/>`, [c]);
      coins(-7, 5, 2, 1.6); const t = isoP(0,0,11); raw(20, spark(t[0]+8, t[1]-2, 2, 0), [[t[0]-2,t[1]-4],[t[0]+11,t[1]]]);
    } else if(style==='D'){   // huy hiệu tròn nổi, trái tim đỏ ở giữa
      cyl(0,0,0,7,1.6,'#2E9C8C',0,'#3FB7A5'); cyl(0,0,1.6,5.4,.5,'#3FB7A5',.5,'#7FE0D0');
      const t = isoP(0,0,2.1);
      raw(3, `<path d="M${f(t[0])} ${f(t[1]-1)}c-2.4 -4.2 -8 -1.8 -5.4 2.4l5.4 4.2l5.4 -4.2c2.6 -4.2 -3 -6.6 -5.4 -2.4z" fill="#E0483A" stroke="#2B3A67" stroke-width=".6"/>${spark(t[0]-9, t[1]-6, 2.2, 0)}${spark(t[0]+9, t[1]-3, 1.8, 1)}`, [[t[0]-12,t[1]-9],[t[0]+12,t[1]+4]]);
    } else {                  // rương báu mở nắp, vàng sáng
      box(-6,-4,0,12,8,5.6,'#A86A3A'); box(-6.1,3.2,0,12.2,.9,5.7,'#F4C542'); box(5.2,-4.1,0,.9,8.2,5.7,'#F4C542');
      const a = isoP(-6,-4,5.6), b = isoP(6,-4,5.6), c2 = isoP(6,-6,12), d = isoP(-6,-6,12);
      raw(1, `<polygon points="${f(a[0])},${f(a[1])} ${f(b[0])},${f(b[1])} ${f(c2[0])},${f(c2[1])} ${f(d[0])},${f(d[1])}" fill="#8A5A34"/>`, [a,b,c2,d]);
      const m = isoP(0,0,5.6);
      raw(6, `${[[-3,0],[0,-1],[3,0],[-1.5,1.4],[1.5,1.2]].map(p => `<ellipse cx="${f(m[0]+p[0]*1.3)}" cy="${f(m[1]+p[1])}" rx="2.4" ry="1.2" fill="#F4C542" stroke="#C99A2E" stroke-width=".4"/>`).join('')}
        <path d="M${f(m[0]-2)} ${f(m[1]-2)}l2 -3l2 3l-2 1.4z" fill="#7FD8F5" stroke="#2B3A67" stroke-width=".5"/>${spark(m[0]-7, m[1]-8, 2.2, 0)}${spark(m[0]+8, m[1]-6, 2, 1)}`, [[m[0]-10,m[1]-10],[m[0]+10,m[1]+2]]);
    }
  }
  it.sort((a,b) => a.k - b.k);
  sc.raw(10, `<g stroke-width=".55">${it.map(x => x.s).join('')}</g>`, pts);
  return sc.out([0,0,0], 1);
}

/* Trang chủ (bố cục điện thoại ngang): 4 phương án sắp xếp, chọn trong bảng Aa (TSX.home: '' = như cũ, '1'..'4').
   Mọi phương án: thanh dưới chỉ còn Chơi tiếp, Nhiệm vụ, Bảng xếp hạng (bỏ Điểm danh, Bạn bè, Hướng dẫn, Hệ thống).
   Khi có sự kiện (chip sự kiện trên thanh trên), khung Hồ sơ đổi theo sự kiện: Lễ hội Ma quái = trời đêm tím, trăng, dơi, bí ngô, mạng nhện.
   Thử: ?hs=1..4 chọn tạm phương án, ?shot=1 ẩn bảng đăng nhập (để chụp ảnh). */
const HSKIN_CSS = `
html.land #home .ldock #homeDaily,html.land #home .ldock #homePals,html.land #home .ldock #guideBtn,html.land #home .ldock #homeSnd{display:none!important}
html.land #home .ldock{justify-content:center}
html.land #home .ldock > *{flex:0 1 190px!important}
html.ev-spooky.land #home #homeProf{background:var(--evbg) center/cover no-repeat,radial-gradient(circle at 78% 22%,rgba(255,233,168,.55),rgba(255,233,168,0) 26%),linear-gradient(180deg,#2E1A5C 0%,#5B2F8C 55%,#C9622F 100%)!important;border-color:#FF8A3D!important;box-shadow:0 0 0 3px rgba(255,138,61,.35),0 6px 0 #1A1035!important}
#home .evbanner{display:none}
html.land body #home #homeProf.pbg-on{background:var(--pbg) center/cover no-repeat!important}
html.land body #home #homeProf.pbg-on .hscene{display:none!important}
/* nút sự kiện góc trái ô Hồ sơ */
html.hs-2.land.has-ev #home #v15bar .v15chip[data-v15="ach"]{display:none!important}
html.hs-2.land #home #v15bar .v15chip.evpin{display:flex!important;position:absolute;z-index:9;margin:0;overflow:hidden;color:#FFF;border:2px solid #FFE27A;border-radius:14px;padding:4px 12px 4px 8px;background:linear-gradient(135deg,#FF8A3D,#C2410C 45%,#7C3AED);animation:evbtn 2.2s ease-in-out infinite}
html.hs-2.land #home #v15bar .v15chip.evpin[data-th="xmas"]{background:linear-gradient(135deg,#E53935,#B71C1C 45%,#2E7D32)}
html.hs-2.land #home #v15bar .v15chip.evpin[data-th="gen"]{background:linear-gradient(135deg,var(--c,#F4C542),#7C3AED)}
html.hs-2.land #home #v15bar .v15chip.evpin[data-th="ach"]{background:linear-gradient(135deg,#F4C542,#E07A2E 50%,#B45309)}
html.hs-2.land #home #v15bar .v15chip.evpin b,html.hs-2.land #home #v15bar .v15chip.evpin small{color:#FFF;text-shadow:0 1px 0 rgba(0,0,0,.35)}
html.hs-2.land #home #v15bar .v15chip.evpin i{animation:evico 1.4s ease-in-out infinite;display:inline-block}
html.hs-2.land #home #v15bar .v15chip.evpin::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:40%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.75),transparent);transform:skewX(-15deg);animation:evsweep 2.8s ease-in-out infinite;pointer-events:none}
@keyframes evbtn{0%,100%{box-shadow:0 0 6px 1px rgba(255,180,60,.6),0 3px 0 #3B1A66}50%{box-shadow:0 0 18px 5px rgba(255,200,80,.95),0 3px 0 #3B1A66}}
@keyframes evico{0%,100%{transform:rotate(-10deg) scale(1)}50%{transform:rotate(10deg) scale(1.18)}}
@keyframes evsweep{0%{left:-60%}60%,100%{left:130%}}
html.hs-2.land.has-ev #home #homeProf .lnm{top:58px!important}
html.hs-2.land #home .evbanner{display:none!important}
/* thanh dưới: Chơi tiếp to, rồi 🏆 🎯 📖 ⚙️ (bỏ Bạn bè, Nhiệm vụ chỉ còn biểu tượng) */
html.hs-2.land body #home .ldock #homePals{display:none!important}
html.hs-2.land #home .ldock #contBtn{order:0;flex:1 1 auto!important;font-size:16px!important}
html.hs-2.land #home .ldock #homeLb{order:1}html.hs-2.land #home .ldock #homeQuest{order:2;flex:0 0 40px!important;padding:0!important;font-size:19px!important}
html.hs-2.land #home .ldock #guideBtn{order:3}html.hs-2.land #home .ldock #homeSnd{order:4}
html.hs-2.land #home .ldock #homeQuest::after{display:none!important}
/* ô Hồ sơ lấp lánh + nhân vật nhảy */
#home #homeProf .pglint{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:inherit;z-index:0}
#home #homeProf .pglint i{position:absolute;font-style:normal;font-size:13px;color:#FFF6C8;text-shadow:0 0 6px #FFE27A;animation:pgl 2.2s ease-in-out infinite;animation-delay:calc(var(--k)*.33s)}
#home #homeProf .pglint .psw{position:absolute;top:-30%;bottom:-30%;left:-40%;width:28%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-14deg);animation:psw 5.5s ease-in-out infinite}
@keyframes pgl{0%,100%{opacity:.1;transform:scale(.5)}50%{opacity:1;transform:scale(1.2)}}
@keyframes psw{0%{left:-40%}45%,100%{left:120%}}
html.land #home #homeProf .pchar.full{transform:scale(1.3);transform-origin:50% 100%}   /* nhân vật to hơn */
#home .pchar.full .avfull{animation:pdance 6.4s ease-in-out infinite!important;transform-origin:50% 100%}
@keyframes pdance{0%,100%{transform:translate(0,0) rotate(0) scale(1,1)}5%{transform:scale(1.12,.86)}11%{transform:translateY(-20%) rotate(-5deg) scale(.92,1.1)}17%{transform:translateY(0) scale(1.16,.82)}22%{transform:scale(.95,1.06)}27%{transform:scale(1.03,.97)}33%{transform:translateX(-6%) rotate(-15deg)}38%{transform:translateX(-6%) rotate(-15deg) scale(1,1.04)}44%{transform:translateX(5%) rotate(13deg)}50%{transform:rotate(0) scaleX(1)}54%{transform:scaleX(-1)}62%{transform:translateX(-10%) scaleX(-1) translateY(-3%)}66%{transform:translateX(-12%) scaleX(-1)}70%{transform:translateX(0) scaleX(1)}75%{transform:rotate(-9deg)}79%{transform:rotate(8deg)}83%{transform:rotate(-6deg)}87%{transform:rotate(4deg)}91%{transform:translateY(-9%) scale(.96,1.05)}95%{transform:translateY(0) scale(1.08,.93)}}
#home .pchar.full .avfull .avwave{animation-duration:.45s!important}
html.ev-xmas.land #home #homeProf{background:var(--evbg) center/cover no-repeat,linear-gradient(180deg,#123B5E 0%,#1E5E7E 60%,#E8F1F7 100%)!important;border-color:#3FB76A!important;box-shadow:0 0 0 3px rgba(63,183,106,.35),0 6px 0 #0B2238!important}
#home .evframe{grid-area:hero;position:relative;z-index:6;pointer-events:none;margin:-9px;animation:efglow 2.6s ease-in-out infinite}
#home .evframe:empty,#home .evframe:not(:has(.efe)){margin:0}
#home .evframe .efe{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
@keyframes efglow{0%,100%{filter:drop-shadow(0 0 2px var(--ec))}50%{filter:drop-shadow(0 0 9px var(--ec))}}
body.lite #home .evframe{animation:none}
/* phương án 2: ô Ranks chia thành nút biểu tượng: 🏆 Bảng xếp hạng, 👥 Bạn bè, 📖 Hướng dẫn, ⚙️ Hệ thống */
html.hs-2.land #home .ldock #homePals,html.hs-2.land #home .ldock #guideBtn,html.hs-2.land #home .ldock #homeSnd{display:flex!important}
html.hs-2.land #home .ldock #homeLb,html.hs-2.land #home .ldock #homePals,html.hs-2.land #home .ldock #guideBtn,html.hs-2.land #home .ldock #homeSnd{flex:0 0 40px!important;padding:0!important;font-size:19px!important}
html.hs-2.land #home .ldock #homeLb::after,html.hs-2.land #home .ldock #homePals::after,html.hs-2.land #home .ldock #guideBtn::after,html.hs-2.land #home .ldock #homeSnd::after{display:none!important}
/* 1: gọn — giữ bố cục, thanh dưới 3 nút to */
html.hs-1.land #home .ldock > *{flex:0 1 230px!important;font-size:15px}
/* 2: sự kiện làm chủ — Hồ sơ cao hết cỡ, tên sự kiện in to trên Hồ sơ, thanh dưới nằm dưới cột chế độ chơi */
html.hs-2.land #home .lob{grid-template-areas:"top top" "tk tk" "hero side" "hero dock"!important;grid-template-columns:1.15fr 1fr!important}
html.hs-2.land #home .evbanner{display:flex;flex-direction:column;align-items:flex-end;text-align:right;position:absolute;right:14px;bottom:12px;z-index:2;color:#FFF;text-shadow:0 2px 0 #2B1650}
html.hs-2.land #home .evbanner b{font:900 22px/1 inherit;letter-spacing:.02em}
html.hs-2.land #home .evbanner small{font:700 12px/1.3 inherit;opacity:.9;background:rgba(0,0,0,.25);border-radius:8px;padding:2px 8px;margin-top:4px}
html.hs-2.land #home .ldock{flex-wrap:nowrap;gap:6px}
html.hs-2.land #home .ldock > *{flex:1 1 0!important;min-width:0}
/* 3: ô vuông — 4 chế độ chơi thành lưới 2×2, chữ ngắn, Hồ sơ hẹp lại */
html.hs-3.land #home .lob{grid-template-columns:.8fr 1.2fr!important}
html.hs-3.land #home .lside{display:grid!important;grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;align-self:stretch}
html.hs-3.land #home .lside > .pan{grid-column:auto!important;grid-row:auto!important;height:auto!important;width:auto!important}
html.hs-3.land #home .lside > .pan{flex-direction:column!important;justify-content:center!important;align-items:center!important;text-align:center;padding:6px!important;min-height:0}
html.hs-3.land #home .lside > .pan .ptitle{font-size:15px!important;margin:4px 0 0!important}
html.hs-3.land #home .lside > .pan .pchar{width:52px!important;height:52px!important;margin:0!important;position:static!important}
html.hs-3.land #home .lside > .pan .lgo,html.hs-3.land #home .lside > .pan .stk,html.hs-3.land #home .lside > .pan .bubble{display:none!important}
html.hs-3.land #home .ldock > *{border-radius:999px!important}
/* 4: sân khấu — Hồ sơ ở giữa, chế độ chơi chia hai bên */
html.hs-4.land #home .lob{grid-template-columns:1fr 1.25fr 1fr!important;grid-template-areas:"top top top" "tk tk tk" "pa hero pb" "pc hero pe" "dock dock dock"!important;grid-template-rows:auto auto 1fr 1fr auto!important}
html.hs-4.land #home .lside{display:contents!important}
html.hs-4.land #home .pan.pA{grid-area:pa}html.hs-4.land #home .pan.pB{grid-area:pb}html.hs-4.land #home .pan.pC{grid-area:pc}html.hs-4.land #home .pan.pE{grid-area:pe}
html.hs-4.land #home .lob > .pan,html.hs-4.land #home .lside > .pan{min-height:0;margin:0!important}
html.hs-4.land #home .pan .ptitle{font-size:13px!important;white-space:normal!important;line-height:1.05!important}
html.hs-4.land #home .pan .lgo,html.hs-4.land #home .pan .stk{display:none!important}
html.hs-4.land #home #homeProf .lgo{display:inline-flex!important}
`;
// Khung sự kiện quanh ô Hồ sơ: ảnh khung do Muse vẽ (EVFRAME_IMG, nền trong suốt) + hiệu ứng lấp lánh (evFrameFx, DeepSeek viết).
// Nằm chồng lên ô Hồ sơ (cùng ô lưới), không nhận bấm. Sự kiện chưa có ảnh khung thì dùng viền vàng đơn giản.
// vị trí / cỡ nền để viền tranh trong ảnh (đo bỏ sao bay lẻ ở rìa) khớp đúng mép ô Hồ sơ
const EVFRAME_FIT = {spooky:'59.5% 59.2% / 103.9% 109.6%', xmas:'49.6% 55.7% / 114.2% 112.2%'};
function hskinFrame(){   // khung lễ hội đã bỏ (2026-11-02): chỉ dọn phần cũ nếu còn
  const fr = document.querySelector('#home .lob .evframe'); if(fr) fr.remove();
  const prof = document.getElementById('homeProf'); if(prof){ prof.style.removeProperty('--evfr'); prof.style.removeProperty('--evfit'); }
}
// Nút sự kiện: chip sự kiện thật (giữ nguyên chỗ bấm) được đặt nổi ở góc trái ô Hồ sơ, rực sáng theo chủ đề.
// Bấm vào: bảng sự kiện có thêm nút Thành tựu (chip Thành tựu trên thanh trên được ẩn).
function hskinEvBtn(chip, kind){
  const prof = document.getElementById('homeProf'), R = document.documentElement, ach = document.querySelector('#v15bar .v15chip[data-v15="ach"]');
  R.classList.toggle('has-ev', !!chip);
  const pin = chip;                                   // hết sự kiện: không ghim nút nào, Thành tựu về lại thanh trên như thường
  document.querySelectorAll('#v15bar .evpin').forEach(e => { if(e!==pin){ e.classList.remove('evpin'); e.style.removeProperty('left'); e.style.removeProperty('top'); } });
  if(!pin || !prof || !R.classList.contains('hs-2')) return;
  pin.classList.add('evpin'); pin.dataset.th = chip ? (kind || 'gen') : 'ach';
  const op = pin.offsetParent; if(!op) return;
  const a = prof.getBoundingClientRect(), o = op.getBoundingClientRect();
  pin.style.left = (a.left - o.left + 10) + 'px'; pin.style.top = (a.top - o.top + 10) + 'px';
  if(chip && !chip.dataset.achHook){ chip.dataset.achHook = 1;
    chip.addEventListener('click', () => setTimeout(() => {
      const mo = document.getElementById('mOpts'), ac = document.querySelector('#v15bar .v15chip[data-v15="ach"]');
      if(!mo || !ac || document.getElementById('modal').hidden || mo.querySelector('.evach')) return;
      const b = document.createElement('button'); b.className = 'btn evach'; b.textContent = '🏅 Thành tựu';
      b.onclick = () => { closeModal(); setTimeout(() => ac.click(), 60); }; mo.insertBefore(b, mo.lastElementChild);
    }, 80)); }
}
// Nhân vật ở ô Hồ sơ: chuỗi động tác hài hước (nhún dẻo, bật nhảy, nghiêng ngó, quay lưng trượt lùi, lắc lư, vẫy tay); ô Hồ sơ có sao lấp lánh và vệt sáng lướt qua
function hskinDance(){
  const prof = document.getElementById('homeProf'); if(!prof) return;
  if(!prof.querySelector('.pglint')){ const g = document.createElement('span'); g.className = 'pglint'; g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<b class="psw"></b>' + [[12,30],[30,14],[52,22],[70,12],[88,30],[8,62],[92,58],[40,40]].map(([x,y],k) => `<i style="left:${x}%;top:${y}%;--k:${k}">✦</i>`).join(''); prof.insertBefore(g, prof.firstChild.nextSibling); }
}
// Nền ô Hồ sơ do Muse vẽ (PROFBG_IMG, build chèn vào); TSX.pbg '' = tự đổi theo tuần trong tháng, '1'..'4' = cố định một nền
function hskinBg(){
  const prof = document.getElementById('homeProf'); if(!prof) return;
  const q = location.search.match(/[?&]pbg=(\d)/), wk = String(Math.min(4, Math.floor((new Date().getDate() - 1) / 7) + 1));   // mặc định đổi nền theo tuần trong tháng: ngày 1-7 nền 1, 8-14 nền 2, 15-21 nền 3, từ 22 nền 4
  const v = q ? q[1] : (TSX.pbg || wk), u = PROFBG_IMG[v];
  prof.classList.toggle('pbg-on', !!u);
  if(u){ if(prof.dataset.pbg!==v){ prof.dataset.pbg = v; prof.style.setProperty('--pbg', `url("${u}")`); } } else { delete prof.dataset.pbg; prof.style.removeProperty('--pbg'); }
}
function hskinDeco(){
  const prof = document.getElementById('homeProf'), chip = document.querySelector('#v15bar .v15chip.ev'), R = document.documentElement;
  const force = (location.search.match(/[?&]ev=(\w+)/) || [])[1];
  const ic = chip ? (chip.querySelector('i') || {}).textContent || '' : '';
  const kind = force || (!chip ? '' : /🎃/.test(ic) ? 'spooky' : /🎄/.test(ic) ? 'xmas' : 'gen');
  R.classList.toggle('ev-spooky', kind==='spooky'); R.classList.toggle('ev-xmas', kind==='xmas');
  hskinFrame(); hskinEvBtn(chip, kind); hskinDance(); hskinBg();
  if(!prof) return;
  let bn = prof.querySelector('.evbanner');
  if(!kind){ prof.style.removeProperty('--evbg'); if(bn) bn.remove(); return; }
  if(prof.dataset.evk!==kind){ prof.dataset.evk = kind; if(bn){ bn.remove(); bn = null; }
    const bat = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0c-3-4-8-5-12-3c3 1 4 3 4 5c-2-1-5-1-7 1c4 0 7 2 8 4c2-2 5-3 7-3c2 0 5 1 7 3c1-2 4-4 8-4c-2-2-5-2-7-1c0-2 1-4 4-5c-4-2-9-1-12 3z" fill="#1A1035"/>`;
    const stars = [[20,26],[70,12],[150,22],[290,70],[120,50],[40,60],[200,14]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#fff" opacity=".8"/>`).join('');
    const svg = kind==='spooky' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice"><circle cx="240" cy="38" r="20" fill="#FFE9A8"/><circle cx="233" cy="33" r="3.5" fill="#F2D27A"/><circle cx="247" cy="45" r="2.6" fill="#F2D27A"/>${stars}${bat(200,30,1)}${bat(276,62,.8)}${bat(214,70,.6)}</svg>`
      : kind==='xmas' ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice">${stars}${[[30,40],[90,70],[160,30],[220,80],[270,30],[60,110],[250,120],[130,100]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff" opacity=".85"/>`).join('')}</svg>` : '';
    if(svg) prof.style.setProperty('--evbg', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`); else prof.style.removeProperty('--evbg'); }
  if(!chip && bn) bn.remove();                       // hết sự kiện: khung vẫn theo mùa nhưng bỏ dòng tên sự kiện
  if(chip){                                           // chép chữ từ chip sự kiện (đã được lớp dịch dịch xong), không để lớp dịch dịch lại
    if(!bn){ bn = document.createElement('span'); bn.className = 'evbanner'; bn.setAttribute('data-notr', ''); prof.appendChild(bn); }
    const b = chip.querySelector('b'), sm = chip.querySelector('small'), html = `<b>${ic} ${b ? b.textContent : ''}</b><small>${sm ? sm.textContent : ''}</small>`;
    if(bn.innerHTML!==html) bn.innerHTML = html; }
}
function hskinApply(){
  if(typeof document === 'undefined') return;
  if(!document.getElementById('hskin-css')){ const st = document.createElement('style'); st.id = 'hskin-css'; st.textContent = HSKIN_CSS; document.head.appendChild(st); }
  const q = location.search.match(/[?&]hs=(\d)/), v = q ? q[1] : (TSX.home || ''), R = document.documentElement;
  ['1','2','3','4'].forEach(n => R.classList.toggle('hs-' + n, v===n));
  if(/[?&]shot=1/.test(location.search) && !document.getElementById('hskin-shot')){ const st = document.createElement('style'); st.id = 'hskin-shot'; st.textContent = '#loginFx{display:none!important}'; document.head.appendChild(st); }
  hskinDeco();
}
// Thử màn trao giải (chỉ khi có ?shot=1&pdemo=1): tự vào ván với máy rồi hiện ngay bảng kết quả, bỏ màn MVP và hướng dẫn
function hskinPodiumDemo(){
  if(!/[?&]shot=1/.test(location.search) || !/[?&]pdemo=1/.test(location.search)) return;
  setTimeout(() => { try { closeModal(); } catch(e) {} const e = [...document.querySelectorAll('[data-go="setup"]')].find(x => x.offsetParent); if(e) e.click();
    setTimeout(() => { document.getElementById('startBtn').click();
      setTimeout(() => { document.querySelectorAll('#orderFx,#tutM').forEach(x => x.remove()); S.players[2].cash = 300; S.players[3].cash = 100; S.reason = 'round'; S.over = true; showResult();
        setTimeout(() => { document.querySelectorAll('#tutM').forEach(x => x.remove()); const t = [...document.querySelectorAll('button,div')].find(x => /^(Tap to continue|Chạm để tiếp tục)/.test((x.innerText || '').trim()) && x.children.length < 3); if(t) t.click(); }, 1200); }, 2500); }, 500); }, 3000);
}
if(typeof document !== 'undefined'){ const go = () => { hskinApply(); hskinPodiumDemo(); setInterval(hskinDeco, 3000); };   // chip sự kiện được vẽ sau khi trang nạp
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); }

/* Hiệu ứng lấp lánh cho khung sự kiện (DeepSeek viết 2026-11-02): viền phát sáng, vệt sáng quét, sao lấp lánh, đèn nháy Giáng sinh, tàn lửa Halloween. Gọi evFrameFx(el, kind). */
const EVFX_CSS = `
.evframe { isolation: isolate; }
.evframe > .efimg { position: relative; z-index: 2; }

.evx-glow {
  position: absolute; inset: 0; border-radius: 12px;
  box-shadow: 0 0 18px 3px var(--evx-glow), inset 0 0 16px var(--evx-glow2);
  opacity: .45; z-index: 0; pointer-events: none;
  animation: evx-pulse 2.8s ease-in-out infinite;
  will-change: opacity;
}
@keyframes evx-pulse {
  0%, 100% { opacity: .35; }
  50% { opacity: .85; }
}

.evx-shine {
  position: absolute; inset: 0; z-index: 3; pointer-events: none; overflow: hidden;
  -webkit-mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
  -webkit-mask-size: 100% 100%, 84% 84%;
  -webkit-mask-position: center, center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-composite: xor;
  mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
  mask-size: 100% 100%, 84% 84%;
  mask-position: center, center;
  mask-repeat: no-repeat;
  mask-composite: exclude;
}
.evx-shine::before {
  content: ""; position: absolute; top: -30%; bottom: -30%; left: -60%; width: 55%;
  background: linear-gradient(105deg, transparent 0 30%, rgba(255,255,255,.85) 50%, transparent 70%);
  transform: translateX(-120%) rotate(8deg);
  animation: evx-sweep 4s linear infinite;
  will-change: transform;
}
@keyframes evx-sweep {
  0% { transform: translateX(-120%) rotate(8deg); }
  100% { transform: translateX(320%) rotate(8deg); }
}

.evx-star {
  position: absolute; width: var(--evx-s); height: var(--evx-s);
  margin-left: calc(var(--evx-s) * -0.5); margin-top: calc(var(--evx-s) * -0.5);
  background: var(--evx-c);
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
  filter: drop-shadow(0 0 4px var(--evx-c));
  opacity: 0; z-index: 4; pointer-events: none; transform-origin: center;
  animation-name: evx-twinkle; animation-timing-function: ease-in-out;
  animation-iteration-count: infinite; animation-duration: var(--evx-dur, 2.4s);
  animation-delay: var(--evx-delay, 0s);
  will-change: transform, opacity;
}
@keyframes evx-twinkle {
  0%, 100% { opacity: 0; transform: scale(.2) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(45deg); }
}

.evx-fairy {
  position: absolute; width: 6px; height: 6px; margin-left: -3px; margin-top: -3px;
  border-radius: 50%; background: var(--evx-c); box-shadow: 0 0 6px var(--evx-c);
  opacity: .3; z-index: 4; pointer-events: none;
  animation-name: evx-fairy; animation-timing-function: ease-in-out;
  animation-iteration-count: infinite; animation-duration: 1.8s;
  animation-delay: var(--evx-delay, 0s);
  will-change: opacity, transform;
}
@keyframes evx-fairy {
  0%, 100% { opacity: .25; transform: scale(.65); }
  50% { opacity: 1; transform: scale(1.1); }
}

.evx-ember {
  position: absolute; width: 4px; height: 4px; margin-left: -2px; margin-top: -2px;
  border-radius: 50%; background: #ff8a3d; box-shadow: 0 0 8px #ff6a00;
  opacity: 0; z-index: 4; pointer-events: none;
  animation-name: evx-ember; animation-timing-function: ease-out;
  animation-iteration-count: infinite; animation-duration: var(--evx-dur, 4.2s);
  animation-delay: var(--evx-delay, 0s);
  will-change: transform, opacity;
}
@keyframes evx-ember {
  0% { opacity: 0; transform: translate3d(0, 0, 0) scale(.6); }
  15% { opacity: .9; }
  100% { opacity: 0; transform: translate3d(var(--evx-dx, 0px), -70px, 0) scale(1.25); }
}

body.lite .evframe * { animation: none !important; }
body.lite .evframe *::before, body.lite .evframe *::after { animation: none !important; }
`;

function evFrameFx(el, kind) {
  // Inject CSS once.
  if (!document.getElementById('evfx-css')) {
    const style = document.createElement('style');
    style.id = 'evfx-css';
    style.textContent = EVFX_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  if (!el || el.dataset.evfx) return; // idempotent
  kind = kind || el.dataset.k || 'gen';
  el.dataset.evfx = kind;

  const lite = document.body.classList.contains('lite');
  const themes = {
    spooky: { glow: '#a855f7', glow2: '#fb923c', sparks: ['#fb923c', '#c084fc', '#f97316', '#e9d5ff'] },
    xmas: { glow: '#fbbf24', glow2: '#ffffff', sparks: ['#FFD95A', '#FFFFFF', '#FFF7CC', '#7FE3FF'] },
    gen: { glow: '#fbbf24', glow2: '#fff7cc', sparks: ['#FFD95A', '#FFF7CC', '#FFB347'] }
  };
  const t = themes[kind] || themes.gen;
  el.style.setProperty('--evx-glow', t.glow);
  el.style.setProperty('--evx-glow2', t.glow2);

  // Soft pulsing border glow.
  const glow = document.createElement('div');
  glow.className = 'evx-glow';
  el.insertBefore(glow, el.firstChild);

  // Masked diagonal shine sweep.
  const shine = document.createElement('div');
  shine.className = 'evx-shine';
  el.appendChild(shine);

  if (lite) return; // skip particles in lite mode

  const rand = Math.random;

  function edgeSpot() {
    const b = 3 + rand() * 5; // 3–8% from edge
    const p = 4 + rand() * 92;
    switch ((rand() * 4) | 0) {
      case 0: return [p, b];
      case 1: return [p, 100 - b];
      case 2: return [b, p];
      default: return [100 - b, p];
    }
  }

  function perimeterSpot(i, n) {
    const b = 4;
    const w = 100 - b * 2;
    const h = 100 - b * 2;
    let d = ((i + 0.5) / n) * 2 * (w + h);
    if (d < w) return [b + d, b];
    d -= w;
    if (d < h) return [100 - b, b + d];
    d -= h;
    if (d < w) return [100 - b - d, 100 - b];
    d -= w;
    return [b, 100 - b - d];
  }

  // Twinkling 4-point stars on the border ring.
  const starCount = kind === 'xmas' ? 12 + ((rand() * 5) | 0) : 12 + ((rand() * 7) | 0);
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'evx-star';
    const pos = edgeSpot();
    star.style.left = pos[0] + '%';
    star.style.top = pos[1] + '%';
    star.style.setProperty('--evx-s', (7 + rand() * 9).toFixed(1) + 'px');
    star.style.setProperty('--evx-c', t.sparks[(rand() * t.sparks.length) | 0]);
    star.style.setProperty('--evx-dur', (1.6 + rand() * 1.8).toFixed(2) + 's');
    star.style.setProperty('--evx-delay', (-rand() * 2).toFixed(2) + 's');
    star.addEventListener('animationiteration', () => {
      const next = edgeSpot();
      star.style.left = next[0] + '%';
      star.style.top = next[1] + '%';
    });
    el.appendChild(star);
  }

  // Christmas fairy lights in two alternating blink groups.
  if (kind === 'xmas') {
    const fairyN = 14 + ((rand() * 5) | 0);
    const palette = ['#FFD95A', '#FF6B6B', '#7FE3FF', '#FFFFFF'];
    for (let i = 0; i < fairyN; i++) {
      const light = document.createElement('div');
      light.className = 'evx-fairy';
      const pos = perimeterSpot(i, fairyN);
      light.style.left = pos[0] + '%';
      light.style.top = pos[1] + '%';
      light.style.setProperty('--evx-c', palette[i % palette.length]);
      light.style.setProperty('--evx-delay', (i % 2 ? -0.9 : 0) + 's');
      el.appendChild(light);
    }
  }

  // Halloween embers near bottom corners.
  if (kind === 'spooky') {
    for (let i = 0; i < 6; i++) {
      const ember = document.createElement('div');
      ember.className = 'evx-ember';
      ember.style.left = (i < 3 ? 3 + rand() * 15 : 82 + rand() * 15) + '%';
      ember.style.bottom = (3 + rand() * 12) + '%';
      ember.style.setProperty('--evx-dur', (3.4 + rand() * 2).toFixed(2) + 's');
      ember.style.setProperty('--evx-delay', (-rand() * 4).toFixed(2) + 's');
      ember.style.setProperty('--evx-dx', (-12 + rand() * 24).toFixed(1) + 'px');
      el.appendChild(ember);
    }
  }
}
/* Hiệu ứng lễ trao giải cuối trận (DeepSeek viết 2026-11-02): đèn sân khấu quét, pháo hoa, mưa xu + pháo giấy, hào quang hạng nhất, đèn flash, vệt sáng băng rôn khi thắng. Gọi awardFx(#podium, thắng?). */
/* AWFX — award ceremony FX layer for the podium screen */
const AWFX_CSS = `
/* container: sits above .p2bg, below .p2L/.p2R */
#podium > .awx-layer{position:absolute!important;inset:0;overflow:hidden;pointer-events:none;z-index:0;grid-area:auto}
#podium > .awx-gold{position:fixed!important}

/* 1. sweeping stage spotlights */
#podium .awx-beam{position:absolute;top:-18%;height:150%;width:44%;
  transform-origin:50% 0;
  background:linear-gradient(180deg,rgba(255,250,225,.55),rgba(255,226,150,.22) 42%,rgba(255,220,140,0) 76%);
  clip-path:polygon(50% 0%,100% 100%,0% 100%);
  filter:blur(5px);mix-blend-mode:screen;opacity:.75;
  animation:awx-swing 10s ease-in-out infinite alternate;will-change:transform}
@keyframes awx-swing{from{transform:rotate(-13deg)}to{transform:rotate(13deg)}}

/* 2. firework bursts (12 radial sparks via box-shadow, scaled out) */
#podium .awx-fw{position:absolute;width:0;height:0;opacity:0;
  animation:awx-burst 5s ease-out infinite;will-change:transform,opacity}
@keyframes awx-burst{
  0%{transform:scale(.06);opacity:0}
  6%{opacity:1}
  38%{opacity:.95}
  70%{transform:scale(1);opacity:0}
  100%{transform:scale(1);opacity:0}}

/* 3. coin + confetti rain */
#podium .awx-p{position:absolute;top:-6%;will-change:transform;
  animation-name:awx-fall;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes awx-fall{
  0%{transform:translate3d(0,-12vh,0) rotate(0deg);opacity:0}
  8%{opacity:1}
  50%{transform:translate3d(var(--sx,18px),50vh,0) rotate(200deg)}
  88%{opacity:1}
  100%{transform:translate3d(0,108vh,0) rotate(400deg);opacity:0}}
#podium .awx-coin{width:10px;height:10px;border-radius:50%;
  background:radial-gradient(circle at 34% 30%,#fffbe0 0 20%,#ffd34d 42%,#e09a00 100%);
  box-shadow:0 0 8px rgba(255,190,40,.95)}
#podium .awx-conf{width:7px;height:11px;border-radius:2px;box-shadow:0 0 6px rgba(0,0,0,.25)}

/* 4. winner halo + rotating rays */
#podium .awx-halo{position:absolute;z-index:1;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(255,242,175,.95) 0%,rgba(255,205,60,.55) 38%,rgba(255,180,0,0) 70%);
  filter:drop-shadow(0 0 10px rgba(255,200,60,.9));
  animation:awx-pulse 2.1s ease-in-out infinite;will-change:transform,opacity}
@keyframes awx-pulse{0%,100%{transform:scale(.88);opacity:.7}50%{transform:scale(1.08);opacity:1}}
#podium .awx-rays{position:absolute;inset:-18%;border-radius:50%;opacity:.85;
  background:repeating-conic-gradient(from 0deg,rgba(255,228,130,.6) 0deg 7deg,rgba(255,228,130,0) 7deg 22deg);
  -webkit-mask-image:radial-gradient(circle,#000 28%,transparent 68%);
  mask-image:radial-gradient(circle,#000 28%,transparent 68%);
  animation:awx-spin 9s linear infinite;will-change:transform}
@keyframes awx-spin{to{transform:rotate(360deg)}}

/* 5. crowd camera flashes */
#podium .awx-flash{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
  background:radial-gradient(circle,#fff 0 18%,rgba(255,255,255,.65) 38%,rgba(255,255,255,0) 72%);
  opacity:0;animation:awx-pop 3.4s ease-out infinite;will-change:opacity,transform}
@keyframes awx-pop{
  0%,86%{opacity:0;transform:scale(.5)}
  90%{opacity:1;transform:scale(1.15)}
  100%{opacity:0;transform:scale(1.5)}}

/* 6a. banner shine sweep (won only) */
#podium .awx-sheen{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit;z-index:3}
#podium .awx-sheen::after{content:'';position:absolute;top:-25%;left:-45%;width:30%;height:150%;
  background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.92),rgba(255,255,255,0));
  transform:translateX(-200%) skewX(-18deg);
  animation:awx-sheen 3s ease-in-out infinite}
@keyframes awx-sheen{
  0%{transform:translateX(-200%) skewX(-18deg)}
  55%{transform:translateX(560%) skewX(-18deg)}
  100%{transform:translateX(560%) skewX(-18deg)}}

/* 6b. one-shot golden flash */
#podium .awx-gold{position:fixed;inset:0;pointer-events:none;z-index:99;opacity:0;
  mix-blend-mode:screen;
  background:radial-gradient(circle at 50% 45%,rgba(255,246,196,.95),rgba(255,200,60,.75) 45%,rgba(255,170,0,0) 80%);
  animation:awx-gold .65s ease-out 1 forwards}
@keyframes awx-gold{0%{opacity:0}12%{opacity:1}100%{opacity:0}}

/* lite mode: kill motion / particles, keep a static halo */
body.lite #podium .awx-beam,
body.lite #podium .awx-fw,
body.lite #podium .awx-p,
body.lite #podium .awx-flash,
body.lite #podium .awx-sheen,
body.lite #podium .awx-gold,
body.lite #podium .awx-rays{animation:none!important;display:none!important}
body.lite #podium .awx-halo{animation:none!important;transform:scale(.95);opacity:.8}
`;

function awardFx(root, won){
  if(!root || root.dataset.awfx) return;           // idempotent
  root.dataset.awfx = '1';

  if(!document.getElementById('awfx-css')){
    const st = document.createElement('style');
    st.id = 'awfx-css';
    st.textContent = AWFX_CSS;
    document.head.appendChild(st);
  }

  const lite = document.body.classList.contains('lite');
  const rnd = (a,b) => a + Math.random()*(b-a);
  const el  = (c) => { const d = document.createElement('div'); d.className = c; return d; };

  /* ---- 4. halo behind 1st place head (kept even in lite) ---- */
  const r1 = root.querySelector('.pdc.r1');
  const head = r1 && r1.querySelector('.pdh');
  if(r1 && head){
    if(getComputedStyle(r1).position === 'static') r1.style.position = 'relative';
    if(getComputedStyle(head).position === 'static') head.style.position = 'relative';
    head.style.zIndex = '2';                        // halo z-index:1 sits below
    const hr = head.getBoundingClientRect(), pr = r1.getBoundingClientRect();
    const size = Math.max(hr.width, hr.height, 40) * 2.4;
    const halo = el('awx-halo');
    halo.style.width = halo.style.height = size + 'px';
    halo.style.left = (hr.left - pr.left + hr.width/2 - size/2) + 'px';
    halo.style.top  = (hr.top  - pr.top  + hr.height/2 - size/2) + 'px';
    halo.appendChild(el('awx-rays'));
    r1.insertBefore(halo, r1.firstChild);
  }

  if(lite) return;                                  // no particles in lite mode

  /* effects layer: right after the background, under podium + results panel */
  const layer = el('awx-layer');
  const bg = root.querySelector('.p2bg');
  if(bg && bg.parentNode === root) root.insertBefore(layer, bg.nextSibling);
  else root.appendChild(layer);

  /* ---- 1. 4 spotlight cones ---- */
  const beamX = [-8, 10, 46, 64];
  for(let i=0;i<4;i++){
    const b = el('awx-beam');
    b.style.left = beamX[i] + '%';
    b.style.width = (40 + (i%2)*9) + '%';
    b.style.animationDuration = (9 + i*1.9).toFixed(1) + 's';
    b.style.animationDelay = (-i*2.4).toFixed(2) + 's';
    layer.appendChild(b);
  }

  /* ---- 2. 5 firework bursts (12 radial sparks each, one node per burst) ---- */
  const FWC = ['#ffd447','#ff7bd5','#5ce1ff','#a6ff5c','#b98bff'];
  for(let i=0;i<5;i++){
    const f = el('awx-fw'), c = FWC[i], R = rnd(26,40);
    const sh = [];
    for(let k=0;k<12;k++){
      const a = k*Math.PI/6 + rnd(-.08,.08);
      sh.push(`${(Math.cos(a)*R).toFixed(1)}px ${(Math.sin(a)*R).toFixed(1)}px 4px 1.5px ${c}`);
    }
    f.style.boxShadow = sh.join(',');
    f.style.left = rnd(8,88).toFixed(1) + '%';
    f.style.top  = rnd(5,36).toFixed(1) + '%';
    f.style.animationDelay = (-i*1.05).toFixed(2) + 's';
    layer.appendChild(f);
  }

  /* ---- 3. 24 falling coins + confetti ---- */
  const CONFC = ['#ff7bd5','#5ce1ff','#a6ff5c','#ffd447','#b98bff','#ff9f6b','#ffffff'];
  for(let i=0;i<24;i++){
    const coin = i % 3 === 0;
    const p = el(coin ? 'awx-p awx-coin' : 'awx-p awx-conf');
    if(!coin) p.style.background = CONFC[i % CONFC.length];
    p.style.left = rnd(-1,98).toFixed(1) + '%';
    p.style.setProperty('--sx', rnd(-45,45).toFixed(0) + 'px');
    p.style.animationDuration = rnd(3.4,6.5).toFixed(2) + 's';
    p.style.animationDelay = (-rnd(0,7)).toFixed(2) + 's';
    layer.appendChild(p);
  }

  /* ---- 5. 6 crowd camera flashes (bottom 35%, left 60%) ---- */
  for(let i=0;i<6;i++){
    const f = el('awx-flash');
    f.style.left = rnd(2,58).toFixed(1) + '%';
    f.style.top  = rnd(66,94).toFixed(1) + '%';
    f.style.animationDuration = rnd(2.8,4.6).toFixed(2) + 's';
    f.style.animationDelay = (-rnd(0,4)).toFixed(2) + 's';
    layer.appendChild(f);
  }

  /* ---- 6. winner extras ---- */
  if(won){
    root.appendChild(el('awx-gold'));              // one-shot golden flash
    const ban = root.querySelector('.p2ban');
    if(ban){
      if(getComputedStyle(ban).position === 'static') ban.style.position = 'relative';
      ban.appendChild(el('awx-sheen'));            // shine sweep every 3s
    }
  }
}

/* Người chơi máy có tên và ảnh (bản Việt: 100 người, ảnh CC0/public domain từ Openverse + ảnh người Muse tạo). Hiện trên bảng xếp hạng cấp độ/điểm hạng
   và thỉnh thoảng gặp trong ván chơi với máy, ván xếp hạng. Không bấm vào được (không có hồ sơ, không kết bạn).
   BOTPOOL[i] = [tên, cấp gốc, điểm hạng gốc]; ảnh ở BOTPOOL_IMG[i] (build chèn). Số liệu nhích dần theo ngày cho có vẻ đang chơi. */
const BOTPOOL = [["mèo.mập.ú", 9, 286], ["Cún Bông 🐶", 15, 238], ["thuhuong.2k3", 9, 260], ["Tỷ Phú Tương Lai", 15, 300], ["phở.bò.tái.chín", 5, 94], ["Gió Đà Lạt", 14, 262], ["bé.na_ngáo", 9, 322], ["Hoàng Phúc", 11, 95], ["trùm.đất.quận.7", 3, 228], ["Sương Mai 🌸", 6, 72], ["anh.ba.miền.tây", 3, 275], ["Khánh Vy", 14, 355], ["lười.nhưng.giàu", 12, 21], ["Bánh Mì Pate", 11, 202], ["ngủ.nướng.pro", 9, 334], ["Minh Khang 99", 13, 315], ["cô.út.cần.thơ", 12, 80], ["Hà My", 11, 7], ["đại.gia.chân.đất", 15, 270], ["nắng.hạ.vàng", 3, 30], ["Tuấn Kiệt", 2, 97], ["ghiền.cà.phê.sữa", 16, 123], ["Gấu Mèo Lầy", 11, 15], ["linhdan_99", 14, 237], ["mua.đất.để.đó", 7, 225], ["Quỳnh Như", 11, 100], ["thánh.đổ.xúc.xắc", 10, 119], ["Bông Lúa Vàng", 12, 150], ["đức.anh.2004", 9, 2], ["Út Đậu", 12, 43], ["trà.sữa.full.topping", 9, 335], ["Hoa Hướng Dương", 6, 208], ["gia.huy.bđs", 10, 42], ["Mây Lang Thang", 13, 130], ["con.nợ.ngân.hàng", 7, 117], ["Ngọc Hân", 10, 147], ["hên.xui.tại.trời", 2, 35], ["thanh.tâm_", 11, 55], ["Chó Shiba Lầy", 8, 55], ["bảo.anh.real", 15, 148], ["Sen Hồ Tây", 8, 34], ["người.miền.núi", 2, 350], ["Lan Anh 🍀", 2, 109], ["xe.ôm.công.nghệ", 5, 26], ["Bích Phương Thảo", 9, 192], ["hay.ngồi.sân.bay", 13, 203], ["Trâu Cày Thuê", 8, 37], ["an.nhiên.tự.tại", 11, 322], ["Phạm Thu Trang", 5, 345], ["bạn.thân.của.mèo", 6, 172], ["Hữu Lộc", 3, 159], ["đi.đâu.cũng.vào.tù", 7, 7], ["Tiểu Thư Hà Nội", 8, 60], ["quang.vinh.2k1", 4, 126], ["Cỏ Ba Lá", 13, 51], ["tỷ.phú.bất.đắc.dĩ", 2, 30], ["Mai Phương", 9, 249], ["gà.rán.giòn.rụm", 4, 349], ["Đen Thôi Đỏ Quên Đi", 10, 96], ["hoài.nam_sg", 9, 260], ["Thỏ Ngọc", 5, 374], ["cày.rank.xuyên.đêm", 14, 67], ["Diệu Linh", 8, 329], ["bánh.tráng.trộn", 8, 59], ["Mèo Cam Biết Tuốt", 8, 215], ["việt.hoàng.88", 5, 0], ["Cánh Đồng Gió", 6, 303], ["người.lạ.ơi", 6, 10], ["Kim Ngân", 5, 95], ["thích.là.nhích", 8, 308], ["Trúc Xinh", 12, 295], ["huy.hoàng.bất.động.sản", 3, 21], ["Bé Mít", 4, 109], ["đường.về.nhà.xa", 9, 132], ["Phương Uyên", 2, 312], ["chủ.trọ.khó.tính", 7, 151], ["Hạt Tiêu Nhỏ", 8, 37], ["lữ.khách.sapa", 3, 46], ["Bảo Ngọc", 5, 298], ["góc.phố.hội.an", 12, 124], ["Nhật Minh", 2, 307], ["cún.con_xíu", 7, 190], ["Sóc Nâu", 11, 232], ["chill.cuối.tuần", 4, 300], ["Thùy Dung", 9, 294], ["đánh.là.thắng", 4, 197], ["Củ Cải Đường", 4, 321], ["minhthu.dalat", 4, 159], ["Ông Trùm Nhỏ", 16, 116], ["lặng.lẽ.nổ.hũ", 15, 312], ["Hồng Nhung", 5, 371], ["sinh.viên.nghèo", 5, 81], ["Vịt Bầu", 13, 322], ["tâm.an_", 10, 100], ["Ngân Hà", 12, 198], ["xứ.dừa.bến.tre", 16, 247], ["Hải Đăng", 11, 40], ["ăn.gì.cũng.béo", 8, 24], ["Tùng Lâm", 3, 55], ["may.mắn.lắm.nha", 2, 262], ["khoa.pug", 3, 10], ["Nguyễn Hải Yến", 2, 42], ["bé.bơ.2k6", 3, 32], ["trùm.cuối.xóm", 3, 38], ["Thanh Hằng 💫", 3, 13], ["ông.chủ.tiệm.nét", 2, 22], ["Văn Toàn 10", 3, 5], ["mỡ.hành.chan.cơm", 2, 44], ["Cẩm Ly", 3, 6], ["lão.nông.tri.điền", 2, 10], ["bà.tám.chợ.lớn", 3, 31], ["Quốc Bảo", 2, 37], ["ngố.tàu", 3, 27], ["Kiều Oanh", 2, 18], ["dân.chơi.hệ.lúa", 2, 42], ["Hồng Đào", 3, 16], ["tèo.em.vũng.tàu", 2, 28], ["Đức Mạnh", 3, 41], ["cá.mập.bất.động.sản", 3, 25], ["Thu Thảo", 2, 35], ["ve.sầu.mùa.hạ", 2, 35], ["Gia Bảo 2k2", 3, 15], ["chị.hai.bán.chè", 2, 16], ["Minh Tuấn", 3, 38], ["thằng.cuội.cung.trăng", 2, 42], ["Tường Vi", 2, 10], ["heo.con.ham.ăn", 2, 32], ["Duy Khánh", 2, 41], ["bé.su.su", 3, 41], ["Phương Nam", 3, 42], ["trà.đá.vỉa.hè", 3, 11], ["Lê Hoàng Long", 3, 23], ["nàng.thơ.phố.núi", 3, 34], ["Quang Huy", 2, 21], ["đầu.bếp.mì.tôm", 2, 11], ["Như Quỳnh", 2, 36], ["chàng.trai.năm.ấy", 2, 26], ["Thùy Linh 🌷", 2, 42], ["bác.tư.bán.vé.số", 2, 29], ["Hữu Nghĩa", 2, 33], ["mây.trắng.bay", 2, 8], ["Tiến Dũng", 3, 30], ["cô.ba.sài.gòn", 2, 15], ["Bảo Trâm", 2, 5], ["sói.già.cô.đơn", 2, 8], ["Xuân Mai", 3, 10], ["anh.thợ.điện", 3, 6], ["Phúc Hậu", 3, 36], ["cháo.lòng.đêm.khuya", 2, 7], ["Trà My", 2, 21], ["nhà.nghèo.vượt.khó", 3, 40], ["Thành Đạt", 2, 34], ["gấu.trắng.bắc.cực", 3, 18], ["Mỹ Duyên", 2, 11], ["ốc.len.ton.ten", 2, 39], ["Đăng Khoa", 2, 21], ["cơm.tấm.sườn.bì", 2, 31], ["Hạ Vy", 2, 5], ["người.đi.trong.mưa", 3, 26], ["Chí Thanh", 3, 15], ["vợ.cấm.chơi.game", 3, 9], ["Ngọc Trinh 98", 2, 39], ["ông.già.noel.fake", 3, 32], ["Hoài Linh", 3, 24], ["lúa.non.miền.bắc", 2, 23], ["Diễm Quỳnh", 2, 6], ["bé.heo.mũm.mĩm", 2, 26], ["Trung Kiên", 3, 20], ["mắm.tôm.hà.nội", 2, 10], ["Yến Nhi", 3, 40], ["chú.ba.xe.ba.gác", 2, 20], ["Việt Anh", 3, 33], ["sầu.riêng.ri6", 3, 5], ["Lam Phương", 3, 29], ["thỏ.bảy.màu", 2, 14], ["Công Phượng fan", 3, 18], ["hút.vía.may.mắn", 2, 16], ["Bích Ngọc", 3, 32], ["tôm.hùm.đất", 2, 31], ["Gia Hân", 3, 35], ["học.sinh.cá.biệt", 2, 38], ["Thế Anh", 3, 21], ["chè.thái.sầu.riêng", 2, 19], ["Ánh Dương", 2, 36], ["kẻ.mộng.mơ", 3, 6], ["Hữu Tài", 3, 43], ["sữa.chua.nếp.cẩm", 3, 23], ["Tố Uyên", 3, 31], ["bãi.biển.mỹ.khê", 3, 24], ["Đình Trọng", 3, 26], ["mèo.hoang.phố.cổ", 2, 29], ["Thu Hà 1995", 2, 31], ["nồi.cơm.điện", 3, 40], ["Kim Chi", 3, 39], ["dì.ghẻ.lạnh.lùng", 3, 10], ["Hoàng Yến", 3, 18], ["ổi.xanh.chấm.muối", 3, 14], ["Bảo Long", 3, 12], ["bánh.xèo.miền.tây", 3, 12], ["Ngọc Ánh", 3, 41]];   // bản Việt: 100 người chơi máy (tên kiểu nick), cấp và điểm hạng thấp, leo dần
const BOTPA = {};        // tên bot trong ván → ảnh
function botDay(){ return Math.floor(Date.now() / 864e5) - 20759; }   // 0 = ngày 02/11/2026
function botRows(key){   // dòng cho bảng xếp hạng: key 'lv' hoặc 'rp'
  const d = Math.max(0, botDay());
  return BOTPOOL.map((b, i) => { const g = ((i * 37) % 11) + 3;    // mỗi bot lên cấp/điểm với nhịp riêng
    const v = key==='lv' ? 2 + ((i + d + g) % 2) : 5 + ((i * 13 + d * g) % 41);   /* bản Việt: cấp 2-3, điểm hạng 5-45 để người chơi thật đứng trên */
    return {id:'', n:b[0], k:i % 7, ft:'', v, at:0, pa:BOTPOOL_IMG[i] || ''}; });
}
function botPick(n, avoid){   // chọn n bot ngẫu nhiên, khác tên trong avoid
  const ids = BOTPOOL.map((b, i) => i).filter(i => !(avoid || []).includes(BOTPOOL[i][0]));
  for(let i=ids.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, n).map(i => { BOTPA[BOTPOOL[i][0]] = BOTPOOL_IMG[i] || ''; return BOTPOOL[i][0]; });
}
function botFill(cfg){   // ván chơi với máy: máy còn tên mặc định "Bot k" thì 60% đổi thành một người chơi trong danh sách
  const used = cfg.map(c => c.name);
  return cfg.map(c => { if(!c.bot || !/^(Bot|Máy) \d$/.test(c.name) || Math.random() > .6 || !BOTPOOL.length) return c;
    const n = botPick(1, used)[0]; used.push(n); return Object.assign({}, c, {name:n}); });
}
function botMatchNames(list){   // ván xếp hạng: mỗi đối thủ 50% là người chơi trong danh sách
  const used = list.slice();
  return list.map(n => { if(Math.random() > .5 || !BOTPOOL.length) return n; const b = botPick(1, used)[0]; used.push(b); return b; });
}
const LIFECHAT = [["Hôm nay ai đi làm về mệt không?", "Mệt xỉu, nhưng thấy đất rẻ là tỉnh liền"], ["Ăn trưa món gì vậy mọi người?", "Bún chả, ngon bá cháy"], ["Ủa trời mưa kìa", "Mưa vậy ở nhà chơi game là chuẩn"], ["Cuối tuần định đi đâu chơi không?", "Chắc về quê thăm ông bà"], ["Nhà mình mới nuôi con mèo", "Mèo gì vậy, gửi hình xem với"], ["Mai thi mà tui còn ngồi đây", "Chơi xong ván này rồi học nha"], ["Tháng này tiền điện cao quá", "Ngoài đời cũng bị cắt điện nước luôn hả 😂"], ["Tối qua coi bóng đá không?", "Coi chứ, thua tiếc ghê"], ["Đói bụng quá", "Ván này xong rồi đi ăn bánh mì"], ["Cà phê sữa đá là chân ái", "Đồng ý, ngày 2 ly"], ["Sắp Tết rồi đó", "Lo tiền thưởng Tết trước đã"], ["Xúc xắc hôm nay ổn áp ghê", "Bạn nói vậy là lát gieo ra 2 cho coi"], ["Ai chơi vui quá đi", "Chơi tiếp ván nữa không?"], ["Tui mới mua đất ngoài đời nè", "Thật hả, chỗ nào vậy, giàu quá"], ["Buồn ngủ quá trời", "Ráng thêm mấy vòng nữa"], ["Hôm nay sinh nhật tui đó", "Chúc mừng sinh nhật nha 🎂"], ["Đang kẹt xe mà vẫn ráng chơi", "Coi chừng lỡ trạm đó"], ["Con nít nhà bên ồn ghê", "Đeo tai nghe vô chơi tiếp"]];
function lifeChat(){   // máy hỏi một câu đời thường, máy khác đáp lại
  if(HEADLESS || !S || S.over || PAUSED || !document.body.classList.contains('ingame')) return; const B = S.players.filter(p => p.bot && p.alive); if(!B.length || Math.random() > .55) return;
  const c = LIFECHAT[rnd(LIFECHAT.length)], a = B[rnd(B.length)]; say(a, c[0], false); const o = B.filter(p => p !== a);
  if(o.length) setTimeout(() => { if(S && !S.over) say(o[rnd(o.length)], c[1], false); }, 2500 + Math.random()*2500); }
if(typeof document !== 'undefined') setInterval(lifeChat, 21000);
const BOTRE = [{"re": "(?:^|[\\s,.!?])(?:cảm ơn|cám ơn|thanks|tks|thank)", "a": ["Có gì đâu", "Ok ok", "Hì hì", "Khách sáo dữ", "Chuyện nhỏ"]}, {"re": "(?:^|[\\s,.!?])(?:chào|hello|hế lô|helo|hi|alo|xin chào|hú)(?=$|[\\s,.!?])", "a": ["Ê chào {me} 👋", "Hú {me}, nay rảnh dữ ha", "Chào nha, vô làm ván đi", "Alo alo nghe rõ", "Hế lô, ăn cơm chưa?", "Ờ chào, mới on hả"], "f": ["Nay chơi được ván nào chưa?", "Hạng gì rồi đó?"]}, {"re": "(?:ai chơi|vào chơi|vô chơi|rủ|làm ván|làm 1 ván|chơi không|chơi ko|chơi hông|chơi k$|1 ván|một ván|lập phòng|tạo phòng)", "a": ["Tui nè, chơi liền", "Rủ tui đi, đang chán", "Ok vô liền, đợi tui xíu", "Chơi thì chơi sợ gì 😤", "Cho tui theo với"], "tag": "play"}, {"re": "(?:kết bạn|(?:^|[\\s,.!?])kb(?=$|[\\s,.!?])|add fr|làm bạn|add tui|add mình)", "a": ["Kết bạn đi, tui gửi rồi đó", "Ok gửi lời mời rồi nha, bấm đồng ý đi", "Kb đi rồi hôm nào rủ nhau leo rank"], "tag": "friend"}, {"re": "(?:mấy tuổi|bao nhiêu tuổi|tuổi gì|năm sinh|sinh năm)", "a": ["Tui 2k3 nè", "Già rồi, 9x đời đầu 😂", "Mới 2k5 thôi", "2k1, còn ông?", "Hỏi tuổi chi, tính làm mai hả 😏"]}, {"re": "(?:ở đâu|quê đâu|chỗ nào|tỉnh nào|ở tỉnh)", "a": ["Tui ở Cần Thơ nè", "Hà Nội nha", "Sài Gòn, kẹt xe muốn xỉu", "Đà Nẵng nè, biển đẹp lắm", "Quê Nghệ An, đang ở Bình Dương", "Huế, mưa suốt"], "f": ["Còn ông ở đâu?"]}, {"re": "(?:tên gì|tên thật|tên là gì)", "a": ["Tên trên nick đó 😂", "Gọi tui là trùm cũng được", "Bí mật nha"]}, {"re": "(?:trai hay gái|nam hay nữ|con trai hả|con gái hả)", "a": ["Đoán đi 😏", "Hỏi chi vậy 😂", "Bí mật quốc gia"]}, {"re": "(?:(?:^|[\\s,.!?])bot(?=$|[\\s,.!?])|máy hả|người thật|có phải người)", "a": ["Ủa hỏi chi vậy 😂", "Chơi đi hỏi hoài", "Bot gì mà cãi lộn được như tui", "Nghi ngờ dữ vậy 😤"]}, {"re": "(?:ngủ đây|bye|bai bai|(?:^|[\\s,.!?])out(?=$|[\\s,.!?])|đi đây|off đây|đi ngủ|ngủ ngon)", "a": ["Ngủ ngon nha", "Bye bye, mai chơi tiếp", "Đi đâu vậy, đang vui mà", "Ok mai on nha"]}, {"re": "(?:(?:^|[\\s,.!?])gà(?=$|[\\s,.!?])|(?:^|[\\s,.!?])ngu(?=$|[\\s,.!?])|dở ẹc|óc chó|(?:^|[\\s,.!?])non(?=$|[\\s,.!?])|ngáo)", "a": ["Nói ai gà đó 😤", "Gà mà thắng mới ghê", "Từ từ coi ai gà", "Ủa đụng chạm dữ vậy 😂", "Vô ván đi rồi biết ai non"]}, {"re": "(?:người yêu|(?:^|[\\s,.!?])ny(?=$|[\\s,.!?])|crush|thất tình|(?:^|[\\s,.!?])ế(?=$|[\\s,.!?])|độc thân|yêu đương|tán gái|tán trai)", "a": ["Ế mấy năm rồi nè 😭", "Có người yêu mà chơi game suốt bị chửi hoài", "Crush seen không rep, thôi chơi game", "Yêu chi cho mệt, mua đất sướng hơn"], "f": ["Ông có ny chưa?"]}, {"re": "(?:bóng đá|đá banh|đá bóng|world cup|(?:^|[\\s,.!?])mu(?=$|[\\s,.!?])|messi|ronaldo|tuyển việt nam|(?:^|[\\s,.!?])aff(?=$|[\\s,.!?])|ngoại hạng)", "a": ["Tối qua coi mà tức, thua phút chót", "Tuyển mình đá hay mà xui", "Messi là nhất, cãi đi", "Ronaldo mới là GOAT nha"], "f": ["Ông fan đội nào?"]}, {"re": "(?:nhạc|bài hát|nghe gì|sơn tùng|(?:^|[\\s,.!?])mtp(?=$|[\\s,.!?])|đen vâu|kpop|blackpink|bts|rap việt)", "a": ["Đang nghe Đen Vâu nè", "Sơn Tùng ra bài mới chưa ta", "Nghe nhạc lofi cày rank chill lắm", "Bật bolero cho máu mua đất 😂"], "f": ["Ông nghe nhạc gì?"]}, {"re": "(?:phim|netflix|coi gì|xem gì|anime|tiktok|youtube)", "a": ["Mới coi xong bộ phim Hàn, khóc sưng mắt", "Lướt tiktok tới 2h sáng nè", "Anime thì One Piece muôn năm", "Netflix hết phim hay rồi"], "f": ["Có phim gì hay chỉ với?"]}, {"re": "(?:(?:^|[\\s,.!?])sếp(?=$|[\\s,.!?]))", "a": ["Sếp nào cũng vậy, kệ ổng", "Sếp tui còn khó hơn, ngày nào cũng họp", "Nghỉ việc mở công ty trong game làm sếp luôn 😂"]}, {"re": "(?:tăng ca|công ty|đi làm|lương|deadline|họp)", "a": ["Sếp tui khó ở lắm", "Deadline dí mà vẫn ráng 1 ván", "Lương về 3 ngày là hết 😭", "Đi làm về mệt mà thấy game là tỉnh"], "f": ["Ông làm nghề gì?"]}, {"re": "(?:(?:^|[\\s,.!?])học(?=$|[\\s,.!?])|(?:^|[\\s,.!?])thi(?=$|[\\s,.!?])|bài tập|thầy|cô giáo|điểm thi|ôn thi|sinh viên)", "a": ["Mai thi mà nay vẫn ngồi đây 😭", "Học hành gì, mua đất trước đã", "Bài tập chất đống luôn", "Thi xong rồi, giờ chơi bù"], "f": ["Học năm mấy rồi?"]}, {"re": "(?:du lịch|đi chơi|đà lạt|vũng tàu|phú quốc|nha trang|đi biển|sa pa|hội an)", "a": ["Đà Lạt mùa này lạnh mà đẹp lắm", "Muốn đi biển quá trời", "Đi du lịch trong game cho đỡ tốn tiền 😂", "Tết này định đi Phú Quốc"], "f": ["Ông thích đi đâu nhất?"]}, {"re": "(?:(?:^|[\\s,.!?])chó(?=$|[\\s,.!?])|(?:^|[\\s,.!?])mèo(?=$|[\\s,.!?])|(?:^|[\\s,.!?])cún(?=$|[\\s,.!?])|thú cưng|(?:^|[\\s,.!?])boss(?=$|[\\s,.!?]))", "a": ["Mèo nhà tui vừa đạp đổ ly nước", "Tui nuôi 2 bé cún, phá dữ lắm", "Boss nằm đè lên điện thoại không cho chơi nè", "Mèo là chân ái"], "f": ["Ông nuôi con gì?"]}, {"re": "(?:mưa|bão|ngập)", "a": ["Mưa quá trời, ở nhà chơi game thôi", "Chỗ tui cũng mưa, ngập tới mắt cá", "Mưa vầy nằm nhà mua đất là chuẩn", "Bão về rồi, nhớ cẩn thận nha"], "f": ["Chỗ ông ngập không?"]}, {"re": "(?:nắng|(?:^|[\\s,.!?])nóng(?=$|[\\s,.!?])|oi bức)", "a": ["Nóng muốn chảy mỡ", "Bật quạt max số mà vẫn nóng", "Nắng vầy chỉ muốn uống trà đá"]}, {"re": "(?:(?:^|[\\s,.!?])lạnh(?=$|[\\s,.!?])|rét|thời tiết|(?:^|[\\s,.!?])trời(?=$|[\\s,.!?]))", "a": ["Trời lạnh nằm chăn chơi là sướng nhất", "Lạnh run mà vẫn ráng gieo", "Thời tiết thất thường ghê"], "f": ["Chỗ ông lạnh không?"]}, {"re": "(?:mẹ|(?:^|[\\s,.!?])ba(?=$|[\\s,.!?])|bố|(?:^|[\\s,.!?])vợ(?=$|[\\s,.!?])|chồng|con nít|em bé|gia đình)", "a": ["Mẹ kêu đi ngủ mà còn mấy vòng", "Vợ cấm chơi mà lén chơi nè 🤫", "Con nít nhà bên ồn ghê", "Gia đình là số 1, rồi tới game"]}, {"re": "(?:ốm|bệnh|đau|sốt|cảm cúm|ho)", "a": ["Uống thuốc rồi nghỉ ngơi đi", "Bệnh mà còn chơi, ráng giữ sức nha", "Tui cũng đang cảm nè, mũi nghẹt"]}, {"re": "(?:kẹt xe|(?:^|[\\s,.!?])xe(?=$|[\\s,.!?])|xe buýt|grab)", "a": ["Kẹt xe muốn xỉu", "Ngồi xe buýt làm 1 ván cho đỡ chán", "Grab nay tăng giá quá trời"]}, {"re": "(?:liên quân|free fire|pubg|(?:^|[\\s,.!?])lol(?=$|[\\s,.!?])|tốc chiến|genshin)", "a": ["Liên quân hồi trước tui cày dữ lắm", "Bỏ game kia rồi, giờ chỉ mua đất", "Game đó toxic quá, chơi cái này hiền hơn 😂"]}, {"re": "(?:thua|phá sản|(?:^|[\\s,.!?])xui(?=$|[\\s,.!?])|toang|mất hết|cháy túi|bị siết|vỡ nợ)", "a": ["Thôi kệ, ván sau gỡ", "Xúc xắc nó ghét ông rồi 😂", "Toang thì làm lại, có gì đâu", "Tui cũng mới phá sản nè, đồng bệnh tương lân"], "f": ["Thua ai vậy?"]}, {"re": "(?:thắng|(?:^|[\\s,.!?])win(?=$|[\\s,.!?])|nổ hũ|top 1|về nhất|lên hạng|lên rank|giàu rồi)", "a": ["Ghê vậy, cho xin vía 🍀", "Khao đi chứ", "Ăn may thôi chứ gì 😏", "Giỏi quá ta, chỉ tui với"], "f": ["Mua ô nào mà thắng vậy?"]}, {"re": "(?:haha|hihi|(?:^|[\\s,.!?])kk|=\\)\\)|😂|🤣|(?:^|[\\s,.!?])lol(?=$|[\\s,.!?])|vãi|(?:^|[\\s,.!?])hài(?=$|[\\s,.!?]))", "a": ["😂😂😂", "Cười té ghế", "Haha mắc cười ghê", "kkk", "Cười xỉu"]}, {"re": "(?:xúc xắc|gieo|đổ hột|lắc)", "a": ["Gieo lẹ lên trời", "Xúc xắc nay hên xui lắm", "Thổi vô cái rồi gieo", "Ra đôi đi ra đôi đi"]}, {"re": "(?:(?:^|[\\s,.!?])tù(?=$|[\\s,.!?])|đảo hoang|(?:^|[\\s,.!?])đảo(?=$|[\\s,.!?])|cảnh sát)", "a": ["Vô tù ngồi chơi xíu", "Ở đảo hoài vậy trời", "Ngồi tù cho đỡ tốn tiền thuê 😂", "Kéo người khác vô đảo chung cho vui"]}, {"re": "(?:sân bay|máy bay|(?:^|[\\s,.!?])bay(?=$|[\\s,.!?]))", "a": ["Có 3 sân bay là bay đâu cũng được", "Gom đủ 4 sân bay là bay mỏi cánh luôn", "Sân bay đắt mà đáng tiền"]}, {"re": "(?:startup|(?:^|[\\s,.!?])quỹ(?=$|[\\s,.!?])|nổ hũ|đầu tư)", "a": ["Startup hên thì lời to, xui thì bay màu", "Quỹ nổ hũ một lần là giàu luôn", "Đầu tư là phải liều"]}, {"re": "(?:(?:^|[\\s,.!?])thuế(?=$|[\\s,.!?]))", "a": ["Đóng thuế mà xót cả ruột", "Né ô thuế ra, 10% tiền mặt đó", "Thuế ngoài đời chưa đủ hay sao 😂"]}, {"re": "(?:(?:^|[\\s,.!?])vay(?=$|[\\s,.!?])|ngân hàng|(?:^|[\\s,.!?])nợ(?=$|[\\s,.!?])|thế chấp)", "a": ["Vay ít thôi, trả không kịp là bị siết", "Vay ngân hàng mua đất, lời thì trả", "Nợ như chúa chổm rồi nè"]}, {"re": "(?:huy hiệu|nhóm màu|gom đủ|đủ bộ)", "a": ["Gom đủ nhóm màu là có huy hiệu, lời lắm", "2 huy hiệu là thắng sớm luôn đó", "Gom nhóm rẻ trước, dễ đủ hơn"]}, {"re": "(?:(?:^|[\\s,.!?])rank(?=$|[\\s,.!?])|(?:^|[\\s,.!?])hạng(?=$|[\\s,.!?])|leo rank|xếp hạng|(?:^|[\\s,.!?])đồng(?=$|[\\s,.!?])|(?:^|[\\s,.!?])bạc(?=$|[\\s,.!?])|(?:^|[\\s,.!?])vàng(?=$|[\\s,.!?])|bạch kim|kim cương hạng|huyền thoại)", "a": ["Kẹt Đồng cả tuần rồi 😭", "Đấu đôi leo rank nhanh hơn", "Lên Vàng là có bảng tên Cúp Vàng đó", "Rank tuần này khó ghê"], "f": ["Ông hạng gì rồi?"]}, {"re": "(?:sự kiện|(?:^|[\\s,.!?])event(?=$|[\\s,.!?])|điểm danh|quà tặng|nhiệm vụ)", "a": ["Nhớ điểm danh mỗi ngày, quà ngon lắm", "Sự kiện này được quà xịn đó", "Làm nhiệm vụ ngày lấy xu nè"]}, {"re": "(?:kim cương|(?:^|[\\s,.!?])nạp(?=$|[\\s,.!?])|cửa hàng|trang phục|bảng tên|(?:^|[\\s,.!?])skin(?=$|[\\s,.!?])|đồ mới)", "a": ["Bảng tên Dải ngân hà đẹp xỉu", "Tui mua trang phục mới rồi nè", "Xem video lấy kim cương cũng được", "Tiết kiệm xu mua Rồng nè"]}, {"re": "(?:(?:^|[\\s,.!?])đất(?=$|[\\s,.!?])|mua ô|(?:^|[\\s,.!?])nhà(?=$|[\\s,.!?])|(?:^|[\\s,.!?])xây(?=$|[\\s,.!?])|tiền thuê|cao ốc|ô nào|hoàn kiếm|nguyễn huệ|hạ long|đà nẵng)", "a": ["Đất đó ngon, mua đi", "Có tiền thì xây liền, chần chừ là mất", "Ô đó thuê cao lắm, né ra", "Mua đất như mua rau vậy 😂", "Hoàn Kiếm với Nguyễn Huệ là đắt nhất"]}, {"re": "(?:ăn|uống|nhậu|thèm)\\s+([^\\s,.!?]+(?:\\s[^\\s,.!?]+)?)", "a": ["{1} ngon không?", "Tui cũng thèm {1} quá", "{1} hả, rủ tui với", "{1} mà không rủ 😤"], "f": ["Ăn ở đâu vậy?"]}, {"re": "(?:đói|cơm|bún|phở|cà phê|trà sữa|bánh mì|mì gói|ăn sáng|ăn trưa|ăn tối)", "a": ["Đói quá, xong ván này đi ăn", "Tui đang ăn mì gói nè", "Cà phê vô là tỉnh liền", "Rủ tui ăn với", "Trà sữa full topping mới chịu"], "f": ["Ăn gì chưa?"]}, {"re": "(?:buồn ngủ|(?:^|[\\s,.!?])mệt(?=$|[\\s,.!?])|thức khuya|mất ngủ)", "a": ["Mệt thì nghỉ, mai chơi tiếp", "Ráng thêm ván nữa rồi ngủ", "Tui cũng thức khuya nè, mai đi làm toang"]}, {"re": "(?:buồn|chán|cô đơn|stress|áp lực)", "a": ["Buồn thì vô chơi với tui", "Chán thì kiếm đất mua cho vui", "Có tui đây nè", "Stress thì mua cao ốc xả stress 😂"], "f": ["Có chuyện gì vậy?"]}, {"re": "(?:tiền|nghèo|(?:^|[\\s,.!?])giàu(?=$|[\\s,.!?])|hết tiền)", "a": ["Ngoài đời nghèo, trong game phải giàu", "Hết tiền thì bán đất", "Giàu trong game thôi chứ ngoài đời rỗng túi 😂"]}, {"re": "(?:\\?|(?:^|[\\s,.!?])sao(?=$|[\\s,.!?])|(?:^|[\\s,.!?])gì(?=$|[\\s,.!?])|(?:^|[\\s,.!?])nào(?=$|[\\s,.!?])|hông$|không$|ko$)", "a": ["Hông biết nữa 😅", "Hỏi khó dữ", "Chắc vậy á", "Tui cũng đang thắc mắc nè", "Hỏi cao thủ đi chứ hỏi tui chi 😂", "Để tui nghĩ đã"]}], BOTFB = ["Ừa", "Chuẩn luôn", "Nói chí phải", "Haha thiệt hả", "Thôi chơi đi nói hoài", "Ờ ờ", "Nghe cũng được", "Rồi sao nữa 😂", "Đúng rồi đó", "Vậy hả", "Ủa thiệt luôn", "Nghe hợp lý"];
function botMe(){ try { return (STORE.name && STORE.name!=='Bạn') ? STORE.name : 'bạn'; } catch(e) { return 'bạn'; } }
const botSmartReply = (text, where) => {   /* trả lời theo ý câu (nhiều chủ đề), nhắc lại chữ người nói, đôi khi hỏi lại (follow); tag: play = rủ chơi, friend = kết bạn */
  const t = String(text || '').toLowerCase().trim(); let hit = null, mm = null;
  for(let i=0; i<BOTRE.length && !hit; i++){ const m = t.match(new RegExp(BOTRE[i].re, 'i')); if(m){ hit = BOTRE[i]; mm = m; } }
  const L = hit ? hit.a : BOTFB, cap = mm && mm[1] ? mm[1].replace(/\s+(không|ko|hông|chưa|nha|nhé|đi|với|hả|hem|hông|k)$/i, '').trim().slice(0, 20) : '';
  let out = L[Math.floor(Math.random()*L.length)].replace('{me}', botMe());
  if(out.includes('{1}')) out = cap ? out.replace(/\{1\}/g, cap).replace(/^./, c => c.toUpperCase()) : BOTFB[Math.floor(Math.random()*BOTFB.length)];
  const fl = hit && hit.f && Math.random() < .4 ? hit.f[Math.floor(Math.random()*hit.f.length)] : '';
  return {text: out, follow: fl, play: !!hit && hit.tag==='play', friend: !!hit && hit.tag==='friend'}; };
/* mỗi người chơi máy một giọng riêng (cố định theo tên): teen, miền Nam, miền Bắc, cộc lốc, lầy, dễ thương, từ tốn; thỉnh thoảng gõ nhầm */
const BSTY = ['teen','nam','bac','coc','lay','cute','chill'];
function botStyle(name){ let h = 7; for(const c of String(name)) h = (h*31 + c.charCodeAt(0)) % 9973; return BSTY[h % BSTY.length]; }
const BWR = (t, a, b) => t.replace(new RegExp('(^|[\\s,.!?])' + a + '(?=$|[\\s,.!?])', 'gi'), '$1' + b);
const lc1 = t => t.charAt(0).toLowerCase() + t.slice(1);
/* thêm chữ đuôi: không thêm khi câu đã có đuôi (ha, nha, nè, á, đó...), chèn trước biểu tượng cảm xúc ở cuối câu; không chồng 2 biểu tượng */
const BEMO = /(\s*(?:\p{Extended_Pictographic}\uFE0F?)+)$/u, BPART = /(ha|nha|nhé|nè|á|đó|đấy|vậy|thế|z|hả|ơi|không|ko|hông|đi|nhaa|hihi|kkk|ạ)$/i;
const btail = (t, x) => { const m = t.match(BEMO), body = m ? t.slice(0, m.index) : t, emo = m ? m[1] : '';
  if(/^\s*\p{Extended_Pictographic}/u.test(x)) return emo ? t : t + x; if(/[?]\s*$/.test(body) || BPART.test(body.replace(/[.!…]+$/, '').trim())) return t; return body + x + emo; };
/* xưng hô riêng từng máy: tui/ông, tao/mày, tôi/bạn, tớ/cậu, mình/bà, t/m; giữ nguyên 'kết bạn', 'bạn bè' */
const BPRN = [['tui','ông'],['tao','mày'],['tôi','bạn'],['tớ','cậu'],['mình','bà'],['t','m'],['tui','bà'],['tao','mày']];
const bprn = name => { let h = 3; for(const c of String(name)) h = (h*17 + c.charCodeAt(0)) % 7919; return BPRN[h % BPRN.length]; };
const bswap = (t, re, to) => t.replace(re, (m, a, w, off, str) => { const pre = str.slice(Math.max(0, off - 5), off + a.length).toLowerCase(), post = str.slice(off + m.length, off + m.length + 3).toLowerCase();
  if(/kết\s*$/.test(pre) || post===' bè') return m; const up = w[0]!==w[0].toLowerCase(); return a + (up ? to[0].toUpperCase() + to.slice(1) : to); });
const botStyleText = (name, text) => { let t = String(text || ''); if(!t) return t; const s = botStyle(name), r = Math.random;
  { const P = bprn(name); t = bswap(t, /(^|[\s,.!?@])(tui|tôi|mình|tớ)(?=$|[\s,.!?])/gi, P[0]); t = bswap(t, /(^|[\s,.!?@])(bạn|ông|cậu|mày)(?=$|[\s,.!?])/gi, P[1]); }
  if(s==='teen'){ t = BWR(t,'không','ko'); t = BWR(t,'hông','ko'); t = BWR(t,'vậy','z'); t = BWR(t,'gì','j'); t = BWR(t,'được','dc'); t = BWR(t,'biết','bít'); t = t.toLowerCase(); if(r() < .35) t = btail(t, ' 😝'); }
  else if(s==='nam'){ t = BWR(t,'không','hông'); t = BWR(t,'nhé','nha'); t = BWR(t,'thế','vậy'); if(r() < .4) t = btail(t, r() < .5 ? ' nè' : ' á'); if(r() < .18) t = 'Trời ơi, ' + lc1(t); }
  else if(s==='bac'){ t = BWR(t,'hông','không'); t = BWR(t,'nha','nhé'); t = BWR(t,'vậy','thế'); t = BWR(t,'nè','đây'); if(r() < .3) t = btail(t, ' đấy'); }
  else if(s==='coc'){ t = t.replace(/\s*\p{Extended_Pictographic}️?/gu, '').replace(/[!.]+$/, '').trim() || 'ừ'; if(t.length > 28 && r() < .5) t = t.split(/[,.]/)[0]; if(r() < .25) t = 'ừ ' + lc1(t); }
  else if(s==='lay'){ if(r() < .45) t = btail(t, ' 😂😂'); if(r() < .15) t = t.toUpperCase(); else if(r() < .3) t = btail(t, ' kkk'); }
  else if(s==='cute'){ if(r() < .5) t = btail(t, [' 🥰',' hihi',' nhaa',' 😚'][Math.floor(r()*4)]); }
  else { if(r() < .4) t = t.replace(/[.!]*$/, '...'); }
  if(r() < .07 && t.length > 8){ const i = 2 + Math.floor(r()*(t.length - 5)); if(/[a-z]/i.test(t[i]) && /[a-z]/i.test(t[i+1]) && /[a-z]/i.test(t[i-1] || '')) t = t.slice(0, i) + t[i+1] + t[i] + t.slice(i+2); }   /* gõ nhầm: đảo 2 chữ cái */
  return t; };
if(typeof window!=='undefined'){ window.__smartReply = botSmartReply; window.__bstyle = botStyleText; }
const H3 = {}, SIDEOF = {};
function houseSVG(g, lv, ori, back, col, nm){ const lk = lv>=3 ? lmKey(g, nm) : null, k = g + lv + (lk||'') + (ori||'x') + (back?'b':'') + (col&&!lk?col:''); return (H3[k] || (H3[k] = lk ? landmark3D(lk, ori, back) : house3D(g, lv, ori, back, col))).svg; }
// ----- mô hình nổi ở bốn góc bàn cờ
function cornerModel(kind){
  // Ô góc rộng thêm ra hai viền cỏ phía ngoài (E đơn vị). Nền ngoài cao, càng vào trong càng thấp.
  // Vật cao chỉ đặt ở nơi mà khi dựng lên không đè lên ô bên cạnh:
  // trạm khởi hành cao tối đa min(x,y), trại giam tối đa x, vườn thú tối đa y, công viên không giới hạn.
  const sc = isoScene(), P = (x,y,z) => sc.P(x,y,z).join(','), S2 = (x,y,z) => sc.P(x,y,z), B = 46, E = 13;
  const tree = (x, y, r, col, z) => { const a = S2(x,y,z||3); sc.raw(x+y+.5, `<rect x="${a[0]-1.3}" y="${a[1]-7}" width="2.6" height="7" fill="#8A5A34"/><circle cx="${a[0]}" cy="${a[1]-7-r*.75}" r="${r}" fill="${col}"/><path d="M${a[0]-r*.55} ${a[1]-7-r*1.1}q${r*.5} ${-r*.45} ${r} ${-r*.05}" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity=".55"/>`, [[a[0]-r,a[1]-7-r*1.8],[a[0]+r,a[1]]]); };
  const cone = (x, y, hh, col, z) => { const a = S2(x,y,z||3); sc.raw(x+y+.5, `<rect x="${a[0]-1}" y="${a[1]-4}" width="2" height="4" fill="#8A5A34"/><ellipse cx="${a[0]}" cy="${a[1]-3-hh/2}" rx="${hh*.36}" ry="${hh/2}" fill="${col}"/>`, [[a[0]-hh*.4,a[1]-4-hh],[a[0]+hh*.4,a[1]]]); };
  const lamp = (x, y, hh, z) => { const a = S2(x,y,z||3); sc.raw(x+y+.6, `<path d="M${a[0]} ${a[1]}V${a[1]-hh}" fill="none" stroke="#3D4A63" stroke-width="1.6"/><circle cx="${a[0]}" cy="${a[1]-hh-1.5}" r="2.6" fill="#FFE27A"/><circle cx="${a[0]}" cy="${a[1]-hh-1.5}" r="5" fill="#FFE27A" opacity=".3" stroke="none"/>`, [[a[0]-5,a[1]-hh-7],[a[0]+5,a[1]]]); };
  // nền bậc thang: ô chính thấp (cao 2.5), hai dải ngoài cao hơn (cao 5)
  const base = (ex, ey, cIn, cOut) => {
    sc.box({x:0,y:0,z:0,w:B,d:B,h:2.5,c:cIn}, -50);
    const ylo = ey<0 ? -E : 0, x0 = ex<0 ? -E : B, y0 = ey<0 ? -E : B;
    sc.box({x:x0, y:ylo, z:0, w:E, d:B+E, h:5, c:cOut}, ex<0 ? -80 : 500);
    sc.box({x:0, y:y0, z:0, w:B, d:E, h:5, c:cOut}, ey<0 ? -79 : 499);
  };
  // ---- 3 góc riêng của Xếp hạng: Đấu trường, Chợ đen, Ngục tối ----
  const sign = (x, y, z, txt, bg, fg) => { const a = S2(x, y, z), w = txt.length*4.2 + 10; sc.raw(999, `<g class="rksign"><rect x="${a[0]-w/2}" y="${a[1]-11}" width="${w}" height="11" rx="2.5" fill="${bg}" stroke="#141C3D" stroke-width="1.2"/><text x="${a[0]}" y="${a[1]-3}" text-anchor="middle" font-family="Be Vietnam Pro,system-ui,sans-serif" font-weight="900" font-size="7" fill="${fg}" stroke="none" letter-spacing=".4">${txt}</text></g>`, [[a[0]-w/2,a[1]-12],[a[0]+w/2,a[1]]]); };
  const torch = (x, y, z, h, col) => { const a = S2(x, y, z); sc.raw(x+y+.7, `<path d="M${a[0]} ${a[1]}V${a[1]-h}" fill="none" stroke="#3A2A20" stroke-width="2"/><path class="rkflame" d="M${a[0]} ${a[1]-h-9}q4 4 2.6 7.2q-1.2 2-2.6 2q-1.4 0-2.6-2q-1.4-3.2 2.6-7.2z" fill="${col}" stroke="#7A1E0A" stroke-width=".8"/><circle cx="${a[0]}" cy="${a[1]-h-4}" r="7" fill="${col}" opacity=".25" stroke="none"/>`, [[a[0]-7,a[1]-h-12],[a[0]+7,a[1]]]); };
  if(kind==='rkvisit'){             // Đấu trường (góc trái: ngoài -x, +y)
    base(-1, 1, ['#D9B57A','#B48A52','#9A7444'], ['#5A3A2E','#47302A','#3A2620']);
    const st = ['#9A8A7A','#7E7062','#675B50'], W = (x,y,w,d,h) => sc.box({x,y,z:2.5,w,d,h,c:st});
    W(6,6,14,3,6); W(26,6,14,3,6); W(6,37,14,3,6); W(26,37,14,3,6); W(6,9,3,11,6); W(6,26,3,11,6); W(37,9,3,11,6); W(37,26,3,11,6);
    const c = S2(23,23,2.5); sc.raw(23*2-.5, `<ellipse cx="${c[0]}" cy="${c[1]}" rx="17" ry="9" fill="#E8C98E" stroke="#B48A52" stroke-width="1"/><ellipse cx="${c[0]}" cy="${c[1]}" rx="9" ry="4.8" fill="none" stroke="#C0392B" stroke-width="1.4" stroke-dasharray="3 2"/>`);
    const s0 = S2(23,23,9); sc.raw(60, `<g class="rkswords"><path d="M${s0[0]-11} ${s0[1]+9}L${s0[0]+9} ${s0[1]-11}" stroke="#E8EEF5" stroke-width="2.6"/><path d="M${s0[0]+11} ${s0[1]+9}L${s0[0]-9} ${s0[1]-11}" stroke="#E8EEF5" stroke-width="2.6"/><path d="M${s0[0]-13} ${s0[1]+5}l6 6M${s0[0]+13} ${s0[1]+5}l-6 6" stroke="#F4C542" stroke-width="2.4"/><circle cx="${s0[0]-12} " cy="${s0[1]+12}" r="2" fill="#F4C542"/><circle cx="${s0[0]+12}" cy="${s0[1]+12}" r="2" fill="#F4C542"/></g>`, [[s0[0]-15,s0[1]-13],[s0[0]+15,s0[1]+14]]);
    torch(8,8,8.5,10,'#FF9A2B'); torch(38,8,8.5,10,'#FF9A2B'); torch(8,38,8.5,10,'#FF9A2B'); torch(38,38,8.5,10,'#FF9A2B');
    return sc.out([B/2,B/2,0]);
  }
  if(kind==='rkpark'){              // Chợ đen (góc trên: ngoài -x, -y): chợ đêm đèn lồng, lều sọc, rương báu
    base(-1, -1, ['#3B3060','#2E2550','#241D42'], ['#2A2248','#201A3A','#18142E']);
    sc.raw(-45, `<polygon points="${P(0,20,2.5)} ${P(46,20,2.5)} ${P(46,26,2.5)} ${P(0,26,2.5)}" fill="#4A3D78" stroke="none"/><polygon points="${P(20,0,2.5)} ${P(26,0,2.5)} ${P(26,46,2.5)} ${P(20,46,2.5)}" fill="#4A3D78" stroke="none"/>`);
    const tent = (x, y, c1, c2) => { sc.box({x,y,z:2.5,w:12,d:12,h:5,c:[c1, shade(c1,.8), shade(c1,.65)]}); const a = S2(x,y,7.5), b = S2(x+12,y,7.5), cc = S2(x+12,y+12,7.5), d = S2(x,y+12,7.5), t = S2(x+6,y+6,17);
      const tri = (p, q, f) => `<polygon points="${p.join(',')} ${q.join(',')} ${t.join(',')}" fill="${f}"/>`, mid = (p, q) => [(p[0]+q[0])/2, (p[1]+q[1])/2];
      sc.raw(x+y+13, tri(a,b,shade(c1,.8)) + tri(b,cc,shade(c2,.7)) + tri(cc,d,c2) + tri(d,a,c1) + `<path d="M${mid(cc,d).join(' ')}L${t.join(' ')}M${mid(b,cc).join(' ')}L${t.join(' ')}" stroke="${c1}" stroke-width="2.2"/><circle cx="${t[0]}" cy="${t[1]-1.5}" r="1.6" fill="#FFE27A"/>`, [a,b,cc,d,[t[0],t[1]-4]]); };
    tent(3,3,'#E0483A','#FFD23F'); tent(29,4,'#7C3AED','#29D3E8'); tent(4,29,'#FF5E94','#FFFDF6');
    // rương báu mở nắp, ngọc phát sáng
    sc.box({x:30,y:30,z:2.5,w:8,d:6,h:4,c:['#B0742E','#8A5A22','#6E4618']});
    const ch = S2(34,33,6.5); sc.raw(75, `<g class="rkgem"><circle cx="${ch[0]}" cy="${ch[1]-2}" r="7" fill="#FFE27A" opacity=".35" stroke="none"/><path d="M${ch[0]-5} ${ch[1]}l2-3h2l2 3z" fill="#29D3E8" stroke="#0B5A6E" stroke-width=".7"/><path d="M${ch[0]} ${ch[1]-1}l2-3h2l2 3z" fill="#FF5E94" stroke="#7A1E3A" stroke-width=".7"/><circle cx="${ch[0]+3}" cy="${ch[1]-4}" r="1.6" fill="#7CE38B" stroke="#1E6E3A" stroke-width=".6"/>${[[-6,1],[-3,2],[2,2],[5,1]].map(q => `<ellipse cx="${ch[0]+q[0]}" cy="${ch[1]+q[1]}" rx="2" ry="1.1" fill="#F4C542" stroke="#8A5A0B" stroke-width=".6"/>`).join('')}</g>`, [[ch[0]-8,ch[1]-9],[ch[0]+8,ch[1]+4]]);
    // dây đèn lồng nhiều màu chăng qua chợ
    const l0 = S2(2,22,13), l1 = S2(44,22,13), mx = (l0[0]+l1[0])/2, my = (l0[1]+l1[1])/2 + 7;
    sc.raw(980, `<path d="M${l0[0]} ${l0[1]}Q${mx} ${my+6} ${l1[0]} ${l1[1]}" fill="none" stroke="#141C3D" stroke-width=".9"/>` + Array.from({length:7}, (_, k) => { const t = (k+1)/8, x = (1-t)*(1-t)*l0[0] + 2*(1-t)*t*mx + t*t*l1[0], y = (1-t)*(1-t)*l0[1] + 2*(1-t)*t*(my+6) + t*t*l1[1], c = ['#FF5E94','#FFD23F','#29D3E8','#7CE38B','#FF8A2B','#B48CFF','#FFD23F'][k];
      return `<g class="rklamp" style="--d:${(k*.21).toFixed(2)}s"><circle cx="${x.toFixed(1)}" cy="${(y+3).toFixed(1)}" r="5" fill="${c}" opacity=".3" stroke="none"/><ellipse cx="${x.toFixed(1)}" cy="${(y+3).toFixed(1)}" rx="2.2" ry="2.8" fill="${c}" stroke="#141C3D" stroke-width=".7"/></g>`; }).join(''), [[l0[0]-2,l0[1]-2],[l1[0]+2,my+14]]);
    torch(18,18,2.5,9,'#B48CFF'); torch(27,27,2.5,9,'#29D3E8');
    sign(23, 23, 26, '🕶 CHỢ ĐEN', '#2A1150', '#FFE27A');
    return sc.out([B/2,B/2,0]);
  }
  if(kind==='rkgotojail'){          // Ngục tối (góc phải: ngoài +x, -y)
    base(1, -1, ['#5E6272','#4A4E5C','#3C3F4C'], ['#3A3D4A','#2E3039','#24262E']);
    const X0 = 18, X1 = 56, Y0 = -11, Y1 = 6, H0 = 5, H1 = 17;
    sc.box({x:X0,y:Y0,z:H0,w:X1-X0,d:Y1-Y0,h:H1-H0,c:['#2A2D3A','#1E2030','#171824']}, -20);
    let face = ''; for(let k=0;k<=16;k++){ const t = X0 + 1.5 + k*(X1-X0-3)/16; face += `<path d="M${P(t,Y1,H0+.8)}L${P(t,Y1,H1-1.6)}" fill="none" stroke="#7A808F" stroke-width="1.2"/>`; }
    const gl = S2((X0+X1)/2, Y1, (H0+H1)/2); sc.raw(-19, face + `<ellipse class="rkglow" cx="${gl[0]}" cy="${gl[1]}" rx="18" ry="6" fill="#FF3B30" opacity=".35" stroke="none"/>`);
    const sk = S2(14, 18, 2.5); sc.raw(40, `<g><ellipse cx="${sk[0]}" cy="${sk[1]-4}" rx="4.2" ry="4" fill="#EDE6D6"/><rect x="${sk[0]-2.4}" y="${sk[1]-1.5}" width="4.8" height="2.6" rx="1" fill="#EDE6D6"/><circle cx="${sk[0]-1.5}" cy="${sk[1]-4}" r="1.1" fill="#141C3D"/><circle cx="${sk[0]+1.5}" cy="${sk[1]-4}" r="1.1" fill="#141C3D"/></g>`);
    const ch = S2(30, 26, 2.5); sc.raw(56, `<path d="M${ch[0]-10} ${ch[1]}q5 4 10 0q5-4 10 0" fill="none" stroke="#9AA3B5" stroke-width="2" stroke-dasharray="2.5 1.5"/>`);
    torch(16,-2,H0,8,'#FF5A2B'); torch(46,-2,H0,8,'#FF5A2B');
    const ghost = (a, b, z, a2, b2, dur, del, sz) => { const c = S2(a,b,z), d = S2(a2,b2,z), gx = (d[0]-c[0]).toFixed(1), gy = (d[1]-c[1]).toFixed(1);
      sc.raw(900, `<g class="rkghost" style="--gx:${gx}px;--gy:${gy}px;--dur:${dur}s;--del:${del}s"><g class="rkgb"><g transform="translate(${c[0]} ${c[1]}) scale(${sz})"><path d="M0 -9C-4.6 -9 -5.8 -4.4 -5.8 -.4L-5.8 5.6Q-4.8 4.6 -3.8 5.8Q-2.8 4.4 -1.8 5.8Q-.9 4.6 0 5.8Q.9 4.6 1.8 5.8Q2.8 4.4 3.8 5.8Q4.8 4.6 5.8 5.6L5.8 -.4C5.8 -4.4 4.6 -9 0 -9z" fill="#DDF1FA" fill-opacity=".92" stroke="#8FC6DE" stroke-width=".8"/><ellipse cx="-2" cy="-3.6" rx="1.1" ry="1.5" fill="#141C3D" stroke="none"/><ellipse cx="2" cy="-3.6" rx="1.1" ry="1.5" fill="#141C3D" stroke="none"/><ellipse cx="0" cy="-.4" rx="1.4" ry="1.1" fill="#141C3D" stroke="none"/></g></g></g>`, [[Math.min(c[0],d[0])-8, Math.min(c[1],d[1])-12],[Math.max(c[0],d[0])+8, Math.max(c[1],d[1])+8]]); };
    ghost(12, 16, 12, 24, 26, 9, 0, .62); ghost(32, 14, 15, 22, 30, 11, -4.5, .52);
    return sc.out([B/2,B/2,0]);
  }
  const C3 = c => [c, shade(c,.85), shade(c,.7)];
  const grp = (k, boxes, cls, style, extra) => { boxes.sort((a,b) => (a.x+a.w/2+a.y+a.d/2+a.z*.01)-(b.x+b.w/2+b.y+b.d/2+b.z*.01)); const pts = []; boxes.forEach(b => { [[b.x,b.y,b.z],[b.x+b.w,b.y+b.d,b.z],[b.x,b.y,b.z+b.h],[b.x+b.w,b.y+b.d,b.z+b.h],[b.x+b.w,b.y,b.z+b.h],[b.x,b.y+b.d,b.z]].forEach(p => pts.push(isoP(p[0],p[1],p[2]))); }); sc.raw(k, `<g class="${cls||''}" style="${style||''}">${boxes.map(isoBox).join('')}${extra||''}</g>`, pts); };
  const beast = (x,y,z,L,W,H,leg,col) => [[0,0],[L-1.5,0],[0,W-1.5],[L-1.5,W-1.5]].map(q => ({x:x+q[0],y:y+q[1],z,w:1.5,d:1.5,h:leg,c:C3(shade(col,.78))})).concat([{x,y,z:z+leg,w:L,d:W,h:H,c:C3(col)}]);
  const treeS = (x, y, r, col, z) => { const a = S2(x,y,z||3); sc.raw(x+y+.5, `<g class="sway"><rect x="${a[0]-1.3}" y="${a[1]-7}" width="2.6" height="7" fill="#8A5A34"/><circle cx="${a[0]}" cy="${a[1]-7-r*.75}" r="${r}" fill="${col}"/><path d="M${a[0]-r*.55} ${a[1]-7-r*1.1}q${r*.5} ${-r*.45} ${r} ${-r*.05}" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity=".55"/></g>`, [[a[0]-r,a[1]-7-r*1.8],[a[0]+r,a[1]]]); };
  if(kind==='gotojail'){            // Đồn cảnh sát: toà nhà xanh có đèn còi, buồng giam bên hông, tiệm donut, xe tuần tra áp giải, cảnh sát đi tuần
    base(1, -1, ['#D5DCE6','#A3AEBE','#8693A6'], ['#C0C9D6','#98A4B6','#7C899C']);
    const K = cityKit('x', sc), bx = (x,y,z,w,d,h,c,k) => sc.box({x,y,z,w,d,h,c:C3(c)}, k);
    // đường nhựa trước đồn
    sc.raw(-45, `<polygon points="${P(0,24,2.5)} ${P(46,24,2.5)} ${P(46,32,2.5)} ${P(0,32,2.5)}" fill="#6B7488" stroke="none"/><path d="M${P(2,28,2.5)}L${P(44,28,2.5)}" stroke="#F4EEDC" stroke-width="1" stroke-dasharray="3 3" fill="none"/>`);
    // toà nhà đồn (lùi ra dải ngoài phía sau, cao theo x)
    const X0 = 18, X1 = 46, Y0 = -11, Y1 = 6, H0 = 5, H1 = 17;
    bx(X0, Y0, H0, X1-X0, Y1-Y0, H1-H0, '#3E6FB5', -20);
    let face = ''; for(let k=0;k<5;k++){ if(k===2) continue; const a = X0+2+k*5.2; face += `<polygon points="${P(a,Y1,H0+5)} ${P(a+3,Y1,H0+5)} ${P(a+3,Y1,H0+9.6)} ${P(a,Y1,H0+9.6)}" fill="#BFE3F2"/>`; }
    for(let k=0;k<3;k++){ const b = Y0+2+k*5; face += `<polygon points="${P(X1,b,H0+5)} ${P(X1,b+3,H0+5)} ${P(X1,b+3,H0+9.6)} ${P(X1,b,H0+9.6)}" fill="#9ACDE6"/>`; }
    face += `<polygon points="${P(29,Y1,H0)} ${P(33.4,Y1,H0)} ${P(33.4,Y1,H0+6.4)} ${P(29,Y1,H0+6.4)}" fill="#2B3A67"/><polygon points="${P(X0,Y1,H0+11)} ${P(X1,Y1,H0+11)} ${P(X1,Y1,H0+11.8)} ${P(X0,Y1,H0+11.8)}" fill="#F4F7FA" stroke="none"/>`;
    sc.raw(-10, face);
    bx(X0-1, Y0-1, H1, X1-X0+2, Y1-Y0+2, 1.6, '#2B3348', -5); bx(28, -5, H1+1.6, 8, 6, 2.6, '#2B3348', -4);
    { const s = S2(32, -2, H1+4.2); sc.raw(-3, `<g class="lt l1"><circle cx="${s[0]-2.4}" cy="${s[1]-1.6}" r="5" fill="#FF5A4E" opacity=".3" stroke="none"/></g><g class="lt l2"><circle cx="${s[0]+2.4}" cy="${s[1]-1.6}" r="5" fill="#4EA5FF" opacity=".3" stroke="none"/></g><rect x="${s[0]-4.4}" y="${s[1]-3.2}" width="4.4" height="3.2" rx="1" fill="#E0483A"/><rect x="${s[0]}" y="${s[1]-3.2}" width="4.4" height="3.2" rx="1" fill="#3E7FCB"/>`, [[s[0]-8,s[1]-8],[s[0]+8,s[1]+2]]); }
    { const a = S2(31.2, Y1, H0+14.4), w = 30; sc.raw(-2, `<g transform="matrix(.866,.5,0,1,${a[0]-13},${a[1]-7.4})"><rect x="0" y="0" width="${w}" height="8.6" rx="2" fill="#1F3470"/><text x="${w/2}" y="6.4" text-anchor="middle" font-size="6.2" font-weight="900" fill="#FFFFFF" stroke="none" letter-spacing=".6">POLICE</text></g>`, [[a[0]-14,a[1]-9],[a[0]+14,a[1]+8]]); }
    // buồng giam bên hông có tù vẫy tay sau song sắt
    bx(47, -9, H0, 10, 13, 9, '#C9C4B8', -15);
    { let g = `<polygon points="${P(57,-7,H0+1)} ${P(57,2,H0+1)} ${P(57,2,H0+7.6)} ${P(57,-7,H0+7.6)}" fill="#3A4258"/>`; for(let j=0;j<7;j++) g += `<path d="M${P(57,-6.4+j*1.3,H0+1)}L${P(57,-6.4+j*1.3,H0+7.6)}" stroke="#C9D1DE" stroke-width=".8" fill="none"/>`;
      const pr = S2(57,-2.4,H0+1); g += `<rect x="${pr[0]-2}" y="${pr[1]-5.4}" width="4" height="4.4" fill="#FFFFFF" stroke-width=".6"/><path d="M${pr[0]-2} ${pr[1]-4.2}h4M${pr[0]-2} ${pr[1]-2.8}h4" stroke="#2B3348" stroke-width=".8"/><circle cx="${pr[0]}" cy="${pr[1]-7}" r="1.8" fill="#F6D7B0"/><path class="wave" d="M${pr[0]+2} ${pr[1]-5}l2.4 -3" stroke="#F6D7B0" stroke-width="1.2"/>`;
      sc.raw(-14, g); }
    // tiệm donut nhỏ (thấp, phía x nhỏ)
    bx(3, 3, 2.5, 10, 7, 6, '#F4A6C0', 20); bx(2.4, 2.4, 8.5, 11.2, 8.2, 1, '#FFFFFF', 21);
    { const p = S2(8, 6.5, 12.6); sc.raw(22, `<g class="bob" style="--k:2"><circle cx="${p[0]}" cy="${p[1]}" r="4.6" fill="#E8B060"/><circle cx="${p[0]}" cy="${p[1]}" r="3.8" fill="#F27BA6" stroke="none"/><circle cx="${p[0]}" cy="${p[1]}" r="1.5" fill="#D5DCE6"/><path d="M${p[0]-2} ${p[1]-2}l.8 .4M${p[0]+1.6} ${p[1]-2.4}l.4 .8M${p[0]+2.4} ${p[1]+1}l-.8 .4" stroke="#FFFFFF" stroke-width=".7"/></g>`, [[p[0]-5,p[1]-5],[p[0]+5,p[1]+5]]); }
    { let a = ''; for(let k=0;k<4;k++){ const q = S2(3.6+k*2.4, 10, 8); a += `<path d="M${q[0]} ${q[1]}l2.4 1.4v1.6l-2.4 -1.4z" fill="${k%2 ? '#FFFFFF' : '#E0483A'}" stroke="none"/>`; } sc.raw(21.5, a); }
    // người và chó đi tuần chậm trong sân; nhịp đi được nối liền qua mỗi lần vẽ lại nhờ biến --ct
    const cop = (x1, y1, x2, y2, dur, hat) => { const a = S2(x1,y1,2.5), b = S2(x2,y2,2.5);
      sc.raw(x1+y1+40, `<g class="cop" style="--dx:${(b[0]-a[0]).toFixed(1)}px;--dy:${(b[1]-a[1]).toFixed(1)}px;animation-duration:${dur}s"><ellipse cx="${a[0]}" cy="${a[1]}" rx="3" ry="1.3" fill="rgba(43,58,103,.28)" stroke="none"/><rect x="${a[0]-2}" y="${a[1]-4.6}" width="1.8" height="4.6" fill="#28407A"/><rect x="${a[0]+.2}" y="${a[1]-4.6}" width="1.8" height="4.6" fill="#28407A"/><rect x="${a[0]-2.6}" y="${a[1]-9.4}" width="5.2" height="5" rx=".8" fill="#7FB4E6"/><circle cx="${a[0]+1.2}" cy="${a[1]-7.6}" r=".7" fill="#F4C542" stroke="none"/><circle cx="${a[0]}" cy="${a[1]-11.6}" r="2.3" fill="#F6D7B0"/><path d="M${a[0]-2.7} ${a[1]-12.2}h5.4l-.6-2.2h-4.2z" fill="${hat}"/><path d="M${a[0]-3.2} ${a[1]-12.1}h6.6" fill="none" stroke="#1B2547" stroke-width="1"/></g>`, [[a[0]-4,a[1]-15],[b[0]+4,b[1]+2],[b[0]-4,b[1]-15],[a[0]+4,a[1]+2]]); };
    cop(8, 36, 36, 36, 9, '#1F3470'); cop(40, 14, 40, 22, 11, '#1F3470'); cop(16, 14, 26, 14, 13, '#1F3470');
    // xe cảnh sát: đỗ ở mép sân, mỗi lần áp giải thì chạy vào với đèn nhấp nháy
    const cb = (x,y,z,w,d,h,c) => isoBox({x,y,z,w,d,h,c:[c, shade(c,.85), shade(c,.7)]});
    const cx0 = 33, cy0 = 30, cz = 2.5, wl = (x,y) => { const a = S2(x,y,cz+1.1); return `<circle cx="${a[0]}" cy="${a[1]}" r="1.5" fill="#1B2030"/><circle cx="${a[0]}" cy="${a[1]}" r=".6" fill="#C9D1DE" stroke="none"/>`; };
    const cin = sc.P(26,0,0);
    const lb = S2(cx0+7, cy0+2.5, cz+7);
    sc.raw(120, `<g class="pcar" style="--tx:${cin[0]}px;--ty:${cin[1]}px">${cb(cx0,cy0,cz+1,14,6,2.6,'#2B3348')}${cb(cx0+4.4,cy0,cz+1,5,6,2.6,'#FFFFFF')}${cb(cx0+3.6,cy0+.5,cz+3.6,6.6,5,2.2,'#3A4258')}${cb(cx0+5.4,cy0+1.2,cz+5.8,1.5,3.6,.9,'#E0483A')}${cb(cx0+6.9,cy0+1.2,cz+5.8,1.5,3.6,.9,'#3B82C4')}${wl(cx0+2.6,cy0+6)}${wl(cx0+11.4,cy0+6)}<circle class="lt l1" cx="${lb[0]-2}" cy="${lb[1]}" r="4" fill="#FF5A4E" stroke="none"/><circle class="lt l2" cx="${lb[0]+2}" cy="${lb[1]}" r="4" fill="#4EA5FF" stroke="none"/></g>`, [isoP(cx0,cy0,cz), isoP(cx0+14,cy0+6,cz+8), isoP(cx0+40,cy0+6,cz)]);
    // tên trộm và viên cảnh sát áp giải vào cửa đồn (chỉ hiện trong lúc áp giải)
    const t0 = S2(29, 31, cz), door = S2(31, 7, cz), jx = (door[0]-t0[0]).toFixed(1), jy = (door[1]-t0[1]).toFixed(1);
    sc.raw(125, `<g class="thief" style="--jx:${jx}px;--jy:${jy}px"><ellipse cx="${t0[0]}" cy="${t0[1]}" rx="3" ry="1.3" fill="rgba(43,58,103,.28)" stroke="none"/><rect x="${t0[0]-2}" y="${t0[1]-4.4}" width="1.8" height="4.4" fill="#4A5568"/><rect x="${t0[0]+.2}" y="${t0[1]-4.4}" width="1.8" height="4.4" fill="#4A5568"/><rect x="${t0[0]-2.6}" y="${t0[1]-9.4}" width="5.2" height="5.2" rx=".8" fill="#FFFFFF"/><path d="M${t0[0]-2.6} ${t0[1]-8}h5.2M${t0[0]-2.6} ${t0[1]-6.4}h5.2M${t0[0]-2.6} ${t0[1]-4.9}h5.2" fill="none" stroke="#2B3348" stroke-width="1"/><circle cx="${t0[0]}" cy="${t0[1]-11.6}" r="2.3" fill="#F6D7B0"/><rect x="${t0[0]-2.3}" y="${t0[1]-12.5}" width="4.6" height="1.5" fill="#1B2030" stroke="none"/><path d="M${t0[0]-2.4} ${t0[1]-12.8}q2.4 -3.2 4.8 0z" fill="#8792A8"/><ellipse cx="${t0[0]-4.4}" cy="${t0[1]-5}" rx="2.4" ry="2.9" fill="#B5894F"/></g>
      <g class="grab" style="--jx:${jx}px;--jy:${jy}px"><rect x="${t0[0]+3.2}" y="${t0[1]-4.6}" width="1.8" height="4.6" fill="#28407A"/><rect x="${t0[0]+5.4}" y="${t0[1]-4.6}" width="1.8" height="4.6" fill="#28407A"/><rect x="${t0[0]+2.6}" y="${t0[1]-9.4}" width="5.2" height="5" rx=".8" fill="#7FB4E6"/><circle cx="${t0[0]+5.2}" cy="${t0[1]-11.6}" r="2.3" fill="#F6D7B0"/><path d="M${t0[0]+2.5} ${t0[1]-12.2}h5.4l-.6-2.2h-4.2z" fill="#1F3470"/><path d="M${t0[0]+2.6} ${t0[1]-7.6}h-3" fill="none" stroke="#7FB4E6" stroke-width="1.6"/></g>`, [[t0[0]-8,t0[1]-16],[door[0]+8,door[1]-16]]);
    const d0 = S2(14,38,2.5), d1 = S2(30,40,2.5);
    sc.raw(90, `<g class="cop" style="--dx:${(d1[0]-d0[0]).toFixed(1)}px;--dy:${(d1[1]-d0[1]).toFixed(1)}px;animation-duration:7s"><ellipse cx="${d0[0]}" cy="${d0[1]-2.6}" rx="3.4" ry="1.9" fill="#B5683A"/><circle cx="${d0[0]+3.2}" cy="${d0[1]-4.4}" r="1.7" fill="#B5683A"/><path d="M${d0[0]+2.6} ${d0[1]-6}l.6-1.6l.8 1.4M${d0[0]-3.2} ${d0[1]-3.4}l-1.6-1.8" fill="none" stroke="#8A4A26" stroke-width="1"/><path d="M${d0[0]-2} ${d0[1]-1}v2M${d0[0]+2} ${d0[1]-1}v2" fill="none" stroke="#8A4A26" stroke-width="1.2"/></g>`, [[d0[0]-5,d0[1]-9],[d1[0]+6,d1[1]+2]]);
    return sc.out([B/2,B/2,0]);
  }
  if(kind==='park'){                // góc trên: ngoài là -x và -y. Có thời tiết riêng: nắng, mưa, gió, đêm trăng
    base(-1, -1, ['#C4E39B','#8FB86A','#789F56'], ['#A9D27E','#7FB65A','#69A04A']);
    sc.raw(-45, `<polygon points="${P(20,46,2.5)} ${P(26,46,2.5)} ${P(26,0,2.5)} ${P(20,0,2.5)}" fill="#E7CFA0" stroke="none"/><polygon points="${P(0,20,2.5)} ${P(46,20,2.5)} ${P(46,26,2.5)} ${P(0,26,2.5)}" fill="#E7CFA0" stroke="none"/>`);
    const f = S2(23,23,2.5); sc.raw(46.2, `<ellipse cx="${f[0]}" cy="${f[1]}" rx="7" ry="3.7" fill="#C9D1DE"/><ellipse cx="${f[0]}" cy="${f[1]-1}" rx="4.8" ry="2.5" fill="#6EC1E4"/><path d="M${f[0]} ${f[1]-1}v-5" fill="none" stroke="#9ED8EF" stroke-width="1.6"/>`);
    const w0 = S2(-6,-6,5), R = 17, cy = w0[1]-R-5; let wheel = '';
    const cabs = ['#5FA8D3','#F4C542','#86BC82','#E0685C','#9B7BC4','#F2A65A','#5FA8D3','#86BC82'];
    for(let k=0;k<8;k++){ const a = k*Math.PI/4 + .3, x = w0[0]+R*Math.cos(a), y = cy+R*Math.sin(a); wheel += `<path d="M${w0[0]} ${cy}L${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="#3D4A63" stroke-width="1"/><rect x="${(x-2.6).toFixed(1)}" y="${(y-2.3).toFixed(1)}" width="5.2" height="4.6" rx="1.3" fill="${cabs[k]}"/>`; }
    sc.raw(-11, `<path d="M${w0[0]-9} ${w0[1]+2}L${w0[0]} ${cy}L${w0[0]+9} ${w0[1]+2}" fill="none" stroke="#3D4A63" stroke-width="2.2"/><g class="spin" style="transform-origin:${w0[0]}px ${cy}px"><circle cx="${w0[0]}" cy="${cy}" r="${R}" fill="none" stroke="#E0685C" stroke-width="2.4"/><circle cx="${w0[0]}" cy="${cy}" r="${R-4}" fill="none" stroke="#F4C542" stroke-width="1.2"/>${wheel}</g><circle cx="${w0[0]}" cy="${cy}" r="2.4" fill="#FFFDF6"/>`, [[w0[0]-R-3, cy-R-3],[w0[0]+R+3, w0[1]+3]]);
    treeS(12, -6, 9, '#6DB868', 5); treeS(-6, 14, 9, '#5FAE5C', 5); treeS(-6, 36, 8, '#5FAE5C', 5); treeS(34, -6, 8, '#6DB868', 5);
    cone(8, 10, 10, '#4E9A4D'); cone(10, 36, 9, '#5AA657'); 
    lamp(28, 31, 10, 2.5); lamp(17, 22, 10, 2.5); lamp(28, 17, 10, 2.5);
    // ---- Công viên giải trí: tàu lượn vòng xoắn, đu quay ngựa gỗ xoay, người bán bóng bay, biển FUN PARK
    { const K = cityKit('x', sc);
      const pts = []; for(let t=0;t<=1.0001;t+=.05){ pts.push(S2(29+15*t, 3+5*Math.sin(t*Math.PI), 3+20*Math.sin(t*Math.PI)*(1-t*.45))); }
      const lc = S2(36, 6, 14);
      let rail = ''; for(let i=0;i<pts.length;i+=3){ const t = i*.05, g = S2(29+15*t, 3+5*Math.sin(t*Math.PI), 2.5); rail += `<path d="M${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}L${g[0].toFixed(1)} ${g[1].toFixed(1)}" stroke="#9AA4AE" stroke-width=".8" fill="none"/>`; }
      rail += `<path d="M${pts.map(p => p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L')}" fill="none" stroke="#E0483A" stroke-width="2.4"/><circle cx="${lc[0]}" cy="${lc[1]}" r="8" fill="none" stroke="#E0483A" stroke-width="2.4"/>`;
      rail += `<g class="coaster"><rect x="${(pts[5][0]-3.4).toFixed(1)}" y="${(pts[5][1]-3.4).toFixed(1)}" width="6.8" height="3.4" rx="1.2" fill="#F4C542"/><circle cx="${(pts[5][0]-1.4).toFixed(1)}" cy="${(pts[5][1]-4.4).toFixed(1)}" r="1.2" fill="#F6D7B0" stroke="none"/><circle cx="${(pts[5][0]+1.6).toFixed(1)}" cy="${(pts[5][1]-4.4).toFixed(1)}" r="1.2" fill="#F6D7B0" stroke="none"/></g>`;
      sc.raw(30, rail, pts.concat([[lc[0]-9,lc[1]-9],[lc[0]+9,lc[1]+9]]));
      // đu quay ngựa gỗ
      K.cyl(11, 34, 2.5, 7, 1.2, '#F4EEE0', 60);
      const e = S2(11, 34, 10); let car = '';
      for(let k=0;k<6;k++){ const an = k*Math.PI/3, q = S2(11+5*Math.cos(an), 34+5*Math.sin(an), 3.7); car += `<path d="M${q[0].toFixed(1)} ${q[1].toFixed(1)}V${(e[1]).toFixed(1)}" stroke="#C9A270" stroke-width=".8" fill="none"/><rect x="${(q[0]-1.6).toFixed(1)}" y="${(q[1]-4.6).toFixed(1)}" width="3.2" height="2" rx=".8" fill="${['#F4C542','#E0685C','#5FA8D3'][k%3]}"/>`; }
      sc.raw(60.4, `<g class="bob" style="--k:3">${car}</g><path d="M${e[0]-10} ${e[1]}L${e[0]} ${e[1]-9}L${e[0]+10} ${e[1]}Z" fill="#E0483A"/><path d="M${e[0]-5} ${e[1]-4.5}L${e[0]} ${e[1]}L${e[0]} ${e[1]-9}ZM${e[0]+5} ${e[1]-4.5}L${e[0]+10} ${e[1]}L${e[0]} ${e[1]-9}Z" fill="#FFFFFF" stroke="none"/><path d="M${e[0]} ${e[1]-9}v-3" stroke="#2B3A67" fill="none"/><path d="M${e[0]} ${e[1]-12}l3 1l-3 1z" fill="#F4C542"/>`, [[e[0]-11,e[1]-13],[e[0]+11,e[1]+8]]);
      // người bán bóng bay
      const p = S2(34, 38, 2.5);
      sc.raw(80, `<rect x="${p[0]-1.6}" y="${p[1]-7}" width="3.2" height="5" rx="1" fill="#F2A33A"/><rect x="${p[0]-1.4}" y="${p[1]-2.2}" width="1.2" height="2.2" fill="#2B3A67" stroke="none"/><rect x="${p[0]+.2}" y="${p[1]-2.2}" width="1.2" height="2.2" fill="#2B3A67" stroke="none"/><circle cx="${p[0]}" cy="${p[1]-8.8}" r="2" fill="#F6D2B0"/><path d="M${p[0]+1.6} ${p[1]-6}v-7" stroke="#2B3A67" stroke-width=".5" fill="none"/><g class="bob" style="--k:4"><circle cx="${p[0]-.4}" cy="${p[1]-15.4}" r="2.6" fill="#E0483A"/><circle cx="${p[0]+3.6}" cy="${p[1]-16.4}" r="2.6" fill="#3E7FCB"/><circle cx="${p[0]+1.6}" cy="${p[1]-19}" r="2.6" fill="#F4C542"/></g>`, [[p[0]-3,p[1]-22],[p[0]+7,p[1]]]);
      // biển FUN PARK ở góc trước
      const s = S2(42, 42, 2.5); sc.raw(96, `<path d="M${s[0]-5} ${s[1]}V${s[1]-6}M${s[0]+5} ${s[1]}V${s[1]-6}" stroke="#8A5A34" stroke-width="1.4" fill="none"/><rect x="${s[0]-10}" y="${s[1]-12.4}" width="20" height="6.6" rx="1.8" fill="#E0483A"/><text x="${s[0]}" y="${s[1]-7.6}" text-anchor="middle" font-size="5.4" font-weight="900" fill="#FFFFFF" stroke="none" letter-spacing=".6">PARK</text>`, [[s[0]-12,s[1]-16],[s[0]+12,s[1]]]);
    }
    // lá vàng rơi
    let leaves = ''; [[12,-6],[-6,14],[-6,36],[34,-6],[12,-6],[-6,14]].forEach((q,k) => { const a = S2(q[0],q[1],5); leaves += `<ellipse class="lf ${k<2?'a':''}" cx="${(a[0]+(k%3-1)*4).toFixed(1)}" cy="${(a[1]-16).toFixed(1)}" rx="1.6" ry=".9" fill="#F4C542" stroke="#B9822E" stroke-width=".5" style="--k:${k}"/>`; });
    sc.raw(800, leaves);
    // thời tiết lơ lửng trên ô: mỗi nhóm chỉ hiện ở pha của nó
    const sk = S2(14,14,46);
    let rays = ''; for(let k=0;k<8;k++){ const a = k*Math.PI/4; rays += `<path d="M${(sk[0]+10*Math.cos(a)).toFixed(1)} ${(sk[1]+10*Math.sin(a)).toFixed(1)}L${(sk[0]+14*Math.cos(a)).toFixed(1)} ${(sk[1]+14*Math.sin(a)).toFixed(1)}" fill="none" stroke="#FFD93B" stroke-width="2.4"/>`; }
    const cloud = (x, y, s2, col) => `<g stroke="none"><ellipse cx="${x}" cy="${y+2.2*s2}" rx="${11*s2}" ry="${4.2*s2}" fill="${shade(col,.82)}"/><circle cx="${x-5*s2}" cy="${y}" r="${4.6*s2}" fill="${col}"/><circle cx="${x+1*s2}" cy="${y-2.6*s2}" r="${6*s2}" fill="${col}"/><circle cx="${x+6.4*s2}" cy="${y+.4*s2}" r="${4.2*s2}" fill="${col}"/><ellipse cx="${x-1*s2}" cy="${y-4.6*s2}" rx="${3*s2}" ry="${1.4*s2}" fill="#FFFFFF" opacity=".7"/></g>`;
    let drops = ''; for(let k=0;k<9;k++) drops += `<path class="drop" d="M${(sk[0]-10+k*2.6).toFixed(1)} ${(sk[1]+6+(k%3)*2).toFixed(1)}l-1.2 4" fill="none" stroke="#6EC1E4" stroke-width="1.4" style="--k:${k}"/>`;
    let gust = ''; for(let k=0;k<3;k++) gust += `<path class="gust" d="M${(sk[0]-16).toFixed(1)} ${(sk[1]+8+k*9).toFixed(1)}q9 -4 17 0t15 -1" fill="none" stroke="#FFFFFF" stroke-width="1.6" style="--k:${k}"/>`;
    const night = `<polygon points="${P(-E,-E,5)} ${P(B,-E,5)} ${P(B,B,2.5)} ${P(-E,B,5)}" fill="#1B2547" opacity=".4" stroke="none"/>`;
    let stars = ''; [[-16,-8],[12,-12],[20,2],[-6,6]].forEach((q,k) => { stars += `<path class="star" d="M${sk[0]+q[0]} ${sk[1]+q[1]-2}l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.8-1.4.8.3-1.5-1.1-1 1.5-.2z" fill="#FFE27A" stroke="none" style="--k:${k}"/>`; });
    let glows = ''; [[28,31],[17,22],[28,17]].forEach(q => { const a = S2(q[0],q[1],2.5); glows += `<circle cx="${a[0]}" cy="${a[1]-11.5}" r="8" fill="#FFE27A" opacity=".45" stroke="none"/>`; });
    sc.raw(990, `<g class="w w-moon">${night}${glows}</g>`);
    sc.raw(995, `<g class="w w-sun"><g class="spin6" style="transform-origin:${sk[0]}px ${sk[1]}px">${rays}</g><circle cx="${sk[0]}" cy="${sk[1]}" r="8" fill="#FFD93B" stroke="#E0A91B" stroke-width="1"/><ellipse cx="${sk[0]-2.6}" cy="${sk[1]-3}" rx="3" ry="1.8" fill="#FFFFFF" opacity=".65" stroke="none"/></g>
      <g class="w w-rain">${drops}${cloud(sk[0], sk[1], 1.1, '#E8ECF2')}</g>
      <g class="w w-wind">${cloud(sk[0]-4, sk[1]-2, .8, '#FFFFFF')}${gust}</g>
      <g class="w w-moon"><path d="M${sk[0]+5} ${sk[1]-7}a8 8 0 1 0 3.5 13.6a6.4 6.4 0 1 1 -3.5 -13.6z" fill="#FFE27A" stroke="#E0A91B" stroke-width="1"/>${stars}</g>`, [[sk[0]-18,sk[1]-16],[sk[0]+18,sk[1]+30]]);
    return sc.out([B/2,B/2,0]);
  }
  if(kind==='visit'){               // Vườn thú nhiệt đới: vòm kính có vẹt và cây, khỉ trên cây, hồ chim cánh cụt, hồng hạc, hươu cao cổ
    base(-1, 1, ['#8FCB5C','#6FAE4A','#5E9A3E'], ['#7DBF4E','#66A543','#578F39']);
    const K = cityKit('x', sc);
    sc.raw(-45, `<polygon points="${P(0,22,2.5)} ${P(46,22,2.5)} ${P(46,27,2.5)} ${P(0,27,2.5)}" fill="#F4C542" stroke="none"/><polygon points="${P(22,0,2.5)} ${P(27,0,2.5)} ${P(27,46,2.5)} ${P(22,46,2.5)}" fill="#F4C542" stroke="none"/>`);
    // vòm kính nhà nhiệt đới (đặt ở phía có y lớn để không đè ô bên cạnh)
    { const c = S2(32,34,2.5), R = 11.5, rx = R*1.2247, ry = R*.66, H = R*1.25*ISOK.z;
      sc.raw(30, `<ellipse cx="${c[0]}" cy="${c[1]}" rx="${rx+1.2}" ry="${ry+.8}" fill="#D9D4C8"/>`
        + `<circle cx="${c[0]-5}" cy="${c[1]-5}" r="5.4" fill="#3F9A45" stroke="none"/><circle cx="${c[0]+5}" cy="${c[1]-8}" r="6.4" fill="#4FAE52" stroke="none"/><circle cx="${c[0]+1}" cy="${c[1]-3}" r="4" fill="#5FB860" stroke="none"/>`
        + `<g class="bob" style="--k:1"><path d="M${c[0]+2} ${c[1]-15}l3 -2.2l1.6 3.2z" fill="#E0483A"/><path d="M${c[0]-7} ${c[1]-12}l3 -2.2l1.6 3.2z" fill="#3E7FCB"/><path d="M${c[0]+7} ${c[1]-10}l2.6 -2l1.4 2.8z" fill="#F4C542"/></g>`
        + `<path d="M${c[0]-rx} ${c[1]}A${rx} ${H} 0 0 1 ${c[0]+rx} ${c[1]}A${rx} ${ry} 0 0 1 ${c[0]-rx} ${c[1]}Z" fill="#BFE8F2" opacity=".55"/>`
        + [-.6,-.2,.2,.6].map(t => `<path d="M${(c[0]+t*rx).toFixed(1)} ${(c[1]+Math.sqrt(1-t*t)*ry).toFixed(1)}Q${(c[0]+t*rx*1.12).toFixed(1)} ${(c[1]-H*.72).toFixed(1)} ${c[0]} ${(c[1]-H).toFixed(1)}" fill="none" stroke="#FFFFFF" stroke-width=".9"/>`).join('')
        + `<path d="M${c[0]-rx*.82} ${c[1]-H*.5}Q${c[0]} ${c[1]-H*.62} ${c[0]+rx*.82} ${c[1]-H*.5}" fill="none" stroke="#FFFFFF" stroke-width=".8"/><ellipse cx="${c[0]-rx*.45}" cy="${c[1]-H*.6}" rx="2.4" ry="4" fill="#FFFFFF" opacity=".55" stroke="none"/>`,
        [[c[0]-rx-2,c[1]-H-2],[c[0]+rx+2,c[1]+ry+2]]); }
    // hồ chim cánh cụt có tảng băng (thấp, đặt phía y nhỏ)
    sc.box({x:29,y:4,z:2.5,w:14,d:12,h:.6,c:C3('#6EC1E4')}, -20);
    sc.box({x:36,y:6,z:3.1,w:5,d:4,h:2,c:C3('#F4F7FA')}, -19);
    [[32,11,0],[33.6,13.4,1],[39,13.4,2]].forEach(q => { const p = S2(q[0],q[1],3.1); sc.raw(-18+q[2]*.01, `<g class="hop" style="--k:${q[2]}"><ellipse cx="${p[0]}" cy="${p[1]-3}" rx="1.8" ry="3" fill="#2B3A67"/><ellipse cx="${p[0]}" cy="${p[1]-2.6}" rx="1.1" ry="2.1" fill="#FFFFFF" stroke="none"/><path d="M${p[0]-.6} ${p[1]-5}h1.2l-.6 .9z" fill="#F2A33A" stroke="none"/></g>`, [[p[0]-2,p[1]-7],[p[0]+2,p[1]]]); });
    // hồng hạc bên hồ nhỏ
    sc.box({x:6,y:4,z:2.5,w:12,d:9,h:.5,c:C3('#6EC1E4')}, -21);
    [[9,10,0],[13,8,1]].forEach(q => { const p = S2(q[0],q[1],3); sc.raw(-17+q[2]*.01, `<g class="bob" style="--k:${q[2]+2}"><path d="M${p[0]} ${p[1]}v-5" stroke="#F27BA6" stroke-width=".8"/><ellipse cx="${p[0]+.6}" cy="${p[1]-6.6}" rx="2.2" ry="1.6" fill="#F49AB8"/><path d="M${p[0]+2} ${p[1]-7}q1 -4 -1 -5" fill="none" stroke="#F49AB8" stroke-width="1"/><path d="M${p[0]+.8} ${p[1]-12.2}l1.2 .6" stroke="#2B3A67" stroke-width=".8"/></g>`, [[p[0]-3,p[1]-13],[p[0]+3,p[1]]]); });
    // khỉ đu trên cây
    treeS(14, 30, 7, '#3F9A45', 2.5);
    { const p = S2(14,30,2.5); sc.raw(70.6, `<g class="swing" style="transform-origin:${p[0]+3}px ${p[1]-15}px"><path d="M${p[0]+3} ${p[1]-15}q2 4 0 7" fill="none" stroke="#8A5A34" stroke-width="1"/><circle cx="${p[0]+3}" cy="${p[1]-7}" r="2.1" fill="#8A5A34"/><circle cx="${p[0]+3.6}" cy="${p[1]-7.2}" r="1" fill="#F6D2B0" stroke="none"/><path d="M${p[0]+1.4} ${p[1]-5.4}q-1.6 1.6 0 3" fill="none" stroke="#8A5A34" stroke-width=".8"/></g>`, [[p[0]-2,p[1]-16],[p[0]+7,p[1]]]); }
    // hươu cao cổ ở góc ngoài
    grp(60, beast(-10,40,5,6.4,3.6,3.6,5,'#F2C25C').concat([{x:-5.4,y:40.8,z:13.4,w:1.8,d:2,h:8,c:C3('#F2C25C')},{x:-5.6,y:40.4,z:21.4,w:3.8,d:2.8,h:2.4,c:C3('#F2C25C')}]), 'nod', '--k:5', `<circle cx="${S2(-6,43.6,10)[0]}" cy="${S2(-6,43.6,10)[1]}" r=".9" fill="#D98A3D" stroke="none"/><circle cx="${S2(-8.6,43.6,11.6)[0]}" cy="${S2(-8.6,43.6,11.6)[1]}" r=".9" fill="#D98A3D" stroke="none"/>`);
    // voi con dạo dưới hàng cọ
    grp(52, beast(4,18,2.5,7,4.6,4,1.8,'#9AA7B8').concat([{x:11,y:18.4,z:4.6,w:2.8,d:3.8,h:3.4,c:C3('#9AA7B8')},{x:13.6,y:19.6,z:2.6,w:1,d:1.2,h:3.6,c:C3('#8794A6')}]), 'pace', '--dx:3px;--dy:1.6px;--k:1');
    [[-6,12],[-6,26],[2,52]].forEach((q,i) => K.palm(q[0], q[1], q[1]>46 ? 5 : 5, 13, 5+q[0]+q[1]));
    // cổng ở mép trước
    const Yg = B+E-1, g1 = S2(2,Yg,5), g2 = S2(22,Yg,5), top = 13;
    sc.raw(900, `<path d="M${g1[0]} ${g1[1]}V${g1[1]-top}M${g2[0]} ${g2[1]}V${g2[1]-top}" fill="none" stroke="#2E7D4F" stroke-width="3"/><polygon points="${P(0,Yg,5+top-6)} ${P(24,Yg,5+top-6)} ${P(24,Yg,5+top+1)} ${P(0,Yg,5+top+1)}" fill="#3FA66B"/><text transform="matrix(.866,.5,0,1,${g1[0]+.6},${g1[1]-top+2.4})" x="${((g2[0]-g1[0])/.866/2-.6).toFixed(1)}" text-anchor="middle" font-size="4.6" font-weight="900" fill="#FFFDF6" stroke="none" letter-spacing=".8">ZOO</text><circle cx="${g1[0]}" cy="${g1[1]-top-2}" r="2.4" fill="#F4C542"/><circle cx="${g2[0]}" cy="${g2[1]-top-2}" r="2.4" fill="#F4C542"/>`, [[g1[0]-3,g1[1]-top-5],[g2[0]+3,g2[1]]]);
    // chim bay ngang ô
    const b0 = S2(-10,30,30), b1 = S2(40,10,30);
    let birds = ''; for(let k=0;k<3;k++) birds += `<g class="bird" style="--bx:${(b1[0]-b0[0]).toFixed(1)}px;--by:${(b1[1]-b0[1]).toFixed(1)}px;--k:${k}"><path class="flap" d="M${(b0[0]-3).toFixed(1)} ${(b0[1]+k*5).toFixed(1)}q1.6 -2.6 3 0q1.4 -2.6 3 0" fill="none" stroke="${['#E0483A','#3E7FCB','#F4C542'][k]}" stroke-width="1.5"/></g>`;
    sc.raw(980, birds, [[b0[0]-4,b0[1]-4],[b1[0]+4,b1[1]+12]]);
    return sc.out([B/2,B/2,0]);
  }
  // trạm khởi hành (ngân hàng), góc dưới: ngoài là +x và +y. Có xe chở tiền đỗ trước cửa
  base(1, 1, ['#DCE4EE','#A9B8CE','#8FA0BA'], ['#C6D1E0','#9DAEC6','#8597B2']);
  let deck = '';
  for(let k=0;k<7;k++) deck += `<polygon points="${P(3+k*3.2,3,2.5)} ${P(3+k*3.2+1.6,3,2.5)} ${P(3+k*3.2+1.6,22,2.5)} ${P(3+k*3.2,22,2.5)}" fill="${k%2 ? '#FFFDF6' : '#2B3A67'}" stroke="none"/>`;
  sc.raw(-40, deck);
  const bx = 31, by = 29, bw = 21, bd = 25, bh = 12, bz = 5;
  sc.box({x:bx-3,y:by-3,z:bz,w:bw+9,d:bd+6,h:1.4,c:['#F4EEDC','#DCD3BC','#C8BEA4']}, 560);
  sc.box({x:bx,y:by,z:bz+1.4,w:bw,d:bd,h:bh,c:['#FFFDF6','#F1EAD8','#DCD3BC']}, 562);
  [by+1, by+8, by+15, by+22].forEach((y,k) => sc.box({x:bx+bw+1.5,y:y,z:bz+1.4,w:2.6,d:2.6,h:bh,c:['#FFFFFF','#EDE7D6','#D6CDB6']}, 580+k));
  const rz = bz+1.4+bh, rx1 = bx+bw+5.5, ym = by+bd/2;
  sc.raw(900, `<polygon points="${P(bx-2,by+bd+3,rz)} ${P(rx1,by+bd+3,rz)} ${P(rx1,ym,rz+10)} ${P(bx-2,ym,rz+10)}" fill="#6F87A8"/><polygon points="${P(rx1,by-3,rz)} ${P(rx1,by+bd+3,rz)} ${P(rx1,ym,rz+10)}" fill="#FFFDF6"/>`, [isoP(bx-2,ym,rz+10), isoP(rx1,ym,rz+10), isoP(rx1,by-3,rz), isoP(bx-2,by+bd+3,rz)]);
  const gg = S2(rx1,ym,rz+3.4); sc.raw(910, `<circle class="bglow" cx="${gg[0]}" cy="${gg[1]}" r="8" fill="#FFE27A" stroke="none" opacity="0"/><circle cx="${gg[0]}" cy="${gg[1]}" r="4" fill="#F4C542"/><text x="${gg[0]}" y="${gg[1]+2.6}" text-anchor="middle" font-size="7" font-weight="800" fill="#7A3B00" stroke="none">₫</text>`);
  const fp = S2(24,54,5); sc.raw(578.4, `<path d="M${fp[0]} ${fp[1]}V${fp[1]-20}" fill="none" stroke="#3D4A63" stroke-width="1.8"/><path d="M${fp[0]} ${fp[1]-20}l10 3.2l-10 3.6z" fill="#E0685C"/>`, [[fp[0]-2,fp[1]-22],[fp[0]+11,fp[1]]]);
  // xe chở tiền màu xanh đỗ trước cửa; khi có lượt chở tiền thì xe chạy tới và tiền bay vào ngân hàng
  const tx = 9, ty = 50.5, tz = 5, G1 = '#7FD36B';
  const wheel2 = (x, y) => { const a = S2(x,y,tz+1.3); return `<circle cx="${a[0]}" cy="${a[1]}" r="1.7" fill="#2B3A67"/><circle cx="${a[0]}" cy="${a[1]}" r=".7" fill="#C9D1DE" stroke="none"/>`; };
  const ds = S2(tx+5, ty+7, tz+6.4), back = sc.P(-16,0,0);
  grp(570, [{x:tx,y:ty,z:tz+1.2,w:10,d:7,h:8,c:C3(G1)},{x:tx+10,y:ty,z:tz+1.2,w:4.6,d:7,h:5.6,c:C3('#8FE07A')},{x:tx+1,y:ty+1,z:tz+9.2,w:4,d:5,h:1.6,c:C3('#5FB85A')},{x:tx+5.6,y:ty+1,z:tz+9.2,w:3.6,d:5,h:2.6,c:C3('#6FC466')}], 'truck', `--tx:${back[0]}px;--ty:${back[1]}px`,
    wheel2(tx+2.4,ty+7) + wheel2(tx+11.6,ty+7) + `<polygon points="${P(tx+10.8,ty+7,tz+3.4)} ${P(tx+13.8,ty+7,tz+3.4)} ${P(tx+13.8,ty+7,tz+6)} ${P(tx+10.8,ty+7,tz+6)}" fill="#3D4A63"/><circle cx="${ds[0]}" cy="${ds[1]}" r="2.6" fill="#FFFDF6" stroke="none"/><text x="${ds[0]}" y="${ds[1]+1.7}" text-anchor="middle" font-size="4.4" font-weight="800" fill="#2F7A3A" stroke="none">₫</text>`);
  const c0 = S2(tx+5, ty+3.5, tz+12); let coins = '';
  for(let k=0;k<6;k++) coins += `<g class="tcoin" style="--cx:${(gg[0]-c0[0]).toFixed(1)}px;--cy:${(gg[1]-c0[1]).toFixed(1)}px;--k:${k}"><ellipse cx="${c0[0]}" cy="${c0[1]}" rx="3" ry="2" fill="${k%2 ? '#F4C542' : '#86D36B'}" stroke-width=".8"/></g>`;
  sc.raw(985, coins, [[c0[0]-4,c0[1]-16]]);
  return sc.out([B/2,B/2,0]);
}
function fxBuildDust(i){
  if(HEADLESS || calm()) return;
  const c = PTC['r'+i] || PTC['h'+i] || ptOf(i), L = document.getElementById('fx'); if(!c || !L) return;
  const e = document.createElement('div'); e.className = 'bfx'; e.style.cssText = `left:${c[0]}px;top:${c[1]}px`;
  let puffs = ''; for(let k=0;k<7;k++) puffs += `<i style="--a:${Math.round(k*51+Math.random()*30)}deg;--d:${14+Math.round(Math.random()*16)}px;animation-delay:${(k*.09).toFixed(2)}s"></i>`;
  e.innerHTML = puffs + '<b class="bh">🔨</b><b class="bs">🪚</b>'; L.appendChild(e); setTimeout(() => e.remove(), 1700);
  SFX.play('saw'); SFX.play('build', .35);
}
const MOD = {ok:false, els:{}};
function renderModels(){
  const hb = document.getElementById('houses'); if(!hb) return;
  let box = document.getElementById('models');
  if(!box){ box = document.createElement('div'); box.id = 'models'; hb.parentNode.insertBefore(box, hb.nextSibling); }
  if(MOD.rk !== (S.mode==='rank')){ MOD.rk = S.mode==='rank'; MOD.ok = false; }
  if(!MOD.ok){ box.innerHTML = ''; MOD.els = {}; MOD.ctr = null; MOD.ok = true; }
  { const old = box.querySelector('.k-center'); if(old) old.remove(); }
  cornerState('go');
  if(S.landed && TILES[S.landed.i] && (TILES[S.landed.i].n==='Khí vận' || TILES[S.landed.i].n==='Cơ hội')){ const ic = document.querySelector(`#board .cell[data-i="${S.landed.i}"] .ic`); if(ic) ic.classList.toggle('hit2', Date.now() - S.landed.at < 2200); }
  let airN = 0; const now = Date.now(), fly = now - CFX.truckAt, n = S.players.length || 4;
  TILES.forEach((t,i) => {
    const corner = t.k==='go' || t.k==='visit' || t.k==='park' || t.k==='gotojail';
    const kind = corner ? t.k : t.k==='air' ? 'air' : t.k==='gift' ? 'gift' : t.k==='co' ? (t.n.indexOf('Điện')>=0 ? 'power' : 'water') : t.k==='island' ? 'island' : t.k==='tax' ? 'tax' : t.k==='fortune' ? 'clover' : t.k==='chance' ? 'qmark' : '';
    if(!kind) return;
    const v = kind==='air' ? airN++ : 0;
    let cls = '', ev = 0;
    if(corner){ const cs = cornerState(t.k); cls = cs.c; ev = cs.ev; }
    else if(kind==='air'){ if(CFX.kind==='plane' && CFX.truckAt && fly < 4800 && CFX.plane === v){ cls = 'fly'; ev = fly; } }
    else if(kind==='power'){ if(Math.floor(S.turns*2/n) % 2 === 0) cls = 'on'; }
    else { const age = (S.landed && S.landed.i===i) ? now - S.landed.at : 1e9; if(age < 2200){ cls = 'hit'; ev = age; } }
    if((kind==='tax' || kind==='clover' || kind==='qmark' || kind==='spark' || kind==='fundm') && S.players.some(p => p.alive!==false && p.pos===i)) cls = (cls + ' occ').trim();
    let el = MOD.els[i];
    if(!el){
      if(!camIdle()) return;                                   // chỉ dựng khi bàn cờ đang đứng yên để lấy đúng vị trí
      let c, m, wpx, dz;
      if(corner){ c = ptOf(i); const ck = (S.mode==='rank' && t.k!=='go' ? 'rk' : '') + t.k; m = CORNER3D[ck] || (CORNER3D[ck] = cornerModel(ck)); wpx = m.w * (LAY.S*2.5/15*Math.SQRT2*.92) / (46*2*.866); dz = 2; }
      else {
        const ic = document.querySelector(`#board .cell[data-i="${i}"] .ic`); if(!ic) return;
        const q = ic.getBoundingClientRect(); if(!q.width) return; c = toLocal(q.left + q.width/2, q.top + q.height/2);
        const sd = SIDEOF[i], ori = (sd==='s-b' || sd==='s-t') ? 'y' : 'x', flip = sd==='s-l' || sd==='s-t', mk = (S.mode==='rank' && kind==='island') ? 'volcano' : kind, key = mk + v + ori + (flip?'f':'');
        m = TILE3D[key] || (TILE3D[key] = tileModel(mk, v, ori, flip));
        wpx = m.w * LAY.S * (kind==='air' ? .0042 : kind==='clover' ? .00147 : kind==='qmark' ? .00147 : (kind==='power' || kind==='water') ? .00272 : kind==='island' ? .00272 : kind==='startup' ? .0027 : kind==='grave' ? .0031 : kind==='tax' ? .0014 : (kind==='spark' || kind==='fundm') ? .0017 : .0024); dz = 1;
        if(kind==='clover' || kind==='qmark' || kind==='tax' || kind==='spark' || kind==='fundm'){       // biểu tượng nổi chính giữa ô, thay cho chữ
          const cell = ic.closest('.cell'), pp = [[0,0],[100,0],[100,100],[0,100]].map(a => { const d = document.createElement('i'); d.style.cssText = `position:absolute;width:0;height:0;left:${a[0]}%;top:${a[1]}%`; cell.appendChild(d); const r = d.getBoundingClientRect(); d.remove(); return toLocal(r.left, r.top); });
          if(pp.every(Boolean)) c = [(pp[0][0]+pp[1][0]+pp[2][0]+pp[3][0])/4, (pp[0][1]+pp[1][1]+pp[2][1]+pp[3][1])/4];
        }
        if(kind==='gift'){                                        // hộp quà nằm chính giữa ô và to hơn
          const cell = ic.closest('.cell'), pp = [[0,0],[100,0],[100,100],[0,100]].map(a => { const d = document.createElement('i'); d.style.cssText = `position:absolute;width:0;height:0;left:${a[0]}%;top:${a[1]}%`; cell.appendChild(d); const r = d.getBoundingClientRect(); d.remove(); return toLocal(r.left, r.top); });
          if(pp.every(Boolean)){ c = [(pp[0][0]+pp[1][0]+pp[2][0]+pp[3][0])/4, (pp[0][1]+pp[1][1]+pp[2][1]+pp[3][1])/4]; wpx *= 1.02; }
        }
        if(kind==='startup' || kind==='grave' || kind==='island'){   // ba tiện ích này phủ kín ô và kéo dài ra tới mép ngoài của viền cỏ
          const cell = ic.closest('.cell'), pp = [[0,0],[100,0],[100,100],[0,100]].map(a => { const d = document.createElement('i'); d.style.cssText = `position:absolute;width:0;height:0;left:${a[0]}%;top:${a[1]}%`; cell.appendChild(d); const r = d.getBoundingClientRect(); d.remove(); return toLocal(r.left, r.top); });
          if(pp.every(Boolean)){
            const mid = (a,b) => [(a[0]+b[0])/2, (a[1]+b[1])/2], ds = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]), vert = sd==='s-b' || sd==='s-t';
            const eo = sd==='s-b' ? mid(pp[3],pp[2]) : sd==='s-t' ? mid(pp[0],pp[1]) : sd==='s-l' ? mid(pp[0],pp[3]) : mid(pp[1],pp[2]);   // giữa cạnh ngoài
            const ei = sd==='s-b' ? mid(pp[0],pp[1]) : sd==='s-t' ? mid(pp[3],pp[2]) : sd==='s-l' ? mid(pp[1],pp[2]) : mid(pp[0],pp[3]);   // giữa cạnh trong
            const lenPx = ds(eo,ei), widPx = vert ? ds(pp[0],pp[1]) : ds(pp[0],pp[3]), bd = document.getElementById('board');
            const ext = (bd.clientWidth*RIM_EXT) / Math.max(cell.offsetWidth, cell.offsetHeight), f = kind==='island' ? 1 : 1 + ext;
            const LEN = Math.round(16*lenPx*f/widPx*2)/2, k2 = key + '_' + LEN;
            m = TILE3D[k2] || (TILE3D[k2] = tileModel(mk, v, ori, flip, LEN));
            c = [ei[0] + (eo[0]-ei[0])*f/2, ei[1] + (eo[1]-ei[1])*f/2]; wpx = m.w * widPx / (16*Math.hypot(.866, ISOK.y));   // 1 đơn vị mô hình dọc cạnh ô dài hypot(.866, ISOK.y) trên hình vẽ
          }
        }
      }
      if(!c) return;
      el = document.createElement('div'); el._base = corner ? 'cm3 k-' + t.k : 't3 t-' + kind; el._cls = null;
      el.style.cssText = `--ct:${now%18018000};--k:0;--ev:0;left:${c[0]}px;top:${c[1]}px;width:${wpx.toFixed(1)}px;transform:translate(${(-m.ax).toFixed(1)}%,${(-m.ay).toFixed(1)}%);z-index:${Math.round(c[1])-dz}`;
      el.innerHTML = m.svg; box.appendChild(el); MOD.els[i] = el;
    }
    { const foc = [S.players[S.cur], S.players[S.viewer]], near = true, full = cls;
      if(el._cls !== full){ const evChanged = (el._cls || '').replace(' zz','') !== cls; el._cls = full; if(evChanged) el.style.setProperty('--ev', cls ? Math.round(ev) : 0); el.className = el._base + (full.trim() ? ' ' + full.trim() : ''); } }
  });
  // hai xấp thẻ Cơ hội / Khí vận: lá bài dựng đứng, sáng màu, bay lơ lửng trên bàn
  MOD.dk = MOD.dk || {};
  ['deckC','deckK'].forEach(id => { const dk = document.getElementById(id); if(!dk) return;
    let el = MOD.dk[id]; if(el && el.isConnected) return;
    const r = dk.getBoundingClientRect(), c = toLocal(r.left + r.width/2, r.top + r.height/2); if(!c) return;
    { const cr = document.getElementById('center').getBoundingClientRect(), mid = toLocal(cr.left + cr.width/2, cr.top + cr.height/2); if(mid){ c[0] += (mid[0]-c[0])*.07; c[1] += (mid[1]-c[1])*.07; } }
    if(id==='deckC'){ c[0] -= LAY.S*.03; c[1] += LAY.S*.018; } else { c[0] += LAY.S*.018; }   // Cơ hội sang trái và xuống, Khí vận sang phải cho cân   // lùi vào giữa bàn để không che ô đất
    const ch = id==='deckC', w = LAY.S*.083;
    const rkd = S.mode==='rank'; el = document.createElement('button'); el.className = 'dkb ' + (ch ? 'ch' : 'fo') + (rkd ? ' rk' : ''); el.setAttribute('aria-label', ch ? 'Xấp thẻ Cơ hội' : 'Xấp thẻ Khí vận');
    el.style.cssText = `left:${c[0].toFixed(1)}px;top:${c[1].toFixed(1)}px;width:${w.toFixed(1)}px;font-size:${(w*.2).toFixed(1)}px;z-index:${Math.round(c[1])+30}`;
    el.innerHTML = `<span class="dkbs"></span><span class="dkbc"><i></i><i></i>${rkd ? `<span class="rkcf">${RKCARD(ch, 'd')}</span>` : `<b><em>${ch ? '?' : '🍀'}</em><small>${ch ? 'Cơ hội' : 'Khí vận'}</small></b>`}</span>`;
    el.onclick = () => showTile(TILES.findIndex(t => t.k===(ch ? 'chance' : 'fortune')));
    box.appendChild(el); MOD.dk[id] = el; });
}
/* v150: đặt quân, bóng, quầng sáng bằng translate; trình duyệt quá cũ không có translate thì dùng left/top như trước */
const TK_TL = typeof CSS!=='undefined' && CSS.supports && CSS.supports('translate', '1px 1px');
if(typeof document!=='undefined' && !TK_TL) document.documentElement.classList.add('notl');
function tkPlace(e, x, y){ if(TK_TL) e.style.translate = x + 'px ' + y + 'px'; else { e.style.left = x + 'px'; e.style.top = y + 'px'; } }
function renderOver(){
  // nhà lego đứng trên ô
  let h = '';
  TILES.forEach((t,i) => {
    const lv = S.level[i]; if(!lv) return; let c = ptOf(i); if(!c) return;
    if(PTC['r'+i]) c = PTC['r'+i]; else { const ic = document.querySelector(`#rim i[data-r="${i}"]`) || document.querySelector(`#board .cell[data-i="${i}"] .lic`); if(ic){ const q = ic.getBoundingClientRect(); c = toLocal(q.left + q.width/2, q.top + q.height/2); const li = ic.hasAttribute('data-r') ? document.querySelector(`#board .cell[data-i="${i}"] .lic`) : null; if(li){ const q2 = li.getBoundingClientRect(), c2 = toLocal(q2.left + q2.width/2, q2.top + q2.height/2); const far = SIDEOF[i]==='s-l' || SIDEOF[i]==='s-t', k = far ? HOUSE_K[0] : HOUSE_K[1]; c = [c[0]*(1-k) + c2[0]*k, c[1]*(1-k) + c2[1]*k]; } if(q.width>0 && camIdle() && ic.hasAttribute('data-r')) PTC['r'+i] = c; } }
    const fresh = S.built && S.built.i===i && Date.now()-S.built.at < 1700, nd = fresh ? -(Date.now()-S.built.at) : 0;
    h += `<div class="hs2 ${fresh?'pop':''} ${lv===3?'shine':''}" style="left:${c[0]}px;top:${c[1]+LAY.tk*.12}px;--nd:${nd}ms;z-index:${Math.round(c[1])}">${lv===3?'<i class="sp1">✦</i><i class="sp2">✦</i><i class="sp3">✧</i>':''}${houseSVG(t.g, lv, (SIDEOF[i]==='s-b' || SIDEOF[i]==='s-t') ? 'y' : 'x', SIDEOF[i]==='s-b' || SIDEOF[i]==='s-r', S.players[S.owner[i]] ? S.players[S.owner[i]].color : null, t.n)}</div>`;
  });
  renderModels();
  { const hb = document.getElementById('houses'); if(hb._h !== h || (h && !hb.firstChild)){ hb._h = h; hb.innerHTML = h; } }

  fitNames();
  // quân cờ: giữ nguyên phần tử để di chuyển mượt
  const layer = document.getElementById('toks'), glow = document.getElementById('glow');
  S.players.forEach(p => {
    let ft = glow.querySelector(`.feet[data-p="${p.id}"]`);
    if(!ft){ ft = document.createElement('div'); ft.dataset.p = p.id; ft.style.setProperty('--c', p.color); glow.appendChild(ft); }
    const fc = tokenPt(p);
    ft.className = 'feet' + (p.alive ? '' : ' dead') + (p.id===S.cur && !S.over ? ' cur' : '');
    if(fc) tkPlace(ft, fc[0], fc[1]);   /* v131: trượt lớp có sẵn, không bắt máy tính lại bố cục và vẽ lại bàn */
    let el = layer.querySelector(`.tk[data-p="${p.id}"]`);
    if(!el){ el = document.createElement('div'); el.className = 'tk'; el.dataset.p = p.id; el.style.setProperty('--c', p.color); layer.appendChild(el); }
    const rg = ringSVG(p), key = rg ? 'r' + S.ring.start : '';
    { const ph = AV.ph ? AV.ph(p.id) : '', k2 = key + '|' + (ph ? ph.length + ph.slice(-16) : ''); if(el.dataset.k !== k2 || !el.firstChild){ el.dataset.k = k2; el.innerHTML = AV(p.id) + rg; } }
    const c = tokenPt(p);
    let sd = glow.querySelector(`.tsh[data-p="${p.id}"]`);
    if(!sd){ sd = document.createElement('div'); sd.className = 'tsh'; sd.dataset.p = p.id; glow.appendChild(sd); }
    sd.classList.toggle('dead', !p.alive || !!(p.rideUntil && Date.now()<p.rideUntil));
    if(c) tkPlace(sd, c[0], c[1]);   /* v150: trượt bằng translate (GPU), không bắt máy tính lại bố cục và vẽ lại bàn cờ mỗi khung hình */
    el.className = 'tk' + (S.plate && p.id===S.plateSeat ? ' tpl tplate-' + S.plate : '') + (p.alive ? '' : ' dead') + (p.id===S.viewer && !p.bot ? ' me' : '') + (p.id===S.cur && !S.over ? ' cur' : '') + (p.hitAt && Date.now()-p.hitAt<650 ? ' ouch' : '') + (p.rideUntil && Date.now()<p.rideUntil ? ' riding' : '') + ['sob','rage','joy','hop','hop2','landq','hopR','hopL','hopF','hopB','flying'].map(k => el.classList.contains(k) ? ' ' + k : '').join('');
    if(c){ tkPlace(el, c[0], c[1]); el.style.zIndex = Math.round(c[1]) + 1; }
  });
  layer.querySelectorAll('.tk').forEach(el => { if(+el.dataset.p >= S.players.length) el.remove(); });
  glow.querySelectorAll('.feet,.tsh').forEach(el => { if(+el.dataset.p >= S.players.length) el.remove(); });
  bubbles.forEach((b, pid) => { const c = tokenPt(S.players[pid]); if(c){ b.el.style.left = c[0] + 'px'; b.el.style.top = (c[1] - LAY.tk*.98) + 'px'; } });
}
function render(){ if(HEADLESS) return; renderBoard(); renderRim(); renderPlayers(); renderButtons(); renderAssets(); renderOver(); renderStash(); renderDanger(); tutCheck(); netSync();
  if(S && S.rules) SFX.mood(!S.over && ((S.rules.rounds - S.round) <= 3 || (limitMs() - (Date.now() - S.start)) < 300000)); }
// Trước khi gieo: tô viền đỏ các ô của đối thủ trong tầm 2 đến 12 bước và báo xác suất dính tiền thuê
const TUT = (() => {
  const KEY = 'lendoi_tut'; let d = {}; try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {} };
  const TIPS = {
    roll:['Tới lượt bạn! Bấm <b>GIEO</b>. Hết 17 giây game tự gieo.', '#rollBtn'],
    start2:['Bạn có sẵn <b>2 ô cùng màu</b>. Thêm ô thứ ba là đủ nhóm, nhận huy hiệu.', ''],
    buy:['<b>Mua</b> thì ai dừng ở đây phải trả thuê cho bạn. Xem gợi ý NÊN MUA phía trên.', ''],
    own:['Đất của bạn có <b>dải màu của bạn</b>. Số đỏ trên ô là tiền thuê.', ''],
    danger:['<b>Viền đỏ</b>: ô đối thủ trong tầm gieo, dừng là mất tiền thuê.', ''],
    rent:['Vừa trả <b>tiền thuê</b>. Nhiều viền đỏ thì dùng ô dù, tô phở trong Túi đồ trước khi gieo.', '#bagBtn'],
    build:['Về lại đất mình thì <b>nâng nhà</b>. Nhà càng cao, thuê càng lớn.', ''],
    trade:['Thiếu ô để đủ nhóm? Chạm <b>thẻ người chơi khác</b>, bấm 🤝 Đổi.', ''],
    jail:['Đang bị giam: nộp tiền, dùng thẻ hoặc gieo đôi để ra. Bị giam chỉ thu nửa tiền thuê.', ''],
    finale:['<b>3 vòng cuối</b>, tiền thuê gấp đôi. Giữ tiền mặt và tránh ô viền đỏ!', '']
  };
  let cur = null;
  return {
    get open(){ return !!cur; },
    reset(){ d = {}; save(); },
    off(){ Object.keys(TIPS).forEach(k => d[k] = 1); save(); this.hide(); },
    hide(){ const e = document.getElementById('coach'); if(e) e.remove(); document.querySelectorAll('.tutglow').forEach(x => x.classList.remove('tutglow')); const was = cur; cur = null; if(was) setTimeout(tutCheck, 350); },
    show(k){
      if(HEADLESS || cur || d[k] || !TIPS[k] || NET || (S && S.tutm)) return false;
      d[k] = 1; save(); cur = k;
      const e = document.createElement('div'); e.id = 'coach';
      e.innerHTML = `<span class="chav">${AV(S ? S.viewer : 0)}</span><p>${TIPS[k][0]}</p><div class="chbt"><button type="button" class="btn primary" id="coachOk">Đã hiểu</button><button type="button" id="coachOff">Tắt hướng dẫn</button></div>`;
      document.body.appendChild(e);
      const a = TIPS[k][1] && document.querySelector(TIPS[k][1]); if(a) a.classList.add('tutglow');
      document.getElementById('coachOk').onclick = () => { SFX.play('pop'); this.hide(); };
      document.getElementById('coachOff').onclick = () => this.off();
      setTimeout(() => { if(cur===k && document.getElementById('coach')===e) this.hide(); }, 8000);
      SFX.play('pop'); return true;
    }
  };
})();
// gọi sau mỗi lần vẽ lại: xem tình huống hiện tại có mẹo nào chưa nói thì nói
function tutCheck(){
  if(HEADLESS || !S || S.over || NET || TUT.open) return;
  const me = S.players[S.viewer]; if(!me || me.bot || !me.alive) return;
  const myRoll = !!(S.wait && S.wait.pid===me.id && S.wait.mode==='roll'), modal = !document.getElementById('modal').hidden, title = modal ? document.getElementById('mTitle').textContent : '';
  if(modal && document.querySelector('#mBody .buyp') && document.querySelector('#mOpts button')) { TUT.show('buy'); return; }
  if(modal && /Nâng|Xây/.test(document.getElementById('mOpts').textContent) && askOpen){ TUT.show('build'); return; }
  if(modal) return;
  if(me.jail>0 && myRoll){ if(TUT.show('jail')) return; }
  if(myRoll && S.turns<=S.players.length){ if(TUT.show('roll')) return; if(owned(me).length>=2 && TUT.show('start2')) return; }
  if(myRoll && me.tutRent){ me.tutRent = 0; if(TUT.show('rent')) return; }
  if(myRoll && document.querySelector('#board .cell.dz')){ if(TUT.show('danger')) return; }
  if(myRoll && owned(me).length && S.round>=2){ if(TUT.show('own')) return; }
  if(myRoll && S.round>=3 && canTrade(me) && S.players.some(q => q.id!==me.id && q.alive && owned(q).some(i => sellable(q, i)))){ if(TUT.show('trade')) return; }
  if(myRoll && S.rules.finale && S.round > S.rules.rounds - S.rules.finale){ TUT.show('finale'); }
}
function renderDanger(){
  const me = S && S.players[S.viewer], on = !!(me && me.alive && !me.bot && !S.over && S.wait && S.wait.pid===me.id && S.wait.mode==='roll' && !held(me));
  let prob = 0, worst = 0; const hot = {};
  if(on) for(let d=2; d<=12; d++){ const i = (me.pos + d) % N, o = S.owner[i]; if(o<0 || o===me.id) continue; const op = S.players[o]; if(!op.alive || mate(me, op)) continue;
    const r = rentOf(i, d); if(r<=0) continue; hot[i] = 1; prob += (6 - Math.abs(7 - d))/36; worst = Math.max(worst, r); }
  document.querySelectorAll('#board .cell.dz').forEach(c => { if(!hot[c.dataset.i]) c.classList.remove('dz'); });
  Object.keys(hot).forEach(i => { const c = document.querySelector(`#board .cell[data-i="${i}"]`); if(c) c.classList.add('dz'); });

}
/* v148: người chơi thật trong ván (phòng bạn bè, xếp hạng có người): kết bạn qua máy chủ bằng mã kết bạn, ra ngoài sảnh hiện đúng trong danh sách Bạn bè */
const realPl = p => !!(p && !p.bot && (p.remote || (S && S.net) || (typeof NET!=='undefined' && NET && NET.live)));
function frBtn(p){
  const F = window.FR_; if(!F || !p.fi || p.fi===F.uid()) return '';
  const st = F.st(p.fi);
  return st==='fr' ? '<div class="pfpal on">✓ Bạn bè</div>' : st==='sent' ? '<button class="btn pfpal" disabled>⏳ Đã gửi lời mời</button>'
    : `<button class="btn pfpal" data-rfa="${p.id}">${st==='in' ? '🤝 Đồng ý kết bạn' : '+ Kết bạn'}</button>`;
}
if(!HEADLESS) document.addEventListener('click', async e => { const b = e.target.closest('[data-rfa]'); if(!b || !S || !window.FR_) return; const p = S.players[+b.dataset.rfa]; if(!p || !p.fi) return;
  b.disabled = true; b.textContent = '…';
  try { if(window.FR_.st(p.fi)==='in') await window.FR_.accept(p.fi); else await window.FR_.request(p.fi, {n:p.name}); } catch(err) {}
  setTimeout(() => { try { if(document.getElementById('assets')) renderAssets(); } catch(err) {} }, 300); });
if(!HEADLESS) window.addEventListener('fr-changed', () => { try { if(document.getElementById('assets')) renderAssets(); } catch(e) {} });
function renderAssets(){
  const box = document.getElementById('assets'), p = S.players[(box && INSPECT!=null && S.players[INSPECT]) ? INSPECT : S.viewer], mine = owned(p), me = p.id===S.viewer;
  const ci = document.getElementById('chatIn'); if(ci && chatTab==='table') ci.placeholder = S.players[S.viewer].name + ' nhắn cho cả bàn';
  if(!box) return;
  const d = debt(p), it = p.loans.reduce((a,L) => a + loanInt(L), 0), mineTurn = !!(S.wait && S.wait.pid===p.id && !S.over), sellNow = me && canList(p);
  const rank = S.players.filter(q => q.alive).sort((a,b) => netWorth(b)-netWorth(a)).indexOf(p) + 1;
  const burst = !p.alive ? ['PHÁ SẢN','#B9C2CC'] : rank===1 ? ['TOP 1!','#FFD23F'] : d>0 ? ['NỢ!','#FF7A59'] : [`HẠNG ${rank}`,'#7FE0C3'];
  const where = !p.alive ? 'Đã rời ván' : p.jail ? 'Đang bị giam' : p.island ? `Ở Đảo hoang, còn ${p.island} lượt` : 'Đang ở ' + TILES[p.pos].n;
  let L = `<div class="pfh"><span class="pfav">${AV(p.id)}</span><div class="pfn"><b>${esc(p.name)}</b><small>${p.bot ? 'Máy' : 'Người chơi'}. ${where}</small></div><span class="burst" style="--b:${burst[1]}">${burst[0]}</span></div>
    ${!me && realPl(p) ? frBtn(p) : ''}${!me && !realPl(p) && window.PALS && !/^Máy \d+$/.test(p.name) ? (() => { const f = window.PALS.info(p.name); return f ? `<div class="pfpal on">❤️ ${f.pts} · ${f.title && f.title.k ? f.title.i + ' ' + f.title.n : f.lv}</div>` : `<button class="btn pfpal" data-pal="${p.id}">+ Kết bạn</button>`; })() : ''}
    <div class="pfs"><div class="pn y"><small>Tiền mặt</small><b>${p.cash}</b></div>
    <div class="pn r"><small>Nợ</small><b>${d}</b>${d ? `<i>lãi ${it} mỗi vòng</i>` : '<i>không nợ ai</i>'}</div>
    <div class="pn t"><small>Tổng tài sản</small><b>${netWorth(p)}</b><i>${d ? `đã trừ nợ ${d}` : 'tiền + đất + nhà'}</i></div></div>`;
  // Thẻ sổ đỏ: mỗi mảnh đất là một lá thẻ, khoản nợ là một tờ giấy nợ
  let R = `<div class="tag">Sổ đỏ (${mine.length})</div>`;
  if(!mine.length && !p.card) R += '<p class="say">Chưa có mảnh đất nào!</p>';
  R += '<div class="sdrow">';
  if(p.card) R += `<div class="sdc"><span class="sd" style="--g:#8A96A3"><span class="sdt">🔑</span><b>Thẻ Ra tù</b><span class="sdr"><small>Đang có</small><em>×${p.card}</em></span></span>${sellNow ? '<button class="btn mini" data-sell="-1">Bán</button>' : ''}</div>`;
  R += mine.map(i => {
    const t = TILES[i], lv = S.level[i], co = t.k==='co';
    const rent = co ? '×' + (TILES.filter((x,j)=>x.k==='co'&&S.owner[j]===p.id).length===2?UTIL_X[1]:UTIL_X[0]) : rentOf(i,0);
    const pips = (t.k==='land' && lv) ? `<span class="sdlv">${LV[lv]}</span>` : '';
    return `<div class="sdc"><button class="as sd ${isColl(i)?'coll':''}" data-a="${i}" style="--g:${t.g?G[t.g]:'#8A96A3'}" aria-label="${t.n}, thuê ${rent}${isColl(i)?', đang thế chấp':''}"><span class="sdt">${t.i||''}</span><b>${t.k==='air' ? t.n.replace(/^Sân bay /,'') : t.k==='co' ? t.n.replace(/^Công ty /,'') : t.n}</b>${pips}<span class="sdr"><small>${co?'Thuê 🎲':'Thuê'}</small><em>${rent}</em></span>${isColl(i)?'<span class="sdst">Thế chấp</span>':''}</button>${sellNow && sellable(p,i) ? `<button class="btn mini" data-sell="${i}">Bán</button>` : ''}${!me && p.alive && canTrade(S.players[S.viewer]) && sellable(p,i) ? `<button class="btn mini trb" data-trade="${i}">🤝 Đổi</button>` : ''}</div>`;
  }).join('') + '</div>';
  if(p.loans.length) R += '<div class="tag o">Giấy nợ · lãi ' + it + '/vòng</div><div class="sdrow">' + p.loans.map((Ln,k) => `<div class="sdc"><span class="sd debt"><span class="sdt">${Ln.type==='bank'?'🏦 Ngân hàng':'🤝 Xã hội'}</span><span class="sdr"><small>Nợ gốc</small><em>${Ln.principal}</em></span><span class="sdn">Lãi ${loanInt(Ln)}/vòng${Ln.type==='bank' ? ' · 🔒 ' + Ln.tiles.length + ' ô' : ''}</span></span>${me ? `<button class="btn mini" data-repay="${k}" ${mineTurn && p.cash>=Ln.principal ? '' : 'disabled'}>Trả hết</button>` : ''}</div>`).join('') + '</div>';
  const pf = perksOf(p);
  const ak = airKing(p) ? `<div class="asrow"><span class="as"><span class="bdg" style="--g:#5FA8D3">✈️</span><span class="an"><b>Ông trùm hàng không</b><small>Dừng ở sân bay của mình: bay tới ô bất kỳ. ${flyWait(p) ? 'Còn ' + flyWait(p) + ' vòng nữa' : 'Sẵn sàng bay'}</small></span></span></div>` : '';
  const uk = utilOwned(p).length ? `<div class="asrow"><span class="as"><span class="bdg ${utilKing(p) ? '' : 'half'}" style="--g:#F4C542">⚡</span><span class="an"><b>${utilKing(p) ? 'Trùm điện nước' : 'Cắt ' + cutWhat(p)}</b><small>Cắt ${cutWhat(p)} 1 ô đất của người khác, ô đó ${utilKing(p) ? 'mất trắng' : 'giảm 50%'} tiền thuê. ${cutWait(p) ? 'Còn ' + cutWait(p) + ' vòng nữa' : 'Sẵn sàng cắt'}</small></span></span></div>` : '';
  if(pf.length || ak || uk) R += '<div class="tag g">Huy hiệu</div><div class="agrid">' + pf.map(g => `<div class="asrow"><span class="as"><span class="bdg ${pk(p,g)<1?'half':''}" style="--g:${G[g]}">${PERK[g].i}</span><span class="an"><b>${PERK[g].n}${pk(p,g)<1?' ½':''}</b><small>${perkText(p,g)}</small></span></span></div>`).join('') + ak + uk + '</div>';
  if(p.startup) R += `<p class="say">🚀 Công ty khởi nghiệp trị giá ${p.startup}.</p>`;
  const html = `<div class="pf" style="--c:${p.color}"><div class="pfL">${L}</div><div class="pfR">${R}</div></div>`;
  // không đổi gì thì giữ nguyên bảng (không nháy, không mất chỗ đang cuộn); có đổi thì vẽ lại nhưng giữ vị trí cuộn
  if(box._h===html) return;
  const mb = document.getElementById('mBody'), sc = [...box.querySelectorAll('*')].filter(e => e.scrollTop || e.scrollLeft).map(e => [e.className, e.scrollTop, e.scrollLeft]), mbt = mb ? mb.scrollTop : 0;
  box.innerHTML = html; box._h = html;
  sc.forEach(([c, t, l]) => { const e = c && box.getElementsByClassName(String(c).split(' ')[0])[0]; if(e){ e.scrollTop = t; e.scrollLeft = l; } });
  if(mb) mb.scrollTop = mbt;
}
let INSPECT = null;
const profOpen = () => !document.getElementById('modal').hidden && !!document.querySelector('#modal .dlg.prof');
function profClose(){ if(profOpen()) closeModal(); }
function openAssets(pid){
  if(askOpen || !S) return;
  INSPECT = (pid!=null && S.players[pid]) ? pid : S.viewer;
  openModal('', '<div id="assets"></div>', [{label:'Đóng', primary:true, fn: closeModal}], 'one prof');
  renderAssets();
}
function pos(i){
  if(i===0) return [12,12]; if(i<11) return [12,12-i]; if(i===11) return [12,1];
  if(i<22) return [12-(i-11),1]; if(i===22) return [1,1]; if(i<33) return [1,i-21]; if(i===33) return [1,12]; return [i-32,12];
}
const CELLS = {key:[], el:[]};
function renderBoard(){
  const b = document.getElementById('board');
  if(!document.getElementById('center')){
    b.innerHTML = `<div id="center">
      <div class="deck" id="deckK" style="--dk:#86BC82" aria-label="Xấp thẻ Khí vận"><i></i><i></i><i class="top"><span>🍀</span>Khí vận</i></div>
      <div class="deck" id="deckC" style="--dk:#EE8A62" aria-label="Xấp thẻ Cơ hội"><i></i><i></i><i class="top"><span>❓</span>Cơ hội</i></div></div>`;
    document.getElementById('diceTray').innerHTML = dieHTML() + dieHTML();
    CELLS.key = []; CELLS.el = [];
  }
  const center = document.getElementById('center'), now = Date.now(), tpl = document.createElement('template');
  TILES.forEach((t,i) => {
    const [r,c] = pos(i), o = S.owner[i], prop = t.k==='land'||t.k==='air'||t.k==='co';
    const lvl = (t.k==='land' && o>=0) ? pk(S.players[o], t.g) : 0, full = lvl===1, half = lvl===.5;
    const here = S.players.filter(p => p.alive && p.pos===i), sp = here.find(p => p.id===S.cur) || here[0];
    const ld = S.landed && S.landed.i===i ? now - S.landed.at : 9999;
    const side = SIDEOF[i] = ((r===1||r===12) && (c===1||c===12)) ? 'cn' : r===12 ? 's-b' : r===1 ? 's-t' : c===1 ? 's-l' : 's-r';
    const val = !prop ? '' : o<0 ? priceOf(i) : t.k==='co' ? '×' + (TILES.filter((x,j) => x.k==='co' && S.owner[j]===o).length===2 ? UTIL_X[1] : UTIL_X[0]) : rentOf(i, 0);
    const cls = `cell ${side} ${t.k==='land'?'g-'+t.g:'sp k-'+t.k} ${o>=0?'own':''} ${full?'full':''} ${half?'half':''} ${sp?'stand':''} ${ld<900?'landed':''}`;
    const st0 = `grid-row:${r};grid-column:${c};` + (t.g?`--g:${G[t.g]};`:'') + (o>=0?`--o:${S.players[o].color};`:'') + (sp?`--pc:${sp.color};`:'');
    const inner = (prop ? `<span class="band ${o>=0?'rent':''}"><b class="bv">${val}</b></span>` : '')
      + `<span class="nmw"><span class="nm">${boardName(t.n)}</span></span>`
      + `<span class="${t.k==='land'?'lic':'ic'}">${t.k==='land' ? (LICON[t.n]||'') : t.i}</span>`
      + (o>=0 ? `<span class="ow" style="background:${S.players[o].color}">${isColl(i)?'🔗':''}</span>` : '')
      + (full ? '<span class="spk s1">✦</span><span class="spk s2">✦</span><span class="spk s3">✧</span>' : '');
    const key = cls + '|' + st0 + '|' + inner, old = CELLS.el[i];
    if(CELLS.key[i]===key && old && old.isConnected) return;          // không đổi gì thì giữ nguyên phần tử
    const st = st0 + (full?`--ph:${-(now%2400)}ms;--ph2:${-((now+i*370)%1900)}ms;--ph3:${-(now%2000)}ms;`:'') + (half?`--ph:${-(now%1300)}ms;`:'') + (sp?`--phs:${-(now%1500)}ms;`:'') + (ld<900?`--ld:${-ld}ms;`:'');
    tpl.innerHTML = `<button class="${cls}" style="${st}" data-i="${i}" aria-label="${t.n}">${inner}</button>`;
    const el = tpl.content.firstChild;
    if(old && old.isConnected) old.replaceWith(el); else b.insertBefore(el, center);
    CELLS.key[i] = key; CELLS.el[i] = el;
  });
  const cur = S.players[S.cur], st = document.getElementById('status');
  st.innerHTML = S.over ? 'Ván đã kết thúc' : `<span class="dot" style="background:${cur.color}">${AV(cur.id)}</span><span>${cur.bot ? esc(cur.name) + ' đang đi' : 'Lượt của <b>' + esc(cur.name) + '</b>'}</span>`;
  document.getElementById('fundv').textContent = S.fund; { const fp = document.getElementById('fundPill'), sb = document.getElementById('suBtn'), me = S.players[S.viewer];
    if(fp){ if(fp._v!=null && S.fund > fp._v){ fp.classList.remove('bump'); void fp.offsetWidth; fp.classList.add('bump'); } fp._v = S.fund; fp.classList.toggle('hot', S.fund >= 300); }
    if(sb){ const v = me && me.alive ? (me.startup||0) : 0; sb.hidden = !v; document.getElementById('suv').textContent = v; }
    { const cb = document.getElementById('cutBtn'); if(cb){ const uk = utilOwned(me).length>0; cb.hidden = !uk; if(uk){ const w = cutWait(me); const cv = document.getElementById('cutv'); cv.hidden = !w; cv.textContent = w; cb.classList.toggle('rdy', !w); cb.classList.toggle('wait', !!w); } }
      document.querySelectorAll('#board .cell.cutoff').forEach(e => e.classList.remove('cutoff'));
      if(S.cut && cutOn(S.cut.i)){ const ce = document.querySelector(`#board .cell[data-i="${S.cut.i}"]`); if(ce) ce.classList.add('cutoff'); } } }
  { const rv = document.getElementById('roundv'); if(rv){ const m = 1 + S.rules.ramp*Math.floor((S.round-1)/5); rv.innerHTML = `V${Math.min(S.round, S.rules.rounds)}/${S.rules.rounds}` + (m>1 ? `<i class="rvm" title="Tiền thuê đang nhân ${m}">×${m}</i>` : '') + (S.rules.finale && S.round > S.rules.rounds - S.rules.finale ? '<i class="rvf">🔥×2</i>' : '');   /* v148: gọn, hệ số thuê thành nhãn nhỏ */ } }
  tickClock();
}
const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const ROT = {1:[90,0],2:[180,0],3:[-90,90],4:[90,90],5:[0,0],6:[-90,0]};   // số điểm tính theo MẶT TRÊN của xúc xắc (như gieo ngoài đời)
function dieHTML(){
  let f = '';
  for(let v=1;v<=6;v++){ f += `<div class="face f${v}"><b class="pg">`; for(let k=0;k<9;k++) f += `<i class="${PIPS[v].includes(k)?'on':''}"></i>`; f += '</b></div>'; }
  return `<div class="dslot"><div class="shadow"></div><div class="drop"><div class="tilt"><div class="cube">${f}</div></div></div></div>`;
}
function tickClock(){
  const el = document.getElementById('clock'); if(!el || !S) return;
  const ms = Math.max(0, limitMs()-(Date.now()-S.start)); el.textContent = Math.floor(ms/60000)+':'+String(Math.floor(ms%60000/1000)).padStart(2,'0');
}
async function showDice(a, b){
  SFX.play('dice');
  S.dice = [a,b]; if(!netClient()){ S.diceSeq = (S.diceSeq||0) + 1; netSync(true); }
  if(HEADLESS || QUIT) return;
  const cubes = document.querySelectorAll('#diceTray .cube'), drops = document.querySelectorAll('#diceTray .drop'), sh = document.querySelectorAll('#diceTray .shadow');
  const sumEl = document.getElementById('sum'); sumEl.textContent = '';
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done = [];
  [a,b].forEach((v,k) => {
    const [rx,ry] = ROT[v], end = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(0deg)`;
    cubes[k].style.transform = end;
    if(still || !cubes[k].animate) return;
    const d = 950 + k*130, dir = k ? -1 : 1;
    done.push(cubes[k].animate([{transform:`rotateX(${rx+dir*1080}deg) rotateY(${ry-dir*900}deg) rotateZ(${dir*540}deg)`},{transform:end}],{duration:d,easing:'cubic-bezier(.2,.7,.2,1)'}).finished);
    drops[k].animate([
      {transform:'translate(' + (dir*-30) + 'px,-260px)',offset:0,easing:'cubic-bezier(.5,0,1,.6)'},
      {transform:'translate(' + (dir*-8) + 'px,0)',offset:.55,easing:'cubic-bezier(0,.6,.4,1)'},
      {transform:'translate(' + (dir*-3) + 'px,-36px)',offset:.72,easing:'cubic-bezier(.5,0,1,.6)'},
      {transform:'translate(0,0)',offset:.88,easing:'ease-out'},
      {transform:'translate(0,-8px)',offset:.94,easing:'ease-in'},
      {transform:'translate(0,0)',offset:1}],{duration:d});
    sh[k].animate([{opacity:0,transform:'scale(.3)',offset:0},{opacity:.3,transform:'scale(1)',offset:.55},{opacity:.15,transform:'scale(.7)',offset:.72},{opacity:.3,transform:'scale(1)',offset:.88},{opacity:.3,transform:'scale(1)',offset:1}],{duration:d});
  });
  await Promise.all(done).catch(() => {});
  sumEl.textContent = '';   // bỏ dòng chữ "Gieo được N" cạnh xúc xắc, nhìn mặt xúc xắc là đủ
  if(a===b && !still){
    SFX.play('double');
    const tray = document.getElementById('diceTray'), fx = document.createElement('div'); fx.className = 'dblfx';
    let sp = ''; for(let k=0;k<14;k++) sp += `<span style="--a:${Math.round(k*360/14 + Math.random()*16)}deg;--d:${70 + Math.round(Math.random()*60)}px;--z:${(.5+Math.random()*.9).toFixed(2)}"></span>`;
    fx.innerHTML = '<i></i><u></u>' + sp + '<b>ĐÔI!</b>'; tray.appendChild(fx); setTimeout(() => fx.remove(), 1400);
  }
  await sleep(280);
}
const STASH = {full:{w:230, h:170}, cmp:{w:140, h:86}};
// Chọn kích thước khu tài sản sao cho nằm trọn trong góc trống bên ngoài hình thoi của bàn cờ
function stashLayout(W, H, cx, cy, hw, hh, lx, rx, appbar, tall){
  const out = [null,null,null,null], TOP = 72, BOT = 70; hw *= 1.07; hh *= 1.07;
  for(let q=0;q<4;q++){
    const left = q===0 || q===1, top = q===1 || q===2;
    if(tall || (appbar && top)) continue;
    const padX = 8 + (left ? lx : rx);
    const okScale = d => {
      for(let sc=1.0; sc>=.4; sc-=.02){
        const w = d.w*sc, h = d.h*sc, x = left ? padX + w : W - padX - w, y = top ? TOP + h : H - BOT - h;
        if(left ? x > cx : x < cx) continue;
        if(top ? y > cy : y < cy) continue;
        if(Math.abs(cx-x)/hw + Math.abs(cy-y)/hh >= 1) return sc;
      }
      return 0;
    };
    let mode = 'full', sc = okScale(STASH.full);
    if(sc < .72){ mode = 'cmp'; sc = Math.min(okScale(STASH.cmp), 1.0); if(sc < .5) continue; }
    const d = STASH[mode];
    out[q] = {mode, sc, left, top, padX, off: (top ? TOP : BOT) + d.h*sc + 6};
  }
  return out;
}
// ----- hình tiền kiểu truyện tranh: xấp tiền xanh và các cột xu vàng, nhiều tiền thì xấp cao và nhiều hơn
function coinCol(x, y, k){
  let s = ''; const rx = 11, ry = 4.2, th = 3.8, K = 'stroke="#6B4A1A" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';
  for(let i=0;i<k;i++){
    const cy = y - i*th;
    s += `<path d="M${x-rx} ${cy-th}V${cy}A${rx} ${ry} 0 0 0 ${x+rx} ${cy}V${cy-th}A${rx} ${ry} 0 0 1 ${x-rx} ${cy-th}Z" fill="#E2A247" ${K}/>`;
    s += `<path d="M${x-6} ${cy+2.2}v-${th-1}M${x} ${cy+3.2}v-${th-1}M${x+6} ${cy+2.2}v-${th-1}" stroke="#6B4A1A" stroke-width="1" opacity=".55" fill="none"/>`;
  }
  const ty = y - (k-1)*th - th;
  return s + `<ellipse cx="${x}" cy="${ty}" rx="${rx}" ry="${ry}" fill="#F3C65E" ${K}/><ellipse cx="${x}" cy="${ty}" rx="${rx*.6}" ry="${ry*.6}" fill="none" stroke="#B9822E" stroke-width="1.2"/>`;
}
const ISO = {w:26, d:14, h:5.4};
// Phép chiếu của mọi mô hình 3D: khớp đúng độ nghiêng thật của bàn cờ (rotateX(tilt) rotateZ(45deg)), để mô hình luôn nằm khít ô
const ISOK = {y:.5, z:1, t:0};
const isoP = (x, y, z) => [(x-y)*.866, (x+y)*ISOK.y - z*ISOK.z];
function setIsoTilt(t){
  if(ISOK.t===t) return; const r = t*Math.PI/180;
  ISOK.t = t; ISOK.y = .866*Math.cos(r); ISOK.z = 1.2247*Math.sin(r);
  for(const o of [TILE3D, CORNER3D, H3]) for(const k in o) delete o[k];
  PCAR = null; MOD.ok = false;
}
function isoBox(b){
  const P = (x,y,z) => isoP(x,y,z).map(v => v.toFixed(1)).join(','), x = b.x, y = b.y, z = b.z, w = b.w, d = b.d, h = b.h;
  let s = `<polygon points="${P(x+w,y,z)} ${P(x+w,y+d,z)} ${P(x+w,y+d,z+h)} ${P(x+w,y,z+h)}" fill="${b.c[2]}"/>`
        + `<polygon points="${P(x,y+d,z)} ${P(x+w,y+d,z)} ${P(x+w,y+d,z+h)} ${P(x,y+d,z+h)}" fill="${b.c[1]}"/>`
        + `<polygon points="${P(x,y,z+h)} ${P(x+w,y,z+h)} ${P(x+w,y+d,z+h)} ${P(x,y+d,z+h)}" fill="${b.c[0]}"/>`;
  if(b.band){ const a = x+w*.4, e = x+w*.62;
    s += `<polygon points="${P(a,y,z+h)} ${P(e,y,z+h)} ${P(e,y+d,z+h)} ${P(a,y+d,z+h)}" fill="${b.band}" stroke="none"/>`
       + `<polygon points="${P(a,y+d,z)} ${P(e,y+d,z)} ${P(e,y+d,z+h)} ${P(a,y+d,z+h)}" fill="${b.band}" stroke="none" opacity=".92"/>`; }
  return s;
}
function moneySVG(cash){
  const dk = '#2F5A2A';
  if(cash<=0) return `<svg viewBox="0 0 122 92" style="--vw:90" class="msvg" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="61" cy="72" rx="36" ry="11" fill="none" stroke="${dk}" stroke-width="2" stroke-dasharray="5 4" opacity=".55"/><text x="61" y="64" text-anchor="middle" font-size="26" font-weight="800" fill="${dk}" opacity=".5">0</text></svg>`;
  const w = ISO.w, d = ISO.d, h = ISO.h, B = Math.min(36, Math.round(cash/50)), gold = cash>1800 ? Math.min(4, Math.ceil((cash-1800)/700)) : 0;
  const coinsN = B===0 ? Math.min(4, Math.max(1, Math.ceil(cash/12.5))) : Math.min(3, Math.round((cash%50)/16));
  const cells = [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], tops = ['#A9D27E','#9ECB72'], boxes = [], piles = Math.ceil(B/12);
  for(let k=0;k<piles;k++){
    const n = Math.floor(B/piles) + (k < B%piles ? 1 : 0), oy = k===1 ? 3*d+8 : 0, ox = k===2 ? 2*w+8 : 0; let left = n;
    [[6,0],[4,1],[2,2]].forEach(L => { const m = Math.min(L[0], left); for(let c=0;c<m;c++) boxes.push({x:ox+cells[c][0]*w, y:oy+cells[c][1]*d, z:L[1]*h, w, d, h, c:[tops[(c+L[1])%2],'#78B556','#5A9743'], band:'#EDE08F'}); left -= m; });
  }
  for(let j=0;j<gold;j++) boxes.push({x:(piles>=3 ? 4*w+16 : 2*w+5), y:j*13, z:0, w:22, d:10, h:5, c:['#F7D96E','#E0AC3C','#BE8423'], band:null});
  boxes.sort((a,b) => ((a.x+a.w/2+a.y+a.d/2) - (b.x+b.w/2+b.y+b.d/2)) || (a.z-b.z));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  boxes.forEach(b => { [[b.x,b.y,b.z],[b.x+b.w,b.y,b.z],[b.x,b.y+b.d,b.z],[b.x+b.w,b.y+b.d,b.z],[b.x,b.y,b.z+b.h],[b.x+b.w,b.y,b.z+b.h],[b.x,b.y+b.d,b.z+b.h],[b.x+b.w,b.y+b.d,b.z+b.h]].forEach(p => { const q = isoP(p[0],p[1],p[2]); x0 = Math.min(x0,q[0]); x1 = Math.max(x1,q[0]); y0 = Math.min(y0,q[1]); y1 = Math.max(y1,q[1]); }); });
  if(!boxes.length){ x0 = x1 = 0; y0 = 0; y1 = 22; }
  let body = '';
  boxes.forEach(b => { body += isoBox(b); });
  let coin = '', left2 = coinsN, col = 0;
  while(left2>0 && col<2){ const k = Math.min(left2, 3); coin += coinCol(x1 + 12 + col*24, y1 - 2 - (col%2)*3, k); left2 -= k; col++; }
  const rx = coinsN ? x1 + 12 + (col-1)*24 + 13 : x1;
  return `<svg viewBox="${(x0-3).toFixed(1)} ${(y0-4).toFixed(1)} ${(rx-x0+6).toFixed(1)} ${(y1-y0+8).toFixed(1)}" style="--vw:${(rx-x0+6).toFixed(0)}" class="msvg" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g stroke="${dk}" stroke-width="1" stroke-linejoin="round">${body}</g>${coin}</svg>`;
}
const SLOT_ORDER = ['nau','xn','hong','cam','do','vang','xl','xd'];
function stashHTML(p, mode){
  return `<div class="stm">${moneySVG(p.cash)}<b class="stamt">${p.cash}</b></div>`;
}
function renderStash(){
  const box = document.getElementById('stash'); if(!box || !S || !LAY.stash) return;
  S.players.forEach(p => {
    const q = seatPos(p.id), L = LAY.stash[q];
    let el = box.querySelector(`.stash[data-p="${p.id}"]`);
    if(!el){ el = document.createElement('div'); el.dataset.p = p.id; el.addEventListener('click', () => openAssets(p.id)); box.appendChild(el); }
    if(!L || !p.alive){ el.style.display = 'none'; return; }
    const d = STASH[L.mode];
    el.style.cssText = `width:${d.w}px;height:${d.h}px;${L.left?'left':'right'}:${L.padX}px;${L.top?'top:72':'bottom:70'}px;transform:scale(${L.sc.toFixed(3)});transform-origin:${L.top?'top':'bottom'} ${L.left?'left':'right'};--c:${p.color}`;
    el.className = 'stash ' + L.mode + (L.left ? ' l' : ' r') + (L.top ? ' t' : ' b');
    const sig = L.mode + '|' + p.cash;
    if(el._sig===sig) return;
    const bump = el._cash!=null && el._cash!==p.cash ? (p.cash>el._cash ? ' bump up' : ' bump dn') : '';
    el._sig = sig; el._cash = p.cash;
    el.innerHTML = stashHTML(p, L.mode);
    if(bump){ const sm = el.querySelector('.stm'); if(sm) sm.className += bump; }
  });
}
// Dải viền cỏ phía ngoài mỗi ô có chủ được tô màu của người sở hữu
function renderRim(){
  const b = document.getElementById('board'); if(!b || !S) return;
  let box = document.getElementById('rim'); if(!box){ box = document.createElement('div'); box.id = 'rim'; b.appendChild(box); box._sig = null; }
  const fullAt = i => { const o = S.owner[i], t = TILES[i]; return o>=0 && o===S.viewer && t && t.k==='land' && groupIdx(t.g).filter(j => S.owner[j]===o).length>=2; };   // chỉ viền của người đang cầm máy mới nháy   // một người có từ 2 ô cùng nhóm màu thì miếng viền sở hữu của các ô đó nhấp nháy
  const sig = S.owner.map((o,i) => (o>=0 && S.players[o]) ? S.players[o].color + (fullAt(i) ? '*' : '') : '').join(',') + '|' + b.clientWidth;
  if(box._sig === sig) return;
  const rim = b.clientWidth*.046, gap = 3; let h = '';
  S.owner.forEach((o,i) => {
    if(o<0 || !S.players[o]) return; const sd = SIDEOF[i]; if(!sd || sd==='cn') return;
    const c = b.querySelector(`.cell[data-i="${i}"]`); if(!c) return;
    const x = c.offsetLeft, y = c.offsetTop, w = c.offsetWidth, hh = c.offsetHeight;
    const r = sd==='s-b' ? [x, y+hh+gap, w, rim] : sd==='s-t' ? [x, y-rim-gap, w, rim] : sd==='s-l' ? [x-rim-gap, y, rim, hh] : [x+w+gap, y, rim, hh];
    h += `<i data-r="${i}" class="${fullAt(i) ? 'full' : ''}" style="left:${r[0].toFixed(1)}px;top:${r[1].toFixed(1)}px;width:${r[2].toFixed(1)}px;height:${r[3].toFixed(1)}px;--o:${S.players[o].color}"></i>`;
  });
  box.innerHTML = h; box._sig = sig;
}
const rankOf = p => S.players.filter(q => q.alive).sort((a,b) => netWorth(b)-netWorth(a)).indexOf(p) + 1;   // thứ hạng theo tổng tài sản đã trừ nợ
function renderPlayers(){
  const plBox = document.getElementById('players'), plHTML = S.players.map(p => {
    return `<div data-p="${p.id}" role="button" tabindex="0" class="pc q${seatPos(p.id)}  ${p.id===S.cur&&!S.over?'cur':''} ${p.alive?'':'dead'} ${p.hitAt && Date.now()-p.hitAt<900?'hit':''} ${p.gainAt && Date.now()-p.gainAt<1100 && !(p.hitAt>p.gainAt)?'got':''}" style="--c:${p.color}">
      ${MIC_ON && NET && !p.bot ? `<span class="pmic ${micOf(p.id) ? 'on' : ''}" aria-label="${micOf(p.id) ? 'Mic đang bật' : 'Mic đang tắt'}">${micOf(p.id) ? '🎙️' : '🔇'}</span>` : ''}<span class="av">${AV(p.id)}${ringSVG(p)}</span>
      <span class="inf"><span class="nmx"><span class="pnm">${!p.bot && p.id===(NET ? NET.me : S.viewer) ? ttMini(TITLE.worn()) : ''}${esc(p.name)}</span>${p.alive && !S.rules.teams ? `<b class="prk r${rankOf(p)}">#${rankOf(p)}</b>` : ''}</span><span class="cash">${p.cash}</span><small>${S.rules.teams ? 'Đội ' + (p.id%2 ? 'B' : 'A') + ' · ' : ''}${p.alive ? owned(p).length + ' ô' : (p.out==='cut' ? 'bị loại' : 'phá sản')}</small></span></div>` ;
  }).join('');
  if(plHTML !== plBox._h || !plBox.firstChild){ plBox._h = plHTML; plBox.innerHTML = plHTML; }
}
function renderButtons(){
  const w = S.wait, on = !!w && !S.over && (!NET || w.pid===NET.me);
  { const key = w ? S.turns + ':' + w.pid + ':' + w.mode : ''; if(on && w.mode==='roll' && !S.players[w.pid].bot && key!==SFX.turnKey){ SFX.turnKey = key; SFX.play('turn'); } if(!w) SFX.turnKey = ''; }
  const rb = document.getElementById('rollBtn'); rb.disabled = !(on && w.mode==='roll'); rb.classList.toggle('blink', !rb.disabled);
  document.getElementById('endBtn').disabled = !(on && w.mode==='end');
  document.getElementById('quitBtn').disabled = NET ? false : !on;
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let chatTab = 'table', chatDm = null;   // khung chat trong ván có 3 mục: Ván (chỉ lời nói của người trong bàn), Thế giới (tin thế giới và chat thế giới), Bạn bè (nhắn riêng)
function renderChat(){
  const el = document.getElementById('chat'), sh = document.getElementById('sheetC'), X = window.HUBX, inp = document.getElementById('chatIn'); if(!el || !S) return;
  if(chatTab!=='table' && !X) chatTab = 'table';
  if(sh) sh.dataset.ct = chatTab; document.querySelectorAll('#cTabs button').forEach(b => b.classList.toggle('on', b.dataset.ct===chatTab));
  const myAv = AV(S.viewer);
  const row = (name, text, me, col, bdg, big, av) => `<div class="msg ${me?'me':''} ${big?'cemo':''}" style="--pc:${col}">${av ? `<span class="cav" title="${esc(name)}">${av}</span>` : `<b>${esc(name)}</b>`}${bdg ? `<i class="cbdg">${bdg}</i>` : ''}<span class="bb ${big?'big':''}">${esc(text)}</span></div>`;
  // người ngoài bàn (Thế giới, Bạn bè): tên nằm trên, bên dưới là mặt nhân vật và lời nói
  const rowN = (name, text, k, bdg, ft, pa) => `<div class="msg named" style="--pc:${PC[k%4]}"><small class="cnm">${esc(name)}${bdg ? ` <i class="cbdg">${bdg}</i>` : ''}</small><div class="crow"><span class="cav">${pa ? `<img class="avph" src="${pa}" alt="">` : X.av(k, ft)}</span><span class="bb">${esc(text)}</span></div></div>`;
  let h = '', ph = '';
  if(chatTab==='table'){
    h = chat.filter(m => !m.sys).map(m => { const p = S.players[m.pid]; return row(p.name, m.text, m.pid===S.viewer, p.color, m.pid!==S.viewer && window.PALS ? window.PALS.badge(p.name) : '', m.emoji, AV(p.id)); }).join('') || '<div class="sys">Chưa ai nói gì. Chào cả bàn đi!</div>';
    ph = S.players[S.viewer].name + ' nhắn cho cả bàn';
  } else if(chatTab==='world'){
    const L = X.FEED.L.filter(m => m.k==='sys' && !m.mine).map(m => ({at:m.at, sys:1, text:m.text})).concat(X.CHAT.d.world.filter(m => !m.sys).map(m => ({at:m.at, who:m.who, me:m.me, text:m.text, k:m.k, ft:m.ft, pa:m.pa}))).sort((a,b) => a.at-b.at).slice(-30);
    h = L.map(m => m.sys ? `<div class="sys">${esc(m.text)}</div>` : m.me ? row(m.who, m.text, true, S.players[S.viewer].color, '', false, myAv) : rowN(m.who, m.text, m.k!=null ? m.k : X.kOf(m.who), '', m.ft, m.pa)).join('');
    ph = `Nói trên Thế giới (còn ${STORE.loa} loa)`;
  } else {
    const D = window.RDM_, fr = D ? D.list() : [], f = chatDm && fr.find(x => x.id===chatDm); if(D) D.setOpen(f ? f.id : null);
    if(!f){ chatDm = null; ph = 'Chọn một người bạn để nhắn';
      h = fr.length ? fr.map(x => { const l = D.last(x.id), un = D.unread(x.id); return `<button class="cfr" data-cdm="${x.id}"><b>${esc(x.n)}</b>${un ? `<i class="cbdg dmun">${un}</i>` : ''}<small>${l ? (l.me ? 'Bạn: ' : '') + esc(l.text) : 'Chạm để nhắn tin'}</small></button>`; }).join('') : '<div class="sys">Bạn chưa có bạn bè thật. Kết bạn ở mục Bạn bè để nhắn tin với nhau.</div>'; }
    else { ph = 'Nhắn riêng cho ' + f.n;
      h = `<button class="cfr back" data-cdm="">‹ ${esc(f.n)}</button>` + (D.msgs(f.id).map(m => m.me ? row('Bạn', m.text, true, S.players[S.viewer].color, '', false, myAv) : rowN(f.n, m.text, f.k, '')).join('') || '<div class="sys">Gửi lời chào đầu tiên đi!</div>'); }
  }
  if(inp && document.activeElement!==inp) inp.placeholder = ph;
  el.innerHTML = h; el.scrollTop = el.scrollHeight;
  { const pv = document.getElementById('chatPrevL'); if(pv){ const L = chat.filter(m => !m.sys).slice(-1), open = sh && !sh.hidden;
      pv.innerHTML = L.length ? L.map(m => `<span><b>${esc(S.players[m.pid].name)}:</b> ${esc(m.text)}</span>`).join('') : '<span class="none">💬 Chat</span>';
      const key = L.length ? L[L.length-1].pid + '|' + L[L.length-1].text + '|' + chat.length : ''; const dot = document.getElementById('chatPrevDot');
      if(open) renderChat._seen = key; if(dot) dot.hidden = open || !key || renderChat._seen === key || (L.length && L[L.length-1].pid === S.viewer); } }
}
function showBubble(p, text, emoji){
  const old = bubbles.get(p.id); if(old){ clearTimeout(old.t); old.el.remove(); }
  const el = document.createElement('div'), ms = emoji ? 2800 : 4200, c = tokenPt(p) || [0,0];
  el.className = 'bub' + (emoji ? '' : ' txt'); el.textContent = text.length>48 ? text.slice(0,47) + '…' : text;
  el.style.cssText = `left:${c[0]}px;top:${c[1] - LAY.tk*.98}px;--o:${p.color};animation-duration:${ms}ms`;
  document.getElementById('fx').appendChild(el);
  bubbles.set(p.id, {el, t: setTimeout(() => { el.remove(); bubbles.delete(p.id); }, ms)});
}
function openModal(title, body, btns, cls){
  SFX.play(String(title).indexOf('⚠️')===0 ? 'warn' : 'pop');
  document.querySelector('#modal .dlg').className = 'dlg' + (cls ? ' ' + cls : '');
  document.getElementById('mTitle').textContent = title;
  document.getElementById('mBody').innerHTML = body;
  const o = document.getElementById('mOpts'); o.innerHTML = '';
  btns.forEach(b => { const e = document.createElement('button'); e.className = 'btn' + (b.primary?' primary':''); e.textContent = b.label; if(b.sub){ const sm = document.createElement('small'); sm.textContent = b.sub; e.appendChild(sm); e.classList.add('two'); } e.disabled = !!b.disabled; e.onclick = b.fn; o.appendChild(e); });
  { const bh = document.querySelector('#mBody .bh'); if(bh) o.prepend(bh); }   // gợi ý bộ sưu tập/huy hiệu nằm trên cùng cột nút
  document.getElementById('modal').hidden = false;
  const f = o.querySelector('button:not(:disabled)'); if(f) f.focus();
}
function closeModal(){ document.getElementById('modal').hidden = true; }
// Gợi ý ngắn: có nên mua ô này để lấy huy hiệu không, kèm một dòng nhỏ nói huy hiệu làm gì
function badgeHint(i, top){
  const t = TILES[i]; if(t && S && (t.k==='air' || t.k==='co')) return kingHint(i, (NET && NET.me!=null) ? NET.me : S.viewer);
  if(!t || t.k!=='land' || !S) return '';
  const me = S.players[(NET && NET.me!=null) ? NET.me : S.viewer] || S.players[S.viewer]; if(!me) return '';
  const idx = groupIdx(t.g), rest = idx.filter(j => j!==i), mine = rest.filter(j => S.owner[j]===me.id).length;
  const rivals = rest.filter(j => S.owner[j]>=0 && S.owner[j]!==me.id), blocker = S.players.find(q => q.id!==me.id && q.alive && rest.length && rest.every(j => S.owner[j]===q.id));
  let v = 'mid', tag = 'CÂN NHẮC', txt = 'Ô đầu nhóm';
  if(mine===rest.length){ v = 'yes'; tag = 'NÊN MUA'; txt = 'Đủ nhóm, có huy hiệu ngay'; }
  else if(blocker){ v = 'yes'; tag = 'NÊN MUA'; txt = `Chặn ${esc(blocker.name)}`; }
  else if(!rivals.length && mine>0){ v = 'yes'; tag = 'NÊN MUA'; txt = `Còn thiếu ${rest.length-mine} ô nữa`; }
  else if(rivals.length && idx.length===3 && mine===1){ v = 'yes'; tag = 'NÊN MUA'; txt = 'Được nửa huy hiệu'; }
  else if(rivals.length){ v = 'no'; tag = 'KHÔNG CẦN'; txt = 'Nhóm đã bị chia'; }
  return `<div class="bh v-${v}${top ? ' top' : ''}"><b>${tag}</b><span>${txt}</span><small>${PERK[t.g].i} Huy hiệu: ${PERK[t.g].d}</small></div>`;
}
function buyInfo(i){
  const t = TILES[i], col = t.g ? G[t.g] : '#98A4B3', price = priceOf(i);
  let cards = '', rows = '';
  if(t.k==='land'){
    [0,1,2,3].forEach(l => cards += `<div class="lvc"><small>${l ? LV[l] : 'Đất nền'}</small><span class="lvi">${l ? houseSVG(t.g, l, 'x', false, null, t.n) : '🚩'}</span><b>${baseRent(i,l)}</b></div>`);
    rows = `<div class="buyr"><span>Nâng mỗi cấp</span><b>${t.b}</b></div>`;
  } else if(t.k==='air'){
    AIR_RENT.forEach((v,k) => { cards += `<div class="lvc"><small>${k+1} sân bay</small><span class="lvi">✈️</span><b>${v}</b></div>`; });
  } else {
    cards = `<div class="lvc"><small>1 công ty</small><span class="lvi">${t.i}</span><b>×4</b></div><div class="lvc"><small>2 công ty</small><span class="lvi">${t.i}${t.i}</span><b>×10</b></div>`;
    rows = '<div class="buyr"><span>Tiền thuê</span><b>số nhân với xúc xắc</b></div>';
  }
  return `<!--B${i}--><div class="buyp" style="--g:${col}"><div class="buyh"><span>📍</span><b>${t.n}</b></div><div class="buylv">${cards}</div><div class="buyr big"><span>Giá mua</span><b>${price}</b></div>${rows}</div>${badgeHint(i, true)}<!--/B-->`;
}
function tileInfo(i){
  const t = TILES[i], o = S.owner[i], own = o>=0 ? S.players[o] : null;
  let h = own
    ? `<div class="ownr" style="--c:${own.color}"><span class="av">${AV(o)}</span><span>Chủ sở hữu: <b>${esc(own.name)}</b></span>${isColl(i) ? '<small>Ngân hàng đang giữ</small>' : ''}</div>`
    : `<div class="ownr none">Chưa có chủ. Giá mua <b>${t.p}</b></div>`;
  const row = (label, val, cur) => `<tr class="${cur?'cur':''}"><td>${label}${cur?' <i>đang thu</i>':''}</td><td>${val}</td></tr>`;
  h += `<table class="t" style="--hl:${t.g ? G[t.g] : '#8A96A3'}">`;
  if(t.k==='land'){
    [0,1,2,3].forEach(l => h += row(l ? LV[l] : 'Chưa xây', baseRent(i,l), !!own && l===S.level[i]));
    h += `<tr><td>Giá nâng mỗi cấp</td><td>${t.b}</td></tr><tr><td>${GN[t.g]}, đủ màu: thuê ×${String(FULL_X).replace('.', ',')} và</td><td>${PERK[t.g].i} ${PERK[t.g].n}</td></tr>`;
  } else if(t.k==='air'){
    const c = own ? TILES.filter((x,j) => x.k==='air' && S.owner[j]===o).length : 0;
    AIR_RENT.forEach((v,k) => { h += row(`Có ${k+1} sân bay`, v, c===k+1); });
  } else if(t.k==='co'){
    const c = own ? TILES.filter((x,j) => x.k==='co' && S.owner[j]===o).length : 0;
    h += row('Có 1 công ty', `${UTIL_X[0]} lần xúc xắc, cắt 1 ô giảm 50% thuê`, c===1) + row('Có cả 2 công ty', `${UTIL_X[1]} lần xúc xắc, cắt 1 ô mất trắng thuê`, c===2);
  }
  const mul = (t.k==='land' || t.k==='air' || t.k==='co') ? rentMul(i) : 1;
  return `<!--T${i}-->` + h + '</table>' + (mul!==1 ? `<p class="bn" style="margin:6px 0 0">Lúc này tiền thuê ô này đang nhân <b>×${mul}</b>.</p>` : '') + '<!--/T-->';
}
const INFO = {go:'Qua đây nhận 200.', visit:'Ghé thăm vườn thú, nghỉ chân ngắm thú.',
  park:'Nghỉ chân.', gotojail:'Bị giam. Nộp 100 hoặc gieo đôi để ra.', tax:'Nộp 10% tiền mặt.', grave:'Bị ma hù, mất 200.', chance:'Rút một thẻ Cơ hội.', fortune:'Rút một thẻ Khí vận.',
  island:'Giam 4 lượt. Nộp 100 để đi, hoặc kéo 1 người vào: mỗi người 2 lượt.', startup:'Rót 100, 200 hoặc 300 mở công ty. Mỗi vòng: lớn gấp rưỡi, đứng yên hoặc phá sản. Tới lượt là bán được.', fund:'Thuế, phạt chảy vào quỹ, mỗi vòng quỹ được thêm 50. Gieo ra đôi nổ hũ, ăn tối đa 300; không ra đôi nhận 15%.', gift:'Mở hộp, nhận 1 món ngẫu nhiên.'};
// truyện tranh 3 khung giải thích ô Khởi nghiệp và ô Quỹ, ít chữ
const dd = (a,b) => `<span class="cxd">${a}</span><span class="cxd">${b}</span>`;
const COMIC = {
  startup: () => { const me = S ? AV(S.viewer) : ''; return `<div class="cmx"><div class="cmq c1"><i>1</i><h5>Rót vốn</h5><div class="cms"><span class="cmbig">💵</span><em>➜</em><span class="cmbig">🚀</span></div><div class="cmchips"><span>100</span><span>200</span><span>300</span></div><b>Chọn số tiền rót vào</b></div>
    <div class="cmq c2"><i>2</i><h5>Chờ thời</h5><div class="cmrows"><div class="up"><span>🚀</span><em>Lớn lên x1,5</em><u>50%</u></div><div><span>😐</span><em>Giữ nguyên</em><u>30%</u></div><div class="dn"><span>💥</span><em>Mất hết</em><u>20%</u></div></div><b>Đổi vận mỗi lần qua Xuất phát</b></div>
    <div class="cmq c3"><i>3</i><h5>Bán lấy tiền</h5><div class="cms"><span class="cmpill">🚀 300</span><em>➜</em><span class="cmbig">💰</span><strong>+300</strong></div><b>Tới lượt, bấm 🚀 để bán</b></div></div>`; },
  fund: () => { const f = S ? S.fund : 100, ten = Math.round(f*.1); return `<div class="cmx"><div class="cmq c1"><i>1</i><h5>Quỹ lớn dần</h5><div class="cms"><span class="cmbig">💸</span><em>➜</em><span class="cmpill gold">🏦 ${f}</span></div><b>Thuế, tiền phạt chảy vào Quỹ</b></div>
    <div class="cmq c3"><i>2</i><h5>Gieo ra đôi</h5><q>Nổ hũ!</q><div class="cms">${dd(5,5)}<em>➜</em><span class="cmbig">💰</span><strong>+${Math.min(f, JACKPOT_MAX)}</strong></div><b>Ra đôi: ăn trọn Quỹ</b></div>
    <div class="cmq c2"><i>3</i><h5>Không ra đôi</h5><div class="cms">${dd(2,5)}<em>➜</em><span class="cmbig">🪙</span><strong>+${ten}</strong></div><b>Không ra đôi: nhận 10%</b></div></div>`; }
};
// ===== CHIA SẺ: mời bạn nhận xu, rủ bạn tăng hảo cảm, chụp ảnh hồ sơ và khoảnh khắc trong ván =====
const SHARE = (() => {
  if(HEADLESS) return {};
  const URL0 = location.origin + location.pathname, DAY = () => new Date().toDateString(), MAX = 3, COIN = 30, LOVE = 5;
  const ld = k => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && v.d===DAY() ? v : {d:DAY(), n:0, ids:[]}; } catch(e) { return {d:DAY(), n:0, ids:[]}; } };
  const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
  const toast = t => { if(window.palToast) window.palToast(t); };
  const paintLeft = () => { const v = ld('lendoi_share'); document.querySelectorAll('.shleft').forEach(e => { e.textContent = Math.max(0, MAX - v.n); }); };
  async function link(text, url){
    url = url || URL0;
    if(navigator.share){ try { await navigator.share({title:'Lên Voi Xuống Chó', text, url}); return true; } catch(e) { return false; } }
    try { await navigator.clipboard.writeText(text + ' ' + url); toast('Đã sao chép lời mời, dán gửi cho bạn bè nhé'); return true; } catch(e) { return false; }
  }
  async function invite(){
    SFX.play('click');
    const uid = window.FR_ ? window.FR_.uid() : '';
    if(!(await link('Vào chiến hay sợ? 😏' + (uid ? ` Mã kết bạn của mình: ${uid}` : ''), uid ? URL0 + '?add=' + uid : URL0))) return;
    if(window.MS_) window.MS_.add('s'); SFX.play('coin'); toast(`Cảm ơn bạn đã mời! Đã chia sẻ ${window.MS_ ? window.MS_.n('s') : ''} lần, xem mốc thưởng ở Nạp & quà`);
  }
  async function inviteFriend(id){
    const P = window.PALS_; const f = P && P.who(id); if(!f) return; SFX.play('click');
    if(!(await link(`Vào chiến hay sợ, ${f.n}? 😏`))) return;
    const v = ld('lendoi_invf'); v.ids = v.ids || [];
    if(!v.ids.includes(id)){ v.ids.push(id); sv('lendoi_invf', v); P.bump(f.n, LOVE); toast(`+${LOVE} ❤️ hảo cảm với ${f.n}`); if(window.renderPals_) window.renderPals_(); }
    else toast(`Hôm nay bạn đã rủ ${f.n} rồi`);
  }
  // vẽ ảnh
  const fixSvg = svg => { let t = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"'); const m = t.match(/viewBox="([-\d.\s]+)"/);
    if(m && !/^<svg[^>]*\swidth=/.test(t)){ const v = m[1].trim().split(/\s+/).map(Number); t = t.replace(/<svg\b/, `<svg width="${v[2]}" height="${v[3]}"`); } return t; };
  const img = svg => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fixSvg(svg)); });
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x+r, y); c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r); c.arcTo(x, y+h, x, y, r); c.arcTo(x, y, x+w, y, r); c.closePath(); };
  const fit = (c, i, x, y, w, h) => { if(!i) return; const k = Math.min(w/i.width, h/i.height), dw = i.width*k, dh = i.height*k; c.drawImage(i, x + (w-dw)/2, y + (h-dh), dw, dh); };
  const TF = "'Fz Heavitas','Be Vietnam Pro',sans-serif", BF = "'Be Vietnam Pro',system-ui,sans-serif";
  const logo = (c, x, y, sz) => { c.save(); c.font = `${sz}px ${TF}`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = sz*.16; c.strokeStyle = '#2B3A67'; c.strokeText('LÊN VOI XUỐNG CHÓ', x, y); c.fillStyle = '#FFE27A'; c.fillText('LÊN VOI XUỐNG CHÓ', x, y); c.restore(); };
  async function send(cv, text){
    const b = await new Promise(r => cv.toBlob(r, 'image/png')); if(!b) return;
    const f = new File([b], 'lendoi.png', {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[f]})){ try { await navigator.share({files:[f], text: text + ' ' + URL0}); } catch(e) {} return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = 'lendoi.png'; document.body.appendChild(a); a.click(); a.remove();
    toast('Đã lưu ảnh. Mở Facebook, Instagram hoặc Threads để đăng nhé');
  }
  async function profile(){
    SFX.play('click'); try { await document.fonts.ready; } catch(e) {}
    const st = document.querySelector('.dlg.profv .pvstage'); if(!st) return;
    const cs = getComputedStyle(st), sa = cs.getPropertyValue('--sa').trim() || '#F6B93B', sb = cs.getPropertyValue('--sb').trim() || '#E0685C';
    const sc = st.querySelector('.pvscene svg'), fg = st.querySelector('.pvfig svg');
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, sa); g.addColorStop(1, sb); c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
    c.save(); c.translate(540, 520); c.fillStyle = 'rgba(255,255,255,.14)'; for(let k=0;k<20;k++){ c.rotate(Math.PI/10); c.beginPath(); c.moveTo(0,0); c.lineTo(-60, -1200); c.lineTo(60, -1200); c.fill(); } c.restore();
    if(sc){ const i = await img(sc.outerHTML); if(i) c.drawImage(i, 0, 160, 1080, 760); }
    if(fg){ const i = await img(fg.outerHTML); fit(c, i, 240, 190, 600, 700); }
    logo(c, 540, 140, 96);
    rr(c, 90, 930, 900, 330, 44); c.fillStyle = '#FFFDF6'; c.fill(); c.lineWidth = 8; c.strokeStyle = '#2B3A67'; c.stroke();
    const nm = (STORE.name || 'Bạn'), lv = (document.querySelector('.lvv') || {}).textContent || '1';
    let tt = ''; try { const w = TITLE.worn(); if(w) tt = w.n; } catch(e) {}
    c.fillStyle = '#2B3A67'; c.textAlign = 'center'; c.font = `900 84px ${BF}`; c.fillText(nm, 540, 1040);
    c.font = `800 46px ${BF}`; c.fillStyle = '#E0685C'; c.fillText(`Cấp ${lv}` + (tt ? ` · ${tt}` : ''), 540, 1120);
    c.font = `700 36px ${BF}`; c.fillStyle = '#5B6680'; c.fillText('Chơi cùng mình trên Lên Voi Xuống Chó', 540, 1200);
    await send(cv, `Hồ sơ Lên Voi Xuống Chó của ${nm} 🎲`);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('.shareEarn, #pvSnap, [data-invf]'); if(!t) return;
    e.preventDefault(); e.stopPropagation();
    if(t.classList.contains('shareEarn')) invite(); else if(t.id==='pvSnap') profile(); else inviteFriend(t.dataset.invf);
  }, true);
  setTimeout(paintLeft, 500);
  return {invite, profile, paintLeft};
})();
if(!HEADLESS) window.SHARE_ = SHARE;
// ----- tranh minh họa vui cho popup ô đặc biệt và sự kiện vòng (v127): bốn con vật của game, nét đậm, mắt to
const ART = (() => {
  const K = 'stroke="#2B3A67" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
  const EYES = [[17.5,24,'#F2A65A'],[18,24,'#7C8AA5'],[18.5,20.5,'#A9B7C6'],[18,23.5,'#FFFDF6']];
  // a: 0 Hổ, 1 Trâu, 2 Voi, 3 Gà; o.sleep: nhắm mắt; o.rot: nghiêng đầu
  const hd = (a, x, y, sz, o) => { o = o || {}; const e = EYES[a], dx = e[0], ey = e[1], dx2 = 48 - dx;
    const shut = o.sleep ? [dx, dx2].map(cx => `<circle cx="${cx}" cy="${ey}" r="5.8" fill="${e[2]}"/><path d="M${cx-4} ${ey}q4 3.4 8 0" fill="none" stroke="#2B3A67" stroke-width="2" stroke-linecap="round"/>`).join('') : '';
    return `<svg class="bob" x="${x}" y="${y}" width="${sz}" height="${sz}" viewBox="0 0 48 48" overflow="visible"><g transform="rotate(${o.rot||0} 24 24)">${AV.raw(a)}${shut}</g></svg>`; };
  const coin = (x, y, r) => { r = r || 7; return `<circle cx="${x}" cy="${y}" r="${r}" fill="#F4C542" ${K}/><circle cx="${x}" cy="${y}" r="${r*.5}" fill="none" stroke="#C98A1A" stroke-width="1.8"/>`; };
  const note = (x, y, rot) => `<g transform="rotate(${rot||0} ${x} ${y})"><rect x="${x-14}" y="${y-8}" width="28" height="16" rx="3" fill="#9FD39A" ${K}/><circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#2B3A67" stroke-width="1.8"/></g>`;
  const drop = (x, y) => `<path d="M${x} ${y-7}q6 8 0 11q-6-3 0-11z" fill="#9CCDE4" ${K}/>`;
  const star = (x, y, r) => { r = r || 6; return `<path d="M${x} ${y-r}L${x+r*.28} ${y-r*.28}L${x+r} ${y}L${x+r*.28} ${y+r*.28}L${x} ${y+r}L${x-r*.28} ${y+r*.28}L${x-r} ${y}L${x-r*.28} ${y-r*.28}Z" fill="#FFE27A" stroke="#2B3A67" stroke-width="1.8" stroke-linejoin="round"/>`; };
  const bub = (x, y, t, w) => { w = w || t.length*10 + 22; return `<g class="pop"><path d="M${x} ${y}h${w}a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8h-${w-18}l-8 9l-1-9h-${0}a8 8 0 0 1-8-8v-12a8 8 0 0 1 8-8z" transform="translate(-8 0)" fill="#FFFDF6" ${K}/><text x="${x + w/2 - 4}" y="${y+20}" text-anchor="middle" font-size="15" font-weight="900" fill="#2B3A67">${t}</text></g>`; };
  const ground = (y, c) => `<ellipse cx="120" cy="${y}" rx="112" ry="10" fill="${c||'#B9DAB2'}" ${K}/>`;
  const tree = (x, y) => `<rect x="${x-5}" y="${y-30}" width="10" height="32" rx="3" fill="#A4764F" ${K}/><circle cx="${x}" cy="${y-44}" r="22" fill="#7FBF6A" ${K}/><circle cx="${x-8}" cy="${y-50}" r="5" fill="#A5D98F"/>`;
  const wrap = (svg, cls) => `<div class="tart ${cls||''}"><svg viewBox="0 0 240 120" aria-hidden="true">${svg}</svg></div>`;
  const T = {
    go: () => ground(108) + `<path d="M46 106V22" ${K} fill="none"/><path d="M46 24h40l-8 12l8 12h-40z" fill="#E0685C" ${K}/><text x="64" y="41" text-anchor="middle" font-size="11" font-weight="900" fill="#FFFDF6">GO</text>`
      + hd(0, 92, 40, 62, {rot:-8}) + note(178, 50, -18) + note(206, 78, 14) + coin(168, 92) + coin(190, 100, 6) + star(150, 30) + bub(168, 6, '+200'),
    tax: () => ground(108) + hd(1, 18, 38, 62, {rot:6}) + drop(84, 44) + drop(92, 60)
      + `<path d="M150 58h70v42a8 8 0 0 1-8 8h-54a8 8 0 0 1-8-8z" fill="#C9D3DC" ${K}/><rect x="144" y="48" width="82" height="14" rx="5" fill="#8A6B56" ${K}/><text x="185" y="92" text-anchor="middle" font-size="16" font-weight="900" fill="#2B3A67">THUẾ</text>`
      + `<path d="M90 70q30-50 70-26" fill="none" stroke="#2B3A67" stroke-width="2" stroke-dasharray="4 5"/>` + coin(118, 42) + coin(140, 38, 6) + coin(160, 46, 5) + bub(150, 6, '-10%'),
    visit: () => `<rect x="0" y="0" width="240" height="120" fill="#E6F2DA"/>` + hd(2, 120, 6, 84) + ground(112, '#A5D98F')
      + [20,52,84,116,148,180,212].map(x => `<rect x="${x}" y="58" width="12" height="54" rx="3" fill="#D9B86A" ${K}/>`).join('') + `<rect x="8" y="70" width="224" height="10" rx="3" fill="#C99B55" ${K}/><rect x="8" y="94" width="224" height="10" rx="3" fill="#C99B55" ${K}/>`
      + hd(3, 16, 30, 56, {rot:-6}) + `<rect x="58" y="56" width="26" height="18" rx="4" fill="#2B3A67"/><circle cx="71" cy="65" r="5.5" fill="#9CCDE4" stroke="#FFFDF6" stroke-width="2"/>` + star(96, 46, 9) + star(108, 64, 5),
    park: () => ground(108) + tree(40, 106) + `<rect x="100" y="72" width="120" height="10" rx="3" fill="#C99B55" ${K}/><rect x="100" y="50" width="120" height="10" rx="3" fill="#C99B55" ${K}/><path d="M110 82v24M210 82v24" ${K} fill="none"/>`
      + hd(3, 132, 20, 60, {rot:14, sleep:1}) + `<text class="zz" x="196" y="30" font-size="20" font-weight="900" fill="#5FA8D3" stroke="#2B3A67" stroke-width="1">Z</text><text class="zz z2" x="214" y="16" font-size="14" font-weight="900" fill="#5FA8D3" stroke="#2B3A67" stroke-width="1">z</text>`,
    grave: () => `<rect x="0" y="0" width="240" height="120" fill="#3B4778"/>` + ground(110, '#5F7A6A') + `<circle cx="206" cy="22" r="12" fill="#FFE27A" ${K}/><path d="M150 106V60a26 26 0 0 1 52 0v46z" fill="#C9D3DC" ${K}/><text x="176" y="80" text-anchor="middle" font-size="14" font-weight="900" fill="#2B3A67">RIP</text>`
      + `<path class="bob" d="M110 82q-2-44 26-44q28 0 26 44l-7-6l-6 7l-7-7l-6 7l-7-7z" fill="#FFFDF6" ${K} transform="translate(-24 -16)"/><circle cx="100" cy="42" r="3.5" fill="#2B3A67"/><circle cx="116" cy="42" r="3.5" fill="#2B3A67"/><ellipse cx="108" cy="54" rx="5" ry="6" fill="#2B3A67"/>`
      + hd(3, 8, 44, 58, {rot:-12}) + drop(66, 46) + bub(20, 4, 'Á Á!'),
    gotojail: () => `<rect x="0" y="0" width="240" height="120" fill="#C9D3DC"/>` + hd(1, 86, 26, 70) + `<rect x="62" y="14" width="118" height="96" rx="6" fill="none" stroke="#2B3A67" stroke-width="6"/>`
      + [80,100,120,140,160].map(x => `<rect x="${x-3}" y="14" width="6" height="96" fill="#5F6C86" stroke="#2B3A67" stroke-width="1.6"/>`).join('') + drop(176, 42) + bub(160, 72, 'Oan!'),
    island: () => `<rect x="0" y="0" width="240" height="120" fill="#9CCDE4"/><path d="M0 88q20-8 40 0t40 0t40 0t40 0t40 0t40 0v32H0z" fill="#5FA8D3" ${K}/><ellipse cx="110" cy="96" rx="70" ry="14" fill="#F4D98A" ${K}/>`
      + `<path d="M150 94q-4-40 10-62" fill="none" stroke="#A4764F" stroke-width="7" stroke-linecap="round"/><path d="M160 32q-28-6-38 12M160 32q24-10 38 6M160 32q-6-22-28-22M160 32q18-20 38-14" fill="none" stroke="#7FBF6A" stroke-width="9" stroke-linecap="round"/>`
      + hd(0, 64, 40, 54, {rot:-6}) + drop(124, 50) + bub(14, 8, 'SOS'),
    chance: () => ground(108) + `<g class="bob"><rect x="132" y="14" width="66" height="88" rx="10" fill="#F2A65A" transform="rotate(10 165 58)" ${K}/><text x="168" y="76" text-anchor="middle" font-size="46" font-weight="900" fill="#FFFDF6" stroke="#2B3A67" stroke-width="2" transform="rotate(10 165 58)">?</text></g>`
      + hd(2, 32, 34, 70, {rot:-10}) + star(118, 26) + star(214, 98, 5),
    fortune: () => ground(108) + `<g class="bob"><rect x="132" y="14" width="66" height="88" rx="10" fill="#7FBF6A" transform="rotate(-8 165 58)" ${K}/><g transform="rotate(-8 165 58)">${[[-9,-9],[9,-9],[-9,9],[9,9]].map(d => `<circle cx="${165+d[0]}" cy="${56+d[1]}" r="10" fill="#B9DAB2" ${K}/>`).join('')}<path d="M165 64q6 16 0 24" fill="none" ${K}/></g></g>`
      + hd(3, 34, 36, 66, {rot:8}) + star(118, 30) + star(214, 22, 5),
    gift: () => ground(108) + `<g class="bob"><rect x="132" y="56" width="78" height="50" rx="5" fill="#E0685C" ${K}/><rect x="126" y="42" width="90" height="18" rx="4" fill="#F28C7E" ${K}/><rect x="164" y="42" width="14" height="64" fill="#F4C542" stroke="#2B3A67" stroke-width="2"/><path d="M171 42q-22-24-26-4zM171 42q22-24 26-4z" fill="#F4C542" ${K}/></g>`
      + hd(0, 36, 38, 64, {rot:-6}) + star(116, 30) + star(224, 30, 5) + star(120, 90, 4)
  };
  const E = {
    fest: () => `<path d="M0 22q120 40 240 0" fill="none" stroke="#2B3A67" stroke-width="2"/>` + [30,80,130,180,220].map((x,k) => `<g class="bob"><rect x="${x-9}" y="${26+Math.sin(k)*6}" width="18" height="24" rx="8" fill="${['#E0685C','#F4C542','#F2A65A','#E0685C','#F4C542'][k]}" ${K}/></g>`).join('') + ground(110) + hd(0, 88, 46, 62, {rot:-6}) + star(170, 70) + star(60, 80, 5),
    storm: () => `<rect x="0" y="0" width="240" height="120" fill="#5F6C86"/><path d="M60 50a20 20 0 0 1 30-26a26 26 0 0 1 48 4a18 18 0 0 1 10 34H66a14 14 0 0 1-6-12z" fill="#C9D3DC" ${K}/><path d="M112 62l-14 22h14l-10 22l26-30h-14l10-14z" fill="#FFE27A" ${K}/>` + ground(112, '#7A8A7A') + hd(1, 158, 48, 60, {rot:10}) + drop(150, 56) + drop(222, 70),
    harvest: () => ground(108, '#F4D98A') + [130,150,170,190,210].map(x => `<path d="M${x} 106V58" stroke="#C99B55" stroke-width="3"/><ellipse cx="${x}" cy="54" rx="6" ry="14" fill="#F4C542" ${K}/>`).join('') + hd(3, 30, 40, 64, {rot:-8}) + coin(104, 40) + coin(116, 62, 6),
    audit: () => ground(108) + coin(160, 96) + coin(178, 96) + coin(196, 96) + coin(169, 84) + coin(187, 84) + coin(178, 72) + `<circle cx="150" cy="44" r="22" fill="#E6F2FA" fill-opacity=".8" ${K}/><path d="M134 60l-22 22" stroke="#2B3A67" stroke-width="7" stroke-linecap="round"/>` + hd(1, 20, 40, 62, {rot:4}) + drop(82, 44),
    boom: () => ground(108) + `<path d="M126 104V60l34-26l34 26v44z" fill="#F4D98A" ${K}/><path d="M118 62l42-32l42 32" fill="none" stroke="#E0685C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="150" y="76" width="20" height="28" fill="#A4764F" ${K}/><path class="bob" d="M214 70V20m-14 14l14-14l14 14" fill="none" stroke="#3F8F5F" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` + hd(2, 28, 36, 70, {rot:-8}) + star(104, 28)
  };
  // Ngân hàng siết nợ (kiểu tranh phẳng, màu dịu): tòa ngân hàng phía sau, người nợ lo lắng xòe tay bên trái,
  // ông chủ ngân hàng đeo kính cau mày cầm giấy đóng dấu QUÁ HẠN bên phải, căn nhà nhỏ ở giữa
  const bank = a => {
    const L = 'stroke="#2B3A67" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
    const fur = ['#F2A65A','#7C8AA5','#A9B7C6','#FFFDF6','#6FBF73','#FFFDF6','#F28C38'][((a % 7) + 7) % 7];
    const cloud = (x, y, k) => `<path d="M${x} ${y}h${30*k}a${6*k} ${6*k} 0 0 0-${7*k}-${9*k}a${9*k} ${9*k} 0 0 0-${15*k}-${2*k}a${6*k} ${6*k} 0 0 0-${8*k} ${11*k}z" fill="#F4FAFD"/>`;
    return `<rect width="240" height="120" fill="#BCD9E6"/>` + cloud(18, 22, 1) + cloud(196, 16, .9) + cloud(120, 12, .7)
      // tòa ngân hàng
      + `<path d="M56 44L114 18L172 44Z" fill="#EADCC4" ${L}/><rect x="62" y="44" width="104" height="66" fill="#E2D2B6" ${L}/><rect x="58" y="44" width="112" height="6" fill="#F1E6D2" ${L}/>`
      + `<rect x="78" y="28" width="72" height="13" rx="2" fill="#F8F2E6" ${L}/><text x="114" y="38" font-size="9.5" text-anchor="middle" fill="#2B3A67" font-weight="900">NGÂN HÀNG</text>`
      + `<rect x="68" y="54" width="9" height="56" fill="#F1E6D2" ${L}/><rect x="151" y="54" width="9" height="56" fill="#F1E6D2" ${L}/>`
      + `<rect x="100" y="56" width="28" height="30" fill="#7FA8C9" ${L}/><path d="M114 56v30M100 71h28" ${L} fill="none"/>`
      // căn nhà nhỏ ở giữa
      + `<rect x="96" y="98" width="52" height="24" fill="#F3E2C6" ${L}/><path d="M88 99L122 80L156 99Z" fill="#C9573F" ${L}/><rect x="104" y="106" width="9" height="16" fill="#8A5A3A" ${L}/><rect x="124" y="104" width="14" height="10" fill="#7FA8C9" ${L}/><path d="M131 104v10" ${L}/>`
      // người nợ bên trái: áo len, tay xòe, mặt lo lắng, giọt mồ hôi
      + `<path d="M-6 122Q-4 92 20 86L50 86Q72 92 74 122Z" fill="#3E5C8A" ${L}/><path d="M28 86q7 6 14 0" fill="none" stroke="#2B3A67" stroke-width="1.6"/>`
      + `<path d="M58 96Q70 104 82 100" fill="none" stroke="#2B3A67" stroke-width="8.6" stroke-linecap="round"/><path d="M58 96Q70 104 82 100" fill="none" stroke="#3E5C8A" stroke-width="5.6" stroke-linecap="round"/>`
      + `<path d="M80 103q6-6 12-3q-1 3-5 4q4 0 5 2q-3 3-11 1z" fill="${fur}" ${L}/>`
      + `<path d="M8 104Q-2 108 0 116" fill="none" stroke="#2B3A67" stroke-width="8.6" stroke-linecap="round"/><path d="M8 104Q-2 108 0 116" fill="none" stroke="#3E5C8A" stroke-width="5.6" stroke-linecap="round"/>`
      + `<g transform="translate(5 26) scale(1.25)">${AV.raw(a)}<path d="M13 15.5l8-3M35 15.5l-8-3" fill="none" stroke="#2B3A67" stroke-width="2" stroke-linecap="round"/></g>`
      + `<path d="M62 30q4 6 0 8q-4-2 0-8z" fill="#9AD3F2" ${L}/><path d="M66 42q3 4 0 6q-3-2 0-6z" fill="#9AD3F2" ${L}/>`
      // ông chủ ngân hàng bên phải: vest, sơ mi, cà vạt, kính, mày cau, miệng trễ
      + `<path d="M156 122Q156 76 182 68L212 68Q240 76 242 122Z" fill="#2F3A52" ${L}/><path d="M188 68L197 92L206 68Z" fill="#FFFDF6" ${L}/><path d="M195 70h4l2.5 20l-4.5 6l-4.5-6z" fill="#1F3A6B" ${L}/><path d="M188 68l-6 18l9 6M206 68l6 18l-9 6" fill="none" ${L}/>`
      + `<ellipse cx="197" cy="44" rx="15.5" ry="18" fill="#F0BE96" ${L}/><ellipse cx="181.5" cy="46" rx="3" ry="4.5" fill="#F0BE96" ${L}/><ellipse cx="212.5" cy="46" rx="3" ry="4.5" fill="#F0BE96" ${L}/>`
      + `<path d="M181 40Q180 22 197 22Q214 22 213 40Q208 30 197 31Q186 30 181 40Z" fill="#2A2C36" ${L}/>`
      + `<rect x="184" y="40" width="11" height="8" rx="2" fill="#EAF4FA" fill-opacity=".5" stroke="#1E2230" stroke-width="2"/><rect x="199" y="40" width="11" height="8" rx="2" fill="#EAF4FA" fill-opacity=".5" stroke="#1E2230" stroke-width="2"/><path d="M195 43h4" stroke="#1E2230" stroke-width="2"/>`
      + `<circle cx="190" cy="44.5" r="1.6" fill="#2B3A67"/><circle cx="204" cy="44.5" r="1.6" fill="#2B3A67"/><path d="M184 36l10 3M210 36l-10 3" stroke="#2A2C36" stroke-width="2.6" stroke-linecap="round"/>`
      + `<path d="M197 47l-1.5 5h3" fill="none" stroke="#B8805C" stroke-width="1.4" stroke-linecap="round"/><path d="M191 57q6-4 12 0" fill="none" stroke="#2B3A67" stroke-width="1.8" stroke-linecap="round"/>`
      // tay cầm tờ giấy QUÁ HẠN, tay kia nắm
      + `<path d="M172 92Q162 92 156 84" fill="none" stroke="#2B3A67" stroke-width="10" stroke-linecap="round"/><path d="M172 92Q162 92 156 84" fill="none" stroke="#2F3A52" stroke-width="7" stroke-linecap="round"/>`
      + `<g transform="rotate(-6 150 66)"><rect x="136" y="44" width="28" height="38" rx="1.5" fill="#FFFFFF" ${L}/><path d="M141 51h18M141 56h18M141 61h14M141 66h18" stroke="#9AA6BC" stroke-width="1.6" stroke-linecap="round"/>`
      + `<g transform="rotate(-12 150 74)"><rect x="136.5" y="68.5" width="28" height="10" rx="1.5" fill="#FFFFFF" stroke="#D9443A" stroke-width="1.6"/><text x="150.5" y="75.8" font-size="5" text-anchor="middle" fill="#D9443A" font-weight="900" letter-spacing=".2">QUÁ HẠN</text></g></g>`
      + `<ellipse cx="154" cy="84" rx="6" ry="5.5" fill="#F0BE96" ${L}/><path d="M150 80q4-2 8 0" fill="none" ${L}/>`
      + `<ellipse cx="226" cy="104" rx="7" ry="6.5" fill="#F0BE96" ${L}/><path d="M221 101h9M221 105h9" stroke="#C99877" stroke-width="1.2" stroke-linecap="round"/>`;
  };
  const BANK_JOKES = ['Vay thì dễ, trả thì khó… nhà bay luôn!', 'Ngân hàng không đùa đâu nha!', 'Nợ quá hạn, nhà ra chợ!', 'Tiền chưa thấy, búa đã tới!', 'Đi vay nhớ ngày trả nha bạn ơi!'];
  return { tile: k => T[k] ? wrap(T[k](), 'k-' + k) : '', ev: k => E[k] ? wrap(E[k](), 'e-' + k) : '',
    bank: a => wrap(bank(a), 'e-bank') + `<p class="tartp">${BANK_JOKES[Math.floor(Math.random()*BANK_JOKES.length)]}</p>` };
})();
// huy hiệu và tiện ích khi gom đủ sân bay hoặc đủ hai công ty
// sảnh trong app (v128, phương án A): dựng một lần, chuyển các nút có sẵn sang bố cục mới (giữ nguyên sự kiện bấm)
// bố cục ngang: các màn danh sách chia 2 cột. Trái (.lp) là tiêu đề, ví và nút chính, phải (.rp) là nội dung cuộn được
function landPanes(){
  const split = (box, isLeft) => {
    if(!box || box.querySelector(':scope > .lp')) return;
    const kids = [...box.children], lp = document.createElement('div'), rp = document.createElement('div'); lp.className = 'lp'; rp.className = 'rp';
    kids.forEach((k, j) => (isLeft(k, j, kids) ? lp : rp).appendChild(k));
    box.classList.add('lsplit'); box.append(lp, rp);
  };
  // Cửa hàng: tiêu đề, ví và phần Kim cương và xu (sau #oldShop) bên trái; các quầy hàng bên phải
  split(document.querySelector('#pals .cm'), k => k.id!=='frList' && k.id!=='frReal');
  split(document.querySelector('#lbd .lbx'), k => k.id!=='lbList');
  split(document.querySelector('#rank .cm'), k => k.matches('.rkhero'));
  split(document.getElementById('friend'), k => k.matches('.back,h1'));
  split(document.getElementById('world'), k => k.matches('.back,h1,.sub'));
}
function lobbyPaint(){
  if(!LAND) return;
  const home = document.getElementById('home'); if(!home || home.querySelector('.lob')) return;
  const cm = home.querySelector('.cm'), q = sel => cm.querySelector(sel);
  const lob = document.createElement('div'); lob.className = 'lob';
  lob.innerHTML = '<div class="ltop"></div><div class="lside"></div><div class="ldock"></div>';
  const put = (box, el) => { if(el) lob.querySelector(box).appendChild(el); };
  put('.ltop', q('.lvpill')); put('.ltop', q('.logo')); put('.ltop', q('.walpill'));
  lob.appendChild(q('#ticker'));
  // ô lớn bên trái là Hồ sơ người chơi (nhân vật đang dùng, tên, cấp); cột phải: Chơi với máy, Chơi với bạn, Cửa hàng, Xếp hạng
  const pf = q('#homeProf'); if(pf){ pf.classList.add('lhero'); pf.insertAdjacentHTML('beforeend', '<span class="lnm" id="homeProfNm"></span><span class="lgo">XEM ▸</span>'); lob.appendChild(pf); }
  const a = q('.pan.pA'); if(a){ a.insertAdjacentHTML('beforeend', '<span class="lgo">▶ VÔ!</span>'); const st = a.querySelector('.stk'); if(st) st.remove(); }
  put('.lside', a); put('.lside', q('.pan.pB')); put('.lside', q('.pShop')); put('.lside', q('.pE'));   // có cả Chơi với bạn (app không có máy chủ phòng thì ô này tự ẩn)
  put('.ldock', q('#contBtn'));
  [['#homeDaily','Điểm danh'],['#homeQuest','Nhiệm vụ'],['#homeLb','BXH'],['#homePals','Bạn bè'],['#guideBtn','Bạn bè'],['#homeSnd','Hệ thống']].forEach(([id, lb]) => { const b = q(id); if(b){ b.dataset.lb = lb; if(id==='#guideBtn') b.textContent = '👥'; put('.ldock', b); } });
  cm.appendChild(lob);
}
// nền bục cúp: khán đài đông người, hai cột đèn pha chiếu xuống bục, sân cỏ kẻ sọc, pháo giấy rơi
function PDBG(){
  const K = 'stroke="#2B3A67" stroke-width="2.5" stroke-linejoin="round"', C = ['#E0685C','#F4C542','#5FA8D3','#7FBF6A','#F2A65A','#FFFDF6','#C38FE0'];
  let crowd = ''; for(let r=0;r<4;r++) for(let k=0;k<44;k++){ const x = k*24 + (r%2 ? 12 : 0) - 10, y = 150 + r*26 + Math.sin(k*1.7 + r)*2; crowd += `<circle cx="${x}" cy="${y}" r="7.5" fill="${C[(k*3 + r*5) % C.length]}" stroke="#141B3A" stroke-width="2"/>`; }
  const tower = x => `<path d="M${x} 300V70" stroke="#2B3A67" stroke-width="7"/><rect x="${x-40}" y="34" width="80" height="40" rx="6" fill="#C9D3DC" ${K}/>` + [0,1,2,3].map(k => `<circle cx="${x-27+k*18}" cy="54" r="7" fill="#FFF6C2" stroke="#2B3A67" stroke-width="2"/>`).join('');
  let cf = ''; for(let k=0;k<26;k++) cf += `<i class="pdcf" style="left:${(k*37)%100}%;background:${C[k % C.length]};animation-duration:${3.2 + (k*7)%30/10}s;animation-delay:-${(k*13)%40/10}s"></i>`;
  return `<svg class="pdbg" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="pdBm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6C2" stop-opacity=".55"/><stop offset="1" stop-color="#FFF6C2" stop-opacity="0"/></linearGradient></defs>
    <path d="M-20 130Q500 70 1020 130V262H-20Z" fill="#1D2650" ${K}/>${crowd}<path d="M-20 262H1020V282H-20Z" fill="#E0685C" ${K}/><text x="500" y="277" text-anchor="middle" font-size="15" font-weight="900" fill="#FFFDF6" letter-spacing="6">LÊN VOI XUỐNG CHÓ · CHUNG KẾT</text>
    ${[0,1,2,3,4,5,6].map(k => `<path d="M${k*160-60} 282L${k*160+20} 282L${k*160+120} 560L${k*160+20} 560Z" fill="#48A867"/>`).join('')}
    <ellipse cx="300" cy="470" rx="250" ry="46" fill="none" stroke="#FFFDF6" stroke-opacity=".5" stroke-width="4"/>
    <path class="beam" d="M90 60L210 60L420 560L120 560Z" fill="url(#pdBm)"/><path class="beam b2" d="M790 60L910 60L520 560L240 560Z" fill="url(#pdBm)"/>${tower(150)}${tower(850)}</svg>${cf}`;
}
function kingHint(i, pid){
  const t = TILES[i]; if(!t || !S || (t.k!=='air' && t.k!=='co')) return '';
  const air = t.k==='air', all = TILES.map((x,j) => j).filter(j => TILES[j].k===t.k), who = S.players[pid], cnt = who ? all.filter(j => S.owner[j]===who.id).length : 0, full = cnt===all.length;
  const mine = who && who.id===S.viewer, whoTx = mine ? 'Bạn' : who ? esc(who.name) : '';
  return `<div class="bh v-${full ? 'yes' : 'mid'}"><b>${cnt}/${all.length} ${air ? 'SÂN BAY' : 'CÔNG TY'}</b><span>${full ? whoTx + ' đã có huy hiệu' : ''}</span><small>${air ? `✈️ Có 3: bay tới ô bất kỳ, ${AIR_CD} vòng 1 lần. Đủ 4: bay mọi lúc` : `⚡ Có 1: cắt 1 ô đối thủ, ô đó giảm 50% thuê. Đủ 2: ô bị cắt mất trắng thuê, có huy hiệu. ${CUT_CD} vòng 1 lần`}</small></div>`;
}
function tileCard(i){
  const t = TILES[i], o = S.owner[i], own = o>=0 ? S.players[o] : null, lv = S.level[i] || 0, col = t.g ? G[t.g] : '#98A4B3';
  let cards = '', rows = '', combo = '';
  if(t.k==='land'){
    [0,1,2,3].forEach(l => cards += `<div class="lvc ${own && l===lv ? 'cur' : ''}"><small>${l ? LV[l] : 'Đất nền'}</small><span class="lvi">${l ? houseSVG(t.g, l, 'x', false, null, t.n) : '🚩'}</span><b>${baseRent(i,l)}</b></div>`);
    rows = `<div class="buyr"><span>Nâng mỗi cấp</span><b>${t.b}</b></div>`;
    if(own){ const idx = groupIdx(t.g), cnt = idx.filter(j => S.owner[j]===o).length; combo = `<div class="bh v-${cnt===idx.length ? 'yes' : 'mid'}"><b>${cnt}/${idx.length} Ô</b><span>${cnt===idx.length ? 'Đã có huy hiệu' : 'Chưa đủ nhóm'}</span><small>${PERK[t.g].i} Huy hiệu: ${PERK[t.g].d}</small></div>`; }
    else combo = badgeHint(i);
  } else if(t.k==='air'){
    const n = own ? TILES.filter((x,j) => x.k==='air' && S.owner[j]===o).length : 0;
    AIR_RENT.forEach((v,k) => { cards += `<div class="lvc ${own && n===k+1 ? 'cur' : ''}"><small>${k+1} sân bay</small><span class="lvi">✈️</span><b>${v}</b></div>`; });
    combo = kingHint(i, own ? o : S.viewer);
  } else {
    combo = kingHint(i, own ? o : S.viewer);
    cards = `<div class="lvc"><small>1 công ty</small><span class="lvi">${t.i}</span><b>×4</b></div><div class="lvc"><small>2 công ty</small><span class="lvi">${t.i}${t.i}</span><b>×10</b></div>`;
    rows = '<div class="buyr"><span>Tiền thuê</span><b>số nhân × xúc xắc</b></div>';
  }
  const head = own ? `<div class="buyr big"><span><i class="odot" style="background:${own.color}"></i>${esc(own.name)}</span><b>${t.k==='co' ? '' : 'Thuê ' + rentOf(i, 0)}</b></div>` : `<div class="buyr big"><span>Giá mua</span><b>${priceOf(i)}</b></div>`;
  return `<div class="buyp" style="--g:${col}"><div class="buyh"><span>📍</span><b>${t.n}</b></div><div class="buylv">${cards}</div>${head}${rows}</div>${combo}`;
}
const RKTILE = {
  visit:{n:'⚔️ Đấu trường', c:'#C0392B', d:'Thách đấu 1 đối thủ: mỗi bên gieo 1 viên, cao hơn lấy 15% tiền mặt bên kia. Thua thì bị lấy ngược!',
    a:`<rect width="240" height="120" fill="#F2C98A"/><ellipse cx="120" cy="92" rx="104" ry="24" fill="#E8B672" stroke="#9A6A3A" stroke-width="2.5"/><ellipse cx="120" cy="92" rx="54" ry="12" fill="none" stroke="#C0392B" stroke-width="3" stroke-dasharray="7 5"/><path d="M14 92V58h22v34M204 92V58h22v34M50 70V44h22v26M168 70V44h22v26" fill="#9A8A7A" stroke="#2B3A67" stroke-width="2.5"/><path d="M94 82L146 30M146 82L94 30" stroke="#E8EEF5" stroke-width="7" stroke-linecap="round"/><path d="M94 82L146 30M146 82L94 30" stroke="#2B3A67" stroke-width="2" stroke-linecap="round" opacity=".4"/><path d="M88 74l14 14M152 74l-14 14" stroke="#F4C542" stroke-width="6" stroke-linecap="round"/><path d="M25 50q6 6 0 12q-6-6 0-12zM215 50q6 6 0 12q-6-6 0-12z" fill="#FF8A2B" stroke="#7A1E0A" stroke-width="1.5"/>`},
  park:{n:'🕶️ Chợ đen', c:'#6B2FA0', d:'Mua ép 1 ô chưa xây nhà của đối thủ, giá 130%. Chủ cũ không được từ chối.',
    a:`<rect width="240" height="120" fill="#2A1F4E"/><circle cx="200" cy="22" r="10" fill="#FFF3B0"/><path d="M0 34Q120 64 240 34" fill="none" stroke="#141C3D" stroke-width="2"/>${[30,62,94,126,158,190,222].map((x,k) => `<ellipse cx="${x}" cy="${44 + Math.sin(k)*3}" rx="6" ry="8" fill="${['#FF5E94','#FFD23F','#29D3E8','#7CE38B','#FF8A2B','#B48CFF','#FFD23F'][k]}" stroke="#141C3D" stroke-width="2"/>`).join('')}<path d="M18 112L50 62L82 112Z" fill="#E0483A" stroke="#2B3A67" stroke-width="2.5"/><path d="M50 62L42 112M50 62L58 112" stroke="#FFD23F" stroke-width="5"/><path d="M150 112L186 58L222 112Z" fill="#7C3AED" stroke="#2B3A67" stroke-width="2.5"/><path d="M186 58L176 112M186 58L196 112" stroke="#29D3E8" stroke-width="5"/><rect x="96" y="86" width="48" height="24" rx="3" fill="#B0742E" stroke="#2B3A67" stroke-width="2.5"/><path d="M96 86q24-18 48 0" fill="#8A5A22" stroke="#2B3A67" stroke-width="2.5"/><circle cx="110" cy="82" r="5" fill="#29D3E8" stroke="#2B3A67" stroke-width="1.5"/><circle cx="122" cy="78" r="5" fill="#FF5E94" stroke="#2B3A67" stroke-width="1.5"/><circle cx="134" cy="82" r="5" fill="#F4C542" stroke="#2B3A67" stroke-width="1.5"/>`},
  gotojail:{n:'💀 Ngục tối', c:'#141C3D', d:'Mất 10% tiền mặt (tối đa 200) rồi bị giam như ô Vào tù.',
    a:`<rect width="240" height="120" fill="#2A2D3A"/>${[0,1,2,3,4,5].map(r => [0,1,2,3,4,5,6,7].map(c => `<rect x="${c*32 + (r%2)*16 - 8}" y="${r*20}" width="30" height="18" fill="#3A3D4A" stroke="#22242E" stroke-width="2"/>`).join('')).join('')}<rect x="66" y="22" width="108" height="80" rx="6" fill="#141420" stroke="#2B3A67" stroke-width="3"/><ellipse cx="120" cy="62" rx="44" ry="26" fill="#FF3B30" opacity=".35"/>${[80,96,112,128,144,160].map(x => `<path d="M${x} 24V100" stroke="#9AA3B5" stroke-width="5" stroke-linecap="round"/>`).join('')}<g transform="translate(200 40)"><path d="M0 -18C-9 -18 -11 -9 -11 -1L-11 12Q-9 10 -7 12Q-5 9 -3 12Q-1 10 0 12Q1 10 3 12Q5 9 7 12Q9 10 11 12L11 -1C11 -9 9 -18 0 -18z" fill="#DDF1FA" stroke="#8FC6DE" stroke-width="2"/><ellipse cx="-4" cy="-6" rx="2" ry="3" fill="#141C3D"/><ellipse cx="4" cy="-6" rx="2" ry="3" fill="#141C3D"/></g><ellipse cx="34" cy="98" rx="11" ry="10" fill="#EDE6D6" stroke="#2B3A67" stroke-width="2"/><circle cx="30" cy="96" r="2.5" fill="#141C3D"/><circle cx="38" cy="96" r="2.5" fill="#141C3D"/>`},
  island:{n:'🌋 Núi lửa', c:'#7A1E0A', d:'Bị kẹt như Đảo hoang: mất lượt hoặc nộp tiền để thoát.',
    a:`<rect width="240" height="120" fill="#3A1E2A"/><circle cx="120" cy="22" r="40" fill="#FF5A1F" opacity=".25"/><path d="M30 120L102 36H138L210 120Z" fill="#3B2B2B" stroke="#2B3A67" stroke-width="3"/><path d="M120 36H138L210 120H120Z" fill="#2A1E1E"/><path d="M110 38q-8 26 -26 44q-6 16 -14 30M130 38q6 28 24 44q8 16 14 30M120 40q4 30 -2 70" fill="none" stroke="#FF5A1F" stroke-width="6" stroke-linecap="round"/><path d="M110 38q-8 26 -26 44q-6 16 -14 30M130 38q6 28 24 44q8 16 14 30M120 40q4 30 -2 70" fill="none" stroke="#FFD23F" stroke-width="2" stroke-linecap="round"/><ellipse cx="120" cy="36" rx="18" ry="5" fill="#FF8A2B" stroke="#7A1E0A" stroke-width="2"/><path d="M104 34q16-40 32 0" fill="#FF5A1F" opacity=".9"/>${[[96,14,5],[144,10,4],[120,4,4],[108,22,3],[136,24,3]].map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="${q[2]}" fill="#FFB020" stroke="#7A1E0A" stroke-width="1.5"/>`).join('')}`}
};
function showTile(i){
  if(askOpen) return; const t = TILES[i];
  if(S && S.mode==='rank' && RKTILE[t.k]){ const r = RKTILE[t.k];
    openModal(r.n, `<div class="rktc" style="--tc:${r.c}"><svg viewBox="0 0 240 120" aria-hidden="true">${r.a}</svg></div><p class="tartp">${r.d}</p>`, [{label:'Đóng', primary:true, fn: closeModal}], 'rktcdlg'); return; }
  const prop = t.k==='land' || t.k==='air' || t.k==='co';
  const body = prop ? tileInfo(i) + (S.owner[i]<0 ? badgeHint(i) : '') : COMIC[t.k] ? COMIC[t.k]() : ART.tile(t.k) + `<p class="tartp">${INFO[t.k]}</p>`;
  // lỡ bỏ qua ô vừa dừng: vẫn mua được cho tới khi kết thúc lượt
  const w = S.wait, p = (w && (!NET || w.pid===NET.me)) ? S.players[w.pid] : null, ps = S.passed;
  if(prop && p && !p.bot && !S.over && p.pos===i && S.owner[i]<0 && S.rules.weekly!=='allbid' && ps && ps.pid===p.id && ps.i===i && ps.turn===S.turns){
    const price = priceOf(i), ok = p.cash >= price, rivals = alive().filter(q => q.id!==p.id);
    stopEndTimer();
    const again = () => { if(S.wait && S.wait.mode==='end' && S.wait.pid===p.id) startEndTimer(p); };
    const btns = [{label: ok ? `Mua với giá ${price}` : `Chưa đủ tiền mua (cần ${price})`, primary:true, disabled:!ok, fn: () => {
      if(netClient()){ netEmit('req', {k:'buy2', i}); closeModal(); return; }
      p.cash -= price; S.owner[i] = p.id; S.passed = null; log(`${p.name} mua ${t.n} với giá ${price}.`); czMood(p,'joy',2200); checkCombo(p, i); closeModal(); render(); again(); }}];
    if(rivals.length && !netClient()) btns.push({label:'Mở đấu giá kín', sub:'Bạn hưởng 10%', fn: async () => { S.passed = null; closeModal(); await auction(p, i); render(); again(); }});
    btns.push({label:'Đóng', fn: () => { closeModal(); again(); }});
    openModal(t.n, body + `<p class="bn">Vẫn mua được tới hết lượt. Bạn có <b>${p.cash}</b>.</p>`, btns);
    return;
  }
  if(prop){ openModal('', tileCard(i), [{label:'Đóng', primary:true, fn: closeModal}], 'one tcard'); return; }
  if(t.k==='chance' || t.k==='fortune'){                      // lá bài lật: mặt trước là xấp thẻ, chạm để lật xem ví dụ
    const ch = t.k==='chance', deck = CARDS[t.k] || [];
    const rkd = S && S.mode==='rank'; openModal('', rkd ? `<div class="rkdk">${RKCARD(ch, 'm')}<p>${ch ? 'Thẻ Cơ hội: thưởng nóng, đòn tấn công bất ngờ' : 'Thẻ Khí vận: vận may, phạt nặng hoặc lật kèo'}</p></div>` : `<div class="dkc ${ch?'ch':'fo'}"><span class="dki"><span class="dkf dk1"><i>${ch?'?':'🍀'}</i><b>${ch?'Cơ hội':'Khí vận'}</b></span></span></div>`,
      [{label:'Đóng', primary:true, fn: closeModal}], 'cmdlg dkdlg');
    return;
  }
  openModal(t.n, body, [{label:'Đóng', primary:true, fn: closeModal}], COMIC[t.k] ? 'cmdlg' : '');
}
function postGame(me, myRank, rank, rw){
  document.querySelectorAll('#pgFx').forEach(e => e.remove());
  const nw = netWorth(me), tot = rank.reduce((a,p) => a + Math.max(0, netWorth(p)), 0) || 1;
  const lands = S.owner.filter(o => o===me.id).length, houses = S.owner.reduce((a,o,i) => a + (o===me.id ? (S.level[i]||0) : 0), 0);
  const score = Math.max(1, Math.min(15, 5 + (rank.length - 1 - myRank)*2.2 + nw/tot*6 + Math.min(2, lands*.15))).toFixed(1);
  const mvp = myRank===0, lv = lvOf(STORE.exp), av = S.avs ? S.avs[me.id] : me.id;
  const medal = (ico, c, name, val, top) => `<div class="pgm ${top ? 'top' : ''}"><span class="pgmi" style="--c:${c}">${ico}</span>${top ? '<em>Nổi bật</em>' : ''}<small>${name}</small><b>${val}</b></div>`;
  const best = [nw >= Math.max(...rank.map(netWorth)), lands >= Math.max(...rank.map(p => S.owner.filter(o => o===p.id).length)), houses>0 && houses >= Math.max(...rank.map(p => S.owner.reduce((a,o,i) => a + (o===p.id ? (S.level[i]||0) : 0), 0))), me.cash >= Math.max(...rank.map(p => p.cash))];
  const page1 = `<div class="pgp p1"><i class="pgstreak a"></i><i class="pgstreak b"></i><i class="pgstreak c"></i><div class="pgfig"><span class="pgrays"></span><span class="pgplat"></span>${AV.full(av, STORE.fit)}</div>
    <div class="pgR"><div class="pgsc"><b>${score}</b><div><span class="pgpos">Hạng ${myRank+1}/${rank.length}</span>${mvp ? '<span class="pgmvp">MVP</span>' : ''}</div><span class="pgrw">🪙 +${rw.coins + (rw.bonus||0)} · ⭐ +${rw.exp} EXP</span></div>
      <div class="pgms">${medal('💰','#F4B43C','Tổng tài sản', fmtN(nw), best[0])}${medal('🏠','#E0685C','Ô đất', lands, best[1])}${medal('🏗️','#5FA8D3','Nhà đã xây', houses, best[2])}${medal('💵','#3FB76A','Tiền mặt', fmtN(me.cash), best[3])}</div>
      <div class="pgbar"><span>Cấp ${lv.L}</span><i><u style="width:${lv.max ? 100 : Math.round(lv.cur/lv.need*100)}%"></u></i><small>${lv.max ? 'Tối đa' : lv.cur + '/' + lv.need} <em>(+${rw.exp})</em></small></div></div></div>`;
  let page2 = '';
  if(S.mode==='rank' && rw.rp!=null){ const now = STORE.rp, was = Math.max(0, now - rw.rp), t1 = tierOf(now), t0 = tierOf(was), up = t1.k > t0.k, down = t1.k < t0.k;
    const nx = t1.next, prog = nx ? Math.round((now - t1.t.min)/(nx.min - t1.t.min)*100) : 100, stars = nx ? Math.max(0, Math.min(5, Math.floor(prog/20))) : 5;
    const base = t0.t.rp[myRank] || 0, safe = !rw.afk && rw.rp > base;
    const lines = (rw.afk ? [['Treo máy', rw.rp]] : [['Hạng đạt ' + (myRank+1), base]]).concat(safe ? [['Bảo hộ hạng ' + t0.t.n, rw.rp - base]] : []).concat(rw.afk ? [] : [['Không treo máy', '✓']]);
    page2 = `<div class="pgp p2 ${up ? 'up' : ''}" style="--tc:${t1.t.c}"><div class="pgtl"><div class="pgstars">${[0,1,2,3,4].map(j => `<i class="${j<stars ? 'on' : ''}" style="--j:${j}">★</i>`).join('')}</div>
        <div class="pgbd"><span class="pgring"></span>${TBADGE(t1.k, 1)}</div><b class="pgtn">${t1.t.n}</b>${up ? '<span class="pgup">LÊN HẠNG!</span>' : down ? '<span class="pgdn">Rớt hạng</span>' : ''}</div>
      <div class="pgtr"><div class="pgrow"><b>Bảo vệ rớt hạng</b><small>${t1.t.safe ? 'Hạng ' + t1.t.n + ' được bảo hộ, thua không rớt hạng' : 'Hạng này không có bảo hộ'}</small></div>
        <div class="pgrow"><b>Điểm hạng</b><div class="pgpt"><span>${now}</span><small>/ ${nx ? nx.min : now}</small><em class="${rw.rp<0 ? 'neg' : ''}">(${rw.rp>0 ? '+' : ''}${rw.rp})</em></div>
          <div class="pgtb"><i><u style="width:${prog}%"></u></i><span class="pgnx">${nx ? TBADGE(nx && t1.k+1, 0) : '👑'}</span></div></div>
        <div class="pgls">${lines.map(l => `<div><span>${l[0]}</span><b class="${typeof l[1]==='number' && l[1]<0 ? 'neg' : ''}">${typeof l[1]==='number' ? (l[1]>0 ? '+' : '') + l[1] : l[1]}</b></div>`).join('')}</div></div></div>`; }
  const pages = [page1].concat(page2 ? [page2] : []); let k = 0;
  const ov = document.createElement('div'); ov.id = 'pgFx';
  const draw = () => { ov.innerHTML = `<div class="pgbg"></div>${pages[k]}<button type="button" class="pgnext">Ấn để tiếp tục ›</button>`; if(pages[k].includes('p2 up')) SFX.play('levelup'); };
  draw(); document.body.appendChild(ov);
  ov.onclick = () => { SFX.play('click'); k++; if(k >= pages.length){ ov.classList.add('out'); setTimeout(() => ov.remove(), 300); } else draw(); };
}
function showResult(){
  const rank = finalRank(), teams = S.rules.teams;
  if(S.nb && !S.nbDone && ['last','time','round','goal'].includes(S.reason)){ S.nbDone = true; try { localStorage.setItem('lendoi_nb', nbCount() + 1); } catch(e) {} }   // v141: đếm ván tân thủ đã chơi xong
  const natural = ['last','time','round','goal'].includes(S.reason);
  const me = NET ? S.players[NET.me] : S.players.find(p => !p.bot), myRank = !me ? -1 : teams ? (me.id%2===S.winTeam ? 0 : 2) : rank.indexOf(me);
  let rw = null;
  if(me && natural && !S.rewarded){ quest(me, 'play', 1); if(myRank===0) quest(me, 'win', 1);
    S.rewarded = true; if(window.PALS) S.players.forEach(q => { if(q.id!==S.viewer) window.PALS.bump(q.name, 5); });
    const coins = REWARD.coins[myRank] || 0, exp = REWARD.exp[myRank] || 50, lv0 = lvOf(STORE.exp).L;
    STORE.addExp(exp);
    const lv1 = lvOf(STORE.exp).L, bonus = (lv1-lv0)*REWARD.perLevel;
    let rp = null, afk = S.mode==='rank' && !!S.afkPen; if(S.mode==='rank'){ const tk = tierOf(STORE.rp); rp = afk ? RANK_PEN.afk : (tk.t.rp[myRank] || 0); if(tk.t.safe && STORE.rp + rp < tk.t.min) rp = tk.t.min - STORE.rp; STORE.addRp(rp); }
    STORE.add(afk ? 0 : coins + bonus); rw = {coins: afk ? 0 : coins, exp, lv0, lv1, bonus: afk ? 0 : bonus, rp, afk};
    if(!(NET && me.id!==NET.me)){ TITLE.result(S.mode, myRank===0); if(S.mode==='rank'){ TITLE.rp(STORE.rp); if(window.FR_) setTimeout(() => window.FR_.touch(), 300); } }
  }
  let quitPen = 0;
  if(me && !natural && S.mode==='rank' && !S.rewarded){ S.rewarded = true; quitPen = RANK_PEN.quit; STORE.addRp(quitPen); }
  if(S.mode==='rank') rankLive(false);
  const title = {last:'Chỉ còn một người trụ lại!', time:`Hết ${Math.round(limitMs()/60000)} phút!`, round:`Hết ${S.rules.rounds} vòng!`, goal:S.goalWhy==='side' ? 'Chiếm trọn 1 cạnh bàn!' : S.goalWhy==='sets' ? `Gom đủ ${S.rules.goalSets} nhóm màu!` : 'Chạm mốc chiến thắng!', manual:'Ván kết thúc sớm', cap:'Hết ván'}[S.reason] || 'Hết ván';
  const fig = (p, r) => `<div class="pdc r${r} ${p.alive?'':'out'}" style="--c:${p.color}">${r===1 ? '<div class="p2crown">👑</div>' : ''}
    <div class="pdh pdfull">${AV.full((AVMAP && AVMAP[p.id]!=null) ? AVMAP[p.id] : p.id, p===me ? STORE.fit : '')}</div>
    <div class="pdn">${esc(p.name)}</div><div class="blk"><b>${r}</b><small>${netWorth(p)}</small></div>${r>=3 ? '<i class="pcry"><u class="a"></u><u class="b"></u><u class="c"></u><u class="d"></u></i><i class="ppud"></i><i class="prain"><b></b><s></s><s></s><s></s></i>' : ''}</div>`;
  const row = [rank[1] ? fig(rank[1],2) : '', fig(rank[0],1), rank[2] ? fig(rank[2],3) : '', rank[3] ? fig(rank[3],4) : ''].join('');
  const list = rank.map((p,k) => `<div><span>${k+1}. ${esc(p.name)}${p.alive?'':' (phá sản)'}</span><b>${netWorth(p)}</b></div>`).join('');
  let chips = '';
  if(rw){
    chips = `<span>🪙 +${rw.coins} xu</span><span>⭐ +${rw.exp} EXP</span>` + (rw.rp!=null ? `<span class="${rw.rp<0?'neg':''}">🏅 ${rw.rp>0?'+':''}${rw.rp} điểm hạng</span>` : '') + (rw.lv1>rw.lv0 ? `<span class="up">LÊN CẤP ${rw.lv1}! +${rw.bonus} xu</span>` : '');
    if(rw.afk) chips = `<span class="neg">⛔ Treo máy: ${rw.rp} điểm hạng, không nhận xu</span><span>⭐ +${rw.exp} EXP</span>`;
  } else if(quitPen) chips = `<span class="neg">🚪 Thoát giữa trận xếp hạng: ${quitPen} điểm hạng</span>`;
  else if(me) chips = '<span class="neg">Ván kết thúc sớm nên không có thưởng</span>';
  try { localStorage.removeItem('lendoi_lastroom'); } catch(e) {}
  const ov = document.createElement('div'); ov.id = 'podium'; ov.className = 'pd2';
  const won = myRank===0, maxW = Math.max(1, ...rank.map(p => netWorth(p)));
  const ban = !me ? 'KẾT THÚC' : teams ? (won ? 'ĐỘI BẠN THẮNG!' : 'ĐỘI BẠN THUA') : won ? 'CHIẾN THẮNG!' : 'HẠNG ' + (myRank + 1);
  const rows2 = rank.map((p,k) => `<div class="p2r k${k+1} ${p===me ? 'me' : ''} ${p.alive ? '' : 'out'}"><em>${k+1}</em><span class="p2av" style="--c:${p.color}">${AV(p.id)}</span><span class="p2n"><b>${esc(p.name)}${p===me ? ' <i>Bạn</i>' : ''}</b><span class="p2bar"><u style="width:${Math.max(4, Math.round(netWorth(p)/maxW*100))}%;background:${p.color}"></u></span></span><strong>${p.alive ? fmtN(netWorth(p)) : 'Phá sản'}</strong></div>`).join('');
  let tiles = '';
  if(rw){ tiles = rw.afk ? `<div class="p2t neg"><i>⛔</i><b>${rw.rp}</b><small>Treo máy</small></div><div class="p2t"><i>⭐</i><b>+${rw.exp}</b><small>EXP</small></div>`
      : `<div class="p2t gold"><i>🪙</i><b>+${rw.coins + (rw.bonus||0)}</b><small>Xu</small></div><div class="p2t"><i>⭐</i><b>+${rw.exp}</b><small>EXP</small></div>` + (rw.rp!=null ? `<div class="p2t ${rw.rp<0 ? 'neg' : 'up'}"><i>🏅</i><b>${rw.rp>0 ? '+' : ''}${rw.rp}</b><small>Điểm hạng</small></div>` : '') + (rw.lv1>rw.lv0 ? `<div class="p2t lvup"><i>🎉</i><b>Cấp ${rw.lv1}</b><small>Lên cấp!</small></div>` : ''); }
  const note = !rw && quitPen ? `🚪 Thoát giữa trận: ${quitPen} điểm hạng` : !rw && me ? 'Ván kết thúc sớm nên không có thưởng' : '';
  const conf = Array.from({length:26}, (_, j) => `<b style="left:${(j*37)%100}%;--d:${(j*.23)%3.2}s;--t:${3+(j%5)*.6}s;--r:${(j*47)%360}deg;background:${['#FFD23F','#FF5E94','#29D3E8','#7CE38B','#B48CFF'][j%5]}"></b>`).join('');
  const fw = [[18,22,'#FFD23F',0],[78,18,'#FF5E94',.7],[48,12,'#29D3E8',1.4],[88,48,'#7CE38B',2.1],[8,52,'#B48CFF',2.8]].map(f => `<i class="p2fw" style="left:${f[0]}%;top:${f[1]}%;--c:${f[2]};--d:${f[3]}s">${Array.from({length:12}, (_, j) => `<u style="--a:${j*30}deg"></u>`).join('')}</i>`).join('');
  ov.innerHTML = `<div class="p2bg"><i class="p2ray"></i><i class="p2spot"></i><i class="p2glow"></i>${fw}<span class="p2cf">${conf}</span></div>
    <div class="p2L"><div class="p2ban ${won ? 'win' : ''}"><i class="p2st a">✦</i><span>${ban}</span><i class="p2st b">✦</i></div><div class="pdrow">${row}</div><i class="p2floor"></i></div>
    <div class="p2R"><div class="p2rib">🏆 BẢNG KẾT QUẢ</div><div class="p2hd"><small>${title}</small><b>${teams ? 'Đội ' + TEAMN[S.winTeam] + ' thắng!' : '👑 ' + esc(rank[0].name) + ' vô địch!'}</b></div>
      <div class="p2list">${rows2}</div>
      ${me ? (tiles ? `<div class="p2rw">${tiles}</div>` : `<div class="p2note">${note}</div>`) : ''}
      ${S.mode==='friend' && NET ? '<div class="p2btns"><button class="btn primary" id="pdRoom">🔁 Về phòng</button><button class="btn" id="pdHome">🏠 Trang chính</button></div>' : '<div class="p2btns"><button class="btn primary" id="pdHome">🏠 Về trang chính</button></div>'}</div>`;
  document.querySelectorAll('#podium').forEach(e => e.remove());
  closeModal(); askOpen = true; document.body.appendChild(ov); try { const k = ((location.search.match(/[?&]aw=([AB])/) || [])[1]) || (S.mode==='rank' ? 'B' : 'A'), bg = ov.querySelector('.p2bg'); if(bg && AWARD_IMG[k]){ bg.style.background = `url("${AWARD_IMG[k]}") center/cover no-repeat`; bg.classList.add('awimg'); } } catch(e) {} try { awardFx(ov, won); } catch(e) {}
  if(me && rw && natural && !HEADLESS) postGame(me, myRank, rank, rw);
  clearSave(); SFX.music('off'); SFX.play('podium'); if(rw && rw.lv1>rw.lv0) setTimeout(() => { if(document.getElementById('podium')) SFX.play('levelup'); }, 7500);
  document.getElementById('pdHome').onclick = () => { SFX.stop('podium'); askOpen = false; ov.remove(); document.querySelectorAll('#adFx').forEach(e => e.remove()); window.goHome(); };
  { const br = document.getElementById('pdRoom'); if(br) br.onclick = () => { SFX.stop('podium'); askOpen = false; ov.remove(); document.querySelectorAll('#adFx').forEach(e => e.remove()); window.backToRoom(); }; }
}
if(!HEADLESS){
  const slots = document.getElementById('slots');
  slots.innerHTML = PC.map((c,i)=>`<div class="slot"><span class="dot" style="background:${c}" title="${PAN[i]}">${AV(i)}</span>
    <input id="n${i}" value="${i===0?'Bạn':'Bot '+i}" aria-label="Tên người chơi ${i+1}" maxlength="14">
    <select id="t${i}" aria-label="Loại người chơi ${i+1}"><option value="h" ${i===0?'selected':''}>Người</option><option value="b" ${i>0?'selected':''}>Máy</option><option value="x">Không chơi</option></select></div>`).join('');
  const SCREENS = ['home','shop','lbd','rank','setup','pick','friend','world','pals','game'];
  const $ = id => document.getElementById(id);
  let matchTimer = null;
  document.body.dataset.scr = document.body.dataset.scr || 'home'; const show = id => { if(IS_APP && id==='friend' && !window.FB_CFG) id = 'home'; document.body.dataset.scr = id; SCREENS.forEach(x => { $(x).hidden = x!==id; }); document.body.classList.toggle('ingame', id==='game'); if(id!=='game') document.body.classList.remove('wide'); window.scrollTo(0,0); };
  // Thử khoá màn hình ngang thật (chạy được trên một số máy Android); máy khác dùng cách xoay bằng CSS ở trên
  const goLandscape = () => { if(IS_APP) return; try { if(window.matchMedia('(pointer:coarse)').matches && screen.orientation && screen.orientation.lock){ const el = document.documentElement; const p = el.requestFullscreen ? el.requestFullscreen() : Promise.reject(); p.then(() => screen.orientation.lock('landscape')).catch(() => {}); } } catch(e) {} };
  const clean = (v, d) => (v.trim().replace(/[<>&]/g,'').slice(0,14) || d);
  const vsIntro = () => { if(HEADLESS || !S || S.mode!=='rank') return; document.querySelectorAll('#vsFx').forEach(e => e.remove());
    const me = NET ? NET.me : S.players.findIndex(p => !p.bot), teams = S.rules.teams, L = teams ? [me, (me+2)%4] : [me], Rr = S.players.map(p => p.id).filter(i => !L.includes(i));
    const card = i => { const p = S.players[i]; if(!p) return ''; const u = !p.bot ? (p.fu || (i===me && window.PH_ ? window.PH_.myU() : '')) : '', ph = u && window.PH_ ? window.PH_.src(u) : ''; return `<div class="vsc ${i===me ? 'me' : ''}" style="--c:${p.color}"><span class="vsa">${ph ? `<img src="${ph}" alt="">` : AV(i, '')}</span><b>${esc(p.name)}</b></div>`; };
    const ov = document.createElement('div'); ov.id = 'vsFx'; ov.innerHTML = `<div class="vsband l">${L.map(card).join('')}</div><div class="vsmid"><b>VS</b><small>${teams ? 'ĐẤU ĐÔI XẾP HẠNG' : 'ĐẤU ĐƠN XẾP HẠNG'}</small></div><div class="vsband r">${Rr.map(card).join('')}</div>`;
    document.body.appendChild(ov); SFX.play('podium'); setTimeout(() => ov.classList.add('out'), 2600); setTimeout(() => ov.remove(), 3100); };
  window.vsIntro = vsIntro;
  const startGame = (cfg, mode, opt) => { if(NET && !((mode==='friend' || (mode==='rank' && NET.rank)) && NET.role==='host' && NET.live)) netLeave(); goLandscape(); show('game'); document.querySelectorAll('#podium').forEach(e => e.remove()); document.getElementById('toks').innerHTML = ''; document.getElementById('glow').innerHTML = ''; document.querySelectorAll('#stage .act').forEach(e => e.remove()); document.getElementById('sheetC').hidden = true; PAUSED = false; document.querySelectorAll('#pauseFx,#orderFx').forEach(e => e.remove()); SKY.t = 0; skyPaint(); newGame(cfg); applyRules(mode || 'bot', !!(opt && opt.teams)); if((mode || 'bot')!=='rank' && (mode==='friend' ? (NET && NET.len==='q') : gameLen()==='q')){ S.rules.rounds = 20; S.rules.events = true; S.rules.cut = [12]; S.rules.limit = 25*60*1000; S.rules.ramp = .25; dealPairs(); } LASTGAME = {cfg, mode: mode || 'bot', opt: opt || null}; { const h = cfg.findIndex(c => !c.bot), pick = (opt && opt.pick!=null) ? opt.pick : savedPick(); if(!NET && h>=0 && pick!=null){ const a = [0,1,2,3]; const j = a.indexOf(pick); if(j>=0) a[j] = a[h]; a[h] = pick; S.avs = a; } if(opt && Array.isArray(opt.avs)) S.avs = opt.avs.slice(); AVMAP = S.avs; S.plate = NET ? '' : STORE.plate; S.plateSeat = h; { const L = lvOf(STORE.exp).L; S.iq = (mode || 'bot')==='bot' ? gameDiff() : (L>=6 ? 3 : L>=3 ? 2 : 1); { const hs = S.players.filter(q => !q.bot); S.nb = (mode || 'bot')==='bot' && !NET && hs.length===1 && nbCount() < NB_GAMES && L<=3; if(S.nb){ hs[0].nbh = true; hs[0].cash += 200; if(nbCount()===0) S.iq = 1; S.nbN = nbCount() + 1; }
        S.tutm = (mode || 'bot')==='bot' && !NET && hs.length===1 && !!(window.TUTM && window.TUTM.want()); if(S.tutm){ S.iq = 1; window.TUTM.begin(); } }   /* v142: ván hướng dẫn tân thủ */ S.players.forEach(q => { if(q.bot) q.bag = S.iq>=3 ? {fruit:2, ot:1, cafe:1, umb:1, pho:1, dice:1, tea:1, dua:1} : S.iq>=2 ? {fruit:1, umb:1, cafe:1} : {}; }); } } fit(); renderChat(); SFX.music('calm'); wakeOn(); setTimeout(perfGuard, 4000); const e = $('sum'); if(e) e.textContent = ''; log(S.mode==='rank' ? `Xếp hạng nhanh: ${S.rules.rounds} vòng, mỗi người có ${S.rules.cash} và ${S.rules.deal} ô đất.` : 'Ván bắt đầu. Mỗi người có ' + START_CASH + '.'); render(); if(window.fpsProbe) window.fpsProbe(); if(S.mode==='rank') rankLive(true); decideOrder().then(() => { if(!NET) S.viewer = S.players[S.cur].bot ? S.viewer : S.cur; render(); run(); }); };
  const withBots = name => [{name, bot:false},{name:'Máy 1',bot:true},{name:'Máy 2',bot:true},{name:'Máy 3',bot:true}];
  const seats = (names, emptyText, avs, fus) => { const keep = AVMAP; if(avs) AVMAP = avs.map((a,i) => a==null ? i : a); const ph = i => (fus && fus[i] && /^data:image\//.test(fus[i])) ? fus[i] : (fus && fus[i] && window.PH_) ? window.PH_.src(fus[i]) : '';   /* ảnh bot là data URL */ const h = [0,1,2,3].map(i => names[i]
    ? `<div class="seat"><span class="dot" style="background:${PC[i]}">${ph(i) ? `<img class="avph" src="${ph(i)}" alt="">` : AV(i)}</span>${esc(names[i])}</div>`
    : `<div class="seat empty"><span class="dot" style="background:var(--soft)">${AV(i)}</span>${emptyText}</div>`).join(''); AVMAP = keep; return h; };
  const resetOnline = () => { if(NET && !(S && S.net) && !NET.live) netLeave(); clearInterval(matchTimer); matchTimer = null; $('friendForm').hidden = false; $('roomBox').hidden = true; $('worldForm').hidden = false; $('matchBox').hidden = true; $('rankForm').hidden = false; $('rMatchBox').hidden = true; $('cErr').textContent = ''; $('jErr').textContent = ''; };
  window.goHome = () => { PAUSED = false; document.querySelectorAll('#bagFan').forEach(e => e.remove()); AVMAP = null; document.querySelectorAll('#pauseFx,#orderFx').forEach(e => e.remove()); SFX.music('off'); wakeOff(); micStop(); netLeave(); if(S && S.net) S = null; resetOnline(); show('home'); if(window.paintMeta) window.paintMeta(); };
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { resetOnline(); if(LAND && b.dataset.go==='setup' && b.classList.contains('pan')){ paintSlots(); show('setup'); paintCoins(); return; } if(b.dataset.go==='setup' && b.classList.contains('pan')){ openPick(k => { paintSlots(); show('setup'); }); return; } show(b.dataset.go); paintCoins(); });
  $('startBtn').onclick = () => {
    const cfg = PC.map((c,i)=>({name:clean($('n'+i).value, 'Người '+(i+1)), type:$('t'+i).value})).filter(x=>x.type!=='x').map(x=>({name:x.name, bot:x.type==='b'}));
    if(cfg.length<2){ openModal('Cần ít nhất 2 người chơi','Hãy chọn Người hoặc Máy cho ít nhất 2 vị trí.',[{label:'Đóng',primary:true,fn:closeModal}]); return; }
    startGame(botFill(cfg), 'bot', {pick: savedPick()});
  };
  // hàng tên hiện đúng con vật: người chơi đầu tiên nhận nhân vật vừa chọn, các ghế còn lại nhận những con còn lại
  function paintSlots(){
    const rows = PC.map((c,i) => $('t'+i).value), seats = rows.map(() => -1); let n = 0; rows.forEach((t,i) => { if(t!=='x') seats[i] = n++; });
    const h = rows.findIndex(t => t==='h'), pick = savedPick(), a = [0,1,2,3];
    if(h>=0 && pick!=null){ const sh = seats[h], j = a.indexOf(pick); if(j>=0) a[j] = a[sh]; a[sh] = pick; }
    { const n0 = $('n0'); if(n0 && STORE.name && (n0.value==='Bạn' || n0.dataset.auto==='1')){ n0.value = STORE.name; n0.dataset.auto = '1'; } try { window.paintDiff && window.paintDiff(); } catch(e) {} }
    document.querySelectorAll('#slots .slot').forEach((el,i) => { const d = el.querySelector('.dot'); if(!d) return; el.style.opacity = rows[i]==='x' ? .45 : 1; el.classList.toggle('me', rows[i]==='h');
      if(rows[i]==='x') return; const keep = AVMAP; AVMAP = a; d.innerHTML = AV(seats[i]); AVMAP = keep; d.style.background = PC[seats[i]]; });
  }
  slots.addEventListener('change', paintSlots);
  const paintLen = () => document.querySelectorAll('[data-len]').forEach(b => b.classList.toggle('on', b.dataset.len===gameLen()));
  document.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { try { localStorage.setItem('lendoi_len', b.dataset.len); } catch(e) {} SFX.play('pop'); paintLen(); });
  paintLen();
  const paintDiff = () => { const d = gameDiff(); document.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('on', +b.dataset.diff===d)); const iqn = $('iqNote'); if(iqn) iqn.innerHTML = ['', 'Máy hiền, hợp để làm quen.', 'Máy biết dùng ô dù, cà phê, hoa quả.', 'Máy tính kỹ, dùng đủ vật phẩm cửa hàng.'][d]; };
  document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { try { localStorage.setItem('lendoi_diff', b.dataset.diff); } catch(e) {} SFX.play('pop'); paintDiff(); });
  paintDiff(); window.paintDiff = paintDiff;
  // app (v129): chọn nhân vật ngay ở màn Chơi với máy, chạm vào con vật ở hàng của bạn để xổ danh sách
  function openAvPop(slotEl){
    let pop = $('avPop'); if(pop){ pop.remove(); return; }
    const cur = savedPick()==null ? 0 : savedPick(), keep = AVMAP; AVMAP = null;
    const all = PICKS.map((x,k) => [k, x[0]]).concat(Object.keys(PREM).map(k => [+k, PREM[k].n]));
    pop = document.createElement('div'); pop.id = 'avPop';
    pop.innerHTML = all.map(([k,n]) => { const own = STORE.ownsAv(k); return `<button type="button" class="avo ${k===cur?'on':''} ${own?'':'lock'}" data-k="${k}" ${own?'':'disabled'}><span>${AV(k, k===cur ? STORE.fit : '')}</span><small>${own ? n : '🔒 ' + PREM[k].p}</small></button>`; }).join('');
    AVMAP = keep;
    const panel = slotEl.closest('.panel'); panel.appendChild(pop);
    const pr = panel.getBoundingClientRect(), sr = slotEl.getBoundingClientRect();
    pop.style.top = (sr.bottom - pr.top + 4) + 'px'; pop.style.left = (sr.left - pr.left) + 'px';
    pop.onclick = ev => { const b = ev.target.closest('.avo[data-k]'); if(!b || b.disabled) return; try { localStorage.setItem('lendoi_av', b.dataset.k); } catch(err) {} SFX.play('pop'); pop.remove(); paintSlots(); };
    const cl = ev => { if(!ev.target.closest('#avPop') && !ev.target.closest('.slot.me .dot')){ const q = $('avPop'); if(q) q.remove(); document.removeEventListener('pointerdown', cl, true); } };
    setTimeout(() => document.addEventListener('pointerdown', cl, true), 0);
  }
  if(LAND) slots.addEventListener('click', e => { const d = e.target.closest('.slot.me .dot'); if(d) openAvPop(d.closest('.slot')); });
  // ----- chọn nhân vật trước khi vào ván
  const PICKS = [['Hổ','Gan dạ, dám chơi lớn'],['Trâu','Chăm chỉ, chắc từng bước'],['Voi','Hiền lành mà nhớ dai'],['Gà','Lanh lợi, dậy sớm nhất']];
  function savedPick(){ try { const v = localStorage.getItem('lendoi_av'); if(v==null) return null; const k = Math.max(0, Math.min(6, +v)); return STORE.ownsAv(k) ? k : 0; } catch(e) { return null; } }
  window.savedPick = savedPick;
  function openPick(cb){
    const cur = savedPick();
    { const keep = AVMAP; AVMAP = null; const all = PICKS.map((x,k) => [k, x[0], x[1]]).concat(Object.keys(PREM).map(k => [+k, PREM[k].n, PREM[k].d]));
      $('pickGrid').innerHTML = all.map(x => { const k = x[0], own = STORE.ownsAv(k); return `<div class="pkc ${cur===k?'on':''} ${own?'':'lock'}" style="--c:${PC[k%4]}"><span class="pkb">${x[1]}</span><span class="pka">${AV(k, cur===k ? STORE.fit : '')}</span><small>${x[2]}</small>${own ? `<button class="pkbtn" data-pick="${k}">CHỌN</button>` : `<button class="pkbtn" disabled>🔒 ${PREM[k].p} xu ở Cửa hàng</button>`}</div>`; }).join(''); AVMAP = keep; }
    $('pickGrid').onclick = e => { const b = e.target.closest('[data-pick]'); if(!b) return; const k = +b.dataset.pick; try { localStorage.setItem('lendoi_av', k); } catch(err) {} cb(k); };
    show('pick');
  }
  window.restartGame = () => { if(LASTGAME) startGame(LASTGAME.cfg, LASTGAME.mode, LASTGAME.opt); else window.goHome(); };
  window.resumeGame = () => {
    const d = loadSave(); if(!d) return;
    if(NET) netLeave(); goLandscape(); show('game'); PAUSED = false;
    document.querySelectorAll('#podium,#pauseFx,#orderFx').forEach(e => e.remove()); document.getElementById('toks').innerHTML = ''; document.getElementById('glow').innerHTML = ''; document.querySelectorAll('#stage .act').forEach(e => e.remove()); document.getElementById('sheetC').hidden = true;
    QUIT = false; QUITR.clear(); S = d.S; S.start = Date.now() - (d.elapsed || 0); S.wait = null; S.over = false; S.restart = S.leave = false; S.turns = Math.max(0, (S.turns||1) - 1);
    S.players.forEach(p => { p.hitAt = p.gainAt = 0; }); LASTGAME = d.last || null; AVMAP = S.avs || null; chat = [];
    fit(); renderChat(); SFX.music('calm'); wakeOn(); setTimeout(perfGuard, 4000); log('Chơi tiếp ván đang dở.'); render(); run();
  };
  function openPause(){
    if(!S || S.over || document.getElementById('pauseFx')) return;
    const net = !!(NET || S.net); if(!net) PAUSED = true; const t0 = Date.now(), myTurn = !!(waitResolve && S.wait && !S.players[S.wait.pid].bot);
    const ov = document.createElement('div'); ov.id = 'pauseFx';
    ov.innerHTML = `<div class="psp"><b class="pst">${net ? '⚙️ HỆ THỐNG' : '⏸ TẠM DỪNG'}</b>
      <button class="btn primary psgo" id="psGo">▶ Chơi tiếp</button>
      <div class="psgrid">
        <button class="btn pst2" id="psNew" ${!net?'':'disabled'} aria-label="Chơi lại ván mới"><i>🔄</i><span>Ván mới</span></button>
        <button class="btn pst2" id="psHome" ${!net?'':'disabled'} aria-label="Về trang chính, giữ ván này"><i>🏠</i><span>Trang chính</span></button>
        <button class="btn pst2" id="psSys" aria-label="Hệ thống"><i>⚙️</i><span>Hệ thống</span></button>
        <button class="btn pst2" id="psRule" aria-label="Xem luật"><i>📖</i><span>Luật chơi</span></button>
        <button class="btn pst2 psquit" id="psQuit" aria-label="Thoát ván chơi"><i>🚪</i><span>Thoát</span></button>
      </div></div>`;
    ov.querySelector('#psSys').onclick = () => document.getElementById('sndBtn').click(); ov.querySelector('#psRule').onclick = () => document.getElementById('ruleBtn').click();
    document.body.appendChild(ov);
    const resume = () => { if(!net && S){ S.start += Date.now() - t0; PAUSED = false; } ov.remove(); };
    $('psQuit').onclick = () => window.askQuit(resume);
    $('psGo').onclick = resume;
    // chạm ra ngoài bảng Tạm dừng: đóng bảng và chơi tiếp (cú chạm này không bấm vào thứ phía sau)
    const outside = e => { if(!document.body.contains(ov)){ document.removeEventListener('pointerdown', outside, true); return; }
      if(e.target.closest('#pauseFx .psp, .dlg, .sheet')) return;
      e.preventDefault(); e.stopPropagation(); document.removeEventListener('pointerdown', outside, true); resume(); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    $('psNew').onclick = () => { resume(); S.restart = true; window.leaveSoon(); };
    $('psHome').onclick = () => { if(myTurn && waitResolve) saveGame(); else S.lateSave = true; resume(); S.leave = true; window.leaveSoon(); };
  }
  { let sig = '', hot = 0, k = 0; const AT = [0, 2300, 4700, 4900, 6700];   /* v131: vẽ lại đúng lúc có sự kiện và lúc mỗi cảnh hết hạn (2,2s / 4,6s / 4,8s / 6,6s) */
    setInterval(() => { if(!(S && !S.over && !PAUSED && !$('game').hidden && document.visibilityState==='visible')) return;
      const g = S.turns + '|' + S.round + '|' + (S.landed ? S.landed.at : 0) + '|' + CFX.truckAt; if(g!==sig){ sig = g; hot = Date.now(); k = 0; }
      const dt = Date.now() - hot; if(k < AT.length && dt >= AT[k]){ while(k < AT.length && dt >= AT[k]) k++; renderModels(); } }, 500); }
  // Máy yếu thì tự tạm ngưng các chuyển động trang trí (cây đung đưa, khói, sóng...); các cảnh sự kiện vẫn chạy
  const TOUCHDEV = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches); if(TOUCHDEV) document.body.classList.add('lowfx');
  /* đỡ nóng máy (v130): trên máy cảm ứng, ngoài ván các hiệu ứng trang trí chạy mãi (lấp lánh, trôi nổi, nhấp nháy) chạy một lúc rồi dừng ở khung hình đang có */
  if(TOUCHDEV && document.getAnimations){ const seen = new WeakMap(); setInterval(() => { if(document.hidden || document.body.classList.contains('ingame')) return;
    document.getAnimations().forEach(a => { try { const t = a.effect && a.effect.getTiming(); if(!(t && t.iterations===Infinity && a.playState==='running')) return; { const tg = a.effect.target; if(tg && tg.closest && tg.closest('#homeProf .pchar')) return; } const f = seen.get(a); if(!f) seen.set(a, Date.now()); else if(Date.now() - f > 1800) a.pause(); } catch(e) {} }); }, 2000); }
  // Theo dõi độ mượt suốt ván: 2 lần đo liên tiếp (mỗi lần 3 giây) dưới 40 hình/giây thì tự bật Tiết kiệm pin (nhớ cho các ván sau), trừ khi người chơi đã tự chọn
  window.fpsProbe = () => {
    if(window.fpsProbe.on) return; window.fpsProbe.on = true;
    let n = 0, t0 = 0, bad = 0, win = 0;
    const live = () => S && !S.over && !PAUSED && !document.hidden && !$('game').hidden;
    const f = t => {
      if(SYS.get('ecoUser') || SYS.get('eco')){ window.fpsProbe.on = false; return; }
      if(!live()){ t0 = 0; n = 0; setTimeout(() => requestAnimationFrame(f), 1000); return; }   /* không chơi thì chờ 1 giây mới xem lại, không bắt máy vẽ liên tục */
      if(!t0){ t0 = t; n = 0; }
      n++;
      if(t - t0 >= 3000){
        const fps = n*1000/(t - t0); bad = fps < 40 ? bad + 1 : 0; t0 = 0; if(++win >= 15 && !bad){ window.fpsProbe.on = false; return; }
        if(bad >= 2){ SYS.set('eco', true); window.fpsProbe.on = false; if(S && S.players[S.viewer]) cornerNote(S.players[S.viewer], '🔋', 'Tiết kiệm pin', 'Máy hơi chậm nên game đã bật chế độ nhẹ', 3200); return; }
      }
      requestAnimationFrame(f);
    };
    setTimeout(() => requestAnimationFrame(f), 3500);
  };
  $('pauseBtn').onclick = openPause; $('ruleBtn').onclick = openGuide; $('contBtn').onclick = () => window.resumeGame();
  { const stg = $('stage'), cam = document.createElement('div'); cam.id = 'cam'; const first = $('scene'); if(first && first.parentNode===stg){ stg.insertBefore(cam, first); ['scene','stash','over','mid'].forEach(id => { const e = $(id); if(e && e.parentNode===stg) cam.appendChild(e); }); } }
  document.addEventListener('pointerdown', () => { if(netClient() && S && S.net && S.players[NET.me] && S.players[NET.me].bot) netEmit('act', {m:'back'}); }, true);
  // ===== Phòng chơi nhiều máy =====
  // tên hiện trong phòng: lấy tên đã dùng lần trước hoặc tên trong Hồ sơ; bắt nhập nếu còn là chữ mặc định "Bạn"
  const RNK = 'lendoi_rname', rnGet = () => { try { return localStorage.getItem(RNK) || ''; } catch(e) { return ''; } };
  ['cName','jName'].forEach(k => { const e = $(k); const v = rnGet() || STORE.name || ''; if(e && v && e.value==='Bạn') e.value = v.slice(0,14); });
  const roomName = (inp, err) => { let v = clean(STORE.name || '', ''); if(!v || v==='Bạn'){ v = clean($(inp).value, ''); if(!v || v==='Bạn') v = 'Khách ' + (100 + rnd(900)); }   /* tên lấy từ Hồ sơ, không cần nhập */ try { localStorage.setItem(RNK, v); } catch(e) {} ['cName','jName'].forEach(k => { if($(k)) $(k).value = v; }); return v; };
  const netConnect = async () => PEERNET;
  const NOROOM = 'Chưa kết nối được. Kiểm tra mạng rồi thử lại.';
  const seatOf = peer => NET && NET.seats ? NET.seats.findIndex(x => x && x.peer===peer) : -1;
  // ===== Mất kết nối giữa ván (chủ phòng xử lý): cả bàn tạm dừng 15 giây; quá 15 giây máy chơi hộ; người đó vào lại thì trả quyền chơi =====
  const DC_SECS = 15;
  const dcBar = window.dcBar = (on, n, secs) => {
    let b = document.getElementById('dcBar'); if(!on){ if(b){ clearInterval(b._iv); b.remove(); } return; }
    if(!b){ b = document.createElement('div'); b.id = 'dcBar'; document.body.appendChild(b); }
    let left = secs; const paint = () => { b.innerHTML = `<span>⏸</span><b>${esc(n)}</b> mất kết nối · chờ <u>${Math.max(0,left)}</u> giây`; };
    paint(); clearInterval(b._iv); b._iv = setInterval(() => { left--; paint(); if(left<=0) clearInterval(b._iv); }, 1000);
  };
  const DC = (() => {
    let tm = null, who = -1;
    const resume = () => { clearTimeout(tm); tm = null; who = -1; PAUSED = false; dcBar(false); netEmit('ev', {k:'dcx'}); };
    const takeover = p => { p.afk = true; p.bot = true; p.remote = false; log(`${p.name} chưa quay lại, máy chơi hộ cho tới khi ${p.name} vào lại.`); };
    return {
      lost(k){ const pl = S && S.players[k]; if(!pl || !pl.alive || pl.afk || who===k || S.over) return;
        if(tm){ takeover(pl); render(); netSync(true); return; }                      // đang chờ người khác thì người này để máy chơi hộ luôn
        who = k; PAUSED = true; log(`${pl.name} mất kết nối, cả bàn tạm dừng ${DC_SECS} giây.`);
        dcBar(true, pl.name, DC_SECS); netEmit('ev', {k:'dc', n:pl.name, s:DC_SECS}); netSync(true);
        tm = setTimeout(() => { const p2 = S && S.players[k]; if(p2 && who===k && !p2.afk) takeover(p2); resume(); render(); netSync(true); }, DC_SECS*1000); },
      back(k){ const pl = S && S.players[k]; if(!pl) return; let ch = false;
        if(who===k){ resume(); ch = true; }
        if(pl.afk){ pl.afk = false; pl.bot = false; pl.remote = true; pl.miss = 0; ch = true; }
        if(ch){ log(`${pl.name} đã quay lại, tiếp tục chơi.`); SFX.play('join'); render(); netSync(true); } },
      reset(){ if(tm) resume(); }
    };
  })();
  // hết ván chơi với bạn: cả nhóm về lại phòng chờ cũ (giữ ID, mật khẩu, chỗ ngồi, chat) để đánh ván mới
  window.backToRoom = () => {
    if(!NET){ window.goHome(); return; }
    PAUSED = false; DC.reset(); document.querySelectorAll('#bagFan,#pauseFx,#orderFx,#dcBar').forEach(e => e.remove()); AVMAP = null; SFX.music('off'); wakeOff(); micStop();
    S = null;
    if(NET.role==='host'){ NET.live = false;
      const on = new Set((NET.R && NET.R.peers ? NET.R.peers() : []).map(x => x.peer));
      NET.seats = NET.seats.map((x,k) => k===0 ? x : (x && (x.bot || on.has(x.peer)) ? x : null)); lobbyCast(); }
    if(NET.role!=='host') try { localStorage.setItem('lendoi_lastroom', JSON.stringify({id:NET.id, pw:NET.pw, name:(($('jName') || {}).value || STORE.name || 'Khách'), at:Date.now()})); } catch(e) {}
    show('friend'); renderLobby();
  };
  const lobbyCast = () => { if(NET && NET.role==='host') netEmit('lobby', {id:NET.id, len:NET.len, live:NET.live?1:0, seats:NET.seats.map(x => x ? {n:x.name, p:x.peer, a:x.av||0, f:x.fu||'', i:x.fi||''} : null), rej:NET.rej, rk:NET.rank ? 1 : 0}); };
  const renderLobby = () => {
    if(!NET) return; if(NET.rank && window.RKD_) window.RKD_.paint();
    const host = NET.role==='host', list = host ? NET.seats.map(x => x ? x.name : null) : (NET.seats || []).map(x => x ? x.n : null);
    const avl = host ? NET.seats.map(x => x ? (x.av||0) : null) : (NET.seats || []).map(x => x ? (+x.a||0) : null);
    const ful = host ? NET.seats.map(x => x ? (x.fu||'') : '') : (NET.seats || []).map(x => x ? String(x.f||'') : '');
    $('rId').textContent = NET.id; $('rPw').textContent = NET.pw || 'Không có'; $('rMode').textContent = NET.len==='q' ? '⚡ Ván nhanh · 20 vòng' : '🏛️ Ván dài · 60 vòng';
    { const cnt = list.filter(Boolean).length; if(NET.cnt!=null && cnt>NET.cnt) SFX.play('join'); NET.cnt = cnt; }
    $('fSlots').innerHTML = seats(list.map((n,k) => n ? n + (k===0 ? ' (chủ phòng)' : '') + (k===NET.me ? ' (bạn)' : '') : null), host ? 'Đang chờ bạn vào' : 'Chỗ trống', avl, ful);
    if(host && !NET.live && !NET.rank) $('fSlots').querySelectorAll('.seat').forEach((el, k) => { if(k > 0 && NET.seats[k]) el.insertAdjacentHTML('beforeend', `<button type="button" class="skick" data-kick="${k}" aria-label="Mời ra">✕</button>`); });
    { const ms = $('rModeSel'); if(ms){ ms.hidden = !(host && !NET.live && !NET.rank); ms.querySelectorAll('[data-rlm]').forEach(b => b.classList.toggle('on', b.dataset.rlm===(NET.len==='q' ? 'q' : 'l'))); } }
    $('startRoom').hidden = !host; $('botFillL').hidden = !host;
    $('roomNote').textContent = host ? (FBNET.ok() ? 'Bấm Mời bạn bè để gửi link qua Zalo, Messenger… Bạn bè bấm link là vào thẳng phòng. Chỗ trống khi bắt đầu sẽ do máy chơi.' : 'Gửi ID phòng và mật khẩu cho bạn bè. Họ cần mở đúng trang này và được bạn mời (nút chia sẻ) với quyền tương tác. Chỗ còn trống khi bắt đầu sẽ do máy chơi.')
      : (NET.me>=0 ? 'Đã vào phòng. Chờ chủ phòng bấm bắt đầu.' : 'Đang xin vào phòng...');
    $('friendForm').hidden = true; $('roomBox').hidden = false;
    // màn ngang: thông tin ván sang cột trái dưới tiêu đề, phòng chờ còn 2 cột người chơi và chat
    if(document.documentElement.classList.contains('land')){ const lp = document.querySelector('#friend > .lp'), rb = document.querySelector('#roomBox .rbL') || document.querySelector('#friend .rbL'); if(lp && rb && rb.parentNode!==lp) lp.appendChild(rb); }
  };
  $('fSlots').addEventListener('click', e => { const b = e.target.closest('[data-kick]'); if(!b || !NET || NET.role!=='host' || NET.live) return; const k = +b.dataset.kick, x = NET.seats[k]; if(!x || k===0) return;
    if(x.peer) NET.rej[x.peer] = 'kick'; (NET.kickN = NET.kickN || []).push(x.name); NET.seats[k] = null; SFX.play('click'); palToast(`Đã mời ${x.name} ra khỏi phòng`); lobbyCast(); renderLobby(); });
  $('rModeSel').addEventListener('click', e => { const b = e.target.closest('[data-rlm]'); if(!b || !NET || NET.role!=='host' || NET.live) return; NET.len = b.dataset.rlm==='q' ? 'q' : 'l'; SFX.play('pop'); lobbyCast(); renderLobby(); });
  const hostWire = R => {
    R.on('lobby', m => { if(m.isMe && m.sameTab && NET && NET.role==='host' && NET.seats[NET.me||0]) NET.seats[NET.me||0].peer = m.peer; });
    R.on('hello', m => {
      if(!NET || m.isMe) return; const d = m.data || {};
      if(String(d.id)!==NET.id) return;
      if(NET.pw && String(d.pw)!==NET.pw){ NET.rej[m.peer] = 'pw'; lobbyCast(); return; }
      if(NET.rej[m.peer]==='kick'){ lobbyCast(); return; }
      let k = seatOf(m.peer);
      if(k<0){
        const nm = clean(String(d.name||''), 'Bạn');
        if(NET.live){
          const on = new Set((R.peers ? R.peers() : []).map(x => x.peer));
          k = NET.seats.findIndex((x,idx) => idx!==NET.me && x && x.name===nm && !on.has(x.peer));
          if(k<0){ NET.rej[m.peer] = 'live'; lobbyCast(); return; }
          NET.seats[k].peer = m.peer; DC.back(k);   // vào lại bằng đúng tên cũ: trả lại chỗ, bỏ máy chơi hộ
        } else {
          k = NET.rank ? (NET.seats[2] ? -1 : 2) : NET.seats.findIndex((x,idx) => idx>0 && !x);
          if(k<0){ NET.rej[m.peer] = 'full'; lobbyCast(); return; }
          let name = nm, c = 2; while(NET.seats.some(x => x && x.name===name)) name = nm + ' ' + (c++);
          NET.seats[k] = {name, peer:m.peer, av:Math.max(0, Math.min(6, +d.av || 0)), fu:String(d.fu || '').slice(0,40), fi:/^\d{8}$/.test(String(d.fi || '')) ? String(d.fi) : '', fit:fitList(d.ft).join('+')};
        }
      }
      delete NET.rej[m.peer]; lobbyCast(); if(!NET.live) renderLobby();
    });
    if(R.onPeers) R.onPeers(ch => { if(!NET) return;
      if(NET.live){ (ch.left || []).forEach(x => { const k = seatOf(x.peer); if(k>=0 && k!==NET.me) DC.lost(k); }); (ch.joined || []).forEach(x => { const k = seatOf(x.peer); if(k>=0 && k!==NET.me) DC.back(k); }); return; }
      (ch.left || []).forEach(x => { const k = seatOf(x.peer); if(k>0) NET.seats[k] = null; }); lobbyCast(); renderLobby(); });
    const who = m => (NET && NET.live && S) ? seatOf(m.peer) : -1;
    R.on('act', m => { const pid = who(m), d = m.data || {}; if(pid<0 || pid===NET.me) return; const pl = S.players[pid]; if(pl.afk){ pl.afk = false; pl.bot = false; pl.remote = true; pl.miss = 0; log(`${pl.name} đã quay lại.`); render(); } else pl.miss = 0; if(S.wait && S.wait.pid===pid && S.wait.mode===d.m && waitResolve) waitResolve('ok'); });
    R.on('mic', m => { const d = m.data || {}; if(m.isMe) return; MICS[+d.p] = !!d.on; if(S) render(); });
    R.on('ordp', m => { const pid = who(m); if(pid<0 || pid===NET.me || !NET.ordTake) return; NET.ordTake(Math.floor(+(m.data || {}).k), pid); });
    R.on('ans', m => { const pid = who(m), d = m.data || {}; if(pid<0 || pid===NET.me) return; if(S.pend && S.pend.to===pid && NET.onAns) NET.onAns(d.id, d.v); });
    R.on('chat', m => { const pid = who(m), d = m.data || {}; if(pid<0 || pid===NET.me || S.over) return; const t = String(d.t||'').slice(0,80).trim(); if(t) say(S.players[pid], t, EMOJI.includes(t)); });
    R.on('req', m => {
      const pid = who(m), d = m.data || {}; if(pid<0 || pid===NET.me || S.over) return; const p = S.players[pid];
      if(!p.alive || !S.wait || S.wait.pid!==pid || S.pend) return;
      if(d.k==='repay'){ repay(p, +d.n); render(); }
      else if(d.k==='item') applyItem(p, String(d.it), +d.t);
      else if(d.k==='trade'){ const take = Math.floor(+d.take), give = Math.floor(+d.give), cash = Math.round(+d.cash) || 0, q = S.players[S.owner[take]]; if(q && q.id!==pid && Math.abs(cash)<=99999 && (give<0 || S.owner[give]===pid)) runTrade(p, q, give, take, cash).then(render); }
      else if(d.k==='sell'){ const i = Math.floor(+d.i), price = Math.floor(+d.price); if(price>=1 && price<=99999 && canList(p) && (i<0 ? p.card>0 : sellable(p, i))) runSale(p, i, price).then(render); }
      else if(d.k==='buy2'){ const i = Math.floor(+d.i), ps = S.passed; if(ps && ps.pid===pid && ps.i===i && ps.turn===S.turns && p.pos===i && S.owner[i]<0 && S.rules.weekly!=='allbid'){ const price = priceOf(i); if(p.cash>=price){ p.cash -= price; S.owner[i] = pid; S.passed = null; log(`${p.name} mua ${TILES[i].n} với giá ${price}.`); checkCombo(p, i); render(); } } }
    });
  };
  const clientState = d => {
    if(!NET || !d || !Array.isArray(d.p)) return;
    // tl, ld.a, bu.a, rg.l đổi theo đồng hồ dù ván không đổi: bỏ ra khi so
    const sig = JSON.stringify(Object.assign({}, d, {tl:0, ld:d.ld ? d.ld.i : null, bu:d.bu ? d.bu.i : null, rg:d.rg ? [d.rg.p, d.rg.d] : null}));
    if(S && S.net && sig===NET.lastSig){ NET.lastSt = Date.now(); return; }
    NET.lastSig = sig;
    const prev = (S && S.net) ? S : null, ns = unpackState(d);
    if(prev){ ns.rewarded = prev.rewarded; ns.players.forEach((p,k) => { const o = prev.players[k]; if(!o) return; p.hitAt = o.hitAt; p.gainAt = o.gainAt; if(p.cash<o.cash) p.hitAt = Date.now(); else if(p.cash>o.cash) p.gainAt = Date.now(); }); }
    S = ns; AVMAP = S.avs; NET.lastSt = Date.now();
    if(S.wait && S.wait.pid===NET.me && !(prev && prev.wait && prev.wait.pid===NET.me)) profClose();
    if(profOpen()) renderAssets();
    if(!prev){ if(window.RKD_) window.RKD_.close(); if(ns.mode==='rank') setTimeout(() => { if(window.vsIntro) window.vsIntro(); }, 300); show('game'); document.getElementById('toks').innerHTML = ''; document.getElementById('glow').innerHTML = ''; document.querySelectorAll('#stage .act,#podium').forEach(e => e.remove()); document.getElementById('sheetC').hidden = true; chat = []; fit(); SFX.music('calm'); wakeOn(); }
    if(NET.lastDs!=null && d.ds!==NET.lastDs && Array.isArray(d.d)) showDice(+d.d[0]||1, +d.d[1]||1);
    NET.lastDs = d.ds;
    if(NET.showId && d.pe!==NET.showId){ NET.showId = 0; if(askAbort) askAbort(); }
    render();
    if(prev) ns.players.forEach((p,k) => { const o = prev.players[k]; if(o && p.alive && p.cash!==o.cash && !(Date.now() - (FXSEEN[k] || 0) < 2500)){ fxNum(p, (p.cash>o.cash ? '+' : '−') + Math.abs(p.cash-o.cash), p.cash>o.cash ? 'gain' : ''); SFX.play(p.cash>o.cash ? (p.cash-o.cash>=100 ? 'coinbig' : 'coin') : 'lose', 0, p.id===NET.me ? 1 : .45); } });
    if(S.over && !NET.shown){ NET.shown = true; showResult(); }
  };
  const clientPrompt = pd => {
    if(!NET || !pd || pd.to!==NET.me) return;
    if(pd.id===NET.doneId){ netEmit('ans', {id:pd.id, v:NET.doneVal}); return; }
    if(pd.id===NET.showId) return;
    if(askAbort) askAbort();
    NET.showId = pd.id;
    const fin = v => { if(!NET) return; NET.doneId = pd.id; NET.doneVal = v; if(NET.showId===pd.id) NET.showId = 0; netEmit('ans', {id:pd.id, v}); };
    const secs = Math.max(3, Math.min(60, +pd.secs || DECIDE));
    if(pd.kind==='bid') bidDialog(String(pd.name||'').slice(0,40), +pd.floor||0, +pd.cash||0, +pd.maxPay||0, secs).then(fin);
    else askLocal(String(pd.title||'').slice(0,90), unpackBody(pd.body), (pd.opts||[]).slice(0,14).map(o => ({k:o.k, label:String(o.label||'').slice(0,90), sub:o.sub ? String(o.sub).slice(0,160) : undefined, primary:!!o.primary, disabled:!!o.disabled})), secs).then(fin);
  };
  // ----- chủ phòng thoát giữa ván: người thật ở ghế sớm nhất lên làm chủ phòng, ghế cũ do máy chơi thay
  const migrate = (oldPeer) => {
    if(!NET || NET.role!=='client' || NET.migr) return; NET.migr = true;
    if(!(S && S.net) || S.over){ if(!(S && S.net)){ netLeave(); resetOnline(); $('jErr').textContent = 'Chủ phòng đã rời phòng.'; } return; }
    const on = new Set((NET.R && NET.R.peers ? NET.R.peers() : []).map(x => x.peer)); on.delete(oldPeer); if(NET.myPeer) on.add(NET.myPeer);
    const oldK = Math.max(0, NET.seats.findIndex(x => x && x.p===oldPeer));
    const cand = NET.seats.map((x,k) => (x && k!==oldK && on.has(x.p) && S.players[k] && S.players[k].alive) ? k : -1).filter(k => k>=0);
    const all = NET.seats.map((x,k) => (x && k!==oldK && on.has(x.p) && S.players[k]) ? k : -1).filter(k => k>=0);
    const nk = (cand.length ? cand : all)[0];
    if(nk==null || nk!==NET.me){ NET.migr = false; NET.hostPeer = nk!=null ? NET.seats[nk].p : null; NET.lastSt = Date.now(); return; }
    // mình là chủ phòng mới
    const R0 = NET.R, oldName = (S.players[oldK] || {}).name || 'Chủ phòng';
    NET.role = 'host'; NET.live = true; NET.hostPeer = null; NET.rej = {}; NET.askSeq = 5000; NET.onAns = null; NET.ordTake = null;
    NET.seats = NET.seats.map(x => x ? {name:String(x.n||''), peer:x.p, av:+x.a||0, fu:String(x.f||''), fi:String(x.i||'')} : null);
    ['helloIv','watch'].forEach(k => { if(NET[k]) clearInterval(NET[k]); NET[k] = null; });
    delete S.net; S.viewer = NET.me; S.wait = null; S.pend = null; S.ring = null; S.upLap = S.upLap || Array(N).fill(-1);
    S.decks = {chance:shuffle(CARDS.chance.map((c,i) => i)), fortune:shuffle(CARDS.fortune.map((c,i) => i))};
    if(!Array.isArray(S.order) || S.order.length!==S.players.length) S.order = S.players.map((p,i) => i);
    S.players.forEach((p,k) => { if(k===NET.me){ p.bot = false; p.remote = false; } else if(k===oldK){ if(p.alive){ p.bot = true; p.remote = false; p.afk = true; } } else if(!p.bot) p.remote = true; });
    PAUSED = false; if(askAbort) try { askAbort(); } catch(e) {}
    hostWire(R0); netEmit('nh', {k:NET.me}); lobbyCast();
    NET.lobbyIv = setInterval(lobbyCast, 1000); NET.hb = setInterval(() => { if(netHost() && S){ netLgSeq = -1; netSync(true); } }, 1000);
    log(`${oldName} (chủ phòng) đã thoát, máy chơi thay. ${S.players[NET.me].name} làm chủ phòng mới.`);
    document.querySelectorAll('#toast2').forEach(e => e.remove()); palToast('👑 Chủ phòng đã thoát, bạn làm chủ phòng mới');
    render(); netSync(true); run();
  };
  const clientWire = R => {
    const fromHost = m => NET && NET.hostPeer && m.peer===NET.hostPeer;
    R.on('hq', m => { if(fromHost(m)) migrate(m.peer); });
    R.on('nh', m => { if(!NET || NET.role!=='client' || m.isMe) return; const k = +(m.data || {}).k; if(NET.seats[k] && NET.seats[k].p===m.peer){ NET.hostPeer = m.peer; NET.migr = false; NET.lastSt = Date.now(); } });
    if(R.onPeers) R.onPeers(ch => { if(!NET || NET.role!=='client' || !NET.hostPeer) return; if((ch.left || []).some(x => x.peer===NET.hostPeer)) migrate(NET.hostPeer); });
    R.on('hello', m => { if(NET && m.isMe && m.sameTab) NET.myPeer = m.peer; });
    R.on('lobby', m => {
      if(!NET) return; const d = m.data || {};
      if(String(d.id)!==NET.id || m.isMe) return;
      if(!NET.hostPeer) NET.hostPeer = m.peer;
      if(m.peer!==NET.hostPeer) return;
      NET.seats = Array.isArray(d.seats) ? d.seats.slice(0,4) : []; if(d.len) NET.len = d.len==='q' ? 'q' : 'l'; NET.rank = !!d.rk;
      NET.me = NET.myPeer ? NET.seats.findIndex(x => x && x.p===NET.myPeer) : -1;
      const rj = d.rej && NET.myPeer && d.rej[NET.myPeer];
      if(rj && NET.me<0){ netLeave(); resetOnline(); $('jErr').textContent = rj==='pw' ? 'Sai mật khẩu phòng.' : rj==='kick' ? 'Bạn đã bị chủ phòng mời ra khỏi phòng.' : rj==='full' ? 'Phòng đã đủ 4 người.' : 'Ván trong phòng này đã bắt đầu.'; return; }
      if(!(S && S.net)){ renderLobby(); if(NET.rank && window.RKD_) window.RKD_.client(); }
    });
    R.on('st', m => { if(fromHost(m) && NET.me>=0) clientState(m.data); });
    R.on('fx', m => { if(!fromHost(m) || NET.me<0) return; const d = m.data || {}, q = Array.isArray(d.q) ? d.q : [];
      q.forEach(x => { if(/^fx(Gain|Lose|Num)$/.test(x && x[0]) && x[1] && x[1][0] && x[1][0]._p!=null) FXSEEN[x[1][0]._p] = Date.now(); });
      if(d.st) clientState(d.st);
      if(S && S.net && window.FXPLAY) window.FXPLAY(q); });
    R.on('mic', m => { const d = m.data || {}; if(m.isMe) return; MICS[+d.p] = !!d.on; if(S) render(); });
    R.on('ord', m => { if(fromHost(m) && NET.me>=0) ordGuest(m.data || {}); });
    R.on('pd', m => { if(fromHost(m)) clientPrompt(m.data); });
    R.on('lg', m => {
      if(!fromHost(m) || !(S && S.net)) return;
      ((m.data || {}).m || []).forEach(x => {
        if(!(x.q > NET.lgSeq)) return; NET.lgSeq = x.q;
        const t = String(x.t||'');
        if(x.s){ chat.push({sys:true, text:esc(t)}); showAct(t); }
        else if(S.players[x.p]){ chat.push({pid:+x.p, text:t, emoji:!!x.e}); showBubble(S.players[x.p], t, !!x.e); if(+x.p!==NET.me){ SFX.play('chat'); if(!S.players[x.p].bot) chatPing(S.players[x.p], t, !!x.e); } }
      });
      if(chat.length>160) chat.splice(0, chat.length-160);
      renderChat();
    });
    R.on('ev', m => {
      if(!fromHost(m) || !(S && S.net)) return; const d = m.data || {};
      if(d.k==='card' && S.players[d.pid]) showCard({bot:true, id:d.pid, name:S.players[d.pid].name}, d.kind==='chance' ? 'chance' : 'fortune', {n:esc(String(d.n||'')), d:esc(String(d.d||''))});
      else if(d.k==='isle' && d.q===NET.me && S.players[d.p]) islandNotice(S.players[d.p], S.players[d.q]);
      else if(d.k==='dc') dcBar(true, String(d.n||''), +d.s || DC_SECS);
      else if(d.k==='dcx') dcBar(false);
      else if(d.k==='item' && ITEMS[d.it]) itemFx(String(d.it), +d.p, +d.t);
    });
  };
  // link mời: bạn bè bấm là vào thẳng phòng (?room=ID&pw=MẬT KHẨU)
  // ----- danh sách phòng đang mở: chủ phòng đăng lên lobby/<ID>, người khác xem, tìm và bấm vào để nhập mật khẩu
  const BLOBBY = window.BLOBBY_ = (() => {   /* phòng chờ của phòng máy: chạy trên máy mình, dùng lại giao diện phòng chờ thật */
    let B = null; const VI = document.documentElement.lang !== 'en';
    const HI = ['Chào cả phòng 👋', 'Hú, vô rồi nè', 'Ê chờ tui với', 'Có ai chơi ván dài không', 'Vô lẹ đi mọi người', 'Hello hello', 'Lần này tui thắng nha 😤'];
    const HOST = ['Chờ xíu đủ người là chơi nha', 'Còn thiếu người, ai rủ thêm bạn đi', 'Đủ 4 là bắt đầu liền'];
    const GO = ['Đủ người rồi, chơi thôi!', 'Ok bắt đầu nha', 'Vô ván!'];
    const pick = a => a[Math.floor(Math.random()*a.length)];
    const sty = (n, t) => (typeof botStyleText==='function' ? botStyleText(n, t) : t);
    const pic = n => { const i = typeof BOTPOOL!=='undefined' ? BOTPOOL.findIndex(b => b[0]===n) : -1; return i >= 0 ? (BOTPOOL_IMG[i] || '') : (BOTPA[n] || ''); };
    const paint = () => { if(!B) return; const names = B.seats.map((x,k) => x ? (x.me && !VI && x.name==='Bạn' ? 'You' : x.name) + (k===0 ? (VI ? ' (chủ phòng)' : ' (host)') : '') + (x.me ? (VI ? ' (bạn)' : ' (you)') : '') : null);
      $('fSlots').innerHTML = seats(names, 'Chỗ trống', B.seats.map(x => x ? x.av : null), B.seats.map(x => x && !x.me ? pic(x.name) : ''));
      $('rId').textContent = B.id; $('rPw').textContent = B.o ? 'Không có' : '••••'; $('rMode').textContent = B.len==='q' ? '⚡ Ván nhanh · 20 vòng' : '🏛️ Ván dài · 60 vòng';
      $('roomNote').hidden = false; $('roomNote').textContent = B.cd ? `Đủ người! Bắt đầu sau ${B.cd} giây…` : 'Chủ phòng đang mời thêm người…'; };
    const say = (n, t, d) => setTimeout(() => { if(B && typeof lcAdd==='function') lcAdd(n, VI ? sty(n, t) : t, false); }, d || 0);
    const close = () => { if(!B) return; B.tm.forEach(clearTimeout); B = null; document.querySelectorAll('#friend .rshare,#startRoom,#botFillL').forEach(e => e.hidden = false); };
    const start = () => { if(!B) return; const st = B; const cfg = [st.seats.find(x => x.me)].concat(st.seats.filter(x => !x.me)).map(x => ({name:x.name, bot:!x.me}));
      st.seats.forEach(x => { if(!x.me) BOTPA[x.name] = pic(x.name); }); close(); resetOnline();
      try { localStorage.setItem('lendoi_len', st.len); } catch(e) {} startGame(cfg, 'bot', {pick: savedPick()}); if(S) S.iq = 3; };
    const join = () => { if(!B) return; const k = B.seats.findIndex(x => !x); if(k < 0) return;
      const n = botPick(1, B.seats.filter(Boolean).map(x => x.name))[0]; if(!n) return; B.seats[k] = {name:n, av:Math.floor(Math.random()*7)}; SFX.play('join'); paint();
      if(VI && Math.random() < .7) say(n, pick(HI), 900 + Math.random()*1500); next(); };
    const next = () => { if(!B) return; if(B.seats.every(Boolean)){ B.cd = 3; paint(); if(VI) say(B.seats[0].name, pick(GO), 300);
        const tick = () => { if(!B) return; B.cd--; if(B.cd <= 0){ start(); return; } paint(); B.tm.push(setTimeout(tick, 1000)); }; B.tm.push(setTimeout(tick, 1000)); return; }
      B.tm.push(setTimeout(join, 2500 + Math.random()*5500)); };   /* người vào dần; lâu không ai vào thì chủ phòng mời máy cho đủ */
    const open = bv => { close(); const me = clean(STORE.name || 'Bạn', 'Bạn');
      B = {id:bv.id, len:bv.len, o:bv.o, cd:0, tm:[], seats:[{name:bv.n, av:0}, null, null, null]};
      botPick(Math.max(0, (bv.c || 1) - 1), [bv.n]).forEach((n, j) => { B.seats[1 + j] = {name:n, av:(j + 2) % 7}; });
      const k = B.seats.findIndex(x => !x); B.seats[k] = {name:me, av:savedPick() || 0, me:1};
      document.querySelectorAll('#friend .rshare,#startRoom,#botFillL').forEach(e => e.hidden = true);
      { const ms = $('rModeSel'); if(ms) ms.hidden = true; } lcReset(); paint(); $('friendForm').hidden = true; $('roomBox').hidden = false;
      if(document.documentElement.classList.contains('land')){ const lp = document.querySelector('#friend > .lp'), rb = document.querySelector('#roomBox .rbL') || document.querySelector('#friend .rbL'); if(lp && rb && rb.parentNode!==lp) lp.appendChild(rb); }
      if(VI) say(bv.n, pick(HOST), 1200); next(); };
    $('leaveRoom').addEventListener('click', () => { if(B){ close(); } }, true);
    $('lcForm').addEventListener('submit', e => { if(!B) return; e.preventDefault(); e.stopImmediatePropagation(); const i = $('lcText'), t = i.value.trim(); if(!t) return;
      lcAdd(clean(STORE.name || 'Bạn', 'Bạn'), t, true); i.value = '';
      if(VI && typeof botSmartReply==='function'){ const o = B.seats.filter(x => x && !x.me); if(o.length){ const b = o[Math.floor(Math.random()*o.length)], r = botSmartReply(t, 'game'); say(b.name, r.text, 1500 + Math.random()*2000); } } }, true);
    document.addEventListener('click', e => { if(B && e.target.closest('[data-go]')) close(); }, true);
    return {open, close, on: () => !!B};
  })();
  const ROOMS = window.ROOMS_ = (() => {
    let L = {}, ref0 = null, q = '';
    let scanning = false, lastScan = 0;
    // phòng chờ của mình: bật đèn hiệu để máy khác tìm thấy; vào ván rồi thì tắt
    const reg = () => { if(!NET || NET.role!=='host' || NET.rank) return; const id0 = NET.id;
      NET.beaconOff = PEERNET.beacon(() => ({id:NET.id, n:String(NET.seats[0] && NET.seats[0].name || 'Chủ phòng').slice(0, 20), av:+(NET.seats[0] && NET.seats[0].av) || 0, c:NET.seats.filter(Boolean).length, len:NET.len==='q' ? 'q' : 'l', o:NET.pw ? 0 : 1}));
      NET.regIv = setInterval(() => { if(!NET || NET.id!==id0 || NET.live){ if(NET && NET.id===id0){ clearInterval(NET.regIv); NET.regIv = null; if(NET.beaconOff){ NET.beaconOff(); NET.beaconOff = null; } } } }, 2000); };
    const scanNow = async () => { if(scanning) return; scanning = true; paint();
      try { const list = await PEERNET.scan(), now = Date.now(); L = {}; list.forEach(v => { L[v.id] = Object.assign({}, v, {at:now}); }); } catch(e) {}
      scanning = false; lastScan = Date.now(); paint(); };
    const paint = () => { const el = $('rbList'); if(!el) return; const now = Date.now(), qq = q.trim().toLowerCase();
      const BR = (() => { return [];   /* bản local: không bày phòng giả của bot */ const w = Math.floor(now/6e5); let sd = (w * 7919) % 233280; const r = () => (sd = (sd*9301 + 49297) % 233280) / 233280;   /* phòng của bot: đổi mỗi 10 phút */
        const out = [], used = new Set(); for(let i=0; i<7 + (w % 5); i++){ const bi = Math.floor(r()*BOTPOOL.length); if(used.has(bi)) continue; used.add(bi);
          out.push({id:String(10000 + Math.floor(r()*89999)), n:BOTPOOL[bi][0], pa:BOTPOOL_IMG[bi] || '', av:bi % 7, c:1 + Math.floor(r()*3), len:r() < .5 ? 'q' : 'l', at:now - Math.floor(r()*30000), bot:1, o:bi % 3 ? 0 : 1}); } window.__botRooms = out; return out; })();
      const A = Object.entries(L).map(([id, v]) => Object.assign({id}, v)).concat(BR).filter(v => v.at && now - v.at < 45000 && (!qq || v.id.includes(qq) || String(v.n || '').toLowerCase().includes(qq))).sort((a,b) => (b.at||0) - (a.at||0));
      el.innerHTML = A.length ? `<div class="rbgrid">${A.map(v => { const ph = v.pa || (v.f && window.PH_ ? window.PH_.src(v.f) : ''); const keep = AVMAP; AVMAP = null; const av = AV(+v.av || 0, ''); AVMAP = keep;
          return `<button type="button" class="rbc ${v.c>=4 ? 'full' : ''}" data-rbid="${esc(v.id)}"><span class="rbav">${ph ? `<img src="${ph}" alt="">` : av}</span><span class="rbi"><b>Phòng ${esc(v.id)}</b><small>👑 ${esc(v.n || 'Chủ phòng')}</small><em>${v.len==='q' ? '⚡ Ván nhanh' : '🏛️ Ván dài'}</em></span><span class="rbn"><b>${v.c || 1}/4</b><i>${v.o ? '🔓' : '🔒'}</i></span></button>`; }).join('')}</div>`
        : `<div class="rbnone"><i>${scanning ? '🔎' : '🏠'}</i><b>${scanning ? 'Đang tìm phòng…' : qq ? 'Không tìm thấy phòng nào' : 'Chưa có phòng nào đang mở'}</b><small>${scanning ? 'Đang hỏi các máy đang mở phòng.' : 'Tạo phòng ở bên trái, hoặc gõ đủ 5 số ID phòng rồi bấm Enter để vào thẳng.'}</small></div>`; };
    const listen = () => { if(!NET) scanNow(); };
    // vào nhanh: tìm rồi vào ngay phòng mở (không mật khẩu, còn ghế) mới nhất
    const quick = async () => { SFX.play('click'); await scanNow();
      const v = Object.values(L).filter(x => x.o && (x.c || 1) < 4)[0];
      if(v){ $('jId').value = v.id; $('jPw').value = ''; $('joinRoom').click(); }
      else palToast(Object.keys(L).length ? 'Các phòng đang mở đều có mật khẩu hoặc đã đủ người' : 'Chưa thấy phòng nào đang mở'); };
    const join = id => { const bv = !L[id] && (window.__botRooms || []).find(x => x.id===id);
      if(bv){ SFX.play('pop'); BLOBBY.open(bv); return; }
      const v = L[id]; if(!v) return; if(v.c>=4){ palToast('Phòng ' + id + ' đã đủ 4 người'); return; } SFX.play('pop');
      if(v.o){ $('jId').value = id; $('jPw').value = ''; $('joinRoom').click(); return; }
      openModal('🔒 Vào phòng ' + id, `<div class="rbjoin"><p>Chủ phòng: <b>${esc(v.n || '')}</b> · ${v.len==='q' ? '⚡ Ván nhanh' : '🏛️ Ván dài'} · ${v.c || 1}/4 người</p><label class="fl">Mật khẩu phòng<input class="inp2" id="rbPw" maxlength="12" inputmode="numeric" placeholder="Nhập mật khẩu" autocomplete="off"></label><p class="err" id="rbErr"></p></div>`,
        [{label:'Vào phòng', primary:true, fn:() => { const pw = ($('rbPw') || {}).value || ''; if(String(pw).trim().length < 2){ $('rbErr').textContent = 'Hãy nhập mật khẩu phòng.'; return; } closeModal(); $('jId').value = id; $('jPw').value = String(pw).trim(); $('joinRoom').click(); }}, {label:'Thôi', fn:closeModal}], 'one rbdlg');
      setTimeout(() => { const i = $('rbPw'); if(i && !SOFTKB) i.focus(); }, 100); };
    $('rbList').addEventListener('click', e => { const b = e.target.closest('[data-rbid]'); if(b) join(b.dataset.rbid); });
    $('rbQ').addEventListener('input', e => { q = e.target.value || ''; paint(); });
    // gõ đủ 5 số ID rồi Enter: vào thẳng phòng đó, như bản cũ
    $('rbQ').addEventListener('keydown', e => { const id = String(e.target.value || '').trim(); if(e.key!=='Enter' || !/^\d{5}$/.test(id)) return; e.preventDefault();
      if(L[id] && !L[id].o){ join(id); return; } $('jId').value = id; $('jPw').value = ''; $('joinRoom').click(); });
    $('rbRef').onclick = () => { SFX.play('click'); scanNow(); };
    $('rbQuick').onclick = quick;
    document.addEventListener('click', e => { if(e.target.closest('[data-go="friend"]')) setTimeout(listen, 100); }, true);
    setInterval(() => { if(document.body.dataset.scr==='friend' && !NET && !document.hidden && Date.now() - lastScan > 7000) scanNow(); }, 2000);
    // màn ngang: khung Tạo phòng nằm cột trái dưới tiêu đề
    setTimeout(() => { const lp = document.querySelector('#friend > .lp'), cp = $('crPanel'); if(lp && cp && cp.parentElement!==lp) lp.appendChild(cp); }, 600);
    return {reg, listen, paint};
  })();
  const roomLink = () => location.origin + location.pathname + '?room=' + NET.id + '&pw=' + encodeURIComponent(NET.pw);
  const copyLink = async () => { const u = roomLink(); try { await navigator.clipboard.writeText(u); palToast('Đã sao chép link phòng, dán gửi cho bạn bè nhé'); } catch(e) { window.prompt('Sao chép link này gửi cho bạn bè:', u); } };
  // mời bạn trong game: danh sách bạn bè, bấm Mời để gửi lời mời vào phòng
  const invited = new Set();
  $('inviteIn').onclick = () => { if(!NET) return; SFX.play('click');
    const L = (window.FR_ ? window.FR_.friends() : []).map(([id, x]) => ({id, n:x.n || 'Bạn', k:+x.av || 0, lv:x.lv || 1, o:x.o || '', pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''})).filter(x => x.o), old = document.getElementById('invPop'); if(old) old.remove();
    const box = document.createElement('div'); box.id = 'invPop';
    box.innerHTML = `<div class="invc"><div class="invh"><b>Mời bạn vào phòng ${NET.id}</b><button class="x" data-invx aria-label="Đóng">✕</button></div><div class="invl">` + (L.length ? L.map(x => `<div class="frc"><span class="frav" style="--c:${PC[x.k%4]}">${x.pa ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.k)}</span><div class="frm"><b>${esc(x.n)}</b><small>Cấp ${x.lv}</small></div><button class="btn ${invited.has(NET.id + x.id) ? '' : 'primary'}" data-inv="${x.id}" ${invited.has(NET.id + x.id) ? 'disabled' : ''}>${invited.has(NET.id + x.id) ? '✓ Đã mời' : 'Mời'}</button></div>`).join('') : '<p class="say">Bạn chưa có bạn bè thật trong game. Kết bạn ở mục Bạn bè, hoặc bấm Mời bạn bè để gửi link qua Zalo, Messenger…</p>') + '</div></div>';
    box.onclick = e => { if(e.target===box || e.target.closest('[data-invx]')){ box.remove(); return; }
      const b = e.target.closest('[data-inv]'); if(!b || b.disabled) return; const f = L.find(x => x.id===b.dataset.inv); if(!f) return;
      invited.add(NET.id + b.dataset.inv); b.disabled = true; b.classList.remove('primary'); b.textContent = '✓ Đã mời'; SFX.play('pop');
      (async () => { try { const d = await FBNET.db(); await d.ref('inv/' + f.o).push({f:FBNET.uid(), n:clean(STORE.name || 'Bạn', 'Bạn').slice(0, 20), fid:window.FR_ ? window.FR_.uid() : '', av:savedPick() || 0, r:String(NET.id), pw:String(NET.pw || ''), at:firebase.database.ServerValue.TIMESTAMP}); palToast('Đã gửi lời mời tới ' + f.n); } catch(err) { palToast('Chưa gửi được lời mời'); b.disabled = false; b.textContent = 'Mời'; invited.delete(NET.id + b.dataset.inv); } })(); };
    document.body.appendChild(box); };
  $('worldRoom').onclick = () => { if(!NET || NET.role!=='host' || NET.live) return; SFX.play('click');
    try { if(window.WSEND){ const m = NET.pw ? `📢 Phòng ${NET.id} đang tìm người, mật khẩu ${NET.pw}. Vào chơi nào!` : `📢 Phòng ${NET.id} đang tìm người, vào thẳng không cần mật khẩu. Vào chơi nào!`; window.WSEND(window.TR ? window.TR(m) : m); } } catch(e) {}
    palToast('Đã rao phòng trên kênh thế giới');
    const free = () => NET.seats.map((x,k) => (!x && k>0) ? k : -1).filter(k => k>=0), used = NET.seats.filter(Boolean).map(x => x.name);
    let n = Math.min(free().length, 1 + Math.floor(Math.random()*3));
    const add = () => { if(!NET || NET.live || n<=0 || typeof botPick!=='function') return; const f = free(); if(!f.length) return;
      const nm = botPick(1, used)[0]; if(!nm) return; used.push(nm); const k = f[0];
      NET.seats[k] = {name:nm, peer:'bot-' + k + '-' + Date.now(), av:Math.floor(Math.random()*7), fu:BOTPA[nm] || '', fi:'', fit:'', bot:1}; n--; lobbyCast(); renderLobby();
      if(n>0) setTimeout(add, 1500 + Math.random()*2500); };
    setTimeout(add, 1800 + Math.random()*1500); };
  $('shareRoom').onclick = async () => { if(!NET) return; SFX.play('click');
    const u = roomLink(), text = NET.pw ? `Vào chiến hay sợ? 😏 Phòng ${NET.id}, mật khẩu ${NET.pw}` : `Vào chiến hay sợ? 😏 Phòng ${NET.id}, vào thẳng không cần mật khẩu`;
    if(navigator.share){ try { await navigator.share({title:'Lên Voi Xuống Chó', text, url:u}); } catch(e) {} } else copyLink(); };
  { const q = new URLSearchParams(location.search), rid = q.get('room'), rpw = q.get('pw');
    if(/^\d{5}$/.test(rid || '')){ try { history.replaceState(null, '', location.pathname); } catch(e) {}
      setTimeout(() => { show('friend'); $('jId').value = rid; if(rpw) $('jPw').value = rpw;
        const n = $('jName'); let v = n ? n.value.trim() : '';
        if(!v || v==='Bạn'){ v = (STORE.name && STORE.name!=='Bạn') ? STORE.name : 'Khách ' + (100 + rnd(900)); if(n) n.value = v; }
        $('joinRoom').click(); }, 400); } }   // bấm link mời là vào thẳng phòng, không cần nhập gì
  // ----- nhận lời mời vào phòng từ bạn bè: popup 15 giây, không bấm thì tự tắt
  { let ref0 = null; const T = 15;
    const pop = (k, v) => { document.querySelectorAll('.invin').forEach(e => e.remove());
      const box = document.createElement('div'); box.className = 'invin';
      const ph = window.PH_ && v.f ? window.PH_.src(v.f) : '';
      box.innerHTML = `<div class="ivc"><span class="ivav" style="--c:${PC[(+v.av||0)%4]}">${ph ? `<img class="avph" src="${ph}" alt="">` : palAV(+v.av || 0)}</span>
        <div class="ivt"><small>${v.lfg ? '🌍 Kênh Thế giới · Đấu đôi' : '🎲 Lời mời chơi'}</small><b>${esc(v.n || 'Bạn bè')}${v.tr ? ' · ' + esc(v.tr) : ''}</b><span>${v.lfg ? 'tìm đồng đội, phòng' : 'mời bạn vào phòng'} <em>${esc(v.r)}</em></span></div>
        <div class="ivb"><button type="button" class="pwfb add" data-ivok="1"><i>⚔️</i>Vào chơi</button><button type="button" class="ivno" data-ivno="1">Để sau</button></div>
        <i class="ivbar"><u style="animation-duration:${T}s"></u></i></div>`;
      document.body.appendChild(box); SFX.play('join');
      const close = () => { clearTimeout(tm); box.classList.add('out'); setTimeout(() => box.remove(), 300); };
      const tm = setTimeout(close, T*1000);
      box.onclick = e => { if(e.target.closest('[data-ivno]')){ SFX.play('click'); close(); return; }
        if(e.target.closest('[data-ivok]')){ close(); SFX.play('pop');
          const go = () => { show('friend'); $('jId').value = v.r; $('jPw').value = v.pw || ''; const n = $('jName'); if(n){ let nm = n.value.trim(); if(!nm || nm==='Bạn') n.value = (STORE.name && STORE.name!=='Bạn') ? STORE.name : 'Khách ' + (100 + rnd(900)); }
          $('joinRoom').click(); };
          if(S && !S.over && document.body.classList.contains('ingame')){
            const rk = S.mode==='rank';
            window.askQuit(() => { const t0 = Date.now(), iv = setInterval(() => { const ph = document.getElementById('pdHome'); if(ph && document.getElementById('podium')) ph.click();   // bỏ qua bảng tổng kết, về thẳng trang chính
                const out = !document.body.classList.contains('ingame');
                if(out || Date.now() - t0 > 15000){ clearInterval(iv); if(out) setTimeout(go, 500); } }, 300); },
              `${esc(v.n || 'Bạn bè')} mời bạn vào phòng <b>${esc(v.r)}</b>.<br>Nếu thoát ván giữa chừng, bạn sẽ <b>không nhận được phần thưởng</b> của ván này` + (rk ? ` và bị <b>trừ ${-RANK_PEN.quit} điểm hạng</b> vì đang đánh xếp hạng.` : '.'),
              'Thoát và vào phòng', '🎲 Lời mời chơi');
            return; }
          go(); } };
      if(!v.lfg) FBNET.db().then(d => d.ref('inv/' + FBNET.uid() + '/' + k).remove()).catch(() => {}); };
    const listen = async () => { try { const d = await FBNET.db(), u = FBNET.uid(); if(!u || ref0) return; ref0 = d.ref('inv/' + u);
        ref0.limitToLast(5).on('child_added', sn => { const v = sn.val() || {}; if(!v.r || !v.at || Date.now() - v.at > 90000){ sn.ref.remove().catch(() => {}); return; } pop(sn.key, v); });
        d.ref('lfg').limitToLast(1).on('child_added', sn => { const v = sn.val() || {}; if(!v.r || !v.at || v.f===u || Date.now() - v.at > 60000 || NET || (S && !S.over && document.body.classList.contains('ingame'))) return; pop(sn.key, Object.assign({lfg:1}, v)); }); } catch(e) {} };
    setTimeout(listen, 2500); }
  let roomLen = 'l';
  document.querySelectorAll('[data-rlen]').forEach(b => b.onclick = () => { roomLen = b.dataset.rlen; SFX.play('pop'); document.querySelectorAll('[data-rlen]').forEach(x => x.classList.toggle('on', x===b)); });
  // ----- chat trong phòng chờ: mọi người trong phòng nhắn tin với nhau trước khi vào ván
  const lcAdd = (n, t, mine) => { const L = $('lcList'); if(!L) return; const e0 = L.querySelector('.lcEmpty'); if(e0) e0.remove();
    const d = document.createElement('div'); d.className = 'lcm' + (mine ? ' me' : ''); d.innerHTML = `<b>${esc(String(n||'').slice(0,14))}</b><span>${esc(String(t||'').slice(0,80))}</span>`;
    L.appendChild(d); while(L.children.length > 60) L.firstChild.remove(); L.scrollTop = L.scrollHeight; if(!mine) SFX.play('pop'); };
  const lcWire = R => { R.on('lchat', m => { if(m.isMe || !NET) return; const d = m.data || {}; if(String(d.id)!==String(NET.id)) return; lcAdd(d.n, d.t, false); }); };
  const lcReset = () => { const L = $('lcList'); if(L) L.innerHTML = '<p class="lcEmpty">Chào cả phòng đi 👋</p>'; };
  $('lcForm').onsubmit = e => { e.preventDefault(); const i = $('lcText'), t = i.value.trim(); if(!t || !NET) return;
    const me = NET.role==='host' ? (NET.seats[0] || {}).name : (($('jName') || {}).value || 'Bạn');
    netEmit('lchat', {id:NET.id, n:me, t}); lcAdd(me, t, true); i.value = ''; };
  // mở lại game khi đang có ván với bạn dở dang (trong 3 tiếng): hỏi có muốn vào lại không
  setTimeout(() => {
    let r = null; try { r = JSON.parse(localStorage.getItem('lendoi_lastroom') || 'null'); } catch(e) {}
    if(!r || !/^\d{5}$/.test(r.id || '') || Date.now() - (r.at||0) > 3*3600*1000 || /[?&]room=/.test(location.search) || NET) return;
    openModal('🎲 Quay lại ván đang chơi?', `<p style="text-align:center;margin:4px 0">Bạn đang có ván dở ở phòng <b>${esc(r.id)}</b>.<br>Vào lại để chơi tiếp nhé!</p>`, [
      {label:'Vào lại', primary:true, fn: () => { closeModal(); show('friend'); $('jId').value = r.id; $('jPw').value = r.pw || ''; $('jName').value = r.name || STORE.name || 'Khách'; $('joinRoom').click(); }},
      {label:'Thôi', fn: () => { try { localStorage.removeItem('lendoi_lastroom'); } catch(e) {} closeModal(); }}]);
  }, 2600);
  const AUTOBOT = () => {   /* phòng không khóa: cứ 3-4 giây có một người chơi máy vào ghế trống (chủ phòng mời ra được) */
    const id0 = NET && NET.id, VI = document.documentElement.lang !== 'en', HI = ['Chào chủ phòng 👋', 'Vô rồi nè', 'Cho chơi ké với', 'Hú, đủ người chưa', 'Chơi liền đi'];
    const tick = () => { if(!NET || NET.id!==id0 || NET.role!=='host' || NET.live || NET.pw || typeof botPick!=='function') return;
      const k = NET.seats.findIndex((x,i) => i>0 && !x);
      if(k >= 0){ const nm = botPick(1, NET.seats.filter(Boolean).map(x => x.name).concat(NET.kickN || []))[0];
        if(nm){ NET.seats[k] = {name:nm, peer:'bot-' + k + '-' + Date.now(), av:Math.floor(Math.random()*7), fu:BOTPA[nm] || '', fi:'', fit:'', bot:1}; lobbyCast(); renderLobby();
          if(VI && Math.random() < .6) setTimeout(() => { if(NET && NET.id===id0 && !NET.live){ const t = HI[Math.floor(Math.random()*HI.length)]; lcAdd(nm, typeof botStyleText==='function' ? botStyleText(nm, t) : t, false); } }, 1000 + Math.random()*1500); } }
      setTimeout(tick, 3000 + Math.random()*1000); };
    setTimeout(tick, 3000 + Math.random()*1000); };
  $('lcForm').addEventListener('submit', () => { const t = ($('lcText').value || '').trim(); if(!t || !NET || NET.live || document.documentElement.lang==='en' || typeof botSmartReply!=='function') return;
    const B = (NET.role==='host' ? NET.seats : []).filter(x => x && x.bot); if(!B.length) return; const b = B[Math.floor(Math.random()*B.length)], r = botSmartReply(t, 'game');
    setTimeout(() => { if(NET && !NET.live) lcAdd(b.name, typeof botStyleText==='function' ? botStyleText(b.name, r.text) : r.text, false); }, 1500 + Math.random()*2000); }, true);
  let ROOMPW = 0;   /* 1 = phòng có mật khẩu, 0 = phòng mở (mặc định: vào một chạm như bản cũ) */
  document.querySelectorAll('[data-rpw]').forEach(b => b.onclick = () => { ROOMPW = +b.dataset.rpw; SFX.play('click');
    document.querySelectorAll('[data-rpw]').forEach(x => x.classList.toggle('on', x===b)); $('cPwL').hidden = !ROOMPW; $('cErr').textContent = ''; });
  $('createRoom').onclick = async () => {
    const name = roomName('cName', 'cErr'); if(!name) return; const pw = ROOMPW ? $('cPw').value.trim() : '';
    if(ROOMPW && pw.length<2){ $('cErr').textContent = 'Mật khẩu phòng cần ít nhất 2 ký tự.'; return; }
    $('cErr').textContent = 'Đang kết nối...';
    const room = await netConnect(); if(!room){ $('cErr').textContent = NOROOM; return; }
    const id = String(10000 + rnd(90000)); let R;
    try { R = await room.join('lendoi-' + id, 'host'); } catch(e) { $('cErr').textContent = 'Không tạo được phòng (' + ((e && e.code) || 'lỗi kết nối') + '). Hãy thử lại.'; return; }
    netLeave();
    NET = {role:'host', live:false, R, id, pw, len:roomLen, me:0, seats:[{name, peer:null, av:(window.savedPick && window.savedPick()) || 0, fu:FBNET.uid() || '', fi:(window.FR_ && window.FR_.uid()) || ''}, null, null, null], rej:{}, askSeq:0, onAns:null};
    hostWire(R); lcWire(R); lcReset(); $('cErr').textContent = ''; renderLobby(); lobbyCast();
    NET.lobbyIv = setInterval(lobbyCast, 1000); ROOMS.reg();   /* bản local: không cho máy tự vào ghế trống, chừa chỗ cho bạn bè */
    NET.hb = setInterval(() => { if(netHost() && S){ netLgSeq = -1; netSync(true); } }, 1000);
  };
  $('startRoom').onclick = () => {
    if(!NET || NET.role!=='host') return;
    if(!$('botFill').checked){   // không thêm máy: chỉ người thật, dồn chỗ ngồi lại
      const hum = NET.seats.filter(Boolean); if(hum.length<2){ $('sErr').textContent = 'Cần ít nhất 2 người, hoặc bật "Thêm máy chơi vào chỗ trống".'; return; }
      NET.seats = hum.concat([null,null,null,null]).slice(0,4); $('sErr').textContent = '';
    }
    const fill = $('botFill').checked;
    const cfg = NET.seats.map((x,k) => x ? (x.bot ? {name:x.name, bot:true} : {name:x.name, bot:false, remote:k>0, fu:x.fu||'', fi:x.fi||'', fit:x.fit||''}) : fill ? {name:'Bot ' + k, bot:true} : null).filter(Boolean);
    const used = NET.seats.filter(Boolean).map(x => x.av||0), free = [0,1,2,3,4,5,6].filter(a => !used.includes(a));
    const avs = NET.seats.map(x => x ? (x.av||0) : fill ? free.shift() : null).filter(a => a!=null);
    NET.live = true; lobbyCast(); startGame(cfg, 'friend', {avs});
  };
  $('leaveRoom').onclick = () => { try { localStorage.removeItem('lendoi_lastroom'); } catch(e) {} netLeave(); resetOnline(); };
  $('joinRoom').onclick = async () => {
    const name = roomName('jName', 'jErr'); if(!name) return; const id = $('jId').value.trim(), pw = $('jPw').value.trim();
    if(!/^\d{5}$/.test(id)){ $('jErr').textContent = 'ID phòng gồm đúng 5 chữ số.'; return; }
    $('jErr').textContent = 'Đang kết nối...';
    const room = await netConnect(); if(!room){ $('jErr').textContent = NOROOM; return; }
    let R; try { R = await room.join('lendoi-' + id, 'guest'); } catch(e) { $('jErr').textContent = 'Không vào được phòng (' + ((e && e.code) || 'lỗi kết nối') + ').'; return; }
    netLeave();
    NET = {role:'client', R, id, pw, name, me:-1, hostPeer:null, myPeer:null, seats:[], doneId:0, doneVal:null, showId:0, lastDs:null, lgSeq:0, lastSt:Date.now(), t0:Date.now()};
    clientWire(R); lcWire(R); lcReset(); $('jErr').textContent = ''; renderLobby();
    try { localStorage.setItem('lendoi_lastroom', JSON.stringify({id, pw, name, at:Date.now()})); } catch(e) {}
    const hello = () => { if(NET && NET.role==='client' && NET.me<0) netEmit('hello', {id, pw, name, av:(window.savedPick && window.savedPick()) || 0, fu:FBNET.uid() || '', fi:(window.FR_ && window.FR_.uid()) || '', ft:STORE.fit || ''}); };
    hello(); NET.helloIv = setInterval(hello, 1500);
    NET.watch = setInterval(() => {
      if(!NET || NET.role!=='client') return;
      if(!NET.hostPeer && Date.now()-NET.t0 > 9000){ netLeave(); resetOnline(); $('jErr').textContent = 'Không tìm thấy phòng này. Kiểm tra lại ID, và chủ phòng phải đang mở phòng chờ.'; return; }
      const t = document.getElementById('toast2');
      if(S && S.net && !S.over && Date.now()-NET.lastSt > 8000){ if(!t){ const e = document.createElement('div'); e.id = 'toast2'; e.textContent = 'Mất kết nối với chủ phòng, đang chờ...'; document.getElementById('stage').appendChild(e); } }
      else if(t) t.remove();
    }, 1500);
  };
  $('findBtn').onclick = () => {
    const name = clean($('wName').value, 'Bạn'), names = [name];
    $('worldForm').hidden = true; $('matchBox').hidden = false; $('mState').textContent = 'Đang tìm người chơi';
    $('mSlots').innerHTML = seats(names, 'Đang tìm');
    matchTimer = setInterval(() => {
      names.push('Đối thủ ' + names.length + ' (máy)'); $('mSlots').innerHTML = seats(names, 'Đang tìm');
      if(names.length===4){
        clearInterval(matchTimer); $('mState').textContent = 'Đã đủ 4 người, vào ván';
        matchTimer = setTimeout(() => { matchTimer = null; startGame(names.map((n,i)=>({name: i ? 'Đối thủ ' + i : n, bot: i>0})), 'world'); }, 1200);
      }
    }, 1100);
  };
  $('cancelMatch').onclick = resetOnline;
  const rankFind = teams => {
    const name = clean(STORE.name || 'Bạn', 'Bạn'), names = [name], rest = botMatchNames(PALS.matchNames(3));   // tên lấy từ hồ sơ, không phải nhập
    $('rankForm').hidden = true; $('rMatchBox').hidden = false; $('rState').textContent = (teams ? 'Đang tìm đồng đội và đối thủ' : 'Đang tìm đối thủ') + ' ±1 hạng quanh ' + tierOf(STORE.rp).t.i + ' ' + tierOf(STORE.rp).t.n;
    $('rSlots').innerHTML = seats(names, 'Đang tìm', null, [window.PH_ ? window.PH_.myU() : '']);
    matchTimer = setInterval(() => {
      { const k0 = tierOf(STORE.rp).k, k = Math.max(0, Math.min(TIERS.length-1, k0 + Math.floor(Math.random()*(2*RANK_GAP+1)) - RANK_GAP)); names.push(TIERS[k].i + ' ' + rest[names.length-1]); } $('rSlots').innerHTML = seats(names, 'Đang tìm', null, [window.PH_ ? window.PH_.myU() : '']);
      if(names.length===4){
        clearInterval(matchTimer); $('rState').textContent = 'Đã đủ 4 người, vào trận';
        matchTimer = setTimeout(() => { matchTimer = null; startGame([{name, bot:false}].concat(rest.map(n => ({name:n, bot:true}))), 'rank', {teams}); setTimeout(vsIntro, 300); }, 1200);
      }
    }, 1100);
  };
  const RKUP = window.RKUP_ = (() => {
    const K = 'lendoi_rkgot', got = () => { try { return +localStorage.getItem(K) || 0; } catch(e) { return 0; } };
    const giftTxt = g => [g.xu && g.xu + ' 🪙', g.gem && g.gem + ' 💎', g.pl && 'Bảng tên “' + PLATES[g.pl].n + '”', g.chest && 'Rương đại gia', g.av && 'Nhân vật Rồng'].filter(Boolean).join(' · ');
    const paint = () => { const k = tierOf(STORE.rp).k, L = document.getElementById('rkLadder'), P = document.getElementById('rkPts'); if(!L) return;
      const t = TIERS[k], sg = v => (v>0 ? '+' : v<0 ? '−' : '') + Math.abs(v);
      if(P) P.innerHTML = ['NHẤT','NHÌ','BA','TƯ'].map((x,j) => `<div class="p${j+1}"><span><small>${x}</small><b>${sg(t.rp[j])}</b></span></div>`).join('');
      { const rk = document.getElementById('rank'), ic = document.getElementById('tierIcon'); if(ic) ic.innerHTML = TBADGE(k, 1); const rl = rk && rk.querySelector('.rkl'); if(rl && !rl.dataset.b){ rl.dataset.b = 1; rl.innerHTML = TIERS.map((_, j) => `<i>${TBADGE(j)}</i>`).join(''); } if(rl) rl.querySelectorAll('i').forEach((e,j) => { e.classList.toggle('on', j===k); e.classList.toggle('done', j<k); }); }
      L.innerHTML = '<h3>🎁 Quà lên hạng</h3>' + TIERS.map((x,j) => { const g = TIER_GIFT[j], st = j<=k ? 'ok' : j===k+1 ? 'next' : '';
        return `<div class="rkrow ${st}" data-tier="${j}" style="--tc:${x.c}"><span class="rkic">${TBADGE(j)}</span><div><b>${x.n}</b><small>${x.min} điểm${x.safe ? '<span class="rksafe"> · không rớt hạng</span>' : ''}</small><em>${g ? giftTxt(g) : 'Hạng khởi đầu'}</em><u class="rkgs">${g ? [g.xu && '🪙', g.gem && '💎', g.pl && '🏷️', g.chest && '🧰', g.av && '🐉'].filter(Boolean).join('') : ''}</u></div><i>${j<=k ? '✓' : j===k+1 ? 'Còn ' + (x.min - STORE.rp) : '🔒'}</i></div>`; }).join('');
      if(!L.dataset.h){ L.dataset.h = 1; L.addEventListener('click', e => { const r = e.target.closest('[data-tier]'); if(!r) return; const j = +r.dataset.tier, x = TIERS[j], g = TIER_GIFT[j]; SFX.play('pop');
        openModal(x.n, `<div class="rkup" style="--tc:${x.c}"><span class="rkupi">${TBADGE(j, 1)}</span><b>${x.n}</b><p>${x.min} điểm${x.safe ? ' · không rớt hạng' : ''}</p><div class="rkupg">${g ? giftTxt(g).split(' · ').map(t => '<span>' + t + '</span>').join('') : '<span>Hạng khởi đầu</span>'}</div></div>`, [{label:'Đóng', primary:true, fn:closeModal}], 'rkupdlg'); }); } };
    const grant = g => { STORE.add(g.xu || 0); if(g.gem) STORE.addGem(g.gem); if(g.pl && !STORE.ownsPlate(g.pl)) STORE.buyPlate(g.pl); if(g.chest) Object.keys(ITEMS).forEach(i => STORE.give(i, 2)); if(g.av && !STORE.ownsAv(g.av)) STORE.buyAv(g.av); };
    const check = () => { const k = tierOf(STORE.rp).k, g0 = got(); if(k <= g0) return; if(!document.getElementById('modal').hidden) return; const scr = document.body.dataset.scr; if(scr!=='home' && scr!=='rank') return;
      const j = g0 + 1, t = TIERS[j], g = TIER_GIFT[j]; try { localStorage.setItem(K, String(j)); } catch(e) {} if(g) grant(g); SFX.play('levelup');
      openModal('🎉 Lên hạng ' + t.n + '!', `<div class="rkup lux" style="--tc:${t.c}"><div class="rkuplux"><i class="rkr1"></i><i class="rkr2"></i>${[0,1,2,3,4].map(q => `<em class="rkst" style="--j:${q}">★</em>`).join('')}${Array.from({length:10}, (_, q) => `<u class="rksp" style="--a:${q*36}deg;--d:${(q*.2).toFixed(1)}s"></u>`).join('')}<span class="rkupi">${TBADGE(j, 1)}</span></div><b>Hạng ${t.n}</b><p>Phần thưởng đã vào túi:</p><div class="rkupg">${g ? giftTxt(g).split(' · ').map(x => '<span>' + x + '</span>').join('') : ''}</div>${g && g.pl ? '<small>Vào Hồ sơ để đeo bảng tên mới</small>' : ''}</div>`,
        [{label:'Tuyệt vời!', primary:true, fn:() => { closeModal(); paintCoins(); setTimeout(check, 400); }}], 'rkupdlg'); };
    { const hero = document.querySelector('#rank .rkhero'); if(hero) hero.addEventListener('click', e => { if(e.target.closest('.back')) return; paint(); const L = document.getElementById('rkLadder'); if(!L) return; SFX.play('pop');
        openModal('🎁 Quà lên hạng', `<div class="rkladder rkpop">${L.innerHTML.replace(/<h3>[^]*?<\/h3>/, '')}</div>`, [{label:'Đóng', primary:true, fn:closeModal}], 'one sys rkpopdlg'); }); }
    let topAt = 0, topScr = false; const top = async force => { if(!force && Date.now() - topAt < 15000) return; topAt = Date.now(); const el = document.getElementById('rkTopL'); if(!el) return; if(window.FR_) await window.FR_.touch();
      try { const d = await FBNET.db(), sn = await d.ref('users').orderByChild('rp').limitToLast(8).once('value'), L = [], seenO = {}, mineO = FBNET.uid(), myK = window.FR_ ? window.FR_.uid() : ''; sn.forEach(ch => { const x = ch.val() || {}; if(!(+x.rp > 0) && ch.key!==myK) return; if(x.o && x.o===mineO && ch.key!==myK) return; if(x.o && seenO[x.o]) return; if(x.o) seenO[x.o] = 1;   /* v148: bỏ mã cũ trùng tài khoản */ L.push({id:ch.key, n:String(x.n || 'Người chơi'), rp:+x.rp || 0, av:+x.av || 0, ft:(typeof x.ft==='string' ? x.ft.slice(0,60) : ''), pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''}); });
        L.sort((a,b) => b.rp - a.rp); L.splice(3);
        const myId = window.FR_ ? window.FR_.uid() : '', myRp = STORE.rp || 0; let pos = 0;
        try { const up = await d.ref('users').orderByChild('rp').startAt(myRp + 1).once('value'), sO = {}; up.forEach(ch => { const x = ch.val() || {}; if(ch.key===myId || (x.o && x.o===mineO)) return; if(x.o){ if(sO[x.o]) return; sO[x.o] = 1; } pos++; }); } catch(e) {}
        pos += 1; const inTop = L.some(x => x.id===myId);
        const myRow = () => { const t = tierOf(myRp), ph = window.PH_ ? window.PH_.src(window.PH_.myU()) : ''; return `${pos > 4 ? '<div class="rkgapdot">⋮</div>' : ''}<div class="rktp me"><em>#${pos}</em><span class="rktav" style="--c:${PC[(savedPick()||0)%4]}">${ph ? `<img class="avph" src="${ph}" alt="">` : palAV(savedPick()||0)}</span><b>Bạn</b><span class="rktb">${TBADGE(t.k)}</span><small>${myRp}</small></div>`; };
        el.innerHTML = L.length ? L.map((x,j) => { const t = tierOf(x.rp); return `<div class="rktp rkn${j+1}${x.id===myId ? ' me' : ''}" data-uprof="${x.id}"><em>${j+1}</em><span class="rktav" style="--c:${PC[x.av%4]}">${x.pa ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.av, x.ft)}</span><b>${esc(x.n)}</b><span class="rktb">${TBADGE(t.k)}</span><small>${x.rp}</small></div>`; }).join('') + (inTop ? '' : myRow()) : '<p class="say">Chưa có ai, bạn vào top đầu tiên nhé!</p>';
      } catch(e) { el.innerHTML = '<p class="say">Chưa tải được.</p>'; } };
    { const tb = document.getElementById('rkTop'); if(tb) tb.addEventListener('click', e => { const r = e.target.closest('[data-uprof]'); if(r && window.PH_){ SFX.play('pop'); window.PH_.view(r.dataset.uprof); } }); }
    setInterval(() => { const on = document.body.dataset.scr==='rank'; if(on) top(!topScr); topScr = on; }, 1000);
    setTimeout(() => { if(window.FR_) window.FR_.touch(); }, 6000);   // mỗi lần mở game: đưa hồ sơ + điểm hạng lên máy chủ
    setInterval(check, 1500);
    return {paint, check};
  })();
  { const setupPh = () => { const d = document.querySelector('#slots .slot .dot'); if(!d || !window.PH_) return; const u = window.PH_.src(window.PH_.myU()); if(u) d.innerHTML = `<img class="avph" src="${u}" alt="">`; };
    addEventListener('ph-loaded', () => { setupPh(); if(NET && !(S && S.net) && !$('roomBox').hidden) renderLobby(); if(S && document.body.classList.contains('ingame')) render(); });
    document.addEventListener('click', e => { if(e.target.closest('[data-go="setup"]')) setTimeout(setupPh, 50); }, true); setTimeout(setupPh, 3000); }
  { const sm = document.querySelector('#rank .rkmore summary'); if(sm) sm.addEventListener('click', e => { e.preventDefault(); SFX.play('pop');
      const IC = ['⏱️','📈','🚫','🏆','🎲','🎯','🎒','🏅','🛡️','⚖️','⚔️','🕶️','💀','🤝'];
      const L = [...document.querySelectorAll('#rank .rkrules li')].map((li,j) => `<div class="rkr"><i>${IC[j] || '✦'}</i><span>${li.innerHTML}</span></div>`).join('');
      openModal('📜 Luật Xếp hạng', `<div class="rkrg">${L}</div>`, [{label:'Đã hiểu', primary:true, fn:closeModal}], 'one sys rkrdlg'); }); }
  // ----- bạn bè đang online: chấm xanh ở viền trái mọi màn, báo nhỏ khi có bạn vừa vào
  { const ON = {}, subs = {}; let me = '', box = null;
    const paint = () => { if(!box){ box = document.createElement('button'); box.type = 'button'; box.id = 'frOn'; box.hidden = true; document.body.appendChild(box);
        box.onclick = () => { SFX.play('pop'); const b = document.querySelector('[data-go="pals"]'); if(b && document.body.dataset.scr!=='game') b.click(); else palToast('Đang online: ' + Object.keys(ON).map(id => (window.FR_.info(id).n || id)).join(', ')); }; }
      const ids = Object.keys(ON); box.hidden = !ids.length; paintChat(ids); if(!ids.length) return;
      box.innerHTML = ids.slice(0, 3).map(id => { const x = window.FR_ ? window.FR_.info(id) : {}; const pa = typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''; return `<span class="fon">${pa ? `<img src="${pa}" alt="">` : palAV(+x.av || 0)}</span>`; }).join('') + `<b>${ids.length}</b><i>online</i>`; };
    // v148: trong ván, bạn bè online chỉ nằm trong khung chat, màn hình ván chơi không hiện gì thêm
    const paintChat = ids => { const co = document.getElementById('chatOn'); if(!co) return;
      co.hidden = !ids.length;
      if(!ids.length){ co.innerHTML = ''; return; }
      co.innerHTML = `<div class="conh"><i></i>Bạn bè online <b>${ids.length}</b></div><div class="conl">` + ids.map(id => { const x = window.FR_ ? window.FR_.info(id) : {}; const pa = typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : '';
        return `<button type="button" class="conp" data-id="${esc(id)}"><span class="fon">${pa ? `<img src="${pa}" alt="">` : palAV(+x.av || 0)}</span><span>${esc(x.n || 'Bạn bè')}</span></button>`; }).join('') + '</div>';
      co.querySelectorAll('.conp').forEach(b => b.onclick = () => { SFX.play('pop'); const t = document.querySelector('#cTabs [data-ct="dm"]'); if(t) t.click(); }); };
    const toast = id => { if(document.body.dataset.scr==='game') return; const x = window.FR_ ? window.FR_.info(id) : {}; const e = document.createElement('div'); e.className = 'fonT'; e.innerHTML = `<i></i><b>${esc(x.n || 'Bạn bè')}</b> vừa online`; document.body.appendChild(e); setTimeout(() => e.classList.add('out'), 3200); setTimeout(() => e.remove(), 3700); };
    const tick = async () => { try { if(!window.FR_ || !FBNET.ok()) return; const d = await FBNET.db(), u = window.FR_.uid(); if(!u) return;
        if(me!==u){ me = u; const r = d.ref('online/' + u); r.onDisconnect().remove(); r.set(firebase.database.ServerValue.TIMESTAMP).catch(() => {}); }
        window.FR_.friends().forEach(([id]) => { if(subs[id]) return; let first = true; subs[id] = d.ref('online/' + id); subs[id].on('value', sn => { const was = !!ON[id]; if(sn.exists()) ON[id] = 1; else delete ON[id]; if(!first && !was && ON[id]) toast(id); first = false; paint(); }); });
      } catch(e) {} };
    setTimeout(tick, 3000); setInterval(tick, 15000); }
  // ----- Tặng quà cho bạn bè: chọn bạn, chọn món, trả xu/kim cương, quà gửi vào Hộp thư của bạn ấy
  const GIFT = window.GIFT_ = (() => {
    let pre = null;
    const price = (t, k) => t==='item' && ITEMS[k] ? ITEMS[k].p : t==='fit' && FITS[k] ? FITS[k].p : t==='plate' && PLATES[k] && !PLATES[k].gem ? PLATES[k].p : t==='av' && PREM[k] ? PREM[k].p : 0;
    const name = (t, k) => t==='item' ? ITEMS[k].i + ' ' + ITEMS[k].n : t==='fit' ? '👒 ' + FITS[k].n : t==='plate' ? '🏷️ Bảng tên ' + PLATES[k].n : '🐾 Nhân vật ' + PREM[k].n;
    const gobj = (t, k) => t==='item' ? {it:{[k]:1}} : t==='fit' ? {fit:k} : t==='plate' ? {plate:k} : {av:+k};
    const friends = () => (window.FR_ ? window.FR_.friends() : []).map(([id, x]) => ({id, n:x.n || 'Bạn', av:+x.av || 0, lv:x.lv || 1, o:x.o || '', pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''})).filter(x => x.o);
    const ask = (t, k) => { const P = price(t, k); if(!P) return; const F = friends(); SFX.play('pop');
      if(!F.length){ openModal('🎁 Tặng quà', '<div class="gfnone"><i>💝</i><b>Chưa có bạn bè để tặng</b><small>Kết bạn ở mục Bạn bè rồi quay lại tặng quà nhé.</small></div>', [{label:'Đóng', primary:true, fn:closeModal}]); return; }
      let to = pre && F.some(f => f.id===pre) ? pre : F[0].id;
      const body = () => `<div class="gfd"><div class="gfit"><b>${esc(name(t, k))}</b><u>${fmtN(P)} 🪙</u></div><small class="gfl">Tặng cho:</small>
        <div class="gff">${F.map(x => `<button type="button" class="gfp ${x.id===to ? 'on' : ''}" data-gto="${x.id}"><span class="gfa">${x.pa ? `<img src="${x.pa}" alt="">` : palAV(x.av)}</span><b>${esc(x.n)}</b></button>`).join('')}</div>
        <input id="gfMsg" maxlength="60" placeholder="Lời nhắn gửi kèm (không bắt buộc)…" autocomplete="off">${STORE.coins < P ? '<p class="gfw">Bạn chưa đủ xu để tặng món này.</p>' : ''}</div>`;
      openModal('🎁 Tặng quà', body(), [{label:'💝 Tặng · ' + fmtN(P) + ' 🪙', primary:true, disabled:STORE.coins < P, fn:() => send(t, k, to)}, {label:'Thôi', fn:closeModal}], 'one gfdlg');
      document.getElementById('mBody').onclick = e => { const g = e.target.closest('[data-gto]'); if(!g) return; to = g.dataset.gto; SFX.play('click'); document.querySelectorAll('#mBody .gfp').forEach(b => b.classList.toggle('on', b.dataset.gto===to)); }; };
    const send = async (t, k, to) => { const P = price(t, k), f = friends().find(x => x.id===to); if(!f || STORE.coins < P) return;
      const msg = String((document.getElementById('gfMsg') || {}).value || '').trim().slice(0, 60), me = clean(STORE.name || 'Bạn', 'Bạn');
      closeModal(); STORE.add(-P); paintCoins();
      try { const d = await FBNET.db(); await d.ref('mail/' + f.o).push({t:'💝 Quà từ ' + me, b:(msg ? '“' + msg + '”' : me + ' tặng bạn một món quà!') + '\n— ' + me, g:gobj(t, k), gift:true, from:me, to:f.id, ff:window.FR_.uid(), at:firebase.database.ServerValue.TIMESTAMP});
        SFX.play('coinbig'); palToast('💝 Đã tặng ' + name(t, k) + ' cho ' + f.n); pre = null;
      } catch(e) { STORE.add(P); paintCoins(); palToast('Chưa gửi được quà, đã hoàn lại xu'); } };
    const openTo = id => { pre = id; closeModal(); const b = document.querySelector('[data-go="shop"]'); if(b) b.click(); setTimeout(() => palToast('Chọn món rồi bấm 🎁 Tặng nhé'), 300); };
    return {price, ask, openTo};
  })();
  const RKD = window.RKD_ = (() => {
    const box = () => $('rkDuo');
    const card = (x, me, empty) => { if(!x) return `<div class="rdcard empty"><i>＋</i><b>${empty}</b></div>`;
      const ph = x.fu && window.PH_ ? window.PH_.src(x.fu) : ''; const keep = AVMAP; AVMAP = null; const av = AV(+x.av || 0, ''); AVMAP = keep;
      return `<div class="rdcard ${me ? 'me' : 'on'}"><span class="rdav">${ph ? `<img class="avph" src="${ph}" alt="">` : av}</span><b>${esc(x.name)}</b>${me ? '<u>Bạn</u>' : ''}</div>`; };
    const sent = new Set();
    const friends = () => (window.FR_ ? window.FR_.friends() : []).map(([id, x]) => ({id, n:x.n || 'Bạn', k:+x.av || 0, lv:x.lv || 1, o:x.o || '', pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''})).filter(x => x.o);
    const paint = () => { const b = box(); if(!b || !NET || !NET.rank) return; const host = NET.role==='host';
      const seats = host ? NET.seats : (NET.seats || []).map(x => x ? {name:x.n, av:x.a, fu:x.f} : null);
      $('rdId').textContent = NET.id; $('rdMine').innerHTML = card(seats[0], NET.me===0, '') + card(seats[2], NET.me===2, host ? 'Mời đồng đội' : 'Đồng đội');
      $('rdStart').hidden = !host; b.classList.toggle('guest', !host);
      const L = friends(); $('rdCnt').textContent = L.length ? L.length + ' người' : '';
      $('rdFr').innerHTML = !host ? '<p class="rdno">Chủ phòng đang mời thêm người…</p>' : L.length ? L.map(x => `<div class="rdf"><span class="rdav">${x.pa ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.k)}</span><span class="rdfn"><b>${esc(x.n)}</b><small>Cấp ${x.lv}</small></span><button type="button" class="rdfi ${sent.has(NET.id + x.id) ? 'ok' : ''}" data-rdf="${x.id}" ${sent.has(NET.id + x.id) || seats[2] ? 'disabled' : ''}>${sent.has(NET.id + x.id) ? '✓' : 'Mời'}</button></div>`).join('') : '<p class="rdno">Chưa có bạn bè trong game. Rao kênh Thế giới hoặc gửi link cho bạn nhé.</p>';
      $('rdNote').textContent = host ? (seats[2] ? 'Đội đã đủ người, bấm SẴN SÀNG để vào trận!' : 'Mời 1 đồng đội. Không có thì máy vào cùng đội với bạn.') : 'Chờ chủ phòng bấm Sẵn sàng…'; };
    document.addEventListener('click', e => { const b = e.target.closest('[data-rdf]'); if(!b || b.disabled || !NET || !NET.rank) return; const f = friends().find(x => x.id===b.dataset.rdf); if(!f) return;
      sent.add(NET.id + f.id); b.disabled = true; b.textContent = '✓'; b.classList.add('ok'); SFX.play('pop');
      FBNET.db().then(d => d.ref('inv/' + f.o).push({f:FBNET.uid(), n:clean(STORE.name || 'Bạn', 'Bạn').slice(0, 20), fid:window.FR_ ? window.FR_.uid() : '', av:savedPick() || 0, tr:tierOf(STORE.rp).t.n, r:String(NET.id), pw:String(NET.pw || ''), at:firebase.database.ServerValue.TIMESTAMP})).then(() => palToast('Đã mời ' + f.n)).catch(() => { palToast('Chưa gửi được lời mời'); sent.delete(NET.id + f.id); paint(); }); });
    const open = () => { $('rankForm').hidden = true; box().hidden = false; document.getElementById('rank').classList.add('rdon'); paint(); };
    const close = () => { box().hidden = true; $('rankForm').hidden = false; document.getElementById('rank').classList.remove('rdon'); };
    const create = async () => { SFX.play('click'); open(); $('rdId').textContent = '…'; $('rdNote').textContent = 'Đang tạo phòng…';
      const room = await netConnect(); if(!room){ $('rdNote').textContent = NOROOM; return; }
      const id = String(10000 + rnd(90000)), pw = String(1000 + rnd(9000)); let R0;
      try { R0 = await room.join('lendoi-' + id, 'host'); } catch(e) { $('rdNote').textContent = 'Không tạo được phòng, thử lại nhé.'; return; }
      netLeave(); const name = clean(STORE.name || 'Bạn', 'Bạn');
      NET = {role:'host', live:false, rank:true, R:R0, id, pw, len:'l', me:0, seats:[{name, peer:null, av:savedPick() || 0, fu:FBNET.uid() || '', fi:(window.FR_ && window.FR_.uid()) || ''}, null, null, null], rej:{}, askSeq:0, onAns:null};
      hostWire(R0); lcWire(R0); lcReset(); lobbyCast(); NET.lobbyIv = setInterval(lobbyCast, 1000);
      NET.hb = setInterval(() => { if(netHost() && S){ netLgSeq = -1; netSync(true); } }, 1000); paint(); };
    const start = () => { if(!NET || NET.role!=='host' || !NET.rank) return; SFX.play('pop');
      const k0 = tierOf(STORE.rp).k, nm = PALS.matchNames(3), tn = () => TIERS[Math.max(0, Math.min(TIERS.length-1, k0 + Math.floor(Math.random()*3) - 1))].i + ' ';
      const sx = NET.seats, cfg = [{name:sx[0].name, bot:false, fu:sx[0].fu||'', fi:sx[0].fi||''}, {name:tn() + nm[0], bot:true}, sx[2] ? {name:sx[2].name, bot:false, remote:true, fu:sx[2].fu||'', fi:sx[2].fi||'', fit:sx[2].fit||''} : {name:tn() + nm[1], bot:true}, {name:tn() + nm[2], bot:true}];
      const used = [sx[0].av||0].concat(sx[2] ? [sx[2].av||0] : []), free = [0,1,2,3,4,5,6].filter(a => !used.includes(a));
      const avs = [sx[0].av||0, free.shift(), sx[2] ? (sx[2].av||0) : free.shift(), free.shift()];
      NET.live = true; lobbyCast(); close(); rankLive(true); startGame(cfg, 'rank', {teams:true, avs}); setTimeout(vsIntro, 300); };
    const leave = () => { SFX.play('click'); netLeave(); close(); };
    const client = () => { if(!NET || !NET.rank || (S && S.net)) return; if(document.body.dataset.scr!=='rank') show('rank'); open(); };
    $('rdStart').onclick = start; $('rdCancel').onclick = leave;
    $('rdShare').onclick = () => $('shareRoom').click();
    $('rdWorld').onclick = async () => { if(!NET) return; const b = $('rdWorld'); b.disabled = true; setTimeout(() => { b.disabled = false; }, 30000);
      try { const d = await FBNET.db(); await d.ref('lfg').push({f:FBNET.uid(), n:clean(STORE.name || 'Bạn', 'Bạn').slice(0, 20), av:savedPick() || 0, tr:tierOf(STORE.rp).t.n, r:String(NET.id), pw:String(NET.pw), at:firebase.database.ServerValue.TIMESTAMP}); palToast('📣 Đã rao trên kênh Thế giới'); } catch(e) { palToast('Chưa rao được, thử lại nhé'); b.disabled = false; } };
    return {paint, client, close, create};
  })();
  const rkdCreate = () => RKD.create();
  $('rFindBtn').onclick = () => rankFind(false);
  $('rFind2').onclick = () => { if(!FBNET.ok()) return rankFind(true); rkdCreate(); };
  $('rCancel').onclick = resetOnline;
  const sheet = (id, on) => { document.getElementById('sheetC').hidden = !on; if(on){ renderChat(); chatSeen(); } };
  document.getElementById('modal').addEventListener('click', e => { if(e.target.id==='modal' && profOpen()) closeModal(); });
  document.getElementById('players').addEventListener('click', e => { const c = e.target.closest('.pc[data-p]'); if(c) openAssets(+c.dataset.p); });
  document.getElementById('chatBtn').onclick = () => sheet('sheetC', document.getElementById('sheetC').hidden);

  // Kéo khung chat bằng tay (màn ngang). Tính ngược phép xoay của màn để kéo đúng hướng.
  { const sh = document.getElementById('sheetC'), stg = document.getElementById('stage'); let d = null, pos = {x:0, y:0};
    try { const v = JSON.parse(localStorage.getItem('lendoi_chatpos') || 'null'); if(v && isFinite(v.x) && isFinite(v.y)) pos = v; } catch(e) {}
    const clamp = () => { const h = sh.offsetParent; if(!h || !sh.offsetWidth) return;
      pos.x = Math.max(-sh.offsetLeft, Math.min(h.clientWidth - sh.offsetWidth - sh.offsetLeft - 6, pos.x));
      pos.y = Math.max(18 - sh.offsetTop, Math.min(h.clientHeight - sh.offsetHeight - sh.offsetTop - 6, pos.y));
      sh.style.setProperty('--dx', pos.x.toFixed(0)+'px'); sh.style.setProperty('--dy', pos.y.toFixed(0)+'px'); };
    const inv = () => { let m = new DOMMatrix(); for(let e = sh.parentElement; e && e.nodeType===1; e = e.parentElement){ const t = getComputedStyle(e).transform; if(t && t!=='none') m = new DOMMatrix(t).multiply(m); } m.e = 0; m.f = 0; return m.inverse(); };
    sh.addEventListener('pointerdown', e => {
      if(stg.classList.contains('tall') || sh.classList.contains('typing') || sh.classList.contains('kb')) return;
      if(e.target!==sh && !e.target.closest('#chatTitle')) return;
      d = {x:e.clientX, y:e.clientY, px:pos.x, py:pos.y, m:inv()}; sh.classList.add('drag'); try { sh.setPointerCapture(e.pointerId); } catch(err) {} e.preventDefault(); });
    sh.addEventListener('pointermove', e => { if(!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y;
      pos.x = d.px + d.m.a*dx + d.m.c*dy; pos.y = d.py + d.m.b*dx + d.m.d*dy; clamp(); });
    const end = () => { if(!d) return; d = null; sh.classList.remove('drag'); try { localStorage.setItem('lendoi_chatpos', JSON.stringify(pos)); } catch(err) {} };
    sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
    document.getElementById('chatBtn').addEventListener('click', () => requestAnimationFrame(clamp)); window.addEventListener('resize', clamp); }
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => sheet(b.dataset.close, false));
  let rz = null; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if(S && !document.getElementById('game').hidden){ fit(); render(); } }, 80); });
  document.getElementById('mX').onclick = closeModal;
  // ----- trang ngoài: nhân vật, xu, cửa hàng
  document.querySelectorAll('[data-av]').forEach(e => { e.innerHTML = AV(+e.dataset.av); });
  const paintCoins = () => { if(window.FR_){ clearTimeout(window.__frT); window.__frT = setTimeout(() => window.FR_.touch(), 3000); }
    document.querySelectorAll('.coinv').forEach(e => { e.textContent = STORE.coins; });
    document.querySelectorAll('.gemv').forEach(e => { e.textContent = STORE.gems; });
    { const pa = document.getElementById('homeProfName'); if(pa){
        document.getElementById('homeProfName').textContent = 'Hồ sơ';
        let tw = null; try { tw = TITLE.worn(); } catch(e) {}
        document.getElementById('homeProfSub').textContent = 'Cấp ' + lvOf(STORE.exp).L + (tw ? ' · ' + tw.n : ''); }
      const nm = document.getElementById('homeProfNm'); if(nm){ nm.textContent = STORE.name || 'Bạn';
        const pc = document.querySelector('#homeProf .pchar'), k = savedPick() || 0, sig = k + '|' + STORE.fit; if(pc && pc._sig!==sig){ pc._sig = sig; delete pc.dataset.av; pc.classList.add('full'); pc.innerHTML = AV.full(k, STORE.fit); }
        const pf = document.getElementById('homeProf'); if(pf && pf.classList.contains('lhero')){ const bg = AV.bg(k); pf.classList.add('scn'); pf.style.setProperty('--sa', bg[0]); pf.style.setProperty('--sb', bg[1]);
          let sc = pf.querySelector('.hscene'); if(!sc){ sc = document.createElement('span'); sc.className = 'hscene'; pf.insertBefore(sc, pf.firstChild); } if(sc._k!==k){ sc._k = k; sc.innerHTML = AV.scene(k); } } } }
    { const cb = document.getElementById('contBtn'), sv = loadSave(); if(cb){ cb.hidden = !sv; if(sv) cb.textContent = '▶ Chơi tiếp'; } }
    const lv = lvOf(STORE.exp), tr = tierOf(STORE.rp);
    document.querySelectorAll('.lvv').forEach(e => { e.textContent = lv.L; });
    document.querySelectorAll('.lvbar').forEach(e => { e.style.width = Math.round(lv.cur/lv.need*100) + '%'; });
    document.querySelectorAll('.lvt').forEach(e => { e.textContent = `${lv.cur}/${lv.need}`; });
    document.querySelectorAll('.tierv').forEach(e => { e.textContent = tr.t.n; });
    const set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
    { const w = WEEKLY[weeklyId()]; set('wkName', w.n); set('wkDesc', w.d); }
    set('tierIcon', tr.t.i); set('tierName', 'Hạng ' + tr.t.n); set('tierPts', tr.next ? STORE.rp + ' / ' + tr.next.min : STORE.rp + ' điểm');
    set('tierNext', tr.next ? `Còn ${tr.next.min - STORE.rp} điểm ➜ ${tr.next.n}` : 'Hạng cao nhất');
    const tb = document.getElementById('tierBar'); if(tb){ tb.style.width = (tr.next ? Math.round((STORE.rp - tr.t.min)/(tr.next.min - tr.t.min)*100) : 100) + '%'; tb.style.background = tr.t.c; }
    const ti = document.getElementById('tierIcon'); if(ti) ti.style.background = tr.t.c;
    { const rk = document.getElementById('rank'); if(rk){ rk.style.setProperty('--tc', tr.t.c); rk.querySelectorAll('.rkl i').forEach((e,k) => { e.classList.toggle('on', k===tr.k); e.classList.toggle('done', k<tr.k); }); if(window.RKUP_) window.RKUP_.paint(); } }
  };
  window.paintMeta = paintCoins;
  document.querySelectorAll('[data-cup]').forEach(e => { e.innerHTML = TROPHY; });
  // ----- Hàng xoay vòng: chọn ngẫu nhiên theo đợt, cùng một đợt thì ai mở cũng thấy như nhau
  const SHOP_H = 5*36e5, SHOP_HN = 4, SHOP_WN = 5, SHOP_HLIM = 2, LOA_P = 15, LOA_P5 = 60, SHOP_OFF = .8;
  const shopCat = () => Object.keys(ITEMS).map(k => ({t:'item', k, n:ITEMS[k].n, d:ITEMS[k].d, p:ITEMS[k].p}))
    .concat(Object.keys(FITS).map(k => ({t:'fit', k, n:(FITS[k].xmas ? '🎄 ' : '') + FITS[k].n, d:FITS[k].xmas ? 'Đồ Noel · mặc vào Hồ sơ có tuyết rơi, đèn nháy' : FITS[k].fly ? '🧹 Mặc vào ván: bay lượn qua các ô' : 'Trang phục cho nhân vật', p:FITS[k].p})))
    .concat(Object.keys(PLATES).filter(k => !PLATES[k].gem).map(k => ({t:'plate', k, n:PLATES[k].n, d:'Bảng tên', p:PLATES[k].p})))
    .concat(Object.keys(PREM).map(k => ({t:'av', k, n:PREM[k].n, d:PREM[k].d, p:PREM[k].p})));
  const shopOwned = x => x.t==='fit' ? STORE.ownsFit(x.k) : x.t==='plate' ? STORE.ownsPlate(x.k) : x.t==='av' ? STORE.ownsAv(+x.k) : false;
  const shopSeed = seed => { let a = seed>>>0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; };
  const shopSlot = sec => { const now = Date.now() + 7*36e5; if(sec==='h'){ const k = Math.floor(now/SHOP_H); return {slot:k, end:(k+1)*SHOP_H - 7*36e5}; } const day = Math.floor(now/864e5), k = Math.floor((day+3)/7); return {slot:k, end:(k*7 - 3 + 7)*864e5 - 7*36e5}; };
  const shopRot = sec => { const sl = shopSlot(sec), r = shopSeed(sl.slot*(sec==='h' ? 7919 : 104729) + (sec==='h' ? 17 : 91)), n = sec==='h' ? SHOP_HN : SHOP_WN;
    const L = shopCat().map(x => [r(), x]).sort((a,b) => a[0]-b[0]).map(x => x[1]);
    const out = L.filter(x => x.t==='item').slice(0, 2); L.forEach(x => { if(out.length < n && !out.includes(x)) out.push(x); });   // luôn có ít nhất 2 vật phẩm, còn lại là bất kỳ món nào
    return {slot:sl.slot, end:sl.end, limit: sec==='h' ? SHOP_HLIM : 0, list: L.filter(x => out.includes(x)).map(x => Object.assign({}, x, {op:x.p, p:Math.max(5, Math.round(x.p*SHOP_OFF/5)*5)}))}; };   // hàng Nổi bật giảm 20%
  let shopSeen = '';
  const shopClock = () => { const h = shopSlot('h'), w = shopSlot('w'), f = ms => { const t = Math.max(0, Math.floor(ms/1000)), d = Math.floor(t/86400), hh = Math.floor(t%86400/3600), mm = Math.floor(t%3600/60), ss = t%60; return d ? `${d} ngày ${hh} giờ` : `${hh}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; };
    const a = document.getElementById('hrLeft'), b = document.getElementById('wkLeft'); if(a) a.textContent = 'Đổi sau ' + f(h.end - Date.now()); if(b) b.textContent = 'Đổi sau ' + f(w.end - Date.now());
    const key = h.slot + '|' + w.slot; if(shopSeen && shopSeen!==key){ shopSeen = key; renderShop(); } shopSeen = key; };
  setInterval(() => { if(document.body.dataset.scr==='shop') shopClock(); }, 1000);
  // ===== Nhiệm vụ mốc: xem video và chia sẻ, đạt mốc thì nhận xu và kim cương (mỗi mốc nhận một lần) =====
  const MS = window.MS_ = (() => {
    const K = 'lendoi_ms', ld = () => { try { return Object.assign({v:0, s:0, got:{}}, JSON.parse(localStorage.getItem(K) || '{}')); } catch(e) { return {v:0, s:0, got:{}}; } };
    const sv = d => { try { localStorage.setItem(K, JSON.stringify(d)); } catch(e) {} try { window.__stSaved && window.__stSaved(); } catch(e) {} };
    const STEPS = {v:[[5,50,3],[15,150,10],[30,300,20],[60,600,40],[100,1000,80]], s:[[1,50,0],[3,120,5],[10,400,20],[25,1000,50]]};
    const NAME = {v:'🎬 Xem video', s:'📤 Chia sẻ game'};
    const paint = () => { const box = document.getElementById('msBox'); if(!box) return; const d = ld();
      box.innerHTML = '<div class="tag">🎯 Nhiệm vụ nhận quà</div>' + ['s'].map(t => `<div class="msgrp"><b class="msh">${NAME[t]} <small>(${d[t]} lần)</small></b>${STEPS[t].map(([n, xu, gem]) => { const id = t + n, got = d.got[id], ok = d[t] >= n;
        return `<div class="msrow ${got ? 'got' : ok ? 'ok' : ''}"><span class="msn">${n} lần</span><span class="msbar"><i style="width:${Math.min(100, d[t]/n*100).toFixed(0)}%"></i></span><span class="msr">🪙 ${xu}${gem ? ' · 💎 ' + gem : ''}</span>${!ok && !got ? `<button type="button" class="btn msdo" data-msdo="${t}">${t==='v' ? '▶ Xem video' : '📤 Chia sẻ'}</button>` : `<button type="button" class="btn ${ok && !got ? 'primary' : ''}" data-msget="${id}" ${ok && !got ? '' : 'disabled'}>${got ? '✓ Đã nhận' : 'Nhận'}</button>`}</div>`; }).join('')}</div>`).join(''); };
    document.addEventListener('click', e => { const dz = e.target.closest && e.target.closest('[data-msdo]'); if(dz){ if(dz.dataset.msdo==='v'){ const a = document.getElementById('adBtn'); if(a) a.click(); } else if(window.SHARE_) window.SHARE_.invite(); return; }
      const b = e.target.closest && e.target.closest('[data-msget]'); if(!b || b.disabled) return; const id = b.dataset.msget, t = id[0], n = +id.slice(1), st = STEPS[t].find(x => x[0]===n), d = ld();
      if(!st || d.got[id] || d[t] < n) return; d.got[id] = 1; sv(d); STORE.add(st[1]); if(st[2]) STORE.addGem(st[2]); SFX.play('coinbig'); palToast(`🎉 Nhận ${st[1]} xu${st[2] ? ' và ' + st[2] + ' kim cương' : ''}!`); paintCoins(); paint(); if(window.paintQDot) window.paintQDot(); if(document.querySelector('.dlg.qmini')) window.openQuests(); });
    const qrows = () => { const d = ld(); return ['s'].map(t => { const st = STEPS[t].find(x => !d.got[t + x[0]]); if(!st) return ''; const [n, xu, gem] = st, ok = d[t] >= n, id = t + n;
      return `<div class="q2"><div class="q2t"><b><span>${t==='v' ? '🎬 Xem ' + n + ' video quảng cáo' : '📤 Chia sẻ game ' + n + ' lần'}</span><em>${Math.min(d[t], n)}/${n}</em></b><span class="qbar"><i style="width:${Math.min(100, Math.round(d[t]/n*100))}%"></i></span></div>`
        + (ok ? `<button class="btn primary" data-msget="${id}">+${xu} 🪙${gem ? ' +' + gem + '💎' : ''}</button>` : `<button class="btn msdo" data-msdo="${t}">${t==='v' ? '▶ Xem' : '📤 Chia sẻ'}</button>`) + '</div>'; }).join(''); };
    const ready = () => { const d = ld(); return ['s'].some(t => { const st = STEPS[t].find(x => !d.got[t + x[0]]); return st && d[t] >= st[0]; }); };
    return { qrows, ready, n: t => ld()[t] || 0, add(t){ const d = ld(); d[t] = (d[t]||0) + 1; sv(d); paint(); const nx = STEPS[t].find(x => !d.got[t + x[0]] && d[t] >= x[0]); if(nx) palToast(`🎯 Đạt mốc ${nx[0]} lần, vào Nhiệm vụ nhận thưởng!`); if(window.paintQDot) window.paintQDot(); if(document.querySelector('.dlg.qmini')) window.openQuests(); }, paint };
  })();
  const renderShop = () => {
    paintCoins(); MS.paint();
    const pack = STORE.pack;
    { const pk = document.getElementById('packBar'); if(pk) pk.innerHTML = `<b>🎒 Túi mang vào ván <em>${pack.length}/${PACK_MAX}</em></b><div class="pkslots">${Array.from({length:PACK_MAX}, (_,n) => pack[n] ? `<button class="pks on" data-pack="${pack[n]}" aria-label="Bỏ ${ITEMS[pack[n]].n} khỏi túi"><span>${ITEMS[pack[n]].i}</span><i>${STORE.has(pack[n])}</i></button>` : '<span class="pks"></span>').join('')}</div>`; }
    document.getElementById('shopGrid').innerHTML = Object.keys(ITEMS).map(k => { const it = ITEMS[k], inp = pack.includes(k);
      return `<div class="icard inv ${inp?'inpack':''}"><span class="iico">${it.i}</span><b>${it.n}</b><span class="iown">Có ${STORE.has(k)}</span><button class="btn pkbtn2 ${inp?'on':''}" data-pack="${k}" ${!inp && pack.length>=PACK_MAX ? 'disabled' : ''}>${inp ? '✓ Trong túi' : pack.length>=PACK_MAX ? 'Túi đầy' : '+ Bỏ vào túi'}</button></div>`; }).join('');
    { const lb = document.getElementById('loaBox'); if(lb) lb.innerHTML = `<div class="icard loac"><span class="iico">📣</span><div class="loat"><b>Loa thế giới</b><small>Mỗi loa nói được 1 câu trên kênh Thế giới. Tin của bạn chạy trên thanh thông báo ở trang chính.</small><span class="iown">Đang có ${STORE.loa}</span></div><div class="loab"><button class="btn primary" data-loa="1" ${STORE.coins>=LOA_P ? '' : 'disabled'}>Mua 1 · ${LOA_P} 🪙</button><button class="btn primary" data-loa="5" ${STORE.coins>=LOA_P5 ? '' : 'disabled'}>Mua 5 · ${LOA_P5} 🪙</button></div></div>`; }
    // hàng theo giờ (5 tiếng đổi 1 lần, 4 món, mỗi món mua 2 lần) và hàng tuần (5 món)
    ['h','w'].forEach(sec => { const R = shopRot(sec), keep = AVMAP;
      document.getElementById(sec==='h' ? 'hrGrid' : 'wkGrid').innerHTML = R.list.map((x,n) => { const own = shopOwned(x), cnt = STORE.shopCount(sec, R.slot, x.t + ':' + x.k), left = R.limit ? R.limit - cnt : 99, out = !own && left<=0;
        let pic; if(x.t==='item') pic = `<span class="iico">${ITEMS[x.k].i}</span>`; else if(x.t==='fit'){ AVMAP = keep; pic = `<span class="fprev">${AV(0, x.k)}</span>`; } else if(x.t==='av'){ AVMAP = null; pic = `<span class="fprev">${AV(+x.k, '')}</span>`; AVMAP = keep; } else pic = `<span class="plprev pc plate-${x.k}"><span class="nmx">${esc(STORE.name || 'Tên bạn')}</span></span>`;
        return `<div class="icard rcard ${own || out ? 'sold' : ''}" data-pv="${x.t}:${x.k}"><span class="rtype t-${x.t}">${{item:'Vật phẩm', fit:'Trang phục', plate:'Bảng tên', av:'Nhân vật'}[x.t]}</span>${pic}<b>${x.n}</b><small>${x.d}</small>${x.t==='item' && R.limit ? `<span class="iown">Còn ${Math.max(0,left)} lượt mua</span>` : x.t==='item' ? `<span class="iown">Đang có ${STORE.has(x.k)}</span>` : ''}<div class="shprice"><i>🪙</i>${x.op ? `<s>${x.op}</s>` : ''}<b>${x.p}</b></div>${x.op ? '<span class="shsale">-20%</span>' : ''}<button class="btn primary" data-rb="${sec}:${n}" ${own || out || STORE.coins < x.p ? 'disabled' : ''}>${own ? 'Đã có' : out ? 'Hết lượt' : 'Mua'}</button></div>`; }).join('');
      AVMAP = keep; });
    { const gg = document.getElementById('gemGrid'); if(gg) gg.innerHTML = GEMSHOP.map(x => { const own = x.t==='plate' && STORE.ownsPlate(x.id);
        const pic = x.t==='plate' ? `<span class="plprev pc plate-${x.id}"><span class="nmx">${esc(STORE.name || 'Tên bạn')}</span></span>` : `<span class="iico">${x.i}</span>`;
        return `<div class="icard rcard gcard ${own ? 'sold' : ''}" data-pv="${x.t==='plate' ? 'plate:' + x.id : 'emo:' + x.i}"><span class="rtype t-gem">Kim cương</span>${pic}<b>${x.n}</b><small>${x.d}</small><div class="shprice"><i>💎</i><b>${x.p}</b></div><button class="btn primary" data-gem="${x.id}" ${own || STORE.gems < x.p ? 'disabled' : ''}>${own ? 'Đã có' : 'Mua'}</button></div>`; }).join(''); }
    shopClock();
    document.getElementById('fitGrid').innerHTML = Object.keys(FITS).map(k => { const ft = FITS[k], own = STORE.ownsFit(k), on = STORE.wearing(k);
      const btn = !own ? `<button class="btn primary" data-fit="${k}" ${STORE.coins>=ft.p?'':'disabled'}>Mua ${ft.p} 🪙</button>` : on ? `<button class="btn" data-fit="${k}">Cởi ra</button>` : `<button class="btn primary" data-fit="${k}">Mặc</button>`;
      return `<div class="icard fcard ${on?'on':''}"><span class="fprev">${AV(0, k)}</span><b>${ft.n}</b>${on ? '<span class="iown">Đang mặc</span>' : own ? '<span class="iown" style="background:#FFFDF6">Đã có</span>' : ''}${btn}</div>`; }).join('');

    { const keep = AVMAP; AVMAP = null;
      document.getElementById('avGrid').innerHTML = Object.keys(PREM).map(k => { const a = PREM[k], own = STORE.ownsAv(+k);
        return `<div class="icard fcard"><span class="fprev">${AV(+k, '')}</span><b>${a.n}</b><small>${a.d}</small>${own ? '<span class="iown">Đã có</span>' : `<button class="btn primary" data-avbuy="${k}" ${STORE.coins>=a.p?'':'disabled'}>Mua ${a.p} 🪙</button>`}</div>`; }).join('');
      AVMAP = keep; }
    document.getElementById('plGrid').innerHTML = Object.keys(PLATES).filter(k => !PLATES[k].gem).map(k => { const pl = PLATES[k], own = STORE.ownsPlate(k), on = STORE.plate===k;
      const btn = !own ? `<button class="btn primary" data-plate="${k}" ${STORE.coins>=pl.p?'':'disabled'}>Mua ${pl.p} 🪙</button>` : on ? `<button class="btn" data-plate="${k}">Gỡ</button>` : `<button class="btn primary" data-plate="${k}">Dùng</button>`;
      return `<div class="icard fcard ${on?'on':''}"><span class="plprev pc plate-${k}"><span class="nmx">${esc(STORE.name || 'Tên bạn')}</span></span><b>${pl.n}</b>${btn}</div>`; }).join('');
    document.querySelectorAll('[data-av]').forEach(e => { e.innerHTML = AV(+e.dataset.av, +e.dataset.av===0 ? STORE.fit : ''); });
    if(window.shopCats) window.shopCats();
    if(window.shopPrev) window.shopPrev();
  };

  document.getElementById('avGrid').addEventListener('click', e => { const b = e.target.closest('[data-avbuy]'); if(!b || b.disabled) return; const k = +b.dataset.avbuy;
    if(STORE.coins < PREM[k].p) return; STORE.add(-PREM[k].p); STORE.buyAv(k); try { localStorage.setItem('lendoi_av', k); } catch(err) {} SFX.play('buy'); renderShop(); });
  document.getElementById('plGrid').addEventListener('click', e => { const b = e.target.closest('[data-plate]'); if(!b || b.disabled) return; const k = b.dataset.plate;
    if(!STORE.ownsPlate(k)){ if(STORE.coins < PLATES[k].p) return; STORE.add(-PLATES[k].p); STORE.buyPlate(k); STORE.setPlate(k); SFX.play('buy'); }
    else { STORE.setPlate(STORE.plate===k ? '' : k); SFX.play('pop'); }
    renderShop(); });
  // ----- ảnh cá nhân: 1 ảnh đại diện + tối đa 4 ảnh, lưu trên máy chủ theo tài khoản Google
  const PH = window.PH_ = (() => {
    const cache = {}, busy = {}; let mine = null;
    const G = () => !!(window.AUTH_ && window.AUTH_.user());
    const myU = () => { try { return FBNET.uid() || ''; } catch(e) { return ''; } };
    // Theo dõi trực tiếp photos/<u>/on và photos/<u>/a: đổi ảnh ở hồ sơ (kể cả trên máy khác) là ván chơi cập nhật ngay.
    // Không tải cả nhánh photos/<u> (có thêm 4 ảnh lớn). Lỗi mạng thì thử lại sau 15 giây thay vì nhớ "không có ảnh" mãi.
    const live = {}, failAt = {};
    const emit = u => dispatchEvent(new CustomEvent('ph-loaded', {detail:u}));
    const setC = (u, v) => { const old = cache[u]; cache[u] = v; if(old !== v) emit(u); };
    const load = async u => { if(!u || busy[u] || live[u] || (failAt[u] && Date.now() - failAt[u] < 15000)) return; busy[u] = 1;
      try { const d = await FBNET.db(), st = {on:null, a:null}, upd = () => { if(st.on===null || st.a===null) return; setC(u, st.on && st.a ? st.a : '');
            if(u===myU() && mine){ mine.on = !!st.on; mine.a = st.a || null; } };
        const r1 = d.ref('photos/' + u + '/on'), r2 = d.ref('photos/' + u + '/a');
        const h1 = sn => { st.on = !!sn.val(); upd(); }, h2 = sn => { st.a = sn.val() || ''; upd(); };
        const er = () => { delete live[u]; failAt[u] = Date.now(); };
        r1.on('value', h1, er); r2.on('value', h2, er); live[u] = () => { r1.off('value', h1); r2.off('value', h2); }; delete failAt[u];
      } catch(e) { failAt[u] = Date.now(); if(cache[u]===undefined) cache[u] = ''; } busy[u] = 0; };
    const src = u => { if(!u) return ''; if(!live[u]) load(u); return cache[u] || ''; };
    const shrink = (file, max, sq, q) => new Promise((ok, no) => { const r = new FileReader(); r.onerror = no;
      r.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => { let sx = 0, sy = 0, sw = im.width, sh = im.height;
          if(sq){ const m = Math.min(sw, sh); sx = (sw - m)/2; sy = (sh - m)/2; sw = sh = m; }
          const k = Math.min(1, max/Math.max(sw, sh)), c = document.createElement('canvas'); c.width = Math.round(sw*k); c.height = Math.round(sh*k);
          const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'; cx.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q)); }; im.src = r.result; };
      r.readAsDataURL(file); });
    const ref = async () => (await FBNET.db()).ref('photos/' + myU());
    const mineGet = async () => { if(mine) return mine; try { mine = (await (await ref()).once('value')).val() || {}; } catch(e) { mine = {}; } mine.p = Object.assign({}, mine.p || {}); return mine; };
    const syncUser = async () => { try { const id = window.FR_ && window.FR_.uid(), d = await FBNET.db(); if(!id) return;
      await d.ref('users/' + id + '/pa').set(mine.on && mine.a ? mine.sm || null : null); } catch(e) {} };
    /* nén tới khi vừa giới hạn máy chủ: giảm chất lượng dần, cần thì giảm cỡ */
    const fit = async (file, max, sq, lim) => { for(const [m, q] of [[max, .9], [max, .8], [max, .7], [Math.round(max*.8), .75], [Math.round(max*.6), .7]]){ const u = await shrink(file, m, sq, q); if(u.length < lim) return u; } throw new Error('big'); };
    const up = async (slot, file) => { if(!G() || !file) return false; await mineGet(); const r = await ref();
      if(slot==='a'){ const a = await fit(file, 512, true, 380000), sm = await fit(file, 112, true, 28000); await r.update({a, sm, on:true}); mine.a = a; mine.sm = sm; mine.on = true; if(!file.__acc){ lsSet('lendoi_avsrc', 'up'); lsSet('lendoi_phup', JSON.stringify({a, sm})); } }
      else { const u = await fit(file, 1080, false, 760000); await r.child('p/' + slot).set(u); mine.p = mine.p || {}; mine.p[slot] = u; }
      setC(myU(), mine.on && mine.a ? mine.a : ''); await syncUser(); return true; };
    const del = async slot => { await mineGet(); if(slot==='a'){ mine.a = null; mine.sm = null; mine.on = false; } else if(mine.p) delete mine.p[slot];
      const r = await ref(); if(slot==='a') await r.update({a:null, sm:null, on:false}); else await r.child('p/' + slot).remove(); setC(myU(), mine.on && mine.a ? mine.a : ''); await syncUser(); };
    const toggle = async () => { await mineGet(); mine.on = !mine.on; await (await ref()).child('on').set(mine.on); setC(myU(), mine.on && mine.a ? mine.a : ''); await syncUser(); };
    const big = u => openModal('🖼️ Ảnh', `<img class="phbig" src="${u}" alt="">`, [{label:'Đóng', primary:true, fn:closeModal}], 'one sys');
    /* xem hồ sơ người khác theo mã 8 số */
    const view = async id => { openModal('Hồ sơ người chơi', '<div class="pvw"><p class="say">Đang tải…</p></div>', [], 'one sys pvwdlg');
      let x = {}, ph = {}; try { const d = await FBNET.db(); x = (await d.ref('users/' + id).once('value')).val() || {}; if(x.o) ph = (await d.ref('photos/' + x.o).once('value')).val() || {}; } catch(e) {}
      const mb = document.getElementById('mBody'); if(!mb || document.getElementById('modal').hidden) return;
      const rp = +x.rp || 0, tr = tierOf(rp), lv = +x.lv || 1, av = +x.av || 0, pics = Object.values(ph.p || {}).filter(Boolean).slice(0, 4);
      const isFr = !!(window.FR_ && window.FR_.friends().some(f => f[0]===id)), isMe = !!(window.FR_ && window.FR_.uid()===id);
      const face = ph.on && ph.a ? `<img src="${ph.a}" alt="">` : `<span class="pwani">${palAV(av, (typeof x.ft==='string' ? x.ft.slice(0,60) : ''))}</span>`;
      const prog = tr.next ? Math.round((rp - tr.t.min)/(tr.next.min - tr.t.min)*100) : 100;
      mb.innerHTML = `<div class="pvw" style="--tc:${tr.t.c}">
        <div class="pwL"><div class="pwav">${face}<span class="pwlv">${lv}</span></div>
          <b class="pwn">${esc(x.n || 'Người chơi')}</b>${x.t ? `<span class="pwt">🎖️ ${esc(String(x.t).slice(0, 30))}</span>` : ''}
          <span class="pwtag">#${esc(id)}</span>${isMe ? '<span class="pwfb me">Đây là bạn</span>' : `<button type="button" class="pwfb" data-pwf="${id}"></button>`}
          ${!isMe && isFr ? `<button type="button" class="pwgift" data-pwgift="${id}">💝 Tặng quà</button>` : ''}
          <div class="pwlk"><button type="button" data-lk="1" ${isMe || !x.o ? 'disabled' : ''}><i>❤️</i><b>0</b></button><button type="button" data-lk="-1" ${isMe || !x.o ? 'disabled' : ''}><i>👎</i><b>0</b></button></div></div>
        <div class="pwR"><div class="pwstat">
            <div class="pwtier"><span class="pwbd">${TBADGE(tr.k, 1)}</span><div><small>Hạng</small><b>${tr.t.n}</b><i><u style="width:${prog}%"></u></i><em>${rp} điểm${tr.next ? ' · còn ' + (tr.next.min - rp) + ' lên ' + tr.next.n : ''}</em></div></div>
            <div class="pwlvl"><small>Cấp</small><b>${lv}</b><i><u style="width:${Math.max(0, Math.min(100, +x.p || 0))}%"></u></i></div></div>
          <div class="pwph"><small>📷 Ảnh · ${pics.length}/4</small><div class="pwgrid">${[0,1,2,3].map(k => pics[k] ? `<button type="button" class="pwp" data-phbig="1"><img src="${pics[k]}" alt=""></button>` : '<span class="pwp none">📷</span>').join('')}</div></div></div>
        <button type="button" class="pwx" data-pwx="1" aria-label="Đóng">✕</button></div>`;
      const fb = mb.querySelector('[data-pwf]'), fset = () => { if(!fb) return; const st = window.FR_ && window.FR_.st ? window.FR_.st(id) : '';
        fb.className = 'pwfb ' + (st || 'add'); fb.disabled = st==='fr' || st==='sent'; fb.innerHTML = st==='fr' ? '<i>✓</i>Bạn bè' : st==='sent' ? '<i>⏳</i>Đã gửi lời mời' : st==='in' ? '<i>🤝</i>Đồng ý kết bạn' : '<i>＋</i>Kết bạn'; };
      fset();
      let votes = {}; const me = myU(), lset = () => { const v = Object.values(votes); mb.querySelectorAll('[data-lk]').forEach(b => { const k = +b.dataset.lk; b.querySelector('b').textContent = v.filter(z => z===k).length; b.classList.toggle('on', votes[me]===k); }); };
      if(x.o){ try { const d = await FBNET.db(); votes = (await d.ref('likes/' + x.o).once('value')).val() || {}; } catch(e) {} lset(); }
      mb.onclick = async e => { if(e.target.closest('[data-pwx]')){ closeModal(); return; }
        const gb = e.target.closest('[data-pwgift]'); if(gb && window.GIFT_){ window.GIFT_.openTo(gb.dataset.pwgift); return; }
        const lk = e.target.closest('[data-lk]'); if(lk && !lk.disabled && x.o){ const k = +lk.dataset.lk, nv = votes[me]===k ? null : k; SFX.play(k>0 ? 'pop' : 'click'); if(nv==null) delete votes[me]; else votes[me] = nv; lset();
          if(nv===1){ lk.classList.add('pop'); setTimeout(() => lk.classList.remove('pop'), 500); }
          try { const d = await FBNET.db(); await d.ref('likes/' + x.o + '/' + me).set(nv); } catch(err) {} return; }
        const f = e.target.closest('[data-pwf]'); if(f && !f.disabled && window.FR_){ f.disabled = true; SFX.play('pop'); try { if(window.FR_.st(id)==='in') await window.FR_.accept(id); else await window.FR_.request(id); } catch(err) {} setTimeout(fset, 400); return; } const b = e.target.closest('[data-phbig]'); if(b) big(b.querySelector('img').src); }; };
    /* khung Cá nhân trong Hồ sơ */
    const pane = () => { if(!G()) return `<div class="pvacc3"><b>📷 Ảnh cá nhân</b><small>Bản local chưa có máy chủ nên chưa đăng ảnh được.</small></div>`;
      if(!mine){ mineGet().then(() => { if(window.__pvTab==='me' && !document.getElementById('modal').hidden) window.openProfile(); }); return '<p class="say">Đang tải ảnh…</p>'; }
      const m = mine, p = m.p || {};
      return `<div class="phme"><div class="phav"><span class="phva">${m.a ? `<img src="${m.a}" alt="">` : AV(savedPick() || 0, '')}</span><div><b>Ảnh đại diện</b><small>Thay con vật ở bảng xếp hạng và trong ván</small>
          <span class="phbt"><button type="button" class="btn primary" data-phup="a">${m.a ? 'Đổi ảnh' : '⬆️ Tải ảnh'}</button>${m.a ? `<button type="button" class="btn" data-phon="1">${m.on ? '✅ Đang dùng' : 'Dùng ảnh này'}</button><button type="button" class="btn" data-phdel="a">Xóa</button>` : ''}</span></div></div>
        <div class="phtag">📷 Ảnh của tôi · ${Object.values(p).filter(Boolean).length}/4</div>
        <div class="phgrid">${[0,1,2,3].map(k => p[k] ? `<div class="phs"><img src="${p[k]}" alt="" data-phbig="1"><button type="button" class="phx" data-phdel="${k}" aria-label="Xóa ảnh">✕</button></div>` : `<button type="button" class="phs add" data-phup="${k}">＋<small>Thêm ảnh</small></button>`).join('')}</div>
        <p class="pvnote">Ai xem hồ sơ của bạn cũng thấy các ảnh này. Đừng đăng ảnh nhạy cảm hay thông tin riêng tư.</p></div>`; };
    /* chọn file rồi tải lên */
    const pick = slot => { if(!G()){ palToast('Bản local chưa đăng ảnh được'); return; } const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(f);
      f.onchange = async () => { const file = f.files && f.files[0]; f.remove(); if(!file) return; palToast('Đang tải ảnh lên…');
        try { await up(slot, file); palToast('✅ Đã lưu ảnh'); } catch(e) { console.error('upload', e); palToast(e && e.message==='big' ? 'Ảnh quá nặng, thử ảnh khác nhé' : /decode|load|Image/i.test(String(e && (e.type || e.message) || '')) || (e && e.type==='error') ? 'Không đọc được ảnh này, thử ảnh JPG/PNG khác nhé' : 'Chưa lưu được ảnh, kiểm tra mạng rồi thử lại nhé'); } if(document.querySelector('.dlg.profv')) window.openProfile(); }; f.click(); };
    const face = () => { if(!G()) return ''; if(!mine){ mineGet().then(() => { if(mine && mine.a && document.querySelector('.dlg.profv')) window.openProfile(); }); return ''; } return mine.on ? (mine.a || '') : ''; };
    const gal = () => { if(!G()) return `<div class="pgnone"><i>📷</i><b>Chưa đăng ảnh được</b><small>Bản local chưa có máy chủ để lưu ảnh.</small></div>`;
      if(!mine){ mineGet().then(() => { if(window.__pvTab==='me' && !document.getElementById('modal').hidden) window.openProfile(); }); return '<p class="say">Đang tải ảnh…</p>'; }
      const p = mine.p || {};
      return `<div class="pgrid">${[0,1,2,3].map(k => p[k] ? `<div class="pgs"><img src="${p[k]}" alt="" data-phbig="1"><button type="button" class="phx" data-phdel="${k}" aria-label="Xóa ảnh">✕</button></div>` : `<button type="button" class="pgs add" data-phup="${k}"><i>＋</i><small>Thêm ảnh</small></button>`).join('')}</div>`; };
    /* v140: chọn ảnh đại diện dùng trong game: 🐯 Nhân vật, 🖼️ Ảnh đã tải lên, hoặc ảnh của tài khoản Google/Facebook đã kết nối */
    function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e) {} }
    function lsGet(k){ try { return localStorage.getItem(k) || ''; } catch(e) { return ''; } }
    const acc = () => { const u = window.AUTH_ && window.AUTH_.user(); if(!u) return null;
      const pd = (u.providerData || []).filter(x => x && x.photoURL), fb = pd.find(x => x.providerId==='facebook.com'), gg = pd.find(x => x.providerId==='google.com');
      const it = fb || gg || (u.photoURL ? {providerId:'google.com', photoURL:u.photoURL} : null); if(!it) return null;
      let url = it.photoURL; if(/googleusercontent\.com/.test(url)) url = url.replace(/=s\d+(-c)?$/, '=s400-c'); else if(/graph\.facebook\.com/.test(url)) url += (url.includes('?') ? '&' : '?') + 'width=400&height=400';
      return {url, fb:it.providerId==='facebook.com', n:it.providerId==='facebook.com' ? 'Facebook' : 'Google'}; };
    const backup = () => { try { return JSON.parse(lsGet('lendoi_phup') || 'null'); } catch(e) { return null; } };
    const srcNow = () => !mine || !mine.on || !mine.a ? 'av' : (lsGet('lendoi_avsrc')==='acc' ? 'acc' : 'up');
    const grab = url => new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
      im.onload = () => { try { const c = document.createElement('canvas'), m = Math.min(im.width, im.height); c.width = c.height = Math.min(512, m); c.getContext('2d').drawImage(im, (im.width-m)/2, (im.height-m)/2, m, m, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : no(new Error('blob')), 'image/jpeg', .9); } catch(e) { no(e); } };
      im.onerror = no; im.src = url; });
    const setSrc = async k => { if(!G()) return; await mineGet(); const r = await ref();
      if(k==='av'){ if(mine.on){ mine.on = false; await r.child('on').set(false); } }
      else if(k==='up'){ const bk = backup(); if(bk && bk.a && mine.a!==bk.a){ await r.update({a:bk.a, sm:bk.sm || null, on:true}); mine.a = bk.a; mine.sm = bk.sm; }
        else if(!mine.a){ pick('a'); return; } mine.on = true; await r.child('on').set(true); lsSet('lendoi_avsrc', 'up'); }
      else if(k==='acc'){ const A = acc(); if(!A){ palToast('Tài khoản chưa có ảnh đại diện'); return; }
        if(mine.a && srcNow()!=='acc' && !backup()) lsSet('lendoi_phup', JSON.stringify({a:mine.a, sm:mine.sm || null}));   // giữ ảnh đã tải lên để đổi lại được
        palToast('Đang lấy ảnh ' + A.n + '…');
        try { const bl = await grab(A.url); bl.__acc = 1; await up('a', bl); lsSet('lendoi_avsrc', 'acc'); palToast('✅ Đang dùng ảnh ' + A.n); }
        catch(e){ palToast('Chưa lấy được ảnh ' + A.n + ', thử lại hoặc tải ảnh lên nhé'); return; } }
      setC(myU(), mine.on && mine.a ? mine.a : ''); await syncUser(); };
    const srcRow = () => { if(!G()) return ''; if(!mine){ mineGet().then(() => { if(document.querySelector('.dlg.profv')) window.openProfile(); }); return ''; }
      const A = acc(), cur = srcNow(), hasUp = !!(backup() || (mine.a && lsGet('lendoi_avsrc')!=='acc'));
      const chip = (k, ic, n) => `<button type="button" class="avsc ${cur===k ? 'on' : ''}" data-avsrc="${k}" aria-pressed="${cur===k}">${ic}<span>${n}</span></button>`;
      return `<div class="avsrc" role="group" aria-label="Ảnh đại diện trong game">${chip('av', '🐯', 'Nhân vật')}${A ? chip('acc', A.fb ? '<i class="avfb">f</i>' : '<i class="avgg">G</i>', 'Ảnh ' + A.n) : ''}${hasUp ? chip('up', '🖼️', 'Ảnh tải lên') : ''}</div>`; };
    return {src, load, myU, view, pane, pick, del, toggle, big, face, gal, G, up, setSrc, srcRow};
  })();
  // ----- Hộp thư: thư riêng (quà từ mã) + thông báo cập nhật chung. Mã quà: codes/<MÃ>, mỗi tài khoản dùng 1 lần
  const MAIL = window.MAIL_ = (() => {
    let mails = {}, news = {}, on = false; const NK = 'lendoi_newsrd';
    const nrd = () => { try { return JSON.parse(localStorage.getItem(NK) || '{}') || {}; } catch(e) { return {}; } };
    const uid = () => { try { return FBNET.uid(); } catch(e) { return ''; } };
    const unread = () => Object.values(mails).filter(m => !m.rd || (m.g && !m.got)).length + Object.keys(news).filter(k => !nrd()[k]).length;
    const dot = () => { const n = unread(), e = document.querySelector('#homeMail .mdot'); if(e){ e.hidden = !n; e.textContent = n > 9 ? '9+' : n; } };
    const start = async () => { if(on) return; try { const d = await FBNET.db(), u = uid(); if(!u) return; on = true;
      d.ref('mail/' + u).limitToLast(30).on('value', sn => { mails = sn.val() || {}; dot(); if(isOpen()) paint(); });
      d.ref('news').limitToLast(15).on('value', sn => { news = sn.val() || {}; dot(); if(isOpen()) paint(); }); } catch(e) { on = false; } };
    const isOpen = () => !document.getElementById('modal').hidden && !!document.querySelector('#mBody .mbx');
    const when = t => { if(!t) return ''; const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth()+1)} ${z(d.getHours())}:${z(d.getMinutes())}`; };
    const gtxt = g => [g.xu && g.xu + ' 🪙', g.gem && g.gem + ' 💎', g.it && Object.keys(g.it).map(k => ITEMS[k] ? ITEMS[k].i + ' ' + ITEMS[k].n + ' ×' + g.it[k] : '').join(', '), g.fit && FITS[g.fit] && '👒 ' + FITS[g.fit].n, g.plate && PLATES[g.plate] && '🏷️ Bảng tên ' + PLATES[g.plate].n].filter(Boolean).join(' · ');
    const gchips = g => [g.xu && `<em>🪙<b>${g.xu}</b></em>`, g.gem && `<em>💎<b>${g.gem}</b></em>`, g.it && Object.keys(g.it).map(k => ITEMS[k] ? `<em>${ITEMS[k].i}<b>${esc(ITEMS[k].n)} ×${g.it[k]}</b></em>` : '').join(''), g.fit && FITS[g.fit] && `<em>👒<b>${esc(FITS[g.fit].n)}</b></em>`, g.plate && PLATES[g.plate] && `<em>🏷️<b>${esc(PLATES[g.plate].n)}</b></em>`, g.av && PREM[g.av] && `<em>🐾<b>${esc(PREM[g.av].n)}</b></em>`].filter(Boolean).join('');
    const list = () => Object.entries(mails).map(([k, m]) => Object.assign({k, kind:'m'}, m)).concat(Object.entries(news).map(([k, m]) => Object.assign({k, kind:'n', rd:!!nrd()[k]}, m))).sort((a,b) => (b.at||0) - (a.at||0));
    let sel = null;
    const paint = () => { const mb = document.getElementById('mBody'); if(!mb) return; const L = list(); if(!sel || !L.some(x => x.kind + x.k===sel)) sel = L[0] ? L[0].kind + L[0].k : null;
      const cur = L.find(x => x.kind + x.k===sel);
      mb.innerHTML = `<div class="mbx"><div class="mbl"><b class="mbh">✉️ Hộp thư</b>${L.length ? L.map(x => `<button type="button" class="mbi ${x.kind + x.k===sel ? 'on' : ''} ${x.rd && !(x.g && !x.got) ? '' : 'new'}" data-mbs="${x.kind + x.k}"><i>${x.kind==='n' ? '📢' : x.g ? (x.got ? '📭' : '🎁') : '✉️'}</i><span><b>${esc(x.t || 'Thư')}</b><small>${when(x.at)}</small></span></button>`).join('') : '<p class="mbnone">Chưa có thư nào</p>'}</div>
        <div class="mbr">${cur ? `<div class="mbt"><i>${cur.kind==='n' ? '📢' : '🎁'}</i><div><b>${esc(cur.t || 'Thư')}</b><small>${cur.kind==='n' ? 'Thông báo từ Lên Voi Xuống Chó' : 'Hệ thống'} · ${when(cur.at)}</small></div></div><div class="mbb">${esc(cur.b || '').replace(/\n/g, '<br>')}</div>
          ${cur.g ? `<div class="mbg"><span>Quà kèm theo</span><div>${gchips(cur.g)}</div>${cur.got ? '<button type="button" class="pwfb fr" disabled>✓ Đã nhận</button>' : `<button type="button" class="pwfb add" data-mbget="${cur.k}"><i>🎁</i>Nhận quà</button>`}</div>` : ''}`
          : '<div class="mbempty"><i>📭</i><b>Hộp thư trống</b><small>Nhập mã quà ở Hồ sơ › Tài khoản, quà sẽ gửi về đây.</small></div>'}</div>
        <button type="button" class="pwx" data-pwx="1" aria-label="Đóng">✕</button></div>`;
      if(cur) markRead(cur); };
    const markRead = async x => { if(x.kind==='n'){ const r = nrd(); if(!r[x.k]){ r[x.k] = 1; try { localStorage.setItem(NK, JSON.stringify(r)); } catch(e) {} dot(); } return; }
      if(!x.rd){ try { const d = await FBNET.db(); await d.ref('mail/' + uid() + '/' + x.k + '/rd').set(true); } catch(e) {} } };
    const claim = async k => { const m = mails[k]; if(!m || !m.g || m.got) return; try { const d = await FBNET.db(); await d.ref('mail/' + uid() + '/' + k).update({got:true, rd:true}); } catch(e) { palToast('Chưa nhận được, thử lại nhé'); return; }
      if(m.g.xu) STORE.add(+m.g.xu || 0); if(m.g.gem) STORE.addGem(+m.g.gem || 0);
      if(m.g.it) Object.keys(m.g.it).forEach(k => { if(ITEMS[k]) STORE.give(k, Math.max(0, Math.min(10, +m.g.it[k] || 0))); });
      if(m.g.fit && FITS[m.g.fit]) STORE.buyFit(m.g.fit); if(m.g.av && PREM[m.g.av]) STORE.buyAv(+m.g.av); if(m.g.plate && PLATES[m.g.plate] && !PLATES[m.g.plate].rk) STORE.buyPlate(m.g.plate); SFX.play('coinbig'); palToast('🎉 Nhận ' + gtxt(m.g)); paintCoins(); };
    const open = () => { start(); sel = null; openModal('Hộp thư', '<div class="mbx"><p class="say">Đang tải…</p></div>', [], 'one sys mbdlg'); paint();
      const mb = document.getElementById('mBody'); mb.onclick = e => { const b = e.target.closest('button'); if(!b) return;
        if(b.dataset.pwx){ closeModal(); return; } if(b.dataset.mbs){ sel = b.dataset.mbs; SFX.play('click'); paint(); return; } if(b.dataset.mbget){ b.disabled = true; claim(b.dataset.mbget); } }; };
    const redeem = async raw => { const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20), out = document.getElementById('gcMsg'), say = (t, ok) => { if(out){ out.textContent = t; out.className = 'gcmsg ' + (ok ? 'ok' : 'bad'); } };
      if(c.length < 4){ say('Mã quà chưa đúng'); return; } say('Đang kiểm tra…', true);
      try { const d = await FBNET.db(), u = uid(), v = (await d.ref('codes/' + c).once('value')).val();
        if(!v){ say('Mã không tồn tại'); return; } if(v.exp && Date.now() > v.exp){ say('Mã đã hết hạn'); return; }
        if((await d.ref('redeem/' + c + '/' + u).once('value')).exists()){ say('Bạn đã dùng mã này rồi'); return; }
        await d.ref('redeem/' + c + '/' + u).set(firebase.database.ServerValue.TIMESTAMP);
        await d.ref('mail/' + u).push({t:'🎁 Quà từ mã ' + c, b:String(v.msg || 'Cảm ơn bạn đã chơi Lên Voi Xuống Chó! Quà của bạn đây.').slice(0, 500), g:{xu:+v.xu || 0, gem:+v.gem || 0}, at:firebase.database.ServerValue.TIMESTAMP, code:c});
        SFX.play('coinbig'); say('✓ Thành công! Quà đã gửi vào Hộp thư ✉️', true); start(); const i = document.getElementById('gcIn'); if(i) i.value = '';
      } catch(e) { say('Mã không dùng được lúc này'); } };
    const codeBox = () => `<div class="gcbox"><b>🎟️ Nhập mã quà tặng</b><div class="gcrow"><input id="gcIn" maxlength="20" placeholder="Nhập mã…" autocomplete="off" autocapitalize="characters"><button type="button" class="pwfb add" data-gcgo="1">Nhận</button></div><small id="gcMsg" class="gcmsg">Quà sẽ được gửi vào Hộp thư ✉️ ngoài màn chính</small></div>`;
    document.getElementById('homeMail').onclick = () => { SFX.play('pop'); open(); };
    { const mv = () => { const w = document.querySelector('#home .walpill'), m = document.getElementById('homeMail'); if(!w || !m) return;
        let wr = w.parentElement.classList.contains('walwrap') ? w.parentElement : null;
        if(!wr){ wr = document.createElement('div'); wr.className = 'walwrap'; w.parentElement.insertBefore(wr, w); wr.appendChild(w); }
        if(m.parentElement!==wr) wr.insertBefore(m, w); };
      mv(); setTimeout(mv, 800); setTimeout(mv, 3000); }   /* nút thư và ví tiền chung một khung, luôn đứng sát nhau */
    setTimeout(start, 2500);
    return {open, redeem, codeBox, start, gtxt};
  })();
  // ----- Tin nhắn riêng giữa bạn bè thật: dm/<mã nhỏ>/<mã lớn>/<tin>
  const RDM = window.RDM_ = (() => {
    const M = {}, subs = {}, RK = 'lendoi_dmrd', t0 = Date.now(); let me = '', open = null;
    const rd = () => { try { return JSON.parse(localStorage.getItem(RK) || '{}') || {}; } catch(e) { return {}; } };
    const pair = id => me < id ? [me, id] : [id, me];
    const list = () => (window.FR_ ? window.FR_.friends() : []).map(([id, x]) => ({id, n:x.n || 'Bạn', k:+x.av || 0, ft:(typeof x.ft==='string' ? x.ft.slice(0,60) : ''), lv:x.lv || 1, pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''}));
    const msgs = id => (M[id] || []).map(m => ({me:m.f===me, text:m.t, at:m.at}));
    const last = id => { const L = msgs(id); return L.length ? L[L.length-1] : null; };
    const unread = id => (M[id] || []).filter(m => m.f!==me && (m.at || 0) > (rd()[id] || 0)).length;
    const total = () => list().reduce((a, f) => a + unread(f.id), 0);
    const badge = () => { const n = total(); document.querySelectorAll('.dmdot').forEach(e => { e.hidden = !n; e.textContent = n > 9 ? '9+' : n; }); };
    const seen = id => { const r = rd(); r[id] = Date.now() + 2000; try { localStorage.setItem(RK, JSON.stringify(r)); } catch(e) {} badge(); };
    const setOpen = id => { open = id || null; if(open) seen(open); };
    const ping = (f, t) => { SFX.play('chat'); document.querySelectorAll('.chatPop').forEach(e => e.remove());
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chatPop'; b.style.setProperty('--c', '#FF5E94');
      b.innerHTML = `<span class="cpa">${f.pa ? `<img src="${f.pa}" alt="">` : palAV(f.k, f.ft)}</span><span class="cpt"><b>${esc(f.n)} · tin nhắn</b><small>${esc(String(t).slice(0, 80))}</small></span><i>💬</i>`;
      b.onclick = () => { b.remove(); if(window.__openDm) window.__openDm(f.id); }; document.body.appendChild(b);
      setTimeout(() => b.classList.add('out'), 4200); setTimeout(() => b.remove(), 4700);
      const cb = document.getElementById('chatBtn'); if(cb && document.body.classList.contains('ingame')) cb.classList.add('unread'); };
    const send = async (id, t) => { if(!me) throw new Error('no'); const [a, b] = pair(id), d = await FBNET.db(); await d.ref(`dm/${a}/${b}`).push({f:me, t:String(t).slice(0, 120), at:firebase.database.ServerValue.TIMESTAMP}); };
    const tick = async () => { try { if(!window.FR_ || !FBNET.ok()) return; const u = window.FR_.uid(); if(!u) return; me = u; const d = await FBNET.db();
        list().forEach(f => { if(subs[f.id]) return; const [a, b] = pair(f.id); subs[f.id] = d.ref(`dm/${a}/${b}`).limitToLast(40);
          subs[f.id].on('child_added', sn => { const v = sn.val(); if(!v || !v.t) return; (M[f.id] = M[f.id] || []).push(v);
            if(v.f!==me && (v.at || Date.now()) > t0 - 3000){ if(open===f.id) seen(f.id); else ping(list().find(x => x.id===f.id) || f, v.t); }
            badge(); if(window.__dmChanged) window.__dmChanged(f.id); }); });
      } catch(e) {} };
    setTimeout(tick, 2500); setInterval(tick, 8000);
    return {list, msgs, last, unread, total, send, setOpen, badge};
  })();
  // ----- hồ sơ người chơi: tên, nhân vật, bảng tên, trang phục, liên kết tài khoản (mô phỏng)
  window.openProfile = (toTitles) => {
    const keepSc = (() => { const m = document.querySelector('#mBody .pv3'); if(!m || document.getElementById('modal').hidden) return null; return {tab:window.__pvTab, v:[...m.querySelectorAll('.pvpane,.p3a,.p3b')].map(e => e.scrollTop)}; })();
    if(window.paintMeta) window.paintMeta();
    const keep = AVMAP; AVMAP = null; const cur = savedPick() || 0;
    const chip = (on, attr, inner) => `<button type="button" class="pfchip ${on?'on':''}" ${attr}>${inner}</button>`;
    const avs = [0,1,2,3].concat(Object.keys(PREM).map(Number).filter(k => STORE.ownsAv(k))).map(k => chip(cur===k, `data-pav="${k}"`, `<span class="pfav">${AV(k, '')}</span>`)).join('')
      + Object.keys(PREM).map(Number).filter(k => !STORE.ownsAv(k)).map(k => `<button type="button" class="pfchip lock" data-goshop="1" aria-label="${PREM[k].n}: mua ở Cửa hàng"><span class="pfav">${AV(k, '')}</span><i>🔒</i></button>`).join('');
    const pls = chip(!STORE.plate, 'data-ppl=""', 'Không') + Object.keys(PLATES).filter(k => STORE.ownsPlate(k)).map(k => chip(STORE.plate===k, `data-ppl="${k}"`, PLATES[k].n)).join('');
    const fts = chip(!STORE.fit, 'data-pft=""', 'Không') + Object.keys(FITS).filter(k => STORE.ownsFit(k)).map(k => chip(STORE.wearing(k), `data-pft="${k}"`, FITS[k].n)).join('')
      + Object.keys(FITS).filter(k => !STORE.ownsFit(k)).map(k => `<button type="button" class="pfchip lock" data-goshop="1">🔒 ${FITS[k].n}</button>`).join('');
    // Hồ sơ mới: trái là nhân vật đứng (mặc đúng đồ đang dùng, bảng tên trên đầu), phải là Túi đồ chia mục như cửa hàng, chỉ hiện đồ đã có
    const tab = window.__pvTab = toTitles ? 'title' : ((window.__pvTab==='plate' || window.__pvTab==='fit' ? 'item' : window.__pvTab) || 'item');
    const pvc = (on, pic, name, btn, attr, extra) => `<div class="pvc ${on ? 'on' : ''}"><span class="pvcp">${pic}</span><b>${esc(name)}</b>${extra || ''}<button type="button" class="pvcb ${on ? 'on' : ''}" ${attr}>${btn}</button></div>`;
    const shopMore = t => `<button type="button" class="pvmore" data-goshop="1">🛒 ${t}</button>`;
    const empty = (ico, t, more) => `<div class="pvempty"><i>${ico}</i><b>${t}</b>${shopMore(more)}</div>`;
    const owned = {
      av: [0,1,2,3,4,5,6].filter(k => STORE.ownsAv(k)),
      fit: Object.keys(FITS).filter(k => STORE.ownsFit(k)),
      plate: Object.keys(PLATES).filter(k => STORE.ownsPlate(k))
    };
    const PANES = {
      av: () => `<div class="pvgrid">${owned.av.map(k => pvc(cur===k, AV(k, ''), PREM[k] ? PREM[k].n : PICKS[k][0], cur===k ? 'Đang dùng' : 'Dùng', `data-pav="${k}" ${cur===k ? 'disabled' : ''}`)).join('')}</div>` + shopMore('Thêm nhân vật ở Cửa hàng'),
      fit: () => owned.fit.length ? `<div class="pvgrid">${owned.fit.map(k => pvc(STORE.wearing(k), AV(cur, k), FITS[k].n, STORE.wearing(k) ? 'Cởi ra' : 'Mặc', `data-pft="${k}"`)).join('')}</div>` + shopMore('Thêm trang phục ở Cửa hàng')
        : empty('👒', 'Chưa có trang phục nào', 'Mua trang phục ở Cửa hàng'),
      plate: () => owned.plate.length ? `<div class="pvgrid">${owned.plate.map(k => pvc(STORE.plate===k, `<span class="plprev pc plate-${k}"><span class="nmx">${esc(STORE.name || 'Bạn')}</span></span>`, PLATES[k].n, STORE.plate===k ? 'Gỡ ra' : 'Dùng', `data-ppl="${STORE.plate===k ? '' : k}"`)).join('')}</div>` + shopMore('Thêm bảng tên ở Cửa hàng')
        : empty('🏷️', 'Chưa có bảng tên nào', 'Mua bảng tên ở Cửa hàng'),
      item: () => `<div class="p3split"><div class="p3a"><div class="pvbag2"><div class="pvbh"><b>Mang vào ván <em>${STORE.pack.length}/${PACK_MAX}</em></b><small>Chạm món để bỏ vào hoặc lấy ra. Mỗi ván dùng tối đa ${ITEM_MAX} món.</small></div>
        <div class="pvbg">${Object.keys(ITEMS).map(k => { const inp = STORE.pack.includes(k), n = STORE.has(k), full = !inp && STORE.pack.length >= PACK_MAX; return `<button type="button" class="pvit ${inp ? 'on' : ''} ${n ? '' : 'zero'}" data-pbag="${k}" ${full ? 'disabled' : ''} aria-label="${ITEMS[k].n}, có ${n}${inp ? ', đang mang vào ván' : ''}"><span>${ITEMS[k].i}</span><i>${n}</i><b>${ITEMS[k].n}</b>${inp ? '<u>✓</u>' : ''}</button>`; }).join('')}</div>
        <div class="pvbl">📣 Loa thế giới: <b>${STORE.loa}</b></div></div>` + shopMore('Mua thêm vật phẩm ở Cửa hàng') + '</div><div class="p3b"><div class="pvtag">👒 Trang phục</div>' + PANES.fit() + '<div class="pvtag">🏷️ Bảng tên</div>' + PANES.plate() + '</div></div>',
      me: () => PH.gal(),
      title: () => `<div id="pvTitles"><div class="pvtag">Danh hiệu · ${TITLE.count()}/${TITLES.length}</div><div class="ttgrid">${TITLE.list().map(t => `<button type="button" class="ttm r${t.r} ${t.got ? '' : 'lock'} ${TITLE.worn() && TITLE.worn().id===t.id ? 'on' : ''}" data-ttl="${t.id}" aria-label="${t.n}"><span class="ttw"><span class="tl l"></span><span class="tl r"></span><span class="ttc">${t.i}</span></span><b>${t.n}</b>${t.got ? `<small>${RAR[t.r].n}</small>` : `<span class="ttp"><u style="width:${Math.round(t.v/t.g*100)}%"></u></span>`}</button>`).join('')}</div><div class="ttinfo" id="ttInfo">Chạm một huy chương để xem cách đạt.</div></div>`,
      acc: () => {
        return '<p class="pvnote">Dữ liệu được lưu trên máy này.</p>'; }
    };
    const TABS = [['me','📷','Ảnh'],['av','🐯','Nhân vật'],['item','🎒','Vật phẩm'],['title','🏅','Danh hiệu'],['acc','👤','Tài khoản']];
    const tr = tierOf(STORE.rp), lv = lvOf(STORE.exp), myFace = PH.face(), gsex = (() => { try { return localStorage.getItem('lendoi_gender') || ''; } catch(e) { return ''; } })();
    const lvp = lv.max ? 100 : Math.round(lv.cur/lv.need*100), tp = tr.next ? Math.round((STORE.rp - tr.t.min)/(tr.next.min - tr.t.min)*100) : 100;
    const body = `<div class="pv pv2 pv3" style="--tc:${tr.t.c}">
      <div class="pvL">
        <div class="p3top"><div class="pvstage" data-pvt="av" title="Đổi nhân vật" style="--sa:${AV.bg(cur)[0]};--sb:${AV.bg(cur)[1]}"><span class="pvscene">${AV.scene(cur)}</span>
          ${isXmas(STORE.fit) ? '<span class="xmasfx" aria-hidden="true"><span class="xlights">' + Array.from({length:7}, (_, j) => `<i style="--d:${(j*.17).toFixed(2)}s;--c:${['#FF3B30','#FFD23F','#3FB76A','#5FA8D3'][j%4]}"></i>`).join('') + '</span>' + Array.from({length:8}, (_, j) => `<b style="left:${(j*12.3+3)%100}%;--t:${(4+(j*7)%5)}s;--d:-${(j*.61).toFixed(2)}s;--s:${(.6+(j%4)*.2).toFixed(1)}">❄</b>`).join('') + '</span>' : ''}
          <span class="pvfig">${AV.full(cur, STORE.fit)}</span><b class="p3lbl">Nhân vật</b></div>
          <button type="button" class="p3av" data-p3av="1" aria-label="Đổi ảnh đại diện">${myFace ? `<img src="${myFace}" alt="">` : `<span class="pwani">${AV(cur, '')}</span>`}<i class="p3cam">📷</i><span class="pwlv">${lv.L}</span></button></div>
        <input id="pfName" maxlength="14" value="${esc(STORE.name || '')}" placeholder="Tên của bạn" aria-label="Tên của bạn">
        <span class="pwtag">${window.FR_ ? '#' + esc(window.FR_.uid()) : ''}</span>
        ${PH.srcRow()}
        ${TITLE.worn() ? `<span class="pwt">${ttMini(TITLE.worn())}${TITLE.worn().n}</span>` : ''}
        <div class="p3row"><div class="pfsex onst"><button type="button" data-sex="m" class="${gsex==='m' ? 'on' : ''}">${window.sexIcon ? window.sexIcon('m') : '♂'}</button><button type="button" data-sex="f" class="${gsex==='f' ? 'on' : ''}">${window.sexIcon ? window.sexIcon('f') : '♀'}</button></div><button type="button" class="p3snap" id="pvSnap">📸 Chia sẻ</button></div>
      </div>
      <div class="pvR"><div class="pwstat p3stat">
          <div class="pwtier"><span class="pwbd">${TBADGE(tr.k, 1)}</span><div><small>Hạng</small><b>${tr.t.n}</b><i><u style="width:${tp}%"></u></i><em>${STORE.rp} điểm${tr.next ? ' · còn ' + (tr.next.min - STORE.rp) + ' lên ' + tr.next.n : ''}</em></div></div>
          <div class="pwlvl"><small>Cấp</small><b>${lv.L}</b><i><u style="width:${lvp}%"></u></i></div></div>
        <nav class="pvtabs">${TABS.map(t => `<button type="button" class="${tab===t[0] ? 'on' : ''}" data-pvt="${t[0]}"><i>${t[1]}</i><span>${t[2]}</span></button>`).join('')}</nav>
        <div class="pvpane">${PANES[tab]()}</div></div>
      <button type="button" class="pwx" data-pwx="1" aria-label="Đóng">✕</button></div>`;
    AVMAP = keep;
    openModal('👤 Hồ sơ', body, [], 'one sys profv p3dlg');
    if(keepSc && keepSc.tab===tab) document.querySelectorAll('#mBody .pv3 .pvpane,#mBody .pv3 .p3a,#mBody .pv3 .p3b').forEach((e,j) => { if(keepSc.v[j]) e.scrollTop = keepSc.v[j]; });
    const mb = document.getElementById('mBody');
    document.getElementById('pfName').oninput = e => { STORE.setName(e.target.value.trim()); const n = mb.querySelector('.plprev .nmx'); if(n) n.textContent = STORE.name || 'Bạn'; };
    mb.onclick = e => { const im = e.target.closest('img[data-phbig]'); if(im){ PH.big(im.src); return; }
      const stg = e.target.closest('.pvstage[data-pvt]'); if(stg){ window.__pvTab = 'av'; SFX.play('click'); window.openProfile(); return; }
      const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.pwx){ closeModal(); return; }
      if(b.dataset.gcgo){ MAIL.redeem((document.getElementById('gcIn') || {}).value); return; }
      if(b.dataset.p3av){ if(PH.G()) PH.pick('a'); else { window.__pvTab = 'me'; window.openProfile(); } return; }
      if(b.dataset.pvt){ window.__pvTab = b.dataset.pvt; SFX.play('click'); window.openProfile(); return; }
      if(b.dataset.phup!=null){ PH.pick(b.dataset.phup); return; }
      if(b.dataset.phdel!=null){ PH.del(b.dataset.phdel).then(() => window.openProfile()); return; }
      if(b.dataset.phon){ PH.toggle().then(() => window.openProfile()); return; }
      if(b.dataset.avsrc){ SFX.play('pop'); PH.setSrc(b.dataset.avsrc).then(() => { if(document.querySelector('.dlg.profv')) window.openProfile(); }); return; }
      if(b.dataset.ttl){ const t = TITLE.list().find(x => x.id===b.dataset.ttl); if(!t) return;
        if(t.got && b.classList.contains('pick')){ TITLE.setWear(t.id); SFX.play('badge'); window.openProfile(true); return; }
        mb.querySelectorAll('.ttm.pick').forEach(x => x.classList.remove('pick')); b.classList.add('pick'); SFX.play('pop');
        document.getElementById('ttInfo').innerHTML = `${t.i} <b>${t.n}</b> <i>(${RAR[t.r].n})</i><br>${t.d}. ` + (t.got ? (TITLE.worn() && TITLE.worn().id===t.id ? 'Đang đeo, chạm lần nữa để gỡ.' : 'Đã mở, chạm lần nữa để đeo.') : `Tiến độ ${fmtN(t.v)}/${fmtN(t.g)}.`); return; }
      if(b.dataset.pbag){ const k = b.dataset.pbag; let a = STORE.pack; if(a.includes(k)) a = a.filter(x => x!==k); else if(a.length < PACK_MAX) a = a.concat([k]); else return; STORE.setPack(a); SFX.play('click'); const pn = mb.querySelector('.pvpane'), sc = pn ? pn.scrollTop : 0; window.openProfile(); const pn2 = document.querySelector('#mBody .pvpane'); if(pn2) pn2.scrollTop = sc; }
      else if(b.dataset.goshop){ SFX.play('pop'); closeModal(); const sb = document.querySelector('[data-go="shop"]'); if(sb) sb.click(); }
      else if(b.dataset.pav!=null){ try { localStorage.setItem('lendoi_av', +b.dataset.pav); } catch(err) {} SFX.play('pop'); window.openProfile(); }
      else if(b.dataset.ppl!=null){ STORE.setPlate(b.dataset.ppl); SFX.play('pop'); window.openProfile(); }
      else if(b.dataset.pft!=null){ STORE.wear(b.dataset.pft); SFX.play('pop'); window.openProfile(); renderShop(); }
      else if(b.dataset.link){ openModal('Liên kết ' + b.dataset.link, `<p>Bản chơi thử chạy trong trang web nên chưa đăng nhập ${b.dataset.link} được.</p><p>Ở app thật, bạn bấm nút này để đăng nhập, giữ xu và cấp độ trên mọi máy, và dùng luôn ảnh đại diện ${b.dataset.link} làm nhân vật.</p>`, [{label:'Đã hiểu', primary:true, fn: () => window.openProfile()}]); } };
  };
  document.getElementById('homeProf').onclick = () => window.openProfile();
  document.addEventListener('click', e => { if(e.target.closest('#plTap')){ const pk = document.getElementById('plPick'); if(pk) pk.hidden = !pk.hidden; } });
  const paintQDot = window.paintQDot = () => { const n = QUEST.ready() + (window.MS_ && window.MS_.ready() ? 1 : 0); document.querySelectorAll('#homeQuest .qdot,#questBtn .qdot').forEach(d => { d.hidden = !n; d.textContent = n; }); };
  window.openQuests = () => {
    if(askOpen) return;
    const L = QUEST.list(), lv = lvOf(STORE.exp);
    const row = q => `<div class="q2 ${q.got ? 'got' : ''}"><div class="q2t"><b><span>${q.n}</span><em>${Math.min(q.v,q.g)}/${q.g}</em></b><span class="qbar"><i style="width:${Math.min(100,Math.round(q.v/q.g*100))}%"></i></span></div>${q.got ? '<span class="qok">✓</span>' : `<button class="btn ${q.v>=q.g ? 'primary' : ''}" data-claim="${q.id}" ${q.v>=q.g ? '' : 'disabled'}>+${q.r} 🪙</button>`}</div>`;
    const dn = L.daily.filter(q => q.got).length, open = L.level.filter(q => !q.lock && !q.got).slice(0, 3), done = L.level.filter(q => q.got).length;
    openModal('🎯 Nhiệm vụ', `<div class="q2h"><b>Cấp ${lv.L}</b><span class="qbar"><i style="width:${Math.round(lv.cur/lv.need*100)}%"></i></span><small>${lv.max ? 'Tối đa' : lv.cur + '/' + lv.need}</small></div>
      <div class="q2s">Hôm nay ${dn}/${L.daily.length}</div>${L.daily.filter(q => !q.got).map(row).join('') || '<p class="say">🎉 Đã xong hết nhiệm vụ hôm nay!</p>'}
      ${window.MS_ && window.MS_.qrows() ? '<div class="q2s">Chia sẻ</div>' + window.MS_.qrows() : ''}
      <div class="q2s">Theo cấp ${done}/30</div>${open.map(row).join('') || '<p class="say">Lên cấp để mở thêm nhiệm vụ.</p>'}<button type="button" class="q2l" id="qTitles">🏅 Danh hiệu ${TITLE.count()}/${TITLES.length} ›</button>`, [{label:'Xong', primary:true, fn: closeModal}], 'one sys qmini');
    document.getElementById('qTitles').onclick = () => window.openProfile(true);
    document.getElementById('mBody').onclick = e => { const b = e.target.closest('[data-claim]'); if(!b || b.disabled) return; const r = QUEST.claim(b.dataset.claim);
      if(r){ const l0 = lvOf(STORE.exp).L; STORE.add(r.r); STORE.addExp(r.x); const l1 = lvOf(STORE.exp).L; if(l1 > l0) STORE.add((l1-l0)*REWARD.perLevel); SFX.play(l1 > l0 ? 'levelup' : 'coinbig'); paintCoins(); paintQDot(); window.openQuests(); } };
  };
  document.getElementById('homeQuest').onclick = () => window.openQuests();

  document.getElementById('questBtn').onclick = () => window.openQuests();

  // ----- Điểm danh 7 ngày: mỗi ngày mở game nhận 1 quà nhỏ, ngày thứ 7 nhận rương lớn. Bỏ lỡ 1 ngày thì bắt đầu lại từ ngày 1; xong ngày 7 thì quay vòng
  const DAILY = (() => {
    const KEY = 'lendoi_daily', today = () => Math.floor((Date.now() + 7*36e5)/864e5);   // ngày theo giờ Việt Nam
    const R = [
      {i:'🪙', v:'30 xu', g:{xu:30}},
      {i:'🧋', v:'Trà sữa', g:{it:{tea:1}}},
      {i:'🪙', v:'50 xu', g:{xu:50}},
      {i:'💎', v:'2 kim cương', g:{gem:2}},
      {i:'🥖☕', v:'Bánh mì + Cà phê', g:{it:{banhmi:1, cafe:1}}, two:1},
      {i:'🪙', v:'80 xu', g:{xu:80}},
      {i:'🎁', v:'300 xu · 10 💎<br>Phở · Xúc xắc vàng · Ô dù', g:{xu:300, gem:10, it:{pho:1, dice:1, umb:1}}, big:1}
    ];
    let d = {n:0, last:-1}; try { d = Object.assign(d, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch(e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {} };
    const state = () => { const t = today();
      if(d.last===t) return {done:d.n, next:0, can:false};                         // hôm nay đã nhận
      if(d.last===t-1 && d.n<7) return {done:d.n, next:d.n+1, can:true};          // đang giữ chuỗi
      return {done:0, next:1, can:true}; };                                       // lần đầu, bỏ lỡ ngày, hoặc xong vòng 7 ngày
    const claim = () => { const st = state(); if(!st.can) return null; const r = R[st.next-1], g = r.g;
      if(g.xu) STORE.add(g.xu); if(g.gem) STORE.addGem(g.gem); if(g.it) Object.keys(g.it).forEach(k => STORE.give(k, g.it[k]));
      d.n = st.next; d.last = today(); save(); return {day:st.next, r}; };
    return {R, state, claim};
  })();
  const paintDaily = () => { const e = document.querySelector('#homeDaily .qdot'); if(e){ const c = DAILY.state().can; e.hidden = !c; e.textContent = c ? '!' : ''; } };
  window.openDaily = () => {
    if(askOpen || !document.getElementById('modal').hidden) return;
    const st = DAILY.state();
    const card = (r, k) => { const day = k+1, cls = day<=st.done ? 'got' : day===st.next ? 'now' : '';
      return `<div class="dc ${r.big ? 'big' : ''} ${cls}" data-day="${day}"><span class="dd">${day===st.next ? 'Hôm nay' : 'Ngày ' + day}</span>${r.big ? '<span class="dt">Quà lớn</span>' : ''}<span class="di ${r.two ? 'two' : ''}">${r.big ? '🎁' : r.i}</span><span class="dw"><span class="dv">${r.big ? 'Hộp quà bí ẩn' : r.v}</span></span></div>`; };
    const foot = st.can ? `Nhận quà <b>ngày ${st.next}</b>. Vào game mỗi ngày để giữ chuỗi, bỏ lỡ 1 ngày sẽ quay lại ngày 1.`
      : (st.done>=7 ? 'Bạn đã nhận rương lớn! Ngày mai bắt đầu vòng điểm danh mới.' : `Hôm nay đã nhận rồi. Quay lại ngày mai để nhận quà <b>ngày ${st.done+1}</b>.`);
    openModal('📅 Điểm danh 7 ngày', `<p class="dlyh">Mỗi ngày vào game nhận <b>1 món quà nhỏ</b>, đủ 7 ngày liên tiếp nhận <b>rương quà lớn</b>.</p><div class="dly">${DAILY.R.map(card).join('')}</div><p class="dlyf" id="dlyF">${foot}</p>`,
      st.can ? [{label:'Nhận quà', primary:true, fn:() => doClaim()}, {label:'Để sau', fn: closeModal}] : [{label:'Đóng', primary:true, fn: closeModal}], 'daily');
    const doClaim = () => {
      const r = DAILY.claim(); if(!r) return;
      const c = document.querySelector(`#mBody .dc[data-day="${r.day}"]`); if(c){ c.classList.remove('now'); c.classList.add('got','pop'); const dd = c.querySelector('.dd'); if(dd) dd.textContent = 'Ngày ' + r.day; }
      SFX.play(r.r.big ? 'levelup' : 'coinbig'); paintCoins(); paintDaily();
      const f = document.getElementById('dlyF'); if(f) f.innerHTML = r.day>=7 ? 'Bạn đã nhận rương lớn! Ngày mai bắt đầu vòng điểm danh mới.' : `Đã nhận! Quay lại ngày mai để nhận quà <b>ngày ${r.day+1}</b>.`;
      const o = document.getElementById('mOpts'); if(o){ o.innerHTML = ''; const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Tuyệt!'; b.onclick = closeModal; o.appendChild(b); }
      if(r.r.big) setTimeout(() => bigMoment('Rương quà ngày 7!', '#FFC53D', '🎁'), 350);
    };
  };
  window.dailyAuto = () => { if(document.body.dataset.scr==='home' && DAILY.state().can) setTimeout(() => { if(document.body.dataset.scr==='home' && !document.body.classList.contains('ingame') && !document.getElementById('loginFx')) window.openDaily(); }, 450); };   // v138: đã vào ván hoặc đang ở màn đăng nhập thì không bật Điểm danh
  document.getElementById('homeDaily').onclick = () => window.openDaily();
  paintDaily(); setInterval(paintDaily, 60000);
  // ----- Bạn bè (bản thử: người chơi mô phỏng, dữ liệu lưu trên máy)
  const PALS = (() => {
    const NAMES = ['Minh Khoa','Thu Hà','Bảo Ngọc','Quốc Anh','Lan Chi','Đức Huy','Mai Phương','Gia Bảo','Tuấn Kiệt','Hoài Thương','Khánh Linh','Việt Hùng','Thanh Tùng','Ngọc Diệp','Hải Đăng','Phương Thảo','Anh Thư','Trọng Nghĩa','Cẩm Tú','Đình Phúc','Yến Nhi','Văn Long','Kim Ngân','Hữu Phước','Bích Vân','Nhật Minh','Diễm My','Công Vinh','Thuý Hằng','Hoàng Nam'];
    const BOTS_ = typeof BOTPOOL!=='undefined' && BOTPOOL.length, BLV = BOTS_ ? botRows('lv') : [];
    const POOL = (BOTS_ ? BOTPOOL.map(b => b[0]) : NAMES).map((n,k) => ({id:String(100000 + ((k*7919 + 4721) % 899999)), n, k:k%7, lv:BOTS_ ? BLV[k].v : 1 + (k*5)%24, pa:BOTS_ ? BOTPOOL_IMG[k] || '' : ''}));
    const LVL = [{n:'Người quen',min:0},{n:'Bạn bè',min:50},{n:'Bạn thân',min:200},{n:'Tri kỷ',min:500},{n:'Gắn bó',min:1000},{n:'Trọn đời',min:2000}];
    const TITLES = [{k:'', n:'Không đeo', i:'', min:0}, {k:'banthan', n:'Bạn thân', i:'🤝', min:200}, {k:'anhem', n:'Anh em', i:'👊', min:500}, {k:'chiem', n:'Chị em', i:'🎀', min:500},
      {k:'thaytro', n:'Thầy trò', i:'🎓', min:500}, {k:'bocon', n:'Bố con', i:'👨‍👦', min:800}, {k:'mecon', n:'Mẹ con', i:'👩‍👧', min:800}, {k:'kethon', n:'Vợ chồng', i:'💍', min:1000, ring:1}];
    const GIFTS = [{k:'rose', n:'Hoa hồng', i:'🌹', p:10, v:10}, {k:'tea', n:'Trà sữa', i:'🧋', p:25, v:30}, {k:'bear', n:'Gấu bông', i:'🧸', p:60, v:80}, {k:'ring', n:'Nhẫn cưới', i:'💍', p:200, v:300}];
    const KEY = 'lendoi_pals', today = () => Math.floor((Date.now() + 7*36e5)/864e5);
    let d = {f:{}}; try { d = Object.assign(d, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch(e) {} d.f = d.f || {};
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {} };
    const who = id => POOL.find(x => x.id===id) || {id, n:(d.f[id] && d.f[id].n) || 'Người chơi ' + id, k:(d.f[id] && d.f[id].k!=null) ? d.f[id].k : (+id||0)%7, lv:1 + (+id||0)%20};
    const idOf = name => { const p = POOL.find(x => x.n===name); if(p) return p.id; let h = 7; for(const ch of String(name)) h = (h*31 + ch.charCodeAt(0)) % 899999; return String(100000 + h); };
    const byName = name => Object.keys(d.f).find(id => who(id).n===name) || null;
    const lvl = pts => { let k = 0; LVL.forEach((l,j) => { if(pts >= l.min) k = j; }); return {k, cur:LVL[k], next:LVL[k+1] || null}; };
    return { LVL, TITLES, GIFTS, who, lvl,
      list: () => Object.keys(d.f).map(id => Object.assign({}, who(id), d.f[id], {free: d.f[id].day !== today()})).sort((a,b) => b.pts - a.pts),
      has: id => !!d.f[id],
      find(q){ q = String(q||'').trim().toLowerCase(); let L = POOL.filter(x => !d.f[x.id]);
        if(!q) return L.slice(0, 8);
        L = L.filter(x => x.n.toLowerCase().includes(q) || x.id.includes(q));
        if(!L.length && /^\d{4,9}$/.test(q) && !d.f[q]) L = [who(q)];
        return L.slice(0, 12); },
      add(id, name, k){ if(d.f[id]) return false; d.f[id] = {pts:0, title:'', day:0, ring:0, since:today()}; if(name && !POOL.find(x => x.id===id)){ d.f[id].n = String(name).slice(0,20); d.f[id].k = k||0; } save(); QUEST.add('friend', 1); return true; },
      idOf, byName,
      info(name){ const id = byName(name); if(!id) return null; const f = d.f[id]; return {id, pts:f.pts, lv:lvl(f.pts).cur.n, title:TITLES.find(t => t.k===f.title) || null}; },
      badge(name){ const x = this.info(name); if(!x) return ''; return x.title && x.title.k ? x.title.i + ' ' + x.title.n : x.pts >= 200 ? '❤️ ' + x.lv : ''; },
      bump(name, v){ const id = byName(name); if(!id) return; d.f[id].pts += v; save(); },
      matchNames(n){ const fr = Object.keys(d.f).map(id => who(id).n), out = []; if(fr.length && Math.random() < .6) out.push(fr[Math.floor(Math.random()*fr.length)]);
        const rest = POOL.map(x => x.n).filter(x => !out.includes(x)).sort(() => Math.random() - .5); while(out.length < n) out.push(rest.pop()); return out.sort(() => Math.random() - .5).map(x => x + ' 🤖'); },   // đối thủ là máy: gắn nhãn 🤖
      rndName(){ return POOL[Math.floor(Math.random()*POOL.length)].n; },
      remove(id){ delete d.f[id]; save(); },
      gift(id, k){ const f = d.f[id], g = GIFTS.find(x => x.k===k); if(!f || !g) return null;
        const free = k==='rose' && f.day !== today(), cost = free ? 0 : g.p; if(STORE.coins < cost) return {err:'coin', cost};
        if(cost) STORE.add(-cost); if(free) f.day = today(); if(k==='ring') f.ring = 1;
        const l0 = lvl(f.pts).k; f.pts += g.v; save(); QUEST.add('gift', 1); return {g, free, up: lvl(f.pts).k > l0 ? lvl(f.pts).cur.n : ''}; },
      canTitle(f, t){ if(f.pts < t.min) return 'Cần ' + t.min + ' điểm thân mật'; if(t.ring && !f.ring) return 'Cần tặng Nhẫn cưới trước'; if(t.k==='kethon'){ const sp = Object.keys(d.f).find(x => d.f[x].title==='kethon' && x!==f.id); if(sp) return 'Bạn đang kết hôn với ' + who(sp).n; } return ''; },
      setTitle(id, k){ const f = d.f[id], t = TITLES.find(x => x.k===k); if(!f || !t) return false; if(k && this.canTitle(Object.assign({id}, f), t)) return false; const was = f.title; f.title = k; save(); if(k==='kethon' && was!=='kethon') QUEST.add('marry', 1); return true; },
      spouse(){ const sp = Object.keys(d.f).find(x => d.f[x].title==='kethon'); return sp ? who(sp) : null; }
    };
  })();
  window.PALS = PALS;

  { const g0 = PALS.gift; PALS.gift = (id, k) => { const r = g0(id, k); if(r && r.g) try { window.__bevt && window.__bevt(botMe(), PALS.who(id).n, r.g, 0); } catch(e) {} return r; }; }
  window.__botAct = (() => {   /* máy tự tương tác: thẻ nhỏ góc màn hình (lời mời kết bạn, quà, rủ chơi) + máy tặng quà / ném trứng nhau trên kênh Thế giới */
    if(typeof document==='undefined' || typeof BOTPOOL==='undefined' || !BOTPOOL.length) return () => {};
    const K = 'ld_botact', ld = () => { try { return JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch(e) { return {}; } }, sv = v => { try { localStorage.setItem(K, JSON.stringify(v)); } catch(e) {} };
    const idx = n => BOTPOOL.findIndex(b => b[0]===n), pic = n => BOTPOOL_IMG[idx(n)] || '';
    const free = () => !document.body.classList.contains('ingame') && (!document.getElementById('modal') || document.getElementById('modal').hidden) && !document.hidden;
    const rndBot = ex => { for(let t=0; t<20; t++){ const n = BOTPOOL[Math.floor(Math.random()*BOTPOOL.length)][0]; if(!(ex || []).includes(n)) return n; } return BOTPOOL[0][0]; };
    const card = (name, text, btns) => { document.querySelectorAll('.bcard').forEach(x => x.remove());
      const c = document.createElement('div'); c.className = 'bcard'; c.innerHTML = `<span class="bcav">${pic(name) ? `<img class="avph" src="${pic(name)}" alt="">` : '🙂'}</span><div class="bctx"><b>${esc(name)}</b><small>${esc(text)}</small><div class="bcbt">${btns.map((b,j) => `<button type="button" data-bc="${j}" class="${j ? '' : 'p'}">${b[0]}</button>`).join('')}</div></div><button type="button" class="bcx" aria-label="Đóng">✕</button>`;
      document.body.appendChild(c); SFX.play('pop'); const t = setTimeout(() => c.remove(), 14000);
      c.onclick = e => { if(e.target.closest('.bcx')){ clearTimeout(t); c.remove(); return; } const b = e.target.closest('[data-bc]'); if(!b) return; clearTimeout(t); c.remove(); const f = btns[+b.dataset.bc][1]; if(f) f(); }; };
    const play = name => { if(window.BLOBBY_ && typeof show==='function'){ show('friend');   /* bạn rủ chơi: vào phòng chờ của người đó, người khác vào dần */
        setTimeout(() => window.BLOBBY_.open({id:String(10000 + Math.floor(Math.random()*89999)), n:name, c:1 + Math.floor(Math.random()*2), len:'q', o:1}), 250); return; }
      if(typeof startGame!=='function') return; const others = botPick(2, [name]); BOTPA[name] = pic(name);
      const me = (typeof clean==='function') ? clean(STORE.name || 'Bạn', 'Bạn') : (STORE.name || 'Bạn');
      const cfg = [{name:me, bot:false}, {name, bot:true}].concat(others.map(n => ({name:n, bot:true})));
      try { localStorage.setItem('lendoi_len', 'q'); } catch(e) {} palToast(`🎲 Vào ván với ${name}…`); setTimeout(() => { startGame(cfg, 'bot', {pick: savedPick()}); if(S) S.iq = 3; }, 900); };
    const act = (kind, name) => { if(!free()) return false; const v = ld(), now = Date.now();
      if(kind==='req'){ const id = PALS.idOf(name); if(PALS.has(id)) return false; v.req = now; sv(v);
        card(name, 'muốn kết bạn với bạn 🤝', [['Đồng ý', () => { if(PALS.add(id, name, idx(name) % 7)){ SFX.play('join'); palToast(`🤝 Đã kết bạn với ${name}`); window.__bsay && window.__bsay(name, `Vừa kết bạn với ${botMe()} nè 😆`, 2500); try { renderPals(); } catch(e) {} } }], ['Để sau', null]]); return true; }
      if(kind==='play'){ v.inv = now; sv(v); card(name, ['rủ bạn làm ván nhanh nè 🎲', 'chán quá, vô chơi một ván không?', 'thiếu người, vô lẹ đi 😆'][Math.floor(Math.random()*3)], [['Vào chơi', () => play(name)], ['Thôi', null]]); return true; }
      if(kind==='gift'){ const id = PALS.idOf(name); if(!PALS.has(id)) return false; v.gift = now; sv(v);
        const egg = Math.random() < .15, g = PALS.GIFTS[Math.random() < .7 ? 0 : 1];
        PALS.bump(name, egg ? -3 : g.v); window.__bevt && window.__bevt(name, botMe(), g, egg ? 1 : 0);
        card(name, egg ? 'vừa ném trứng thối vào bạn 🥚😝' : `tặng bạn ${g.i} ${g.n} · +${g.v} thân mật`, egg ? [['Ném lại', () => { const f = PALS.list().find(x => x.n===name); if(f && window.__palEgg) window.__palEgg(f.id); }], ['Bỏ qua', null]] : [['Cảm ơn', () => window.__bsay && window.__bsay(name, 'Có gì đâu, chơi vui nha 😆', 2000)]]);
        try { renderPals(); } catch(e) {} return true; }
      return false; };
    const tick = () => { if(!free()) return; const v = ld(), now = Date.now(), fr = PALS.list().filter(x => idx(x.n) >= 0);
      if(Math.random() < .4){ const a = rndBot(), b = rndBot([a]), egg = Math.random() < .25; window.__bevt && window.__bevt(a, b, PALS.GIFTS[Math.floor(Math.random()*3)], egg ? 1 : 0); return; }
      if(fr.length < 8 && now - (v.req || 0) > 4*60e3 && Math.random() < .5){ act('req', rndBot(fr.map(x => x.n))); return; }
      if(fr.length && now - (v.gift || 0) > 6*60e3 && Math.random() < .5){ act('gift', fr[Math.floor(Math.random()*fr.length)].n); return; }
      if(fr.length && now - (v.inv || 0) > 5*60e3 && Math.random() < .4){ act('play', fr[Math.floor(Math.random()*fr.length)].n); } };
    const loop = () => { try { tick(); } catch(e) {} setTimeout(loop, 35000 + Math.random()*40000); };
    setTimeout(loop, 25000);
    return act; })();
  let palTab = 'mine';
  window.PALS_ = PALS; window.paintCoins = paintCoins;
  const palAV = (k, ft) => { const keep = AVMAP; AVMAP = null; const h = AV(k, typeof ft==='string' ? ft : ''); AVMAP = keep; return h; };   /* ft: trang phục người đó đang mặc (từ hồ sơ công khai) */
  const palToast = window.palToast = t => { const e = document.createElement('div'); e.className = 'frtoast'; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2200); };
  const renderPals = window.renderPals_ = () => {
    paintCoins(); if(window.SHARE_) window.SHARE_.paintLeft();
    document.querySelectorAll('#frTabs button').forEach(b => b.classList.toggle('on', b.dataset.t===palTab));
    document.getElementById('frSearch').hidden = palTab!=='find';
    const box = document.getElementById('frList');
    FR.paint(palTab);
    if(palTab==='req'){ box.innerHTML = ''; return; }
    if(palTab==='find'){
      const L = PALS.find(document.getElementById('frQ').value);
      box.innerHTML = '<div class="tag">' + (document.getElementById('frQ').value.trim() ? 'Kết quả tìm' : 'Gợi ý kết bạn') + '</div>' + (L.map(x => `<div class="frc"><span class="frav" style="--c:${PC[x.k%4]}">${x.pa ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.k)}</span><div class="frm"><b>${esc(x.n)}</b><small>Cấp ${x.lv} · ID ${String(x.id).length===6 ? '7' + x.id + '3' : x.id}</small></div>${window.PREQ_ && window.PREQ_.has(x.id) ? '<button class="btn fradd" disabled>✓ Đã gửi</button>' : `<button class="btn primary fradd" data-add="${x.id}">+ Kết bạn</button>`}</div>`).join('') || '<p class="say">Không tìm thấy ai. Thử tên khác hoặc nhập đúng ID.</p>');
      return;
    }
    const L = PALS.list(), sp = PALS.spouse();
    if(!L.length){ box.innerHTML = ''; return; }
    box.innerHTML = (document.querySelector('#frReal .tag') ? '' : '<div class="tag">Bạn bè</div>') + (sp ? `<div class="frwed">💍 Bạn đã kết hôn với <b>${esc(sp.n)}</b></div>` : '') + L.map(x => { const lv = PALS.lvl(x.pts), t = PALS.TITLES.find(y => y.k===x.title), pct = lv.next ? Math.round((x.pts - lv.cur.min)/(lv.next.min - lv.cur.min)*100) : 100;
      return `<div class="frc mine"><span class="frav" style="--c:${PC[x.k%4]}">${x.pa ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.k)}</span><div class="frm"><b>${esc(x.n)}${t && t.k ? ` <em class="frtt">${t.i} ${t.n}</em>` : ''}</b><small>Cấp ${x.lv} · ID ${String(x.id).length===6 ? '7' + x.id + '3' : x.id}</small><span class="frbar"><i style="width:${pct}%"></i></span><small class="frlv">❤️ ${x.pts} · <u>${lv.cur.n}</u>${lv.next ? ' · còn ' + (lv.next.min - x.pts) + ' tới ' + lv.next.n : ''}</small></div>
        <span class="frq"><button class="btn" data-gift="${x.id}" aria-label="Tặng quà">🎁</button><button class="btn" data-egg="${x.id}" aria-label="Ném trứng thối">🥚</button></span><div class="fract"><button class="btn ${x.free ? 'primary' : ''}" data-fl="${x.id}">🌹 ${x.free ? 'Tặng hoa miễn phí' : 'Tặng hoa 10 🪙'}</button><button class="btn" data-gift="${x.id}">🎁 Tặng quà</button><button class="btn" data-invf="${x.id}">📤 Rủ chơi</button><button class="btn" data-title="${x.id}">🏅 Danh hiệu</button></div></div>`; }).join('');
  };
  // ===== BẠN BÈ THẬT (Firebase): mã kết bạn 8 số, lời mời kết bạn, danh sách bạn, tìm theo mã hoặc tên, mời qua link ?add=MÃ =====
  const FR = window.FR_ = (() => {
    const UK = 'lendoi_uid'; let uid = ''; try { uid = localStorage.getItem(UK) || ''; } catch(e) {}
    if(!/^\d{8}$/.test(uid)){ uid = String(10000000 + Math.floor(Math.random()*89999999)); try { localStorage.setItem(UK, uid); } catch(e) {} }
    let d = null, reqs = {}, fr = {}, prof = {}, profAt = {}, found = null, sent = new Set(), started = false, err = '';
    /* v148: gộp bạn bè + lời mời của mã cũ (from) sang mã đang dùng (to): bạn bè của mã cũ thành bạn của mã mới ở cả hai phía, xoá dấu vết mã cũ */
    async function merge(from, to){ if(!from || !to || from===to) return; const db = d || await FBNET.db();
      const F = (await db.ref('friends/' + from).once('value')).val() || {}, Q = (await db.ref('reqs/' + from).once('value')).val() || {}, up = {};
      Object.keys(F).forEach(f => { if(f===to || f===from) return; up[`friends/${to}/${f}`] = F[f]; up[`friends/${f}/${to}`] = F[f]; up[`friends/${f}/${from}`] = null; });
      Object.keys(Q).forEach(f => { if(f===to || f===from) return; up[`reqs/${to}/${f}`] = Q[f]; });
      up[`friends/${to}/${from}`] = null; up[`friends/${from}`] = null; up[`reqs/${from}`] = null;
      try { await db.ref().update(up); } catch(e) { for(const k of Object.keys(up)){ try { await db.ref(k).set(up[k]); } catch(e2) {} } }   // luật máy chủ chặn gộp một lần thì ghi từng mục
      try { await db.ref('users/' + from).remove(); } catch(e) {} }
    const refreshProf = async () => { if(!d) return; const now = Date.now(); await Promise.all(Object.keys(fr).filter(id => now - (profAt[id] || 0) > 20000).map(async id => { try { prof[id] = (await d.ref('users/' + id).once('value')).val() || prof[id] || {}; profAt[id] = now; } catch(e) {} })); };
    const TS = () => firebase.database.ServerValue.TIMESTAMP;
    const me = () => { let av = 0; try { av = window.savedPick ? (window.savedPick() || 0) : 0; } catch(e) {} let t = ''; try { const w = TITLE.worn(); if(w) t = w.n; } catch(e) {} const bw = document.querySelector('.lvbar'); return {o:FBNET.uid(), rp:STORE.rp || 0, n:((STORE.name && STORE.name!=='Bạn') ? STORE.name : ((window.AUTH_ && window.AUTH_.user() && window.AUTH_.user().displayName) || ('Người chơi ' + uid.slice(-3)))).slice(0,14), av, lv:lvOf(STORE.exp).L, ft:(STORE.fit || '').slice(0,60), p: bw ? parseInt(bw.style.width) || 0 : 0, t, g: (() => { try { return localStorage.getItem('lendoi_gender') || ''; } catch(e) { return ''; } })(), at:TS()}; };
    const card = (id, x, act) => `<div class="frc rl" data-uprof="${id}"><span class="frav" style="--c:${PC[(x.av||0)%4]}">${typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.av||0, (typeof x.ft==='string' ? x.ft.slice(0,60) : ''))}</span><div class="frm"><b>${esc(x.n || 'Người chơi')}</b><small>Cấp ${x.lv||1} · Mã ${id}</small></div>${act}</div>`;
    const badge = () => { const n = Object.keys(reqs).length, b = document.getElementById('frBadge'); if(b){ b.hidden = !n; b.textContent = n; } const h = document.getElementById('homePals'); if(h) h.classList.toggle('hasreq', !!n); };
    const repaint = () => { const t = document.querySelector('#frTabs .on'); if(t && !document.getElementById('pals').hidden) paint(t.dataset.t); };
    function paint(tab){
      const el = document.getElementById('frReal'); if(!el) return;
      const my = document.getElementById('frMyId'); if(my) my.textContent = uid;
      if(!FBNET.ok()){ el.innerHTML = '<p class="say">Chưa kết nối máy chủ nên chưa kết bạn thật được.</p>'; return; }
      if(!started) start();
      if(tab==='req'){ const L = Object.entries(reqs);
        el.innerHTML = L.length ? L.map(([id, x]) => card(id, x, `<span class="frbtns"><button class="btn primary" data-fra="${id}">Đồng ý</button><button class="btn" data-frd="${id}">Từ chối</button></span>`)).join('') : '<p class="say">Chưa có lời mời kết bạn nào. Gửi mã hoặc link cho bạn bè để họ kết bạn với bạn nhé.</p>'; return; }
      if(tab==='find'){ el.innerHTML = err ? `<p class="say">${err}</p>` : found==null ? '<p class="say">Nhập mã kết bạn 8 số hoặc tên người chơi rồi bấm Tìm.</p>' : !found.length ? '<p class="say">Không tìm thấy người chơi nào.</p>'
          : '<div class="tag">Người chơi</div>' + found.map(([id, x]) => card(id, x, id===uid ? '<small class="frme2">Bạn</small>' : fr[id] ? '<small class="frme2">✓ Bạn bè</small>' : sent.has(id) ? '<button class="btn" disabled>✓ Đã gửi</button>' : reqs[id] ? `<button class="btn primary" data-fra="${id}">Đồng ý</button>` : `<button class="btn primary" data-frq="${id}">+ Kết bạn</button>`)).join(''); return; }
      const L = Object.keys(fr);
      el.innerHTML = L.length ? '<div class="tag">Bạn bè</div>' + L.map(id => card(id, prof[id] || {}, `<button class="btn frx" data-frx="${id}" aria-label="Hủy kết bạn">✕</button>`)).join('') : '';
    }
    async function start(){
      if(started || !FBNET.ok() || !(!window.AUTH_ || window.AUTH_.user())) return; started = true;
      try { d = await FBNET.db(); } catch(e) { started = false; d = null; return; }
      try { await d.ref('users/' + uid).update(me()); } catch(e) {}   // ghi hồ sơ (kèm chủ sở hữu) trước, luật mới cho đọc lời mời theo chủ sở hữu
      d.ref('reqs/' + uid).on('value', s => { const old = Object.keys(reqs).length; reqs = s.val() || {}; if(Object.keys(reqs).length > old && old>=0 && window.palToast && s.exists()) {} badge(); repaint(); });
      d.ref('friends/' + uid).on('value', async s => { fr = s.val() || {}; delete fr[uid];
        await Promise.all(Object.keys(fr).map(async id => { try { prof[id] = (await d.ref('users/' + id).once('value')).val() || prof[id] || {}; profAt[id] = Date.now(); } catch(e) {} }));
        const mine = FBNET.uid(), stale = Object.keys(fr).filter(id => prof[id] && prof[id].o && prof[id].o===mine);   // v148: mã cũ của chính mình (máy khác) lọt vào danh sách
        stale.forEach(id => { delete fr[id]; merge(id, uid).catch(() => {}); });
        repaint(); try { window.dispatchEvent(new Event('fr-changed')); } catch(e) {} });
      checkLink();
      setInterval(() => { refreshProf().then(repaint).catch(() => {}); }, 60000);
    }
    async function search(q){
      q = String(q || '').trim(); err = ''; found = null; if(!q) return;
      if(!d){ await start(); if(!d){ err = 'Không kết nối được máy chủ.'; repaint(); return; } }
      try {
        if(/^\d{8}$/.test(q)){ const v = (await d.ref('users/' + q).once('value')).val(); found = v ? [[q, v]] : []; }
        else { const s = await d.ref('users').orderByChild('n').startAt(q).endAt(q + '').limitToFirst(10).once('value'); found = []; s.forEach(c => { found.push([c.key, c.val()]); }); }
      } catch(e) { err = 'Không tìm được, thử lại sau.'; }
      repaint();
    }
    async function request(id, hint){
      if(!d) await start(); if(!d){ palToast(window.AUTH_ && !window.AUTH_.user() ? 'Đăng nhập Google để kết bạn thật nhé' : 'Chưa kết nối máy chủ, thử lại sau'); return; }
      if(id===uid) return; if(hint && !prof[id]) prof[id] = hint; if(fr[id]){ palToast('Hai bạn đã là bạn bè'); return; }
      if(reqs[id]) return accept(id);
      try { await d.ref(`reqs/${id}/${uid}`).set(me()); sent.add(id); try { window.dispatchEvent(new Event('fr-changed')); } catch(e) {} SFX.play('pop'); palToast('Đã gửi lời mời kết bạn'); } catch(e) { palToast('Gửi lời mời không được, thử lại sau'); }
      repaint();
    }
    async function accept(id){ if(!d) await start(); if(!d) return; try { await d.ref().update({[`friends/${uid}/${id}`]:TS(), [`friends/${id}/${uid}`]:TS(), [`reqs/${uid}/${id}`]:null, [`reqs/${id}/${uid}`]:null}); prof[id] = reqs[id] || prof[id]; SFX.play('join'); palToast('Đã kết bạn'); } catch(e) { palToast('Không kết bạn được, thử lại sau'); } }
    async function decline(id){ if(d) try { await d.ref(`reqs/${uid}/${id}`).remove(); } catch(e) {} }
    async function unfriend(id){ if(!d || !confirm('Hủy kết bạn với ' + ((prof[id] || {}).n || 'người này') + '?')) return; try { await d.ref().update({[`friends/${uid}/${id}`]:null, [`friends/${id}/${uid}`]:null}); } catch(e) {} }
    async function shareLink(){ SFX.play('click'); const u = location.origin + location.pathname + '?add=' + uid, t = `Vào chiến hay sợ? 😏 Mã kết bạn của mình: ${uid}`;
      if(navigator.share){ try { await navigator.share({title:'Lên Voi Xuống Chó', text:t, url:u}); } catch(e) {} return; }
      try { await navigator.clipboard.writeText(t + ' ' + u); palToast('Đã sao chép link kết bạn'); } catch(e) { window.prompt('Sao chép link này:', u); } }
    function checkLink(){
      let q = null; try { q = new URLSearchParams(location.search).get('add'); } catch(e) {}
      if(!/^\d{8}$/.test(q || '') || q===uid) return; try { history.replaceState(null, '', location.pathname); } catch(e) {}
      setTimeout(async () => { const b = document.querySelector('[data-go="pals"]'); if(b) b.click(); palTab = 'find'; document.getElementById('frQ').value = q; await search(q); renderPals(); }, 600);
    }
    document.getElementById('frReal').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.frq) request(b.dataset.frq); else if(b.dataset.fra) accept(b.dataset.fra); else if(b.dataset.frd) decline(b.dataset.frd); else if(b.dataset.frx) unfriend(b.dataset.frx); });
    /* chỉ tạo hồ sơ công khai khi đã đăng nhập Google (trên web), để bảng xếp hạng không có tên rác */
    setTimeout(() => { if(FBNET.ok() && (!window.AUTH_ || window.AUTH_.user())) start(); }, 1500);
    return {request, accept, merge, refreshProf, st: id => fr[id] ? 'fr' : reqs[id] ? 'in' : sent.has(id) ? 'sent' : '', friends: () => Object.keys(fr).map(id => [id, prof[id] || {}]), paint, search, start, touch: async () => { if(!FBNET.ok() || !(!window.AUTH_ || window.AUTH_.user())) return; if(!started){ start(); return; } try { if(!d) d = await FBNET.db(); await d.ref('users/' + uid).update(me()); } catch(e) {} }, uid: () => uid, info: id => prof[id] || reqs[id] || ((found || []).find(x => x[0]===id) || [])[1] || {}};
  })();
  // thanh bạn bè: chạm vào thanh để xem hồ sơ của bạn; các nút tặng hoa, tặng quà, danh hiệu, rủ chơi, hủy kết bạn nằm trong hồ sơ
  const EGG = window.EGG_ = { n(){ try { return +localStorage.getItem('lendoi_eggs') || 0; } catch(e) { return 0; } }, add(k){ try { localStorage.setItem('lendoi_eggs', Math.max(0, this.n() + k)); } catch(e) {} document.querySelectorAll('.eggn').forEach(x => { x.textContent = this.n(); }); } };
  setTimeout(() => EGG.add(0), 300);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-buyegg]'); if(!b) return; const k = +b.dataset.buyegg, cost = k===5 ? 40 : 10;
    if(STORE.coins < cost){ SFX.play('warn'); palToast(`Không đủ xu, cần ${cost} 🪙`); return; } STORE.add(-cost); EGG.add(k); paintCoins(); SFX.play('buy'); palToast(`Đã mua ${k} trứng thối 🥚 (đang có ${EGG.n()})`); });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.pfsex [data-sex]'); if(!b) return;
    try { localStorage.setItem('lendoi_gender', b.dataset.sex); } catch(err) {} SFX.play('click');
    b.parentNode.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x===b));
    if(window.FR_ && window.FR_.touch) window.FR_.touch(); });
  // kết bạn với người chơi máy: gửi lời mời trước, một lúc sau họ mới chấp nhận (giống bạn bè thật)
  const PREQ = window.PREQ_ = (() => {
    const K = 'lendoi_preq', ld = () => { try { return JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch(e) { return {}; } }, sv = v => { try { localStorage.setItem(K, JSON.stringify(v)); } catch(e) {} };
    const tick = () => { const v = ld(), now = Date.now(); let ch = false;
      Object.keys(v).forEach(id => { const r = v[id]; if(now < r.due) return; delete v[id]; ch = true;
        if(PALS.add(id, r.n, r.k)){ SFX.play('join'); palToast(`🤝 ${r.n} đã chấp nhận lời mời kết bạn!`); paintQDot(); try { renderPals(); } catch(e) {} if(typeof renderChat==='function') try { renderChat(); } catch(e) {} } });
      if(ch) sv(v); };
    setInterval(tick, 4000);
    return { has: id => !!ld()[id], send(id, n, k){ const v = ld(); if(v[id] || PALS.list().some(x => x.id===id)) return false; v[id] = {n, k, due: Date.now() + (20 + Math.random()*70)*1000}; sv(v); return true; } };
  })();
  const palEgg = window.__palEgg = id => { const f = PALS.list().find(x => x.id===id); if(!f) return;
    if(EGG.n() < 1){ SFX.play('warn'); palToast('Hết trứng thối rồi! Mua thêm ở Cửa hàng 🥚'); return; } EGG.add(-1);
    if(f.pts >= 3) PALS.bump(f.n, -3); SFX.play('warn'); try { window.__bevt && window.__bevt(botMe(), f.n, null, 1); } catch(e) {} palToast(`🥚 Bạn ném trứng thối vào ${f.n}! Hảo cảm −3 😝 (còn ${EGG.n()} quả)`); renderPals(); };
  const avName = k => PAN[k] || (PREM[k] && PREM[k].n) || 'Nhân vật';
  // giới tính: ký hiệu nhỏ ♀ hồng, ♂ xanh (vẽ SVG cho đều nét)
  const FEM = ['Thu Hà','Bảo Ngọc','Lan Chi','Mai Phương','Hoài Thương','Khánh Linh','Ngọc Diệp','Phương Thảo','Anh Thư','Cẩm Tú','Yến Nhi','Kim Ngân','Bích Vân','Diễm My','Thuý Hằng'];
  const sexIcon = g => g==='f' ? '<svg class="sexi f" viewBox="0 0 24 24" aria-label="Nữ"><circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="3.2"/><path d="M12 15v8M8 19.5h8" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"/></svg>'
    : g==='m' ? '<svg class="sexi m" viewBox="0 0 24 24" aria-label="Nam"><circle cx="10" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="3.2"/><path d="M14.3 9.7L21 3" stroke="currentColor" stroke-width="3.2"/><path d="M14.5 2.5H21.5V9.5" fill="currentColor" stroke="none" transform="translate(0 0)"/><path d="M15 3h6v6z" fill="currentColor"/></svg>' : '';
  window.sexIcon = sexIcon;
  const openPal = row => {
    const sim = row.querySelector('[data-gift]'), real = row.querySelector('[data-frx],[data-fra],[data-frq]');
    let id, k = 0, nm = '', lv = 1, xp = 0, love = '', ttl = '', acts = '', g = '';
    if(sim){ id = sim.dataset.gift; const x = PALS.list().find(y => y.id===id) || PALS.who(id); k = x.k || 0; nm = x.n; lv = x.lv || 1; xp = ((+id || 0)*37 + lv*11) % 100; g = FEM.includes(x.n) ? 'f' : 'm';
      const L = PALS.lvl(x.pts || 0), t = PALS.TITLES.find(y => y.k===x.title), pct = L.next ? Math.round(((x.pts||0) - L.cur.min)/(L.next.min - L.cur.min)*100) : 100;
      love = `<div class="fpr"><span class="fpk">❤️ Hảo cảm</span><b class="fpv">${x.pts||0}</b><em class="fprel">${L.cur.n}</em></div><div class="fpbar love"><i style="width:${pct}%"></i></div><small class="fpnote">${L.next ? `Còn ${L.next.min - (x.pts||0)} điểm tới ${L.next.n}` : 'Thân thiết nhất rồi!'}</small>`;
      ttl = `<div class="fpr"><span class="fpk">🏅 Danh hiệu</span><span class="fpttl">${t && t.k ? `${t.i} ${t.n}` : '<i>Chưa có</i>'}</span><button class="fplink" data-title="${id}">Đổi ›</button></div>`;
      acts = `<button class="fpb rose" data-fl="${id}"><i>🌹</i><span>Tặng hoa</span></button><button class="fpb gift" data-gift="${id}"><i>🎁</i><span>Tặng quà</span></button><button class="fpb egg" data-egg="${id}"><i>🥚</i><span>Trứng thối</span></button><button class="fpb inv" data-invf="${id}"><i>✉️</i><span>Rủ chơi</span></button>`;
    } else if(real){ id = real.dataset.frx || real.dataset.fra || real.dataset.frq; const x = FR.info(id); k = x.av || 0; nm = x.n || 'Người chơi'; lv = x.lv || 1; xp = Math.max(0, Math.min(100, x.p || 0)); g = x.g || '';
      love = `<div class="fpr"><span class="fpk">👥 Bạn bè thật</span><span class="fpttl">Kết nối qua máy chủ</span></div>`;
      ttl = `<div class="fpr"><span class="fpk">🏅 Danh hiệu</span><span class="fpttl">${x.t ? esc(x.t) : '<i>Chưa có</i>'}</span></div>`;
      acts = real.dataset.frx ? `<button class="fpb wide" data-frx="${id}"><i>✕</i><span>Hủy kết bạn</span></button>` : real.dataset.fra ? `<button class="fpb wide inv" data-fra="${id}"><i>🤝</i><span>Đồng ý kết bạn</span></button>` : `<button class="fpb wide inv" data-frq="${id}"><i>➕</i><span>Kết bạn</span></button>`;
    } else return;
    const bg = AV.bg(k), keep = AVMAP; AVMAP = null;
    const body = `<div class="fpro"><div class="fpL"><div class="fpstage" style="--sa:${bg[0]};--sb:${bg[1]}"><span class="fpscene">${AV.scene(k)}</span><span class="fpfig">${AV.full(k, '')}</span></div>
        <div class="fpname"><b>${esc(nm)}</b><small>${sexIcon(g)}${avName(k)} · ID ${id}</small></div></div>
      <div class="fpR"><div class="fpcard"><div class="fpr"><span class="fplv">Cấp ${lv}</span><div class="fpbar xp"><i style="width:${xp}%"></i></div><b class="fpv">${xp}%</b></div>
        ${love}${ttl}</div><div class="fpacts">${acts}</div></div></div>`;
    AVMAP = keep;
    openModal('👤 Hồ sơ bạn bè', body, [], 'one fpdlg');
    document.getElementById('mBody').onclick = e => { const b = e.target.closest('button'); if(!b || b.dataset.invf) return;
      if(b.dataset.egg){ closeModal(); palEgg(b.dataset.egg); return; }
      const key = ['fl','gift','title','frx','fra','frq'].find(x => b.dataset[x]!=null); if(!key) return;
      closeModal(); const o = row.querySelector(`[data-${key}="${b.dataset[key]}"]`); if(o) o.click(); };
  };
  ['frList','frReal'].forEach(id => document.getElementById(id).addEventListener('click', e => {
    const eg = e.target.closest('[data-egg]'); if(eg){ palEgg(eg.dataset.egg); return; }
    if(e.target.closest('button')) return; const row = e.target.closest('.frc.mine, .frc.rl'); if(row){ SFX.play('click'); openPal(row); } }));
  const palGift = (id, k) => { const r = PALS.gift(id, k); if(!r) return; if(r.err){ palToast('Không đủ xu, cần ' + r.cost + ' 🪙'); SFX.play('warn'); return; }
    SFX.play(r.up ? 'levelup' : 'coin'); palToast(`${r.g.i} +${r.g.v} thân mật` + (r.up ? ' · Lên mức ' + r.up + '!' : '')); renderPals(); paintQDot(); };
  document.getElementById('frTabs').onclick = e => { const b = e.target.closest('[data-t]'); if(!b) return; palTab = b.dataset.t; SFX.play('click'); renderPals(); };
  document.getElementById('frGo').onclick = () => { FR.search(document.getElementById('frQ').value); renderPals(); };
  document.getElementById('frQ').addEventListener('keydown', e => { if(e.key==='Enter') renderPals(); });
  document.getElementById('frList').onclick = e => {
    const a = e.target.closest('[data-add]'); if(a){ const w = PALS.who(a.dataset.add); if(PREQ.send(a.dataset.add, w.n, w.k)){ SFX.play('pop'); palToast('Đã gửi lời mời kết bạn tới ' + w.n); a.disabled = true; a.classList.remove('primary'); a.textContent = '✓ Đã gửi'; } return; }
    const fl = e.target.closest('[data-fl]'); if(fl){ palGift(fl.dataset.fl, 'rose'); return; }
    const g = e.target.closest('[data-gift]'); if(g){ const id = g.dataset.gift, w = PALS.who(id);
      openModal('🎁 Tặng quà cho ' + w.n, `<div class="frgifts">${PALS.GIFTS.map(x => `<button class="frgift" data-g="${x.k}"><span>${x.i}</span><b>${x.n}</b><small>+${x.v} thân mật</small><em>${x.p} 🪙</em></button>`).join('')}</div><p class="say">Bạn đang có ${STORE.coins} 🪙. Tặng Nhẫn cưới là điều kiện để kết hôn.</p>`, [{label:'Đóng', primary:true, fn: closeModal}], 'one sys');
      document.getElementById('mBody').onclick = ev => { const b = ev.target.closest('[data-g]'); if(!b) return; closeModal(); palGift(id, b.dataset.g); }; return; }
    const t = e.target.closest('[data-title]'); if(t){ const id = t.dataset.title, f = PALS.list().find(x => x.id===id); if(!f) return;
      openModal('🏅 Danh hiệu với ' + f.n, `<div class="frtitles">${PALS.TITLES.map(x => { const why = x.k ? PALS.canTitle(f, x) : ''; return `<button class="frtitle ${f.title===x.k ? 'on' : ''}" data-tt="${x.k}" ${why ? 'disabled' : ''}><span>${x.i || '✕'}</span><b>${x.n}</b><small>${why || (x.k ? 'Đã mở' : 'Gỡ danh hiệu')}</small></button>`; }).join('')}</div><button class="btn frdel" data-del="1">Hủy kết bạn</button>`, [{label:'Đóng', primary:true, fn: closeModal}], 'one sys');
      document.getElementById('mBody').onclick = ev => { const b = ev.target.closest('[data-tt]'); if(b && !b.disabled){ if(PALS.setTitle(id, b.dataset.tt)){ SFX.play(b.dataset.tt==='kethon' ? 'win' : 'click'); if(b.dataset.tt==='kethon') palToast('💍 Chúc mừng! Bạn và ' + f.n + ' đã kết hôn'); closeModal(); renderPals(); paintQDot(); } return; }
        if(ev.target.closest('[data-del]')){ PALS.remove(id); closeModal(); palToast('Đã hủy kết bạn với ' + f.n); renderPals(); } }; }
  };
  document.querySelectorAll('[data-go="pals"]').forEach(b => b.addEventListener('click', () => { palTab = 'mine'; renderPals(); }));
  // ----- Kênh thế giới: thông báo chạy ở trang chính, tin tuyển người (bản thử: tin của người khác là mô phỏng)
  document.addEventListener('click', e => { const b = e.target.closest('[data-pal]'); if(!b || !S) return; const p = S.players[+b.dataset.pal]; if(!p) return;
    if(PREQ.send(PALS.idOf(p.name), p.name, (S.avs && S.avs[p.id]!=null) ? S.avs[p.id] : p.id%4)){ SFX.play('pop'); palToast('Đã gửi lời mời kết bạn tới ' + p.name); b.disabled = true; b.textContent = '✓ Đã gửi'; } else palToast('Đã gửi lời mời rồi, chờ ' + p.name + ' chấp nhận nhé'); });
  const FEED = (() => {
    const L = [], KIND = {rank1:{i:'🏆', t:'tuyển người leo Xếp hạng đơn', go:'rank'}, rank2:{i:'🤝', t:'tuyển đồng đội Xếp hạng đôi', go:'rank'}, room:{i:'🎲', t:'tuyển 3 người chơi phòng riêng', go:'friend'}};
    const SYS = [n => `🎉 ${n} vừa nổ hũ Quỹ`, n => `✈️ ${n} vừa thành Ông trùm hàng không`, n => `💍 ${n} vừa kết hôn`, n => `🥇 ${n} vừa lên hạng Vàng`, n => `🏙️ ${n} vừa xây cao ốc thứ 10`, n => `⚡ ${n} vừa cắt điện nước đối thủ`];
    const push = m => { m.at = Date.now(); L.unshift(m); if(L.length > 20) L.pop(); };
    const fake = () => { if(!L.length) push({k:'sys', who:'', text:'🎲 Chào mừng tới Lên Voi Xuống Chó! Chạm vào đây để chat với mọi người'}); return; const n = PALS.rndName() + ' 🤖'; /* người chơi máy: luôn gắn nhãn 🤖 */ if(Math.random() < .55){ const ks = (IS_APP && !window.FB_CFG) ? ['rank1','rank2'] : ['rank1','rank2','room'], k = ks[Math.floor(Math.random()*ks.length)]; push({k, who:n, text:`${KIND[k].i} ${n} ${KIND[k].t}`}); } else push({k:'sys', who:n, text:SYS[Math.floor(Math.random()*SYS.length)](n)}); };
    for(let k=0;k<2;k++) fake();
    return { L, KIND, fake, say(who, text){ push({k:'sys', who, mine:1, text:`📣 ${who}: ${text}`}); }, post(k){ const n = STORE.name || 'Bạn'; push({k, who:n, mine:1, text:`${KIND[k].i} ${n} ${KIND[k].t}`}); } };
  })();
  let tkN = 0;
  const tkNext = () => { const el = document.getElementById('tkText'); if(!el) return; const m = FEED.L[tkN % FEED.L.length]; tkN++; el.textContent = m.text; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; };
  document.getElementById('tkText').addEventListener('animationend', () => { if(Math.random() < .5) { FEED.fake(); tkN = 0; } tkNext(); });
  tkNext();
  // ----- Phòng chat: Thế giới, Nhóm, Bạn bè, Tìm phòng (bản thử: người khác là mô phỏng, tin lưu trên máy)
  const CHAT = (() => {
    const KEY = 'lendoi_chat'; let d = {world:[], group:[], dm:{}};
    try { d = Object.assign(d, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch(e) {} d.dm = d.dm || {};
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch(e) {} };
    const put = (L, m) => { m.at = Date.now(); L.push(m); if(L.length > 40) L.shift(); save(); };
    const WORLD = ['Ai chơi Xếp hạng đôi không?', 'Vừa nổ hũ 500, sướng quá', 'Hôm nay cửa hàng có Rồng kìa', 'Cho xin vía Ông trùm hàng không', 'Thua 3 ván liền rồi huhu', 'Kết bạn với mình đi mọi người', 'Mới lên cấp 10 nè', 'Có ai bị cắt điện nước hoài như tui không 😂', 'Rút trúng thẻ Mổ trĩ, cười xỉu', 'Tối nay ai leo hạng chung không?'];
    const REPLY = ['Ok nha!', 'Vào chơi một ván không?', 'Haha 😆', 'Đợi xíu mình vào liền', 'Tặng hoa cho mình đi 🌹', 'Tối nay leo hạng nhé', 'Chơi phòng riêng đi, mình tạo phòng', 'Đang ăn cơm, lát nha'];
    d.world = [];   /* kênh Thế giới thật (Firebase: world/) + người chơi máy trò chuyện chỉ hiện trên máy mình */
    const BW = ["Ai leo hạng tối nay không, mình đang Vàng 2 😭", "Vừa nổ hũ Quỹ, hên dữ thần", "Có ai bị cắt điện nước hoài như tui không 😂", "Mua được Hoàn Kiếm rồi, giàu rồi ae ơi", "Thua 3 ván liền, chắc đi ngủ thôi", "Rút trúng thẻ vào tù 2 lần liên tiếp, đời 🥲", "Ai chỉ mình cách gom đủ 4 sân bay với", "Sáng nay trời Hà Nội se se lạnh ghê", "Trưa nay ăn bún bò, chiều chơi 2 ván cho tiêu cơm", "Mới lên cấp 12, vui quá trời", "Ai bán rẻ cho mình ô Đà Lạt hông 😆", "Ván nhanh 20 vòng là chân ái", "Hôm nay sếp đi vắng, làm 1 ván đã 🤫", "Có ai Sài Gòn mưa to không", "Xúc xắc hôm nay ghét tui ghê", "Kết bạn với mình đi mọi người ơi", "Cuối tuần rảnh quá, ai rủ đi cà phê không 😅", "Đang chờ xe buýt, làm 1 ván cho đỡ chán", "Vừa xây cao ốc ở Hạ Long, ai dừng là toang", "Ai còn thức không, mất ngủ quá", "Trà sữa full topping + Lên Voi Xuống Chó = cuối tuần hoàn hảo", "Mèo nhà mình vừa đạp đổ ly cà phê lên bàn phím 🙀", "Bị Cao thủ cắt điện 3 lần một ván, ức ghê", "Ai đánh Xếp hạng đôi không, mình hơi gà nhưng chăm", "Lương về rồi, mua liền gói trang phục mới", "Có ai gặp Tỷ Phú Tương Lai chưa, chơi khôn dữ", "Mai thi rồi mà vẫn ngồi đây 😭", "Chúc cả nhà buổi tối vui vẻ nha", "Mẹ kêu đi ngủ mà còn 3 vòng nữa", "Bạn nào ở Đà Nẵng không, giao lưu chút", "Vừa thắng ván dài 60 vòng, mỏi tay luôn", "Có ai thấy thẻ Khí vận hôm nay keo kiệt không", "Đậu xe sai chỗ bị phạt, giống y vào ô Thuế 😂", "Hôm nay mưa, ở nhà chơi game là nhất", "Mình mới chơi, có mẹo gì không mọi người", "Ai tạo phòng cho mình vào với 🙏"], BC = [["Có ai biết mua ô nào lời nhất không?", "Gom đủ nhóm màu trước, có huy hiệu là lời liền"], ["Ủa sao mình vào tù hoài vậy 😭", "Do xúc xắc ghét bạn á, mình cũng vậy"], ["Ăn tối chưa mọi người?", "Vừa ăn cơm tấm xong, giờ làm ván nè"], ["Ai rảnh vào phòng mình không?", "Gửi ID đi, mình vào liền"], ["Hôm nay ai thắng nhiều nhất vậy?", "Mình thắng 2 thua 4 😅"], ["Trời nóng quá trời luôn", "Bật quạt chơi game thôi chứ biết sao"], ["Có nên vay ngân hàng mua đất không?", "Vay ít thôi, nhớ trả kẻo bị siết nợ đó"], ["Sao mấy ô sân bay đắt vậy", "Đủ 3 cái là bay đi đâu cũng được, đáng lắm"], ["Mai đi làm sớm mà giờ chưa ngủ", "Một ván cuối thôi rồi ngủ nha 😂"], ["Ai ở Huế không?", "Mình nè, Huế mưa suốt luôn"], ["Ván nhanh hay ván dài vui hơn?", "Ván nhanh, có sẵn 2 ô đất nên vào việc liền"], ["Cuối tuần này có sự kiện gì không ta", "Nghe nói sắp có sự kiện mới, hóng quá"], ["Mình vừa bị phá sản 😭", "Không sao, ván sau gỡ lại, mình phá sản 3 lần rồi"], ["Có ai nuôi mèo không?", "Nuôi 2 bé, ngồi chơi game là nằm đè lên tay"], ["Xin vía nổ hũ với ạ", "Vía đây, chúc bạn nổ to 🍀"], ["Cao ốc nào thu tiền thuê nhiều nhất vậy?", "Hoàn Kiếm với Nguyễn Huệ, dừng là khóc"]], BR2 = ["Chào bạn nha 👋", "Hello, vào chơi một ván không?", "Haha đúng rồi đó", "Đồng ý luôn", "Bạn ở đâu vậy?", "Ok nha bạn", "Gửi ID phòng đi mình vào", "Chuẩn luôn 😂", "Kết bạn với mình nha"];
    const bwho = () => { const i = Math.floor(Math.random()*BOTPOOL.length); return {who:BOTPOOL[i][0], pa:BOTPOOL_IMG[i] || '', k:i % 7}; };
    const bpost = (b, text, at) => { if(window.__bstyle) text = window.__bstyle(b.who, text); const bi = BOTPOOL.findIndex(x => x[0]===b.who), m = {who:b.who, text,at:at || Date.now(), me:0, k:b.k, ft:'', pa:b.pa, bot:1, r:bi < 0 ? 0 : botRows('rp')[bi].v, hr:1}; d.world.push(m); d.world.sort((x,y) => x.at - y.at); if(d.world.length > 40) d.world.shift(); if(!at && Math.random() < .5) FEED.say(m.who, m.text); try { window.__worldChanged && window.__worldChanged(); } catch(e) {} };
    const BT3 = [["Có ai thức không, buồn quá", "Tui nè, mất ngủ", "Vô làm ván đi hai ông", "Ok vô"], ["Ủa sao nay mua đất toàn bị người ta mua trước", "Chậm tay thì chịu thôi", "Lần sau gieo lẹ lên 😂"], ["Vừa bị ném trứng thối, ai ném tui vậy 😤", "Không phải tui nha", "Tui đó, ai biểu hôm qua giành đất tui 😏", "Đợi đó 😤"], ["Leo rank khó quá trời", "Đánh đấu đôi dễ lên hơn", "Ghép với cao thủ là bay rank luôn"], ["Nay sinh nhật tui nè", "Chúc mừng sinh nhật nha 🎂", "HPBD, tặng quà đi mọi người", "Để tui tặng bó hoa 🌹"], ["Ai ở Sài Gòn mưa không", "Mưa quá trời, ngập tới gối", "Ở nhà chơi game là chuẩn bài"], ["Ăn gì giờ này ta", "Mì gói thần thánh", "Bánh tráng trộn nha", "Đói mà nghèo, thôi uống nước 😂"], ["Sắp lương về rồi ae", "Lương về là nạp kim cương hả 😆", "Lương về là trả nợ ông ơi"], ["Có ai biết cách gom 4 sân bay không", "Gặp là mua liền, đừng tiếc tiền", "Có 3 cái là bay đâu cũng được rồi"], ["Mới lên Bạc nè ae", "Chúc mừng, tui kẹt Đồng cả tuần", "Ráng lên, Vàng đang chờ đó"], ["Ông nào vừa giành Hạ Long của tui ra đây", "Không phải tui 😇", "Tui đó, sao 😏", "Ván sau biết tay 😤"], ["Có ai chơi đấu đôi không, thiếu 1 người", "Tui nè", "Cho tui theo với"], ["Mấy bà nuôi chó hay mèo", "Mèo, lười như chủ", "Chó, sáng nào cũng kêu dậy đi làm", "Nuôi cá cho đỡ mệt 😂"], ["Hôm qua thắng 5 ván liền nè", "Xạo quá 😂", "Thiệt mà, có ảnh làm chứng", "Cho xin vía đi"]], BTH = ["Cảm ơn nha 🥰", "Ui quà nè, thương quá", "Ghê, được tặng quà luôn", "Cảm ơn nha, mai tặng lại"], BEG = ["Ai ném tui đó 😤", "Ê thôi nha 😤", "Trứng thối hôi quá trời 🤢", "Đợi đó, ném lại liền"];
    const bnamed = n => { const i = BOTPOOL.findIndex(b => b[0]===n); return i < 0 ? null : {who:n, pa:BOTPOOL_IMG[i] || '', k:i % 7}; };
    window.__wsys = text => { d.world.push({sys:1, who:'', text, at:Date.now(), me:0}); d.world.sort((x,y) => x.at - y.at); if(d.world.length > 40) d.world.shift(); try { window.__worldChanged && window.__worldChanged(); } catch(e) {} };
    window.__bsay = (name, text, delay) => { const b = bnamed(name); if(b) setTimeout(() => bpost(b, text), delay || 0); };
    window.__bevt = (giver, to, g, egg) => { window.__wsys(egg ? `🥚 ${giver} ném trứng thối vào ${to}` : `🎁 ${giver} tặng ${g.i} ${g.n} cho ${to}`);   /* thông báo trên kênh Thế giới, người nhận đáp lại */
      if(bnamed(to)) window.__bsay(to, (egg ? BEG : BTH)[Math.floor(Math.random()*(egg ? BEG : BTH).length)], 3500 + Math.random()*5000); };
    const bthread = () => { const T = BT3[Math.floor(Math.random()*BT3.length)], who = []; while(who.length < Math.min(3, T.length)){ const b = bwho(); if(!who.some(x => x.who===b.who)) who.push(b); }
      let t = 0; T.forEach((s, j) => { t += j ? 3000 + Math.random()*6000 : 0; const b = j===T.length-1 && T.length>3 ? who[0] : who[j % who.length]; setTimeout(() => bpost(b, s), t); }); };
    const btick = () => { if(typeof BOTPOOL==='undefined' || !BOTPOOL.length) return; if(Math.random() < .35){ bthread(); return; } if(Math.random() < .45){ const c = BC[Math.floor(Math.random()*BC.length)]; bpost(bwho(), c[0]); setTimeout(() => bpost(bwho(), c[1]), 3000 + Math.random()*7000); } else bpost(bwho(), BW[Math.floor(Math.random()*BW.length)]); };
    const bloop = () => { if(!document.hidden) btick(); setTimeout(bloop, 18000 + Math.random()*30000); };
    if(typeof document!=='undefined') setTimeout(() => { if(typeof BOTPOOL==='undefined') return; for(let i=0;i<7;i++) bpost(bwho(), BW[Math.floor(Math.random()*BW.length)], Date.now() - (7-i)*(60000 + Math.random()*90000)); bloop(); }, 2500);
    window.__botReply = text => { if(typeof BOTPOOL==='undefined') return; const n = 1 + (Math.random() < .45 ? 1 : 0);
      const tl = String(text).toLowerCase(), nb = BOTPOOL.find(x => x[0].length >= 3 && tl.includes(x[0].toLowerCase()));   /* nhắc tên máy nào thì máy đó trả lời */
      for(let i=0;i<n;i++) setTimeout(() => { const b = i===0 && nb ? bnamed(nb[0]) : bwho(), r = window.__smartReply(text, 'world'); bpost(b, (botMe()!=='bạn' && Math.random() < .35 ? '@' + botMe() + ' ' : '') + r.text);
        if(r.follow) setTimeout(() => bpost(b, r.follow), 3000 + Math.random()*3000);
        if(i===0 && (r.play || r.friend) && window.__botAct) setTimeout(() => window.__botAct(r.play ? 'play' : 'req', b.who), 2500); }, 3000 + i*4500 + Math.random()*4000); };
    let wref = null;
    const wstart = async () => { if(wref || !FBNET.ok()) return; try { const db = await FBNET.db(); wref = db.ref('world').orderByChild('at').limitToLast(40);
        wref.on('child_added', sn => { const x = sn.val() || {}, myId = window.FR_ ? window.FR_.uid() : '';
          const m = {who:String(x.n || 'Người chơi').slice(0,20), text:String(x.t || '').slice(0,80), at:+x.at || Date.now(), me:x.id===myId ? 1 : 0, k:Math.max(0, Math.min(6, +x.k || 0)), ft:typeof x.ft==='string' ? x.ft.slice(0,60) : '', id:/^\d{8}$/.test(x.id || '') ? x.id : '', r:Math.max(0, +x.r || 0), hr:x.r!=null};
          d.world.push(m); if(d.world.length > 40) d.world.shift();
          if(!m.me && Date.now() - m.at < 90000) FEED.say(m.who, m.text);
          try { window.__worldChanged && window.__worldChanged(); } catch(e) {} });
      } catch(e) { wref = null; } };
    const wsend = async text => { const db = await FBNET.db(); let k = 0; try { k = window.savedPick ? (window.savedPick() || 0) : 0; } catch(e) {}
      await db.ref('world').push({u:FBNET.uid(), id:window.FR_ ? window.FR_.uid() : '', n:(STORE.name || 'Người chơi').slice(0,20), k, ft:(STORE.fit || '').slice(0,60), r:Math.max(0, Math.min(99999, +STORE.rp || 0)), t:String(text).slice(0,80), at:firebase.database.ServerValue.TIMESTAMP}); };   window.WSEND = wsend;
    { let tries = 0; const go = () => { if(wref) return; if(FBNET.ok()) wstart(); if(++tries < 20) setTimeout(go, 3000); }; setTimeout(go, 1500); }
    const pick = A => A[Math.floor(Math.random()*A.length)];
    return { d, pick, REPLY,
      world(text){ try { window.__botReply && window.__botReply(text); } catch(e) {} wsend(text).catch(() => { window.palToast && palToast('Chưa gửi được lên kênh Thế giới, thử lại nhé'); STORE.addLoa(1); }); },
      worldFake(){},
      group(text, who){ put(d.group, who ? {who, text} : {who:STORE.name || 'Bạn', me:1, text}); },
      dm(id, text, mine){ d.dm[id] = d.dm[id] || []; put(d.dm[id], mine ? {me:1, text} : {text}); },
      last(id){ const L = d.dm[id]; return L && L.length ? L[L.length-1] : null; } };
  })();
  window.HUBX = {CHAT, FEED, PALS, kOf: name => { const id = PALS.byName(name) || PALS.idOf(name); return PALS.who(id).k; }, av: (k, ft) => palAV(k, ft)};
  document.getElementById('chatPrev').onclick = () => { const b = document.getElementById('chatBtn'); if(b) b.click(); setTimeout(renderChat, 60); };
  document.getElementById('cTabs').onclick = e => { const b = e.target.closest('[data-ct]'); if(!b) return; chatTab = b.dataset.ct; SFX.play('click'); renderChat(); };
  document.getElementById('chat').addEventListener('click', e => { const b = e.target.closest('[data-cdm]'); if(!b) return; chatDm = b.dataset.cdm || null; renderChat(); });
  window.__worldChanged = () => { try { if(hubOn && hubTab==='world') renderHub(); } catch(e) {} try { const sh = document.getElementById('sheetC'); if(S && sh && !sh.hidden && chatTab==='world') renderChat(); } catch(e) {} };
  let hubTab = 'world', hubDm = null, hubOn = false;
  const hubK = name => { try { return window.HUBX.kOf(name) || 0; } catch(e) { return 0; } };
  const hubRow = m => { if(m.sys) return `<div class="hsys">${esc(m.text)}</div>`; const k = m.me ? (savedPick() || 0) : (m.k!=null ? m.k : hubK(m.who || '')), ft = m.me ? STORE.fit : (m.ft || '');
    const rk = m.me ? tierOf(+STORE.rp || 0).k : m.hr ? tierOf(m.r).k : -1, rt = rk >= 0 ? TIERS[rk] : null;   /* hạng của người nói */
    const pf = m.me ? '' : m.id ? `data-uprof="${m.id}"` : m.bot ? `data-bprof="${esc(m.who || '')}"` : '';
    return `<div class="hmsg ${m.me ? 'me' : ''}"><span class="havw${rt ? ' rkf' : ''}" style="--tc:${rt ? rt.c : 'transparent'}"><span class="hav" style="--c:${PC[k%4]}" ${pf}>${m.pa ? `<img class="avph" src="${m.pa}" alt="">` : palAV(k, ft)}</span>${rt ? `<i class="rkb" title="${rt.n}">${TBADGE(rk)}</i>` : ''}</span><div class="hbx">${m.who && !m.me ? `<b style="--c:${PC[k%4]}" ${pf}>${esc(m.who)}${rt ? `<em class="rkn" style="--tc:${rt.c}">${rt.n}</em>` : ''}${PALS.badge(m.who) ? ` <i>${PALS.badge(m.who)}</i>` : ''}</b>` : ''}<p class="hbub">${esc(m.text)}</p></div></div>`; };
  const botProf = name => {   /* hồ sơ người chơi máy: ảnh, cấp, hạng, nút kết bạn (lời mời lưu trên máy) */
    const i = typeof BOTPOOL==='undefined' ? -1 : BOTPOOL.findIndex(b => b[0]===name); if(i < 0) return;
    const lv = botRows('lv')[i].v, rp = botRows('rp')[i].v, tr = tierOf(rp), ph = BOTPOOL_IMG[i] || '';
    let sent = {}; try { sent = JSON.parse(localStorage.getItem('lendoi_botfr') || '{}'); } catch(e) {} const isFr = !!(window.PALS && window.PALS.has(window.PALS.idOf(name)));
    const prog = tr.next ? Math.round((rp - tr.t.min)/(tr.next.min - tr.t.min)*100) : 100;
    openModal('Hồ sơ người chơi', `<div class="pvw" style="--tc:${tr.t.c}">
        <div class="pwL"><div class="pwav">${ph ? `<img src="${ph}" alt="">` : `<span class="pwani">${palAV(i % 7, '')}</span>`}<span class="pwlv">${lv}</span></div>
          <b class="pwn">${esc(name)}</b><span class="pwtag">#7${window.PALS ? window.PALS.idOf(name) : i}3</span>
          <button type="button" class="pwfb ${isFr ? 'fr' : sent[name] ? 'sent' : 'add'}" data-bfr="1" ${isFr || sent[name] ? 'disabled' : ''}>${isFr ? '<i>✓</i>Bạn bè' : sent[name] ? '<i>⏳</i>Đã gửi lời mời' : '<i>＋</i>Kết bạn'}</button></div>
        <div class="pwR"><div class="pwstat">
            <div class="pwtier"><span class="pwbd">${TBADGE(tr.k, 1)}</span><div><small>Hạng</small><b>${tr.t.n}</b><i><u style="width:${prog}%"></u></i><em>${rp} điểm${tr.next ? ' · còn ' + (tr.next.min - rp) + ' lên ' + tr.next.n : ''}</em></div></div>
            <div class="pwlvl"><small>Cấp</small><b>${lv}</b><i><u style="width:${(i * 37) % 90 + 5}%"></u></i></div></div>
          <div class="pwph"><small>📷 Ảnh · 0/4</small><div class="pwgrid">${[0,1,2,3].map(() => '<span class="pwp none">📷</span>').join('')}</div></div></div>
        <button type="button" class="pwx" data-pwx="1" aria-label="Đóng">✕</button></div>`, [], 'one sys pvwdlg');
    const mb = document.getElementById('mBody'); if(!mb) return;
    mb.onclick = e => { if(e.target.closest('[data-pwx]')){ closeModal(); return; }
      const b = e.target.closest('[data-bfr]'); if(!b || b.disabled) return; SFX.play('pop');
      sent[name] = Date.now(); try { if(window.PREQ_) window.PREQ_.send(window.PALS.idOf(name), name, i % 7); } catch(e) {} try { localStorage.setItem('lendoi_botfr', JSON.stringify(sent)); } catch(e) {}
      b.disabled = true; b.className = 'pwfb sent'; b.innerHTML = '<i>⏳</i>Đã gửi lời mời'; palToast('Đã gửi lời mời kết bạn tới ' + name); };
  };
  document.addEventListener('click', e => { const r = e.target.closest('.hmsg [data-uprof], .hmsg [data-bprof]'); if(!r) return; SFX.play('pop');
    if(r.dataset.uprof){ if(window.PH_) window.PH_.view(r.dataset.uprof); } else botProf(r.dataset.bprof); });
  const renderHub = () => {
    const box = document.getElementById('hub'); if(!box || !hubOn) return;
    const ago = t => { const s = Math.floor((Date.now()-t)/1000); return s < 60 ? 'vừa xong' : s < 3600 ? Math.floor(s/60) + ' phút trước' : Math.floor(s/3600) + ' giờ trước'; };
    const tabs = [['world','🌍','Thế giới'],['dm','💬','Bạn bè'],['room','📢','Tìm phòng']].map(t => `<button class="ht-${t[0]} ${hubTab===t[0] ? 'on' : ''}" data-ht="${t[0]}"><i>${t[1]}</i><span>${t[2]}</span></button>`).join('');
    const fr = PALS.list(); let body = '', input = true, note = '';
    if(hubTab==='world'){ body = CHAT.d.world.map(hubRow).join(''); note = 'Kênh chung của mọi người chơi.'; }
    else if(hubTab==='group'){
      if(!fr.length){ body = '<p class="say">Nhóm của bạn gồm những người bạn đã kết bạn. Hãy kết bạn trước nhé!</p>'; input = false; }
      else { body = `<div class="hgrp">👥 Nhóm của tôi · ${fr.length + 1} thành viên: ${fr.slice(0,5).map(x => esc(x.n)).join(', ')}${fr.length>5 ? '...' : ''}</div>` + (CHAT.d.group.map(hubRow).join('') || '<p class="say">Chưa có tin nào. Rủ cả nhóm vào chơi đi!</p>'); }
      note = 'Chat chung với tất cả bạn bè của bạn.'; }
    else if(hubTab==='dm'){
      const dfr = window.RDM_ ? window.RDM_.list() : [], f = hubDm && dfr.find(x => x.id===hubDm); if(window.RDM_) window.RDM_.setOpen(f ? f.id : null);
      if(!f){ hubDm = null; input = false; body = dfr.length ? dfr.map(x => { const l = RDM_.last(x.id), un = RDM_.unread(x.id); return `<button class="hfr" data-dm="${x.id}"><span class="frav" style="--c:${PC[x.k%4]}">${x.pa ? `<img class="avph" src="${x.pa}" alt="">` : palAV(x.k, x.ft)}</span><span class="hfn"><b>${esc(x.n)}</b><small>${l ? (l.me ? 'Bạn: ' : '') + esc(l.text) : 'Chạm để nhắn tin'}</small></span>${un ? `<em class="dmun">${un}</em>` : ''}</button>`; }).join('') : '<p class="say">Bạn chưa có bạn bè thật. Kết bạn ở mục Bạn bè để nhắn tin với nhau.</p>'; note = 'Bạn bè thật, nhắn riêng chỉ hai người thấy.'; }
      else { body = `<button class="hback" data-dm="">‹ ${esc(f.n)}</button>` + (RDM_.msgs(f.id).map(m => hubRow(Object.assign({who:m.me ? (STORE.name || 'Bạn') : f.n}, m))).join('') || '<p class="say">Gửi lời chào đầu tiên đi!</p>'); note = 'Nhắn riêng, chỉ hai người thấy.'; } }
    else { input = false; note = 'Bấm Tham gia để tới đúng màn chơi.';
      body = `<div class="wpost"><b>Đăng tin tuyển người</b><div class="wbtns"><button class="btn" data-post="room">🎲 Phòng riêng</button><button class="btn" data-post="rank1">🏆 Xếp hạng đơn</button><button class="btn" data-post="rank2">🤝 Xếp hạng đôi</button></div></div><div class="wlist">${FEED.L.map((m,n) => `<div class="wrow ${m.mine ? 'mine' : ''} ${m.k==='sys' ? 'sys' : ''}"><div><b>${esc(m.text)}</b><small>${ago(m.at)}</small></div>${m.k!=='sys' && !m.mine ? `<button class="btn primary" data-join="${n}">Tham gia</button>` : ''}</div>`).join('')}</div>`; }
    const keep = document.getElementById('hubIn'), val = keep ? keep.value : '', foc = keep && document.activeElement===keep;
    box.innerHTML = `<div class="hside"><div class="htabs">${tabs}</div><p class="hnote">${note}</p></div>`
      + `<div class="hmain"><div class="hbody" id="hubBody">${body}</div>${input ? `<div class="hin"><input id="hubIn" maxlength="80" placeholder="${hubTab==='world' ? `Nói trên Thế giới (còn ${STORE.loa} loa)` : 'Nhập tin nhắn'}" aria-label="Nhập tin nhắn"><button class="btn primary" id="hubSend" aria-label="Gửi">${hubTab==='world' ? '📣' : '➤'}</button></div>` : ''}</div>`;
    const hb = document.getElementById('hubBody'); if(hubTab!=='room' && !(hubTab==='dm' && !hubDm)) hb.scrollTop = hb.scrollHeight;
    const inp = document.getElementById('hubIn'); if(inp){ inp.value = val; if(foc) inp.focus(); inp.onkeydown = e => { if(e.key==='Enter') hubSend(); }; document.getElementById('hubSend').onclick = hubSend; }
  };
  const hubSend = () => { const inp = document.getElementById('hubIn'), t = inp ? inp.value.trim() : ''; if(!t) return; inp.value = ''; SFX.play('chat');
    if(hubTab==='world'){ if(STORE.loa < 1){ inp.value = t; SFX.play('warn');
        // hết loa: hỏi có muốn vào Cửa hàng mua loa không
        openModal('📣 Hết loa rồi', '<p>Nói trên kênh Thế giới cần <b>1 loa</b> mỗi câu. Bạn đang hết loa.</p>', [
          {label:'Mua loa ở Cửa hàng', primary:true, fn: () => { hubOn = false; closeModal(); const sb = document.querySelector('[data-go="shop"]'); if(sb) sb.click(); if(window.shopTab) window.shopTab('loa'); }},
          {label:'Để sau', fn: () => { closeModal(); openWorld('world'); }}]);
        return; }
      STORE.addLoa(-1); CHAT.world(t); FEED.say(STORE.name || 'Bạn', t); tkN = 0; tkNext(); }
    else if(hubTab==='group'){ CHAT.group(t); const fr = PALS.list(); if(fr.length) setTimeout(() => { CHAT.group(CHAT.pick(CHAT.REPLY), CHAT.pick(fr).n); renderHub(); }, 1400); }
    else if(hubTab==='dm' && hubDm && window.RDM_){ window.RDM_.send(hubDm, t).catch(() => palToast('Chưa gửi được tin, thử lại nhé')); }
    renderHub(); };
  window.__dmChanged = () => { try { if(hubOn && hubTab==='dm') renderHub(); } catch(e) {} try { if(chatTab==='dm') renderChat(); } catch(e) {} };
  window.__openDm = id => { if(document.body.classList.contains('ingame')){ chatTab = 'dm'; chatDm = id; const sh = document.getElementById('sheetC'); if(sh && sh.hidden) document.getElementById('chatBtn').click(); else renderChat(); } else { hubDm = id; openWorld('dm'); } };
  const openWorld = tab => {
    if(typeof tab==='string') hubTab = tab; hubOn = true;
    openModal('💬 Phòng chat', '<div id="hub"></div>', [{label:'Đóng', primary:true, fn: () => { hubOn = false; closeModal(); }}], 'one sys qbig hubdlg');
    renderHub();
    document.getElementById('mBody').onclick = e => {
      const t = e.target.closest('[data-ht]'); if(t){ hubTab = t.dataset.ht; SFX.play('click'); renderHub(); return; }
      const dm = e.target.closest('[data-dm]'); if(dm){ hubDm = dm.dataset.dm || null; renderHub(); return; }
      const hl = e.target.closest('[data-hloa]'); if(hl){ if(!hl.disabled && STORE.coins >= LOA_P){ STORE.add(-LOA_P); STORE.addLoa(1); SFX.play('buy'); paintCoins(); renderHub(); } return; }
      const p = e.target.closest('[data-post]'); if(p){ FEED.post(p.dataset.post); tkN = 0; tkNext(); SFX.play('chat'); palToast('Đã đăng tin tuyển người'); renderHub(); return; }
      const j = e.target.closest('[data-join]'); if(j){ const m = FEED.L[+j.dataset.join]; hubOn = false; closeModal(); if(m && FEED.KIND[m.k]){ show(FEED.KIND[m.k].go); paintCoins(); } } };
  };
  setInterval(() => { if(!hubOn) return; if(document.getElementById('modal').hidden || !document.getElementById('hub')){ hubOn = false; return; } }, 7000);
  document.getElementById('ticker').onclick = () => openWorld();
  // thanh tin chạy trong ván: chỉ tin hệ thống và tin loa, không có tin tuyển người; chạy xong một tin thì ẩn vài giây
  { const st = document.getElementById('stage'), bar = document.createElement('div'); bar.className = 'ticker gtk'; bar.id = 'gTicker'; bar.hidden = true;
    bar.innerHTML = '<span class="tki">📣</span><span class="tkw"><span class="tkt" id="gtkText"></span></span>'; st.appendChild(bar);
    const txt = bar.querySelector('#gtkText'); let gN = 0, gT = null;
    const next = () => { gT = null; if(!document.body.classList.contains('ingame')){ bar.hidden = true; gT = setTimeout(next, 4000); return; }
      if(Math.random() < .4) FEED.fake();
      const L = FEED.L.filter(m => m.k==='sys'); if(!L.length){ gT = setTimeout(next, 6000); return; }
      const m = L[gN % L.length]; gN++; txt.textContent = m.text; bar.hidden = false; txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = ''; };
    txt.addEventListener('animationend', () => { bar.hidden = true; clearTimeout(gT); gT = setTimeout(next, 7000 + Math.random()*5000); });
    gT = setTimeout(next, 5000); }
  // ----- Bảng xếp hạng (bản thử: bảng mô phỏng, dòng của bạn là số thật)
  const LB = (() => {
    const names = ['Minh Khoa','Thu Hà','Bảo Ngọc','Quốc Anh','Lan Chi','Đức Huy','Mai Phương','Gia Bảo','Tuấn Kiệt','Hoài Thương','Khánh Linh','Việt Hùng','Thanh Tùng','Ngọc Diệp','Hải Đăng','Phương Thảo','Anh Thư','Trọng Nghĩa','Cẩm Tú','Đình Phúc','Yến Nhi','Văn Long','Kim Ngân','Hữu Phước','Bích Vân','Nhật Minh','Diễm My','Công Vinh','Thuý Hằng','Sơn Tùng'];
    names.forEach((n,i) => { names[i] = n + ' 🤖'; });   // bảng xếp hạng mẫu: người chơi máy
    let sd = 7; const rd = () => (sd = (sd*16807) % 2147483647) / 2147483647;
    const lv = [], fr = [], rk = [];
    names.forEach((n,k) => { lv.push({n, k, v: Math.max(2, Math.round(60 - k*1.7 + rd()*3))}); rk.push({n:names[(k*7+3)%30], k:k+1, v: Math.max(0, Math.round(1500 - k*48 + rd()*30))}); });
    names.slice(0,10).forEach((n,k) => fr.push({n:names[(k*11+5)%30], k:k+2, v: Math.round(2400 - k*210 + rd()*60)}));
    return {lv, fr, rk};
  })();
  let lbTab = 'lv';
  // bảng xếp hạng thật: đọc hồ sơ công khai của người chơi trên Firebase (cấp, điểm hạng); tab Bạn bè là bạn thật
  const lbCache = {};
  const lbFetch = async t => { const c = lbCache[t]; if(c && Date.now() - c.at < 12000) return c.l; let l = [];
    try { const myId = window.FR_ ? window.FR_.uid() : '';
      if(window.FR_ && !lbFetch.pushed){ lbFetch.pushed = 1; try { await window.FR_.touch(); } catch(e) {} setTimeout(() => { lbFetch.pushed = 0; }, 20000); }   // v148: điểm của mình lên máy chủ trước rồi mới đọc bảng
      if(t==='fr' && window.FR_ && window.FR_.refreshProf) try { await window.FR_.refreshProf(); } catch(e) {}
      if(t==='fr') l = (window.FR_ ? window.FR_.friends() : []).map(([id, x]) => ({id, n:x.n || 'Bạn', k:x.av || 0, ft:(typeof x.ft==='string' ? x.ft.slice(0,60) : ''), v:+x.lv || 1, pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''}));
      else { const key = t==='lv' ? 'lv' : 'rp', d = await FBNET.db(), sn = await d.ref('users').orderByChild(key).limitToLast(30).once('value');
        const mineO = FBNET.uid(), byO = {};   // v148: một tài khoản chỉ một dòng (bỏ mã cũ ở máy khác), không tính chính mình
        sn.forEach(ch => { const x = ch.val() || {}; if(ch.key===myId || x[key]==null || (x.o && x.o===mineO)) return;
          const row = {id:ch.key, n:String(x.n || 'Người chơi'), k:+x.av || 0, ft:(typeof x.ft==='string' ? x.ft.slice(0,60) : ''), v:+x[key] || 0, at:+x.at || 0, pa:typeof x.pa==='string' && x.pa.indexOf('data:image/')===0 ? x.pa : ''};
          const o = x.o || ch.key, old = byO[o]; if(!old || row.at > old.at) byO[o] = row; });
        l = Object.values(byO); }
    } catch(e) {}
    if(t!=='fr' && typeof botRows==='function') l = l.concat(botRows(t==='lv' ? 'lv' : 'rp'));
    lbCache[t] = {at:Date.now(), l}; return l; };
  const paintLb = async () => {
    const want = lbTab; if(!lbCache[want]) document.getElementById('lbList').innerHTML = '<p class="say">Đang tải bảng xếp hạng…</p>';
    const fetched = await lbFetch(want); if(want!==lbTab) return;
    const keep = AVMAP; AVMAP = null;
    const me = {lv: lvOf(STORE.exp).L, rk: STORE.rp, fr: lvOf(STORE.exp).L}, medal = ['🥇','🥈','🥉'];
    const list = fetched.slice().sort((a,b) => b.v - a.v);
    const fmt = v => lbTab==='rk' ? (tierOf(v).t.i + ' ' + v) : 'Cấp ' + v;
    const sub = x => lbTab==='lv' ? 'Người chơi' : lbTab==='fr' ? 'Bạn bè' : 'Hạng ' + tierOf(x.v).t.n;
    const myPh = PH.src(PH.myU()), row = (x, pos, cls, isMe) => `<div class="lbrow ${cls}" ${x.id ? `data-uprof="${x.id}"` : ''}><span class="lbpos">${pos<=3 ? medal[pos-1] : pos}</span><span class="lbav" style="--c:${PC[x.k%4]}">${isMe && myPh ? `<img class="avph" src="${myPh}" alt="">` : x.pa ? `<img class="avph" src="${x.pa}" alt="">` : AV(x.k, isMe ? STORE.fit : (x.ft || ''))}</span><span class="lbn"><b>${isMe ? ttMini(TITLE.worn()) : ''}${esc(x.n)}</b><small>${isMe ? (TITLE.worn() ? 'Bạn · ' + TITLE.worn().n : 'Bạn') : sub(x)}</small></span><span class="lbv">${fmt(x.v)}</span></div>`;
    let h = '';
    {
      const mv = me[lbTab], pos = 1 + list.filter(x => x.v > mv).length, mine = {n:STORE.name || 'Bạn', k:savedPick()||0, v:mv};
      const all = list.slice(); all.splice(pos-1, 0, mine);
      h = all.slice(0,10).map((x,k) => row(x, k+1, x===mine ? 'me' : k<3 ? 'r' + (k+1) : '', x===mine)).join('');
      if(pos>10) h += '<div class="lbgap">⋮</div>' + row(mine, pos, 'me', true);
    }
    document.getElementById('lbList').innerHTML = h;
    document.getElementById('lbNote').textContent = lbTab==='lv' ? 'Xếp theo cấp độ. Lên cấp bằng cách chơi và thắng ván.' : lbTab==='fr' ? (list.length ? 'Bạn bè thật của bạn, xếp theo cấp độ.' : 'Chưa có bạn bè thật. Mời bạn chơi cùng để cùng leo bảng nhé!') : 'Xếp theo điểm xếp hạng.';
    document.querySelectorAll('#lbTabs .lbtab').forEach(b => b.classList.toggle('on', b.dataset.t===lbTab));
    AVMAP = keep;
  };
  { const fe = document.getElementById('frReal'); if(fe) fe.addEventListener('click', e => { if(e.target.closest('button')) return; const r = e.target.closest('[data-uprof]'); if(r){ SFX.play('pop'); PH.view(r.dataset.uprof); } }); }
  document.getElementById('lbList').addEventListener('click', e => { const r = e.target.closest('[data-uprof]'); if(r){ SFX.play('pop'); PH.view(r.dataset.uprof); } });
  document.getElementById('lbTabs').onclick = e => { const b = e.target.closest('[data-t]'); if(!b) return; lbTab = b.dataset.t; SFX.play('pop'); paintLb(); };
  document.getElementById('homeLb').addEventListener('click', () => { paintLb(); });
  { let t = null; try { t = localStorage.getItem(RKLIVE); } catch(e) {}
    if(t){ rankLive(false); STORE.addRp(RANK_PEN.quit);
      setTimeout(() => openModal('🚪 Rời trận xếp hạng', `<div class="warnbox"><b>Bạn bị trừ ${-RANK_PEN.quit} điểm hạng</b>Lần trước bạn đã đóng trang khi trận xếp hạng chưa kết thúc. Lần sau hãy chơi hết trận nhé!</div>`, [{label:'Đã hiểu', primary:true, fn: closeModal}]), 600); } }
  paintQDot(); setInterval(paintQDot, 2000); setInterval(skyTick, 4000);
  renderShop();
  const rotBuy = e => { const b = e.target.closest('[data-rb]'); if(!b || b.disabled) return; const [sec, n] = b.dataset.rb.split(':'), R = shopRot(sec), x = R.list[+n]; if(!x) return;
    const key = x.t + ':' + x.k; if(shopOwned(x) || STORE.coins < x.p || (R.limit && STORE.shopCount(sec, R.slot, key) >= R.limit)) return;
    STORE.add(-x.p); if(x.t==='item') STORE.give(x.k, 1); else if(x.t==='fit') STORE.buyFit(x.k); else if(x.t==='plate') STORE.buyPlate(x.k); else STORE.buyAv(+x.k);
    STORE.shopMark(sec, R.slot, key); SFX.play('buy'); renderShop(); };
  document.getElementById('loaBox').addEventListener('click', e => { const b = e.target.closest('[data-loa]'); if(!b || b.disabled) return; const n = +b.dataset.loa, c = n===5 ? LOA_P5 : LOA_P; if(STORE.coins < c) return; STORE.add(-c); STORE.addLoa(n); SFX.play('buy'); renderShop(); });
  document.querySelectorAll('[data-go="shop"]').forEach(b => b.addEventListener('click', () => renderShop()));   // vào cửa hàng là vẽ lại để số loa, số xu và hàng xoay vòng luôn mới
  document.getElementById('hrGrid').addEventListener('click', rotBuy); document.getElementById('wkGrid').addEventListener('click', rotBuy);
  const togglePack = k => { let a = STORE.pack; if(a.includes(k)) a = a.filter(x => x!==k); else if(a.length < PACK_MAX) a = a.concat([k]); else return; STORE.setPack(a); SFX.play('click'); renderShop(); };
  document.getElementById('packBar').addEventListener('click', e => { const b = e.target.closest('[data-pack]'); if(b) togglePack(b.dataset.pack); });
  document.getElementById('shopGrid').addEventListener('click', e => { const pb = e.target.closest('[data-pack]'); if(pb){ if(!pb.disabled) togglePack(pb.dataset.pack); return; }
    const b = e.target.closest('[data-buy]'); if(!b) return; const k = b.dataset.buy;
    if(STORE.coins < ITEMS[k].p) return; STORE.add(-ITEMS[k].p); STORE.give(k, 1); SFX.play('buy'); renderShop(); });
  document.getElementById('fitGrid').addEventListener('click', e => { const b = e.target.closest('[data-fit]'); if(!b || b.disabled) return; const k = b.dataset.fit;
    if(!STORE.ownsFit(k)){ if(STORE.coins < FITS[k].p) return; STORE.add(-FITS[k].p); STORE.buyFit(k); STORE.put(k); SFX.play('buy'); }
    else { STORE.wear(k); SFX.play('pop'); }
    renderShop(); });
  document.getElementById('gemGrid').addEventListener('click', e => { const b = e.target.closest('[data-gem]'); if(!b || b.disabled) return; const x = GEMSHOP.find(g => g.id===b.dataset.gem); if(!x || STORE.gems < x.p) return;
    if(x.t==='plate'){ if(STORE.ownsPlate(x.id)) return; STORE.buyPlate(x.id); STORE.setPlate(x.id); }
    else if(x.t==='chest') Object.keys(ITEMS).forEach(k => STORE.give(k, 2));
    else if(x.t==='coins') STORE.add(x.v);
    else if(x.t==='loa') STORE.addLoa(x.v);
    STORE.addGem(-x.p); SFX.play('buy'); renderShop(); });
  document.getElementById('bagBtn').onclick = openBag;
  document.getElementById('sndBtn').onclick = openSystem; document.getElementById('homeSnd').onclick = openSystem; 
  SYS.apply(); applyBright();
  { const q = document.getElementById('quitBtn'); let held = false, tmq = null;
    q.addEventListener('click', e => { if(SYS.get('lock') && !held){ e.stopImmediatePropagation(); e.preventDefault(); } held = false; }, true);
    q.addEventListener('pointerdown', () => { if(!SYS.get('lock')) return; q.classList.add('holding'); tmq = setTimeout(() => { held = true; q.classList.remove('holding'); q.click(); }, 1500); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev => q.addEventListener(ev, () => { clearTimeout(tmq); q.classList.remove('holding'); })); }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState==='visible' && !document.getElementById('game').hidden) wakeOn(); });

  // ===== Màn mở đầu: logo hiện to giữa màn hình khoảng 4 giây, rồi thu nhỏ bay lên chỗ cũ và phòng chờ hiện dần =====
  (() => {
    const body = document.body, logo = document.querySelector('#home .logo'), home = $('home');
    let fin = false; const finish = () => { body.classList.remove('splash'); ['splashTap','splashHint'].forEach(id => { const e = $(id); if(e) e.remove(); }); if(!fin){ fin = true; if(window.dailyAuto) window.dailyAuto(); } };
    if(!logo || !home || home.hidden || body.dataset.scr!=='home' || !logo.animate){ finish(); return; }
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const HOLD = calm ? 1500 : 4200, FLY = 850;
    let flying = false, tHold = 0, guard = setTimeout(finish, HOLD + FLY + 3000);
    // các phần khác của phòng chờ: anh em của logo và của mọi khung chứa logo
    const sibs = []; for(let el = logo; el && el!==home; el = el.parentElement){ [...el.parentElement.children].forEach(c => { if(c!==el && !c.hidden) sibs.push(c); }); }
    const tap = document.createElement('div'); tap.id = 'splashTap'; tap.setAttribute('aria-label', 'Vào game'); body.appendChild(tap);
    const hint = document.createElement('div'); hint.id = 'splashHint'; hint.textContent = 'CHẠM ĐỂ VÀO GAME'; body.appendChild(hint);
    const start = () => {
      // trang đang xoay 90 độ bằng CSS: đổi tọa độ màn hình sang tọa độ của trang đã xoay
      const rotd = LAND && !IS_APP && body.classList.contains('rotp'), r = logo.getBoundingClientRect(), W = innerWidth;
      const vw = rotd ? innerHeight : innerWidth, vh = rotd ? innerWidth : innerHeight;
      const pcx = r.left + r.width/2, pcy = r.top + r.height/2, lcx = rotd ? pcy : pcx, lcy = rotd ? W - pcx : pcy;
      const dx = vw/2 - lcx, dy = vh*0.46 - lcy;
      const k = Math.max(1.4, Math.min(vw*0.66/logo.offsetWidth, vh*0.40/logo.offsetHeight, 4.2));
      const at = (x, y, sc) => `translate(${x}px,${y}px) rotate(-4deg) scale(${sc})`;
      const sp = [...logo.children];
      if(calm){ logo.style.transform = at(dx,dy,k); logo.animate([{opacity:0},{opacity:1}], {duration:500}); logo.style.opacity = 1; }
      else {
        logo.animate([{opacity:0, transform:at(dx,dy,k*.25)},{opacity:1, transform:at(dx,dy,k*1.1), offset:.6},{opacity:1, transform:at(dx,dy,k*.97), offset:.82},{opacity:1, transform:at(dx,dy,k)}], {duration:900, easing:'cubic-bezier(.2,.8,.3,1)', fill:'forwards'});
        sp.forEach((e, i) => e.animate([{transform:`translateY(${i ? 60 : -60}%)`, opacity:0},{transform:'none', opacity:1}], {duration:620, delay:120 + i*170, easing:'cubic-bezier(.3,1.5,.5,1)', fill:'backwards'}));
        // hết đoạn bật lên thì giữ logo đứng yên bằng style thường: iPhone vẽ lại chữ ở cỡ to nên nét sắc, không bị vỡ như khi đang chạy hiệu ứng
        setTimeout(() => { if(flying) return; logo.style.opacity = 1; logo.style.transform = at(dx,dy,k); logo.getAnimations().forEach(a => { if(a.effect && a.effect.target===logo) a.cancel(); }); }, 950);
      }
      // cần đăng nhập: logo bật lên xong thì hiện màn đăng nhập, giữ logo đứng chờ tới khi chọn xong
      if(window.needLogin && window.needLogin()){
        setTimeout(() => { if(flying) return; clearTimeout(tHold); clearTimeout(guard); tap.remove(); hint.remove();
          window.showLogin(() => fly()); }, calm ? 400 : 1100);
      }
      setTimeout(() => { if(!flying && document.body.contains(hint)) hint.classList.add('on'); }, calm ? 300 : 1600);
      const fly = () => {
        if(flying) return; flying = true; clearTimeout(tHold); hint.classList.remove('on'); tap.remove();
        logo.getAnimations().forEach(a => { if(a.effect && a.effect.target===logo) a.cancel(); });
        SFX.play('whoosh', 0, .5);
        sibs.forEach(c => c.classList.add('spl-h'));
        body.classList.remove('splash');                               // phòng chờ hiện lại nhưng các khối vẫn đang ẩn chờ trượt vào
        const a = logo.animate(calm
          ? [{opacity:1, transform:at(dx,dy,k)},{opacity:1, transform:at(0,0,1)}]
          : [{transform:at(dx,dy,k)},{transform:at(dx,dy+vh*.02,k*1.06), offset:.16},{transform:at(0,0,.94), offset:.84},{transform:at(0,0,1)}],
          {duration:FLY, easing:'cubic-bezier(.65,0,.3,1)'});
        logo.style.transform = ''; logo.style.opacity = '';
        sibs.forEach((c, i) => setTimeout(() => { c.classList.add('spl-in'); c.classList.remove('spl-h'); }, FLY*.55 + i*70));
        a.finished.catch(() => {}).then(() => { clearTimeout(guard); setTimeout(() => sibs.forEach(c => c.classList.remove('spl-in')), 700 + sibs.length*70); finish(); });
      };
      tHold = setTimeout(() => { if(!document.getElementById('loginFx')) fly(); }, HOLD);
      tap.addEventListener('pointerdown', () => setTimeout(fly, 60));   // chạm để vào ngay (chạm này cũng mở khóa loa)
    };
    // chờ font logo sẵn sàng để đo đúng kích thước (tối đa 0,6 giây)
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 600))]).then(() => requestAnimationFrame(start));
  })();
  ['click','touchend','touchstart','keydown'].forEach(ev => document.addEventListener(ev, () => SFX.unlock(), true));
  document.addEventListener('pointerdown', e => { SFX.unlock(); const b = e.target.closest && e.target.closest('button'); if(b && !b.disabled && b.id!=='sndBtn' && b.id!=='homeSnd') SFX.play('click'); }, true);
  document.addEventListener('click', e => { const u = e.target.closest && e.target.closest('#bag [data-use]'); if(u && !u.disabled) useItem(u.dataset.use); });
  window.addEventListener('pageshow', renderShop);
  document.getElementById('rollBtn').onclick = () => { if(PAUSED) return; if(netClient()){ netEmit('act', {m:'roll'}); document.getElementById('rollBtn').disabled = true; return; } if(waitResolve && S.wait && S.wait.mode==='roll' && (!NET || S.wait.pid===NET.me)) waitResolve('ok'); };
  document.getElementById('endBtn').onclick = () => { if(netClient()){ netEmit('act', {m:'end'}); document.getElementById('endBtn').disabled = true; return; } if(waitResolve && S.wait && S.wait.mode==='end' && (!NET || S.wait.pid===NET.me)) waitResolve('ok'); };
  // Rời ván bất cứ lúc nào: nếu máy đang đi thì chờ hết lượt đó rồi mới thoát, tránh hai ván chạy chồng nhau
  window.leaveSoon = () => { if(!S) return; S.over = true; if(!S.restart && !S.leave) S.reason = 'manual'; QUIT = true;
    // đóng ngay hộp thoại, đếm ngược đang mở; phần còn lại của lượt chạy tức thì không hoạt ảnh
    if(waitResolve) waitResolve('quit'); [...QUITR].forEach(f => { try { f(); } catch(e) {} });
    document.querySelectorAll('#quitCf').forEach(e => e.remove());
    // thoát hẳn: hiện bảng tổng kết tài sản ngay (Ván mới, Trang chính thì để vòng chơi tự xử lý, giờ cũng xong ngay)
    if(!S.restart && !S.leave && !document.getElementById('podium')){ S.shown = true; render(); showResult(); } };
  const doQuit = () => { if(netClient()){ netLeave(); window.goHome(); return; } if(netHost() && S && !S.over && S.players.some(p => p.remote && p.alive)){ netEmit('hq', {}); setTimeout(() => { netLeave(); window.leaveSoon(); }, 250); return; } window.leaveSoon(); };
  window.askQuit = (pre, msg, yes, title) => {
    if(document.getElementById('quitCf')) return;
    const o = document.createElement('div'); o.id = 'quitCf';
    o.innerHTML = '<div class="qcd"><b>' + (title || 'Thoát ván chơi?') + '</b><p>' + (msg ? msg : S && S.mode==='rank' && !NET ? `Đây là trận xếp hạng: thoát giữa chừng bị <b>trừ ${-RANK_PEN.quit} điểm hạng</b>.` : 'Ván đang chơi sẽ kết thúc sớm và không có thưởng.') + '</p><div class="qcb"><button class="btn" id="qcNo">Chơi tiếp</button><button class="btn primary" id="qcYes">' + (yes || 'Thoát') + '</button></div></div>';
    document.body.appendChild(o);
    document.getElementById('qcNo').onclick = () => o.remove();
    document.getElementById('qcYes').onclick = () => { o.remove(); if(typeof pre==='function') pre(); doQuit(); };
  };
  document.getElementById('quitBtn').onclick = () => window.askQuit();
  const _unusedQuit = () => { if(netClient()){ netLeave(); window.goHome(); return; } if(NET){ S.over = true; S.reason = 'manual'; if(waitResolve) waitResolve('quit'); return; } if(waitResolve) waitResolve('quit'); };
  document.getElementById('board').addEventListener('click', e => { const c = e.target.closest('.cell'); if(c) showTile(+c.dataset.i); });
  document.getElementById('emojis').innerHTML = EMOJI.map(e => `<button data-e="${e}" aria-label="Gửi ${e}">${e}</button>`).join('');
  document.getElementById('emojis').addEventListener('click', e => { const b = e.target.closest('button'); if(b && S && !S.over){ if(netClient()) netEmit('chat', {t:b.dataset.e}); else say(S.players[S.viewer], b.dataset.e, true); } });
  const sendText = () => { const i = document.getElementById('chatIn'), v = i.value.trim(); if(!v || !S) return;
    if(chatTab==='world'){ if(STORE.loa < 1){ palToast('Hết loa rồi. Mua loa ở Cửa hàng để nói trên Thế giới'); SFX.play('warn'); return; } STORE.addLoa(-1); CHAT.world(v.slice(0,80)); FEED.say(STORE.name || 'Bạn', v.slice(0,80)); SFX.play('chat'); i.value = ''; renderChat(); return; }
    if(chatTab==='dm'){ if(!chatDm){ palToast('Chọn một người bạn trước đã'); return; } if(window.RDM_) window.RDM_.send(chatDm, v.slice(0,120)).catch(() => palToast('Chưa gửi được tin, thử lại nhé')); SFX.play('chat'); i.value = ''; return; }
    if(netClient()) netEmit('chat', {t:v.slice(0,80)}); else say(S.players[S.viewer], v, EMOJI.includes(v)); i.value = ''; };
  document.getElementById('sendBtn').onclick = sendText;
  document.getElementById('cutBtn').onclick = async () => {     // Trùm điện nước: chọn một ô đất của người khác để cắt
    const p = S && S.players[S.viewer]; if(!p || !utilOwned(p).length || S.over || askOpen) return;
    const mine = () => S.wait && S.wait.pid===p.id && (S.wait.mode==='roll' || S.wait.mode==='end');
    if(netClient()){ cornerNote(p, '⚡', 'Cắt điện nước', 'Phòng nhiều máy: bản thử này chỉ chủ phòng dùng được', 2600); return; }
    if(cutWait(p)){ cornerNote(p, '⚡', 'Cắt điện nước', `Còn ${cutWait(p)} vòng nữa mới cắt tiếp được`, 2400); return; }
    if(!mine()){ cornerNote(p, '⚡', 'Cắt điện nước', 'Tới lượt mình mới cắt được', 2200); return; }
    if(!TILES.some((t,i) => cutOK(p, i))){ cornerNote(p, '⚡', 'Cắt điện nước', 'Chưa có ô đất nào của người khác để cắt', 2400); return; }
    const wasEnd = S.wait.mode==='end'; if(wasEnd) stopEndTimer();
    const k = await pickTile(p, DECIDE, `⚡✂️ Chạm ô đất muốn cắt ${cutWhat(p)}` + (utilKing(p) ? ' (mất trắng tiền thuê)' : ' (giảm 50% tiền thuê)'), i => cutOK(p, i), 'Thôi');
    if(k>=0 && mine()) doCut(p, k);
    if(wasEnd && S.wait && S.wait.mode==='end' && S.wait.pid===p.id && !endTimer) startEndTimer(p);
    render();
  };
  document.getElementById('suBtn').onclick = async () => {      // bán công ty khởi nghiệp: chỉ khi tới lượt mình
    const p = S && S.players[S.viewer]; if(!p || !p.startup || S.over) return;
    const mine = () => S.wait && S.wait.pid===p.id && (S.wait.mode==='roll' || S.wait.mode==='end');
    if(netClient()){ cornerNote(p, '🚀', 'Công ty của bạn', 'Phòng nhiều máy: bản thử này chỉ chủ phòng bán được', 2600); return; }
    if(!mine()){ cornerNote(p, '🚀', 'Công ty của bạn', `Trị giá ${p.startup}<br><small>Tới lượt mình mới bán được</small>`, 2200); return; }
    const wasEnd = S.wait.mode==='end'; if(wasEnd) stopEndTimer();
    const c = await ask('🚀 Bán công ty?', `<p>Công ty đang trị giá <b>${p.startup}</b>.</p>`, [{k:'y', label:'Bán lấy ' + p.startup, primary:true}, {k:'n', label:'Giữ tiếp'}], 12, p.id);
    if(c==='y' && p.startup>0 && p.alive) sellStartup(p);
    if(wasEnd && S.wait && S.wait.mode==='end' && S.wait.pid===p.id && !endTimer) startEndTimer(p);
    render();
  };
  { const qk = document.getElementById('quick'), ci = document.getElementById('chatIn'), sh = document.getElementById('sheetC');
    qk.innerHTML = ['Chào cả nhà!','Nhanh lên nào','Đẹp đấy!','Ôi không…','Cảm ơn nha','Haha','Chơi lại nhé'].map(x => `<button type="button">${x}</button>`).join('');
    qk.onclick = e => { const b = e.target.closest('button'); if(!b) return; ci.value = b.textContent; sendText(); };
    // bàn phím riêng của game, nằm ngang theo màn chơi
    const kb = document.getElementById('kbd'), KB = {vi:(() => { try { return localStorage.getItem('lendoi_kbvi')!=='0'; } catch(e) { return true; } })(), shift:false, num:false};
    const TONE = {s:'\u0301', f:'\u0300', r:'\u0309', x:'\u0303', j:'\u0323'};
    const telex = (text, ch) => {
      const word = (text.match(/([^\s]*)$/) || ['',''])[1], head = text.slice(0, text.length - word.length), lc = ch.toLowerCase();
      if(!word) return text + ch;
      let units = []; for(const c of word.normalize('NFD')){ if(/[\u0300-\u036f]/.test(c) && units.length) units[units.length-1] += c; else units.push(c); }
      const base = u => u[0].toLowerCase(), isV = u => 'aeiouy'.indexOf(base(u))>=0, hasMod = u => /[\u0302\u0306\u031B]/.test(u), out = () => head + units.join('').normalize('NFC');
      const last = units[units.length-1];
      if(lc==='d' && (last==='d' || last==='D')){ units[units.length-1] = last==='D' ? 'Đ' : 'đ'; return out(); }
      if('aeo'.indexOf(lc)>=0 && isV(last) && base(last)===lc && !hasMod(last)){ units[units.length-1] = last[0] + '\u0302' + last.slice(1); return out(); }
      if(lc==='w'){
        for(let k=units.length-1;k>=0;k--){ const u = units[k], b = base(u);
          if(!hasMod(u) && (b==='a' || b==='o' || b==='u')){ units[k] = u[0] + (b==='a' ? '\u0306' : '\u031B') + u.slice(1);
            if(b==='o' && k>0 && base(units[k-1])==='u' && !hasMod(units[k-1])) units[k-1] = units[k-1][0] + '\u031B' + units[k-1].slice(1);
            return out(); } }
        return text + ch;
      }
      if(TONE[lc] || lc==='z'){
        const vs = []; units.forEach((u,k) => { if(isV(u)) vs.push(k); }); if(!vs.length) return text + ch;
        let g = [vs[vs.length-1]]; for(let k=vs.length-2; k>=0 && vs[k]===g[0]-1; k--) g.unshift(vs[k]);
        if(g.length>1 && g[0]>0){ const pv = base(units[g[0]-1]), fv = base(units[g[0]]); if((pv==='q' && fv==='u') || (pv==='g' && fv==='i')) g.shift(); }
        const mods = g.filter(k => hasMod(units[k])), endCons = g[g.length-1] < units.length-1;
        const t = mods.length ? mods[mods.length-1] : g.length===1 ? g[0] : endCons ? g[g.length-1] : g[g.length-2];
        units = units.map(u => u.replace(/[\u0300\u0301\u0303\u0309\u0323]/g, ''));
        if(TONE[lc]) units[t] += TONE[lc];
        return out();
      }
      return text + ch;
    };
    const kbDraw = () => {
      const rows = KB.num ? ['1234567890', '.,?!:;()-', '@\'"/+=%&'] : ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      const key = (c, cls, lab) => `<button type="button" data-k="${c==='"' ? '&quot;' : c}" class="${cls||''}">${lab || (KB.shift && !KB.num ? c.toUpperCase() : c)}</button>`;
      kb.innerHTML = `<div>${rows[0].split('').map(c => key(c)).join('')}</div><div>${rows[1].split('').map(c => key(c)).join('')}</div>`
        + `<div>${KB.num ? '' : key('shift', 'w2' + (KB.shift ? ' on' : ''), '⇧')}${rows[2].split('').map(c => key(c)).join('')}${key('back', 'w2', '⌫')}</div>`
        + `<div>${key('num', 'w2', KB.num ? 'ABC' : '123')}${key('vi', 'w2 kblang' + (KB.vi ? ' on' : ''), KB.vi ? '🇻🇳 VI' : '🇬🇧 EN')}${key(' ', 'sp', 'dấu cách')}${key('hide', 'w2', '▾')}${key('send', 'w3 go', 'Gửi')}</div>`;
    };
    const kbOpen = on => { kb.hidden = !on; sh.classList.toggle('kb', on); if(on) kbDraw(); };
    kb.addEventListener('pointerdown', e => {
      const b = e.target.closest('button'); if(!b) return; e.preventDefault(); const k = b.dataset.k; SFX.play('click');
      if(k==='shift'){ KB.shift = !KB.shift; kbDraw(); return; }
      if(k==='num'){ KB.num = !KB.num; kbDraw(); return; }
      if(k==='vi'){ KB.vi = !KB.vi; try { localStorage.setItem('lendoi_kbvi', KB.vi ? '1' : '0'); } catch(e) {} kbDraw(); return; }
      if(k==='hide'){ kbOpen(false); return; }
      if(k==='send'){ sendText(); return; }
      if(k==='back'){ ci.value = Array.from(ci.value).slice(0,-1).join(''); }
      else if(ci.value.length < 80){ const ch = KB.shift && !KB.num ? k.toUpperCase() : k; ci.value = (KB.vi && !KB.num && /[a-z]/i.test(k)) ? telex(ci.value, ch) : ci.value + ch; if(KB.shift){ KB.shift = false; kbDraw(); } }
      ci.scrollLeft = ci.scrollWidth;
    });
    // dùng bàn phím của điện thoại: khi màn đang xoay ngang bằng CSS thì dựng khung chat thẳng đứng lên đầu màn hình để gõ, gõ xong trả về chỗ cũ
    ci.addEventListener('pointerdown', e => { if(SOFTKB){ e.preventDefault(); ci.readOnly = true; ci.setAttribute('inputmode', 'none'); kbOpen(true); return; } ci.readOnly = false; ci.removeAttribute('inputmode'); kbOpen(false); });
    let typT = null;
    ci.addEventListener('focus', () => { clearTimeout(typT); if(isRot() && !ci.readOnly){ const st = document.getElementById('stage'); sh.style.setProperty('--stH', st.clientHeight + 'px'); sh.classList.add('typing'); } });
    ci.addEventListener('blur', () => { clearTimeout(typT); typT = setTimeout(() => sh.classList.remove('typing'), 180); });
    document.getElementById('sendBtn').addEventListener('pointerdown', e => { if(sh.classList.contains('typing')) e.preventDefault(); });   // bấm Gửi không làm tụt bàn phím
    // phím Enter trên bàn phím điện thoại gửi tin luôn
    ci.setAttribute('enterkeyhint', 'send');
    ci.addEventListener('beforeinput', e => { if(e.inputType==='insertLineBreak'){ e.preventDefault(); sendText(); } });
    // chạm ra ngoài khung chat thì khung tự đóng
    document.addEventListener('pointerdown', e => { if(sh.hidden || !e.target.closest) return; if(e.target.closest('#sheetC') || e.target.closest('#chatBtn') || e.target.closest('.frtoast')) return;
      ci.blur(); sh.classList.remove('typing'); kbOpen(false); const x = sh.querySelector('[data-close="sheetC"]'); if(x) x.click(); else sh.hidden = true; }, true);
    document.querySelectorAll('[data-close="sheetC"]').forEach(x => x.addEventListener('click', () => kbOpen(false)));
    window.telexTest = telex; }
  document.getElementById('chatIn').addEventListener('keydown', e => { if(e.key==='Enter') sendText(); });
  document.addEventListener('click', e => {
    if(!e.target.closest || !e.target.closest('#assets')) return;
    const sl = e.target.closest('[data-sell]');
    if(sl){ if(!askOpen && S.wait) listForSale(S.players[NET ? NET.me : S.wait.pid], +sl.dataset.sell); return; }
    const trd = e.target.closest('[data-trade]');
    if(trd){ if(!askOpen && S.wait) proposeTrade(S.players[NET ? NET.me : S.wait.pid], +trd.dataset.trade); return; }
    const r = e.target.closest('[data-repay]');
    if(r){ if(netClient()){ netEmit('req', {k:'repay', n:+r.dataset.repay}); closeModal(); } else if(!askOpen && S.wait && (!NET || S.wait.pid===NET.me)){ repay(S.players[S.wait.pid], +r.dataset.repay); render(); } return; }
    const c = e.target.closest('.as[data-a]'); if(c) showTile(+c.dataset.a); });
  // đồng hồ ván chỉ tính lúc đang chơi: tạm dừng hoặc tắt màn hình, khóa máy thì không trừ giờ
  { const fb = document.getElementById('ffBtn'), paintFF = () => { fb.classList.toggle('on', FF); fb.textContent = FF ? '⏩ x3' : '⏩'; };
    if(fb){ paintFF(); fb.addEventListener('click', e => { e.stopPropagation(); FF = !FF; try { localStorage.setItem('lendoi_ff', FF ? '1' : '0'); } catch(err) {} paintFF(); }); } }
  setInterval(() => { if(S && !S.over){ if(PAUSED && !document.hidden && !NET && !S.net) S.start += 1000; tickClock(); } }, 1000);
  { let hidAt = 0; document.addEventListener('visibilitychange', () => {
      if(document.hidden){ hidAt = Date.now(); return; }
      if(hidAt && S && !S.over && !netClient()) S.start += Date.now() - hidAt; hidAt = 0; }); }
  // ===== Cửa hàng kiểu game (màn ngang): thanh ví trên cùng, tab bên trái, lưới hàng ở giữa, phòng thử đồ bên phải =====
  const SHV = {tab:'hot', pv:null};
  function shopLayout(){
    const cm = document.querySelector('#shop .cm'); if(!cm || cm.querySelector('.shx')) return;
    const kids = [...cm.children], at = el => kids.indexOf(el), $i = id => document.getElementById(id);
    const x = document.createElement('div'); x.className = 'shx';
    x.innerHTML = `<header class="shbar"><button type="button" class="shback" aria-label="Quay lại">‹</button><h1 class="shtitle">Cửa hàng</h1>
        <div class="shwal"><span class="shcur c"><i>🪙</i><b class="coinv">${STORE.coins}</b><button type="button" data-shtab="earn" aria-label="Nhận thêm xu">+</button></span><span class="shcur g"><i>💎</i><b class="gemv">${STORE.gems}</b><button type="button" data-shtab="earn" aria-label="Nạp kim cương">+</button></span></div></header>
      <nav class="shtabs">${[['hot','🔥','Nổi bật'],['av','🐯','Nhân vật'],['fit','👒','Trang phục'],['plate','🏷️','Bảng tên'],['item','🎒','Vật phẩm'],['gem','💎','Kim cương'],['loa','📣','Loa'],['earn','🎁','Nạp & quà']].map(t => `<button type="button" data-shtab="${t[0]}"><i>${t[1]}</i><span>${t[2]}</span></button>`).join('')}</nav>
      <div class="shgrid"></div><aside class="shprev"></aside>`;
    const grid = x.querySelector('.shgrid');
    const pane = (k, els) => { const p = document.createElement('div'); p.className = 'shpane'; p.dataset.pane = k; els.forEach(e => { if(e) p.appendChild(e); }); grid.appendChild(p); };
    const iHr = at($i('hrGrid')), iWk = at($i('wkGrid')), iGem = at($i('gemGrid')), iLoa = at($i('loaBox')), iOld = at($i('oldShop'));
    pane('hot', [kids[iHr-2], kids[iHr-1], kids[iHr], kids[iWk-2], kids[iWk-1], kids[iWk]]);   // hàng đổi theo giờ và theo tuần, đang giảm giá
    ['av','fit','plate','item'].forEach(k => { const sub = document.createElement('p'), g = document.createElement('div'); sub.className = 'sub shcsub'; g.className = 'rotgrid'; g.id = 'shc-' + k; pane(k, [sub, g]); });
    { const hp = grid.querySelector('[data-pane="hot"]'), tg = document.createElement('div'), sb = document.createElement('p'), g = document.createElement('div');   // mục sự kiện ở đầu Nổi bật
      tg.className = 'tag xmastag'; tg.textContent = '🎄 Mùa Noel'; sb.className = 'sub shcsub'; g.className = 'rotgrid'; g.id = 'shc-noel'; if(hp) hp.prepend(tg, sb, g); }
    pane('gem', [kids[iGem-2], kids[iGem-1], kids[iGem]]);
    pane('loa', [kids[iLoa-1], kids[iLoa]]);
    pane('earn', kids.slice(iOld + 1));                            // Kim cương và xu: xem video, nạp
    { const eg = x.querySelector('.eggshop'), ip = grid.querySelector('[data-pane="item"]'); if(eg && ip) ip.prepend(eg); }   // trứng thối nằm ở mục Vật phẩm
    cm.appendChild(x);
    const setTab = window.shopTab = k => { if(SHV.tab!==k) SHV.pv = null; SHV.tab = k; x.querySelectorAll('.shtabs [data-shtab]').forEach(b => b.classList.toggle('on', b.dataset.shtab===k)); grid.querySelectorAll('.shpane').forEach(p => p.classList.toggle('on', p.dataset.pane===k)); grid.scrollTop = 0; window.shopPrev(); };
    x.querySelector('.shback').onclick = () => { const b = cm.querySelector(':scope > .back'); if(b) b.click(); };
    x.addEventListener('click', e => {
      const tb = e.target.closest('[data-shtab]'); if(tb){ SFX.play('click'); setTab(tb.dataset.shtab); return; }
      const a = e.target.closest('[data-shact]');
      if(a){ const k = a.dataset.shact; SFX.play('click');
        if(k==='reset'){ SHV.pv = null; window.shopPrev(); }
        else if(k==='char'){ if(window.openProfile) window.openProfile(); }
        else if(k==='buy'){ const c = SHV.pv && grid.querySelector(`.shpane.on [data-pv="${CSS.escape(SHV.pv)}"] .btn`); if(c && !c.disabled) c.click(); }
        else if(k==='gift' && SHV.pv && window.GIFT_){ const pv = SHV.pv.split(':'); window.GIFT_.ask(pv[0], pv.slice(1).join(':')); }
        return; }
      const cb = e.target.closest('[data-cb]'); if(cb){ if(!cb.disabled) shopCatBuy(cb.dataset.cb); return; }
      if(e.target.closest('button')) return;                        // nút Mua trên từng thẻ đã có xử lý riêng
      const c = e.target.closest('[data-pv]'); if(c){ SHV.pv = c.dataset.pv; SFX.play('pop'); window.shopPrev(); }
    });
    setTab(SHV.tab);
    window.shopCats();
  }
  // các mục theo loại hàng: Nhân vật, Trang phục, Bảng tên, Vật phẩm (mua một lần dùng mãi, riêng vật phẩm dùng trong ván)
  window.shopCats = () => {
    if(!document.getElementById('shc-av')) return;
    const keep = AVMAP; AVMAP = null; const cur = savedPick() || 0;
    const card = (t, k, cls, typ, pic, name, desc, cur$, price, own, btn, can, extra) => `<div class="icard rcard ${cls||''}" data-pv="${t}:${k}"><span class="rtype t-${typ}">.</span>${pic}<b>${esc(name)}</b><small>${esc(desc)}</small>${extra || ''}<div class="shprice ${own ? 'own' : ''}">${own ? '<b>✓ Đã có</b>' : `<i>${cur$}</i><b>${price}</b>`}</div><button class="btn primary" data-cb="${t}:${k}" ${can ? '' : 'disabled'}>${btn}</button></div>`;
    const set = (id, sub, html) => { const g = document.getElementById(id); if(!g) return; g.innerHTML = html; const p = g.previousElementSibling; if(p) p.textContent = sub; };
    set('shc-av', 'Nhân vật đi trên bàn cờ. Mua một lần, dùng mãi.', [0,1,2,3,4,5,6].map(k => { const own = STORE.ownsAv(k), pr = PREM[k], nm = pr ? pr.n : PICKS[k][0], ds = pr ? pr.d : PICKS[k][1];
      return card('av', k, own && cur===k ? 'on' : '', 'av', `<span class="fprev">${AV(k, '')}</span>`, nm, ds, '🪙', pr ? pr.p : 0, own, own ? (cur===k ? 'Đang dùng' : 'Dùng') : 'Mua', own ? cur!==k : STORE.coins >= pr.p); }).join(''));
    const fitCard = k => { const f = FITS[k], own = STORE.ownsFit(k), on = STORE.wearing(k);
      return card('fit', k, (on ? 'on ' : '') + (f.xmas ? 'xmascard' : ''), 'fit', `<span class="fprev">${AV(cur, k)}</span>`, f.n, f.xmas ? 'Đồ Noel · mặc vào Hồ sơ có tuyết rơi' : 'Trang phục cho nhân vật', '🪙', f.p, own, own ? (on ? 'Cởi ra' : 'Mặc') : 'Mua', own || STORE.coins >= f.p); };
    set('shc-noel', 'Đồ sự kiện Noel, chỉ có trong mùa lễ. Mặc vào Hồ sơ có tuyết rơi, đèn nháy!', Object.keys(FITS).filter(isXmas).map(fitCard).join(''));
    set('shc-fit', 'Nhân vật đội lên đầu khi vào ván. Bấm Mặc để thay đồ.', Object.keys(FITS).filter(k => !isXmas(k)).map(k => { const f = FITS[k], own = STORE.ownsFit(k), on = STORE.wearing(k);
      return card('fit', k, on ? 'on' : '', 'fit', `<span class="fprev">${AV(cur, k)}</span>`, f.n, 'Trang phục cho nhân vật', '🪙', f.p, own, own ? (on ? 'Cởi ra' : 'Mặc') : 'Mua', own || STORE.coins >= f.p); }).join(''));
    set('shc-plate', 'Khung tên hiện trên thẻ người chơi trong ván.', Object.keys(PLATES).filter(k => !PLATES[k].rk).map(k => { const pl = PLATES[k], own = STORE.ownsPlate(k), on = STORE.plate===k, g = pl.gem ? GEMSHOP.find(x => x.id===k) : null, price = g ? g.p : pl.p;
      return card('plate', k, (on ? 'on ' : '') + (g ? 'gcard' : ''), g ? 'gem' : 'plate', `<span class="plprev pc plate-${k}"><span class="nmx">${esc(STORE.name || 'Tên bạn')}</span></span>`, g ? g.n : 'Bảng tên ' + pl.n, g ? g.d : 'Bảng tên', g ? '💎' : '🪙', price, own, own ? (on ? 'Gỡ ra' : 'Dùng') : 'Mua', own || (g ? STORE.gems : STORE.coins) >= price); }).join(''));
    set('shc-item', 'Mang vào ván để dùng (chọn trong Hồ sơ, mục Túi đồ). Mỗi ván dùng tối đa ' + ITEM_MAX + ' món.', Object.keys(ITEMS).map(k => { const it = ITEMS[k];
      return card('item', k, '', 'item', `<span class="iico">${it.i}</span>`, it.n, it.d, '🪙', it.p, false, 'Mua', STORE.coins >= it.p, `<span class="iown">Đang có ${STORE.has(k)}</span>`); }).join(''));
    AVMAP = keep;
  };
  function shopCatBuy(id){
    const i = id.indexOf(':'), t = id.slice(0, i), k = id.slice(i + 1);
    if(t==='av'){ const n = +k; if(!STORE.ownsAv(n)){ if(!PREM[n] || STORE.coins < PREM[n].p) return; STORE.add(-PREM[n].p); STORE.buyAv(n); SFX.play('buy'); } else SFX.play('pop'); try { localStorage.setItem('lendoi_av', n); } catch(e) {} }
    else if(t==='fit'){ if(!STORE.ownsFit(k)){ if(STORE.coins < FITS[k].p) return; STORE.add(-FITS[k].p); STORE.buyFit(k); STORE.put(k); SFX.play('buy'); } else { STORE.wear(k); SFX.play('pop'); } }
    else if(t==='plate'){ if(!STORE.ownsPlate(k)){ const g = PLATES[k].gem ? GEMSHOP.find(x => x.id===k) : null;
        if(g){ const gb = document.querySelector(`#gemGrid [data-gem="${k}"]`); if(gb && !gb.disabled) gb.click(); return; }
        if(STORE.coins < PLATES[k].p) return; STORE.add(-PLATES[k].p); STORE.buyPlate(k); STORE.setPlate(k); SFX.play('buy'); }
      else { STORE.setPlate(STORE.plate===k ? '' : k); SFX.play('pop'); } }
    else if(t==='item'){ if(STORE.coins < ITEMS[k].p) return; STORE.add(-ITEMS[k].p); STORE.give(k, 1); SFX.play('buy'); }
    renderShop();
  }
  // phòng thử đồ: nhân vật đứng trên gốc cây, mặc thử món đang chọn (trang phục, nhân vật, bảng tên, cầm vật phẩm)
  window.shopPrev = () => {
    const box = document.querySelector('#shop .shprev'); if(!box) return;
    const pv = SHV.pv ? SHV.pv.split(':') : null, t = pv && pv[0], k = pv ? pv.slice(1).join(':') : '';
    const av = t==='av' ? +k : (savedPick() || 0), fit = t==='fit' ? fitWith(STORE.fit, k) : STORE.fit, plate = t==='plate' ? k : STORE.plate;
    const emo = t==='item' && ITEMS[k] ? ITEMS[k].i : t==='emo' ? k : '';
    const card = SHV.pv ? document.querySelector(`#shop .shpane.on [data-pv="${CSS.escape(SHV.pv)}"]`) : null, btn = card && card.querySelector('.btn'), pr = card && card.querySelector('.shprice'), nm = card && card.querySelector(':scope > b');
    const can = !!(btn && !btn.disabled), bg = AV.bg(av);
    document.querySelectorAll('#shop .shgrid [data-pv]').forEach(c => c.classList.toggle('pv', !!SHV.pv && c.dataset.pv===SHV.pv));
    box.innerHTML = `<div class="shroom" style="--sa:${bg[0]};--sb:${bg[1]}"><span class="shfr f1">🏆</span><span class="shfr f2">🌸</span><span class="shlamp"></span>
        <div class="shplate"><span class="plprev pc plate-${esc(plate || '')}"><span class="nmx">${esc(STORE.name || 'Bạn')}</span></span></div>
        <div class="shped"></div><div class="shfig">${AV.full(av, fit)}</div>${emo ? `<span class="shhold">${emo}</span>` : ''}
        <button type="button" class="shsign" data-shact="char">Đổi<br>nhân vật</button>${card ? `<span class="shtry"><b>${esc(nm ? nm.textContent : '')}</b>${card.querySelector('small') ? `<small>${esc(card.querySelector('small').textContent)}</small>` : ''}</span>` : '<span class="shtry hint">Chạm vào món hàng để mặc thử</span>'}</div>
      <div class="shpvbar"><button type="button" class="shreset" data-shact="reset" aria-label="Bỏ thử đồ" ${SHV.pv ? '' : 'disabled'}>↻</button>
        <button type="button" class="shbuy ${btn && btn.textContent!=='Mua' ? 'use' : ''}" data-shact="buy" ${can ? '' : 'disabled'}>${!card ? 'Chạm món để thử' : btn.textContent==='Mua' ? (can ? `Mua · ${pr ? esc(((pr.querySelector('i') || {}).textContent || '') + ((pr.querySelector(':scope > b') || {}).textContent || '')) : ''}` : 'Chưa đủ tiền') : esc(btn.textContent)}</button>${card && window.GIFT_ && window.GIFT_.price(t, k) ? `<button type="button" class="shgift" data-shact="gift">🎁 Tặng</button>` : ''}</div>`;
  };
  if(LAND){ shopLayout(); lobbyPaint(); landPanes();
    // màn ngang hẹp (iPhone SE, mini): bật kiểu gọn. Đo theo khổ đang nhìn thấy, kể cả khi trang đang xoay bằng CSS
    const landSync = () => { const r = !IS_APP && document.body.classList.contains('rotp'), W = r ? innerHeight : innerWidth, H = r ? innerWidth : innerHeight, h = document.documentElement;
      h.classList.toggle('narrow', W < 760); h.classList.toggle('short', H < 380); h.style.setProperty('--vvh', H + 'px'); h.style.setProperty('--vvw', W + 'px'); };
    landSync(); addEventListener('resize', () => setTimeout(landSync, 60)); if(screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(landSync, 60)); }
  // ===== Bàn phím trên màn hình cho mọi ô nhập chữ khi trang đang xoay bằng CSS (điện thoại cầm dọc) =====
  // Lúc đó bàn phím của iPhone vẫn bật theo chiều dọc và đè lệch lên giao diện ngang, nên dùng bàn phím vẽ sẵn (có gõ Telex).
  if(LAND && !IS_APP){
    const GK = {el:null, inp:null, num:false, shift:false, vi:(() => { try { return localStorage.getItem('lendoi_kbvi')!=='0'; } catch(e) { return true; } })()};
    const rotd = () => document.body.classList.contains('rotp');
    const okInp = el => el && ((el.tagName==='INPUT' && /^(text|search|tel|number|password|)$/.test(el.type || '')) || el.tagName==='TEXTAREA') && el.id!=='chatIn' && !el.disabled;
    const labelOf = el => { const l = el.closest('label'); return (el.getAttribute('aria-label') || (l && l.childNodes[0] && l.childNodes[0].textContent) || el.placeholder || 'Nhập chữ').trim(); };
    const ensure = () => { if(GK.el) return GK.el; const k = document.createElement('div'); k.id = 'gkbd'; k.hidden = true; document.body.appendChild(k);
      k.addEventListener('pointerdown', e => { const b = e.target.closest('button'); e.preventDefault(); if(!b || !GK.inp) return; press(b.dataset.k); }); return (GK.el = k); };
    const show = () => { const k = ensure(), v = GK.inp.value, pw = GK.inp.type==='password';
      const rows = GK.num ? ['1234567890', '-/:;()@.,', '?!\'"+=%&'] : ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      const key = (c, cls, lab) => `<button type="button" data-k="${c==='"' ? '&quot;' : c}" class="${cls||''}">${lab || (GK.shift && !GK.num ? c.toUpperCase() : c)}</button>`;
      k.innerHTML = `<div class="gkv"><small>${esc(labelOf(GK.inp))}</small><b>${esc(pw ? '•'.repeat(v.length) : v)}<i></i></b></div>`
        + `<div>${rows[0].split('').map(c => key(c)).join('')}</div><div>${rows[1].split('').map(c => key(c)).join('')}</div>`
        + `<div>${GK.num ? '' : key('shift', 'w2' + (GK.shift ? ' on' : ''), '⇧')}${rows[2].split('').map(c => key(c)).join('')}${key('back', 'w2', '⌫')}</div>`
        + `<div>${key('num', 'w2', GK.num ? 'ABC' : '123')}${key('vi', 'w2 kblang' + (GK.vi ? ' on' : ''), GK.vi ? '🇻🇳 VI' : '🇬🇧 EN')}${key(' ', 'sp', 'dấu cách')}${key('done', 'w3 go', 'Xong')}</div>`;
      k.hidden = false; document.body.classList.add('gkon'); };
    const emit = t => GK.inp && GK.inp.dispatchEvent(new Event(t, {bubbles:true}));
    const close = () => { if(!GK.inp) return; const el = GK.inp; GK.inp = null; el.classList.remove('gkfocus'); if(GK.el) GK.el.hidden = true; document.body.classList.remove("gkon"); el.dispatchEvent(new Event('change', {bubbles:true})); };
    function press(k){
      const el = GK.inp, max = el.maxLength > 0 ? el.maxLength : 40; SFX.play('click');
      if(k==='shift'){ GK.shift = !GK.shift; show(); return; }
      if(k==='num'){ GK.num = !GK.num; show(); return; }
      if(k==='vi'){ GK.vi = !GK.vi; try { localStorage.setItem('lendoi_kbvi', GK.vi ? '1' : '0'); } catch(e) {} show(); return; }
      if(k==='done'){ close(); return; }
      if(k==='back') el.value = Array.from(el.value).slice(0,-1).join('');
      else if(Array.from(el.value).length < max){ const ch = GK.shift && !GK.num ? k.toUpperCase() : k; el.value = (GK.vi && !GK.num && /[a-z]/i.test(k) && window.telexTest) ? window.telexTest(el.value, ch) : el.value + ch; if(GK.shift){ GK.shift = false; } }
      emit('input'); show();
    }
    const open = el => {
      if(GK.inp && GK.inp!==el) GK.inp.classList.remove('gkfocus');
      GK.inp = el; el.classList.add('gkfocus');
      GK.num = /numeric|decimal|tel/.test(el.dataset.gkim || '') || el.type==='number' || el.type==='tel';
      GK.vi = !GK.num; GK.shift = false; show();
      setTimeout(() => { try { el.scrollIntoView({block:'center', inline:'nearest'}); } catch(e) {} }, 30);
    };
    document.addEventListener('pointerdown', e => {
      const t = e.target, el = t.closest ? t.closest('input,textarea') : null;
      if(okInp(el) && rotd()){ e.preventDefault(); if(!el.dataset.gk){ el.dataset.gk = '1'; el.dataset.gkim = el.getAttribute('inputmode') || ''; } el.readOnly = true; el.setAttribute('inputmode', 'none'); open(el); return; }
      if(el && el.dataset.gk && !rotd()){ el.readOnly = false; if(el.dataset.gkim) el.setAttribute('inputmode', el.dataset.gkim); else el.removeAttribute('inputmode'); delete el.dataset.gk; delete el.dataset.gkim; }   // máy đã nằm ngang thật: dùng lại bàn phím của máy
      if(GK.inp && !(t.closest && t.closest('#gkbd'))) close();
    }, true);
    // ô nhập bị đổi giá trị bằng code (ví dụ mở hộp thoại mới) thì đóng bàn phím
    new MutationObserver(() => { if(GK.inp && !document.body.contains(GK.inp)) close(); }).observe(document.body, {childList:true, subtree:true});
  }
  // app: thanh tin trong ván bám sát sau ô đồng hồ (ô này đổi bề ngang theo chữ)
  if(IS_APP && window.ResizeObserver){ const cp = document.getElementById('clockPill'), st = document.getElementById('stage'); if(cp && st) new ResizeObserver(() => st.style.setProperty('--clkw', cp.offsetWidth + 'px')).observe(cp); }
} else {
  module.exports = { applyRules, newGame, run, state: () => S, logs: () => logs, TILES, finalRank, netWorth };
}