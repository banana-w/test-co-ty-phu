/* ===== characters.js: Mô hình nhân vật SVG hoạt hình (Rồng, Gà, Hổ, Khỉ) ===== */
// ===== Nhân vật hoạt hình: Rồng, Gà, Hổ, Khỉ =====
const CZK = ['rong','ga','ho','khi']; let CZU = 0;
function czSVG(a, view, cls, uid){
  const k = CZK[a % 4];
  let s = view==='side' ? czBuildSide(k) : czBuild(k);
  if(view==='back') s = s.replace(/class="inr" fill="[^"]*"/g, 'fill="url(#fur)"');
  s = s.replace(/(id="|url\(#)(fur|belly|skin|limb)\b/g, '$1$2' + uid);
  return `<svg class="cz ${cls}" viewBox="0 0 400 400" aria-hidden="true">${s}</svg>`;
}
function czHead(a, mood){
  const k = CZK[a % 4], s = czBuild(k).replace(/(id="|url\(#)(fur|belly|skin|limb)\b/g, '$1$2h' + (++CZU));
  return `<svg class="cz czh ${mood||''}" x="0" y="0" width="48" height="48" viewBox="${a%4===1 ? '90 -22 220 220' : '90 8 220 214'}">${s}</svg>`;
}
function czSync(el, p){ }
function czTk(p){ return document.querySelector(`.tk[data-p="${p.id}"]`); }
const CZDIR = ['hopR','hopB','hopL','hopF'];
function czSh(p){ return document.querySelector(`.tsh[data-p="${p.id}"]`); }
function czHop(p, prev){   // mỗi bước quân nảy lên một nhịp, bóng trên mặt bàn co lại
  if(HEADLESS) return; const el = czTk(p), sd = czSh(p); if(!el) return;
  const k = el.classList.contains('hop') ? 'hop2' : 'hop';   /* v131: đổi qua lại hop/hop2 để chạy lại nhịp nảy, không cần void offsetWidth (bắt cả trang tính lại bố cục mỗi bước) */
  if(sd) sd.classList.remove('hop','hop2','landq');
  el.classList.remove('hop','hop2','landq'); el.classList.add(k); if(sd) sd.classList.add(k);
}
function czHopEnd(p){        // chạm đất ở ô cuối: lún xuống rồi bật lại
  if(HEADLESS) return; const el = czTk(p), sd = czSh(p); if(!el) return;
  if(sd) sd.classList.remove('hop','hop2');
  el.classList.remove('hop','hop2'); void el.offsetWidth; el.classList.add('landq'); if(sd) sd.classList.add('landq');
  setTimeout(() => { el.classList.remove('landq'); if(sd) sd.classList.remove('landq'); }, 380);
}
let SHAKE_AT = 0;
function fxShake(amt){       // rung nhẹ bàn cờ khi có khoản tiền lớn (từ 100), mạnh hơn từ 300
  if(HEADLESS || calm() || document.body.classList.contains('eco')) return;
  const now = Date.now(); if(now - SHAKE_AT < 700) return; SHAKE_AT = now;
  const el = document.getElementById('cam'); if(!el || !el.animate) return;
  const a = amt>=300 ? 7 : 4, k = [[-1,.6],[.9,-.7],[-.7,-.4],[.5,.5],[-.3,.2],[.15,-.1]];
  try { el.animate([{translate:'0 0'}].concat(k.map(v => ({translate:(v[0]*a).toFixed(1)+'px '+(v[1]*a).toFixed(1)+'px'})), [{translate:'0 0'}]), {duration: amt>=300 ? 420 : 300, easing:'linear'}); } catch(e) {}
}
function czMood(p, kind, ms){ }

// Nhân vật vẽ tay: hổ, trâu, voi, gà (mảng phẳng, nét xanh than, mắt to)
let AVMAP = null;   // ghế nào dùng con vật nào (người chơi chọn nhân vật trước ván)
const AV = (() => {
  const S0 = 'stroke="#2B3A67" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#FFFFFF" ${S0}/><circle cx="${x+.8}" cy="${y+.7}" r="2.4" fill="#2B3A67"/><circle cx="${x+1.6}" cy="${y-.2}" r=".8" fill="#FFFFFF"/>`;
  const art = [
    // Hổ
    `<circle cx="12.5" cy="12" r="5.5" fill="#F2A65A" ${S0}/><circle cx="12.5" cy="12" r="2.2" fill="#F6C9B8"/><circle cx="35.5" cy="12" r="5.5" fill="#F2A65A" ${S0}/><circle cx="35.5" cy="12" r="2.2" fill="#F6C9B8"/>
     <circle cx="24" cy="26" r="16" fill="#F2A65A" ${S0}/>
     <path d="M24 10.5v6M18.5 11.5l1.5 5M29.5 11.5l-1.5 5M8.5 25h4.5M9.5 30.5l4.5-1M39.5 25h-4.5M38.5 30.5l-4.5-1" fill="none" ${S0}/>
     <ellipse cx="24" cy="34" rx="8" ry="6" fill="#FFFDF6" ${S0}/><path d="M21.5 31h5l-2.5 3z" fill="#E0685C" stroke="#2B3A67" stroke-width="1.6" stroke-linejoin="round"/>
     <path d="M24 34v2.2M24 36.2q-2.4 2.4-4.6.4M24 36.2q2.4 2.4 4.6.4" fill="none" stroke="#2B3A67" stroke-width="1.8" stroke-linecap="round"/>` + eye(17.5,24) + eye(30.5,24),
    // Trâu
    `<path d="M12 18Q2 15 4 5Q8 12 16 12Z" fill="#F4EBD0" ${S0}/><path d="M36 18Q46 15 44 5Q40 12 32 12Z" fill="#F4EBD0" ${S0}/>
     <ellipse cx="7.5" cy="24" rx="4.6" ry="3" fill="#7C8AA5" transform="rotate(-20 7.5 24)" ${S0}/><ellipse cx="40.5" cy="24" rx="4.6" ry="3" fill="#7C8AA5" transform="rotate(20 40.5 24)" ${S0}/>
     <path d="M24 10C36 10 39 19 38 27C37.5 36 32 43 24 43C16 43 10.5 36 10 27C9 19 12 10 24 10Z" fill="#7C8AA5" ${S0}/>
     <path d="M19.5 11.5q4.5-4.5 9 0" fill="#5F6C86" ${S0}/>
     <ellipse cx="24" cy="35" rx="10" ry="6.5" fill="#C9D1DE" ${S0}/><circle cx="20.3" cy="35" r="1.5" fill="#2B3A67"/><circle cx="27.7" cy="35" r="1.5" fill="#2B3A67"/>` + eye(18,24) + eye(30,24),
    // Voi
    `<ellipse cx="8" cy="23" rx="8" ry="11.5" fill="#C3CEDA" ${S0}/><ellipse cx="8.6" cy="23" rx="4" ry="7.2" fill="#F0C4CF"/><ellipse cx="40" cy="23" rx="8" ry="11.5" fill="#C3CEDA" ${S0}/><ellipse cx="39.4" cy="23" rx="4" ry="7.2" fill="#F0C4CF"/>
     <circle cx="24" cy="21.5" r="14" fill="#A9B7C6" ${S0}/>
     <path d="M16.6 30Q15.2 36 12.4 36.8Q15.4 33.4 14.8 29.4Z" fill="#FFFDF6" ${S0}/><path d="M31.4 30Q32.8 36 35.6 36.8Q32.6 33.4 33.2 29.4Z" fill="#FFFDF6" ${S0}/>
     <path d="M19.5 27Q19 40.5 24 43.5Q30.5 46 31.5 39.5Q29.5 40.8 28.2 38.6Q28.6 33 28.5 27Z" fill="#A9B7C6" ${S0}/>
     <path d="M21 33.5h6.2M21.6 37.6h5.6" fill="none" stroke="#2B3A67" stroke-width="1.6" stroke-linecap="round"/>` + eye(18.5,20.5) + eye(29.5,20.5),
    // Gà
    `<path d="M17 12Q14.5 4 20 5.4Q21 1 25 4.2Q29.4 1 30.4 6.4Q34.6 6.4 31 12.6Z" fill="#E0685C" ${S0}/>
     <circle cx="24" cy="25.5" r="14.5" fill="#FFFDF6" ${S0}/>
     <path d="M21 36.5Q20 44 24 44Q28 44 27 36.5Z" fill="#E0685C" ${S0}/>
     <path d="M19.2 29.5L24 37L28.8 29.5Q24 27.4 19.2 29.5Z" fill="#F2A65A" ${S0}/>
     <circle cx="13" cy="30" r="2.3" fill="#F6C9B8"/><circle cx="35" cy="30" r="2.3" fill="#F6C9B8"/>` + eye(18,23.5) + eye(30,23.5),
    // Rồng
    `<path d="M11 15L8 3L18 11Z" fill="#F4C542" ${S0}/><path d="M37 15L40 3L30 11Z" fill="#F4C542" ${S0}/><path d="M24 4l3 5h-6z" fill="#E0685C" ${S0}/>
     <circle cx="24" cy="26" r="16" fill="#6FBF73" ${S0}/><ellipse cx="24" cy="33.5" rx="9.5" ry="6.4" fill="#B7E3A1" ${S0}/>
     <circle cx="20.5" cy="33" r="1.3" fill="#2B3A67"/><circle cx="27.5" cy="33" r="1.3" fill="#2B3A67"/><path d="M7 30q-5 1 -4 6M41 30q5 1 4 6" fill="none" stroke="#F4C542" stroke-width="2" stroke-linecap="round"/>
     <path d="M19 37.5q5 3 10 0" fill="none" ${S0}/>` + eye(18,22.5) + eye(30,22.5),
    // Gấu trúc
    `<circle cx="11.5" cy="11.5" r="6" fill="#2B3A67" ${S0}/><circle cx="36.5" cy="11.5" r="6" fill="#2B3A67" ${S0}/><circle cx="24" cy="26" r="16" fill="#FFFDF6" ${S0}/>
     <ellipse cx="17.5" cy="24" rx="6" ry="7" transform="rotate(18 17.5 24)" fill="#2B3A67"/><ellipse cx="30.5" cy="24" rx="6" ry="7" transform="rotate(-18 30.5 24)" fill="#2B3A67"/>
     <ellipse cx="24" cy="31.5" rx="2.6" ry="1.9" fill="#2B3A67"/><path d="M24 33.4v2.2M20.5 37q3.5 2.4 7 0" fill="none" ${S0}/><circle cx="13" cy="32" r="2.2" fill="#F6C9B8"/><circle cx="35" cy="32" r="2.2" fill="#F6C9B8"/>` + eye(18,24) + eye(30,24),
    // Cáo
    `<path d="M8 20L7 3L20 12Z" fill="#F28C38" ${S0}/><path d="M40 20L41 3L28 12Z" fill="#F28C38" ${S0}/><path d="M10.5 15L10 7.5L16 12Z" fill="#FFFDF6"/><path d="M37.5 15L38 7.5L32 12Z" fill="#FFFDF6"/>
     <circle cx="24" cy="26" r="16" fill="#F28C38" ${S0}/><path d="M9.5 31Q16 27 24 36Q32 27 38.5 31Q36 42 24 42Q12 42 9.5 31Z" fill="#FFFDF6" ${S0}/>
     <ellipse cx="24" cy="34.5" rx="2.4" ry="1.8" fill="#2B3A67"/><path d="M21 38.2q3 1.8 6 0" fill="none" ${S0}/>` + eye(18,23.5) + eye(30,23.5)
  ];
  const TOP = [10, 10, 7.5, 11, 10, 10, 10], EYE = [24, 24, 20.5, 23.5, 22.5, 24, 23.5];
  const wear = (k, i) => {
    if(k && k.indexOf('+')>=0) return k.split('+').map(x => wear(x, i)).join('');
    const t = TOP[i % TOP.length], e = EYE[i % EYE.length];
    if(k==='non') return `<path d="M3 ${t+7}L24 ${t-10}L45 ${t+7}Q24 ${t+13} 3 ${t+7}Z" fill="#F4E3A1" ${S0}/><path d="M24 ${t-10}L15 ${t+9}M24 ${t-10}L33 ${t+9}" fill="none" stroke="#2B3A67" stroke-width="1.3" stroke-linecap="round"/>`;
    if(k==='kinh') return `<rect x="10.5" y="${e-4.6}" width="12" height="9" rx="3.2" fill="#2B3A67"/><rect x="25.5" y="${e-4.6}" width="12" height="9" rx="3.2" fill="#2B3A67"/><path d="M22.5 ${e-1}h3M10.5 ${e-2}l-4-1.5M37.5 ${e-2}l4-1.5" fill="none" ${S0}/><path d="M13 ${e-2.4}l3-1.2M28 ${e-2.4}l3-1.2" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>`;
    if(k==='mu') return `<path d="M9.5 ${t+6}Q9.5 ${t-8} 24 ${t-8}Q38.5 ${t-8} 38.5 ${t+6}Z" fill="#5FA8D3" ${S0}/><path d="M36 ${t+6}Q47 ${t+4.5} 48.5 ${t+10}L35 ${t+9.5}Z" fill="#3E7FA8" ${S0}/><circle cx="24" cy="${t-8}" r="1.8" fill="#2B3A67"/>`;
    if(k==='no') return `<path d="M24 44.5L14.5 39.5V49.5ZM24 44.5L33.5 39.5V49.5Z" fill="#E0685C" ${S0}/><circle cx="24" cy="44.5" r="2.8" fill="#E0685C" ${S0}/>`;
    if(k==='vuong') return `<path d="M12 ${t+5}L9.5 ${t-8}L17 ${t-1.5}L24 ${t-11.5}L31 ${t-1.5}L38.5 ${t-8}L36 ${t+5}Z" fill="#F4C542" ${S0}/><circle cx="24" cy="${t-1}" r="2" fill="#E0685C"/><circle cx="16" cy="${t+1.5}" r="1.3" fill="#5FA8D3"/><circle cx="32" cy="${t+1.5}" r="1.3" fill="#5FA8D3"/>`;
    if(k==='len') return `<path d="M10 ${t+6}Q10 ${t-9} 24 ${t-9}Q38 ${t-9} 38 ${t+6}Z" fill="#E0685C" ${S0}/><rect x="9" y="${t+2}" width="30" height="6" rx="2.5" fill="#F4E3A1" ${S0}/><circle cx="24" cy="${t-10}" r="3.4" fill="#FFFDF6" ${S0}/>`;
    if(k==='tainghe') return `<path d="M8 ${e+1}Q7 ${t-10} 24 ${t-10}Q41 ${t-10} 40 ${e+1}" fill="none" stroke="#2B3A67" stroke-width="3" stroke-linecap="round"/><rect x="3.5" y="${e-4}" width="7" height="11" rx="3" fill="#5FA8D3" ${S0}/><rect x="37.5" y="${e-4}" width="7" height="11" rx="3" fill="#5FA8D3" ${S0}/>`;
    if(k==='khan') return `<path d="M10 ${e+14}Q24 ${e+21} 38 ${e+14}L38.5 ${e+18.5}Q24 ${e+26} 9.5 ${e+18.5}Z" fill="#E0685C" ${S0}/><path d="M31 ${e+19}l4 9l-5 1l-3-8z" fill="#C94F44" ${S0}/>`;
    if(k==='hoa') return [0,72,144,216,288].map(a => `<circle cx="${(35 + 3.3*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(t + 2 + 3.3*Math.sin(a*Math.PI/180)).toFixed(1)}" r="2.6" fill="#F6A5C0" ${S0}/>`).join('') + `<circle cx="35" cy="${t+2}" r="1.9" fill="#F4C542"/>`;
    if(k==='kinhtron') return `<circle cx="17.5" cy="${e}" r="5.6" fill="rgba(255,255,255,.28)" stroke="#2B3A67" stroke-width="1.9"/><circle cx="30.5" cy="${e}" r="5.6" fill="rgba(255,255,255,.28)" stroke="#2B3A67" stroke-width="1.9"/><path d="M23.1 ${e}h1.8M11.9 ${e-1}l-4-1.2M36.1 ${e-1}l4-1.2" fill="none" stroke="#2B3A67" stroke-width="1.6" stroke-linecap="round"/>`;
    if(k==='chop') return `<rect x="15" y="${t-15}" width="18" height="15" rx="1.5" fill="#2B3A67" ${S0}/><rect x="15" y="${t-5}" width="18" height="3" fill="#E0685C"/><rect x="9" y="${t-1}" width="30" height="4" rx="2" fill="#2B3A67" ${S0}/>`;
    if(k==='ria') return `<path d="M24 ${e+8.5}q-3-3-7-1q-3 1.5-6-.5q2 5 7.5 3.5q3.5-1 5.5-2zM24 ${e+8.5}q3-3 7-1q3 1.5 6-.5q-2 5-7.5 3.5q-3.5-1-5.5-2z" fill="#4A3426" stroke="#2B3A67" stroke-width="1" stroke-linejoin="round"/>`;
    if(k==='noel') return `<path d="M9 ${t+5}Q12 ${t-11} 28 ${t-10}Q40 ${t-9} 42 ${t+4}Q38 ${t-2} 34 ${t-3}L38 ${t+5}Z" fill="#E0453A" ${S0}/><rect x="8" y="${t+2}" width="30" height="6" rx="3" fill="#FFFDF6" ${S0}/><circle cx="42" cy="${t+5}" r="3.3" fill="#FFFDF6" ${S0}/>`;
    if(k==='tuanloc') return `<path d="M15 ${t+2}L12 ${t-8}M12 ${t-4}L7 ${t-7}M13 ${t-7}L10 ${t-12}M33 ${t+2}L36 ${t-8}M36 ${t-4}L41 ${t-7}M35 ${t-7}L38 ${t-12}" fill="none" stroke="#8A5A3B" stroke-width="2.6" stroke-linecap="round"/><path d="M15 ${t+2}L12 ${t-8}M12 ${t-4}L7 ${t-7}M13 ${t-7}L10 ${t-12}M33 ${t+2}L36 ${t-8}M36 ${t-4}L41 ${t-7}M35 ${t-7}L38 ${t-12}" fill="none" stroke="#B07A50" stroke-width="1.2" stroke-linecap="round"/><circle cx="24" cy="${e+7}" r="3.2" fill="#FF3B30" stroke="#2B3A67" stroke-width="1.2"/><circle cx="23" cy="${e+6}" r="1" fill="#fff"/>`;
    if(k==='raunoel') return `<path d="M10 ${e+5}Q11 ${e+22} 24 ${e+24}Q37 ${e+22} 38 ${e+5}Q33 ${e+11} 24 ${e+11}Q15 ${e+11} 10 ${e+5}Z" fill="#FFFDF6" ${S0}/><path d="M24 ${e+8.5}q-4-3-8-1q-3 1.5-5-1q2 5 7 4q4-.5 6-2zM24 ${e+8.5}q4-3 8-1q3 1.5 5-1q-2 5-7 4q-4-.5-6-2z" fill="#FFFDF6" stroke="#2B3A67" stroke-width="1"/>`;
    if(k==='choi') return `<path d="M-4 47L44 39" stroke="#8A5A2B" stroke-width="3.4" stroke-linecap="round"/><path d="M-4 47L44 39" stroke="#2B3A67" stroke-width="1" stroke-linecap="round" fill="none" opacity=".5"/><path d="M42 39.5L55 33L57 41L56 47L44 41Z" fill="#E8B34A" stroke="#2B3A67" stroke-width="1.4" stroke-linejoin="round"/><path d="M47 38.5L56 36M47 41L57 41M46 43L56 45.5" stroke="#B9822A" stroke-width="1"/><path d="M41 38L44.5 37.5L45.5 42L42 42.5Z" fill="#7C3AED" stroke="#2B3A67" stroke-width="1"/>`;
    if(k==='sinhnhat') return `<path d="M16.5 ${t+3}L24 ${t-15}L31.5 ${t+3}Z" fill="#C38FE0" ${S0}/><circle cx="21.5" cy="${t-2}" r="1.3" fill="#F4C542"/><circle cx="26" cy="${t-7}" r="1.2" fill="#5FA8D3"/><circle cx="26.5" cy="${t+0.5}" r="1.2" fill="#E0685C"/><circle cx="24" cy="${t-16}" r="2.6" fill="#F4C542" ${S0}/>`;
    return '';
  };
  // trang phục chỉ hiện trên nhân vật do người thật điều khiển
  const mine = i => !S.net && !S.players[i].remote && (!NET || NET.role!=='host' || i===(NET.me||0));   // người đang cầm máy này
  const auto = i => { try { if(!S || !document.body.classList.contains('ingame')) return ''; const p = S.players[i]; if(!p) return ''; if(p.bot) return BOTPA[p.name] || '';
      if(typeof p.fit==='string') return fitList(p.fit).join('+');   // đồ người đó đang mặc (gửi qua mạng)
      return (S.net ? i===S.viewer : mine(i)) ? STORE.fit : ''; } catch(e) { return ''; } };
  const TINT = [0, 150, 250, 70];   // trùng nhân vật: người thứ 2, 3, 4 đổi màu để dễ phân biệt
  const real = i => { try { if(!window.PH_ || !S || !document.body.classList.contains('ingame')) return ''; const p = S.players[i]; if(!p) return ''; if(p.bot) return BOTPA[p.name] || ''; return window.PH_.src(p.fu || ((S.net ? i===S.viewer : !p.remote) ? window.PH_.myU() : '')); } catch(e) { return ''; } };
  const f = (i, fit) => { if(fit===undefined){ const ph = real(i); if(ph) return `<img class="avs avph" src="${ph}" alt="">`; } const a = (AVMAP && AVMAP[i]!=null) ? AVMAP[i] : i, dup = AVMAP ? AVMAP.slice(0, i).filter(x => x===a).length : 0;
    return `<svg class="avs" viewBox="0 0 48 48" aria-hidden="true"${dup ? ` style="filter:hue-rotate(${TINT[dup % 4]}deg) saturate(1.15)"` : ''}>${art[a % art.length]}${wear(fit===undefined ? auto(i) : fit, a)}</svg>`; };
  f.ph = i => real(i);   // ảnh đại diện thật của người chơi i (rỗng nếu không có)
  f.raw = a => art[a % art.length];   // hình gốc (0 Hổ, 1 Trâu, 2 Voi, 3 Gà) để ghép vào tranh minh họa
  // nhân vật đứng nguyên người (hồ sơ, phòng chờ, cửa hàng), kiểu tay chân que: đầu và thân liền một khối hình trứng,
  // mắt to lệch nhau, tay chân là nét đen mảnh, găng trắng, giày tròn
  const FK = '#2B3A67', FS = `stroke="${FK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
  const EGG = 'M60 27C88 27 97 64 97 90C97 113 81 124 60 124C39 124 23 113 23 90C23 64 32 27 60 27Z';
  const fEyes = `<ellipse cx="47" cy="62" rx="10.5" ry="12.5" fill="#fff" ${FS}/><ellipse cx="72" cy="61" rx="11.5" ry="13.5" fill="#fff" ${FS}/>`
    + `<ellipse cx="50" cy="63.5" rx="5.6" ry="7" fill="${FK}"/><ellipse cx="75.5" cy="62.5" rx="6" ry="7.5" fill="${FK}"/><circle cx="52" cy="60" r="2.1" fill="#fff"/><circle cx="77.8" cy="58.6" r="2.3" fill="#fff"/>`;
  const fCheek = `<ellipse cx="35" cy="79" rx="5.5" ry="3.2" fill="#F59A9A" opacity=".7"/><ellipse cx="86" cy="79" rx="5.5" ry="3.2" fill="#F59A9A" opacity=".7"/>`;
  const fShine = `<ellipse cx="39" cy="45" rx="7.5" ry="4" fill="#fff" opacity=".5" transform="rotate(-32 39 45)"/>`;
  const fLegs = (c, shoe) => `<path d="M50 120Q49 131 45 139M70 120Q72 131 76 139" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`
    + `<ellipse cx="42" cy="141" rx="8.4" ry="4.4" fill="${shoe}" ${FS}/><ellipse cx="79" cy="141" rx="8.4" ry="4.4" fill="${shoe}" ${FS}/><ellipse cx="40" cy="139.6" rx="3" ry="1.2" fill="#fff" opacity=".45"/><ellipse cx="77" cy="139.6" rx="3" ry="1.2" fill="#fff" opacity=".45"/>`;
  const fArms = `<g class="avwave"><path d="M26 88Q13 82 11 69" fill="none" stroke="${FK}" stroke-width="3.4" stroke-linecap="round"/><circle cx="11" cy="65" r="5.4" fill="#fff" ${FS}/></g>`
    + `<path d="M94 92Q106 99 104 110" fill="none" stroke="${FK}" stroke-width="3.4" stroke-linecap="round"/><circle cx="104" cy="114" r="5.4" fill="#fff" ${FS}/>`;
  // [màu thân, màu bụng, phía sau thân (tai, sừng, đuôi), phía trước (mặt, hoa văn), chân]
  const FULL = [
    ['#F5A04A', '#FFE6C4',   // Hổ: tai tròn, vằn trán và hông, mõm trắng, đuôi vằn
      `<path d="M92 112Q112 116 110 95" fill="none" stroke="${FK}" stroke-width="8.6" stroke-linecap="round"/><path d="M92 112Q112 116 110 95" fill="none" stroke="#F5A04A" stroke-width="4.6" stroke-linecap="round"/><path d="M104 113l3-5M109 105l-5-1" stroke="${FK}" stroke-width="2"/>`
      + `<circle cx="37" cy="36" r="10" fill="#F5A04A" ${FS}/><circle cx="37" cy="36" r="4.5" fill="#F6B8B0"/><circle cx="83" cy="36" r="10" fill="#F5A04A" ${FS}/><circle cx="83" cy="36" r="4.5" fill="#F6B8B0"/>`,
      `<path d="M60 28v9M52 30l2 7M68 30l-2 7M23.5 82l8 2M24 95l8-1.5M96.5 82l-8 2M96 95l-8-1.5" fill="none" stroke="${FK}" stroke-width="2.6" stroke-linecap="round"/>`
      + `<ellipse cx="60" cy="85" rx="12.5" ry="8.5" fill="#FFFDF6" ${FS}/><path d="M56.5 81h7l-3.5 3.8z" fill="#E0685C" stroke="${FK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M60 84.8v2.4M60 87.2q-2.6 2.6-5 .4M60 87.2q2.6 2.6 5 .4" fill="none" stroke="${FK}" stroke-width="1.8" stroke-linecap="round"/>`, ''],
    ['#7C8AA5', '#C9D1DE',   // Trâu: sừng cong, tai ngang, chỏm tóc, mõm to hai lỗ mũi
      `<path d="M93 108q14 4 15 18" fill="none" stroke="${FK}" stroke-width="3"/><path d="M104 124l4 8 5-7z" fill="#5F6C86" ${FS}/>`
      + `<path d="M41 37Q22 34 19 15Q30 27 47 29Z" fill="#F4EBD0" ${FS}/><path d="M79 37Q98 34 101 15Q90 27 73 29Z" fill="#F4EBD0" ${FS}/>`
      + `<ellipse cx="23" cy="56" rx="9.5" ry="5" fill="#7C8AA5" transform="rotate(-25 23 56)" ${FS}/><ellipse cx="97" cy="56" rx="9.5" ry="5" fill="#7C8AA5" transform="rotate(25 97 56)" ${FS}/>`,
      `<path d="M49 31q5-8 11-2q6-8 11 2" fill="#5F6C86" ${FS}/><ellipse cx="60" cy="88" rx="18.5" ry="11" fill="#D5DCE7" ${FS}/><ellipse cx="53" cy="87" rx="2.4" ry="3.1" fill="${FK}"/><ellipse cx="67" cy="87" rx="2.4" ry="3.1" fill="${FK}"/><path d="M55 94q5 3 10 0" fill="none" stroke="${FK}" stroke-width="1.8" stroke-linecap="round"/>`, ''],
    ['#A9B7C6', '#DDE5EE',   // Voi: tai lớn hai bên, vòi cuộn, ngà
      `<ellipse cx="25" cy="62" rx="17" ry="23" fill="#A9B7C6" ${FS}/><ellipse cx="26" cy="62" rx="9" ry="14" fill="#F0C4CF"/><ellipse cx="95" cy="62" rx="17" ry="23" fill="#A9B7C6" ${FS}/><ellipse cx="94" cy="62" rx="9" ry="14" fill="#F0C4CF"/>`
      + `<path d="M93 110q12 2 12 14" fill="none" stroke="${FK}" stroke-width="3" stroke-linecap="round"/>`,
      `<path d="M46 80q-3 9-10 10q7-5 6-12z" fill="#fff" ${FS}/><path d="M74 80q3 9 10 10q-7-5-6-12z" fill="#fff" ${FS}/>`
      + `<path d="M53 74Q52 92 58 100Q66 106 71 98Q64 99 63 92Q64 82 67 74Z" fill="#A9B7C6" ${FS}/><path d="M55.5 84h9M56.5 90h7" fill="none" stroke="${FK}" stroke-width="1.6" stroke-linecap="round"/>`, ''],
    ['#FFFDF6', '#FFF0C9',   // Gà: mào đỏ, mỏ cam, yếm đỏ, đuôi lông, chân cam
      `<path d="M27 104q-15-1-18-14q9 4 13 2q-7-6-5-15q8 10 15 12z" fill="#FFFDF6" ${FS}/>`,
      `<path d="M50 33q-5-11 4-12q2-8 8-3q6-6 9 3q8 0 3 12z" fill="#E0685C" ${FS}/><path d="M53 77L60 89L67 77Q60 74 53 77Z" fill="#F2A65A" ${FS}/><path d="M57 88q-1 8 3 8q4 0 3-8z" fill="#E0685C" ${FS}/>`, '#F2A65A'],
    ['#6FBF73', '#C8EBB0',   // Rồng: sừng vàng, mào đỏ, cánh nhỏ, đuôi gai, bụng có vảy
      `<path d="M90 114Q112 122 116 100L108 104Q104 96 98 104Q94 98 90 104Z" fill="#6FBF73" ${FS}/>`
      + `<path d="M26 80Q6 70 4 52Q14 60 20 56Q18 66 28 70Z" fill="#9BD88F" ${FS}/><path d="M94 80Q114 70 116 52Q106 60 100 56Q102 66 92 70Z" fill="#9BD88F" ${FS}/>`
      + `<path d="M43 34L34 12L51 28Z" fill="#F4C542" ${FS}/><path d="M77 34L86 12L69 28Z" fill="#F4C542" ${FS}/>`,
      `<path d="M60 22l4.5 8h-9z" fill="#E0685C" ${FS}/><path d="M43 99h34M45 107h30M49 115h22" fill="none" stroke="#86C67A" stroke-width="2.2" stroke-linecap="round"/>`
      + `<ellipse cx="60" cy="85" rx="15" ry="9" fill="#B7E3A1" ${FS}/><circle cx="55" cy="84" r="1.7" fill="${FK}"/><circle cx="65" cy="84" r="1.7" fill="${FK}"/><path d="M54 90q6 4 12 0" fill="none" stroke="${FK}" stroke-width="1.8" stroke-linecap="round"/>`, ''],
    ['#FFFDF6', '#F1F1EA',   // Gấu trúc: tai đen, quầng mắt đen, mũi đen
      `<circle cx="36" cy="35" r="10.5" fill="${FK}"/><circle cx="84" cy="35" r="10.5" fill="${FK}"/><circle cx="93" cy="112" r="6" fill="${FK}"/>`,
      `<ellipse cx="46" cy="64" rx="13" ry="16" fill="${FK}" transform="rotate(22 46 64)"/><ellipse cx="73" cy="63" rx="13.5" ry="16.5" fill="${FK}" transform="rotate(-22 73 63)"/>`
      + `<ellipse cx="60" cy="82" rx="4.4" ry="3.2" fill="${FK}"/><path d="M60 85v2.6M55.5 89q4.5 3 9 0" fill="none" stroke="${FK}" stroke-width="1.8" stroke-linecap="round"/>`, ''],
    ['#F28C38', '#FFFDF6',   // Cáo: tai nhọn, mặt nạ trắng, đuôi bông chóp trắng
      `<path d="M90 116Q120 118 115 89Q110 75 98 86Q108 98 90 104Z" fill="#F28C38" ${FS}/><path d="M111 80Q118 85 115 95Q108 92 106 83Z" fill="#FFFDF6"/>`
      + `<path d="M39 40L30 9L55 30Z" fill="#F28C38" ${FS}/><path d="M39 34L34 17L48 29Z" fill="#FFFDF6"/><path d="M81 40L90 9L65 30Z" fill="#F28C38" ${FS}/><path d="M81 34L86 17L72 29Z" fill="#FFFDF6"/>`,
      `<path d="M26 80Q42 72 60 88Q78 72 94 80Q92 104 60 104Q28 104 26 80Z" fill="#FFFDF6"/><ellipse cx="60" cy="86" rx="3.8" ry="2.9" fill="${FK}"/><path d="M56 91q4 2.6 8 0" fill="none" stroke="${FK}" stroke-width="1.8" stroke-linecap="round"/>`, '']
  ];
  const fWear = k => (k && k.indexOf('+')>=0) ? k.split('+').map(x => fWear(x)).join('') : k==='non' ? `<path d="M17 43L60 4L103 43Q60 53 17 43Z" fill="#F4E3A1" ${FS}/><path d="M60 4L47 47M60 4L73 47" fill="none" stroke="${FK}" stroke-width="1.5"/>`
    : k==='kinh' ? `<rect x="33" y="53" width="26" height="17" rx="6" fill="${FK}"/><rect x="61" y="52" width="27" height="18" rx="6" fill="${FK}"/><path d="M58 59h4M33 58l-9-3M88 58l9-3" fill="none" stroke="${FK}" stroke-width="2.4" stroke-linecap="round"/><path d="M38 57h6M66 56h7" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>`
    : k==='mu' ? `<path d="M29 42Q29 13 60 13Q91 13 91 42Z" fill="#5FA8D3" ${FS}/><path d="M87 42Q109 38 115 48L87 48Z" fill="#3E7FA8" ${FS}/><circle cx="60" cy="13" r="3" fill="${FK}"/>`
    : k==='no' ? `<path d="M60 101L46 93V109ZM60 101L74 93V109Z" fill="#E0685C" ${FS}/><circle cx="60" cy="101" r="4.2" fill="#E0685C" ${FS}/>`
    : k==='vuong' ? `<path d="M38 36L33 11L47 24L60 5L73 24L87 11L82 36Z" fill="#F4C542" ${FS}/><circle cx="60" cy="24" r="3.2" fill="#E0685C"/><circle cx="46" cy="30" r="2.1" fill="#5FA8D3"/><circle cx="74" cy="30" r="2.1" fill="#5FA8D3"/>`
    : k==='len' ? `<path d="M31 46Q30 13 60 13Q90 13 89 46Z" fill="#E0685C" ${FS}/><path d="M42 20Q41 30 42 40M52 15V40M68 15V40M78 20Q79 30 78 40" fill="none" stroke="#C94F44" stroke-width="2"/><rect x="28" y="38" width="64" height="11" rx="5" fill="#F4E3A1" ${FS}/><circle cx="60" cy="11" r="8" fill="#FFFDF6" ${FS}/>`
    : k==='tainghe' ? `<path d="M23 66Q20 8 60 8Q100 8 97 66" fill="none" stroke="${FK}" stroke-width="7" stroke-linecap="round"/><path d="M23 66Q20 8 60 8Q100 8 97 66" fill="none" stroke="#5FA8D3" stroke-width="3" stroke-linecap="round"/><rect x="12" y="54" width="16" height="25" rx="7" fill="#5FA8D3" ${FS}/><rect x="92" y="54" width="16" height="25" rx="7" fill="#5FA8D3" ${FS}/>`
    : k==='khan' ? `<path d="M29 93Q60 108 91 93L92 103Q60 119 28 103Z" fill="#E0685C" ${FS}/><path d="M36 97l1 9M48 101l.5 9M60 103v9M72 101l-.5 9M84 97l-1 9" stroke="#F4E3A1" stroke-width="2.4" stroke-linecap="round"/><path d="M74 103l9 23l-12 2l-6-21z" fill="#C94F44" ${FS}/>`
    : k==='hoa' ? [0,72,144,216,288].map(a => `<circle cx="${(88 + 8*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(36 + 8*Math.sin(a*Math.PI/180)).toFixed(1)}" r="6.5" fill="#F6A5C0" ${FS}/>`).join('') + `<circle cx="88" cy="36" r="4.6" fill="#F4C542" ${FS}/>`
    : k==='kinhtron' ? `<circle cx="46" cy="61" r="13" fill="rgba(255,255,255,.28)" stroke="${FK}" stroke-width="3.2"/><circle cx="74" cy="61" r="13" fill="rgba(255,255,255,.28)" stroke="${FK}" stroke-width="3.2"/><path d="M59 61h2M33 59l-9-3M87 59l9-3" fill="none" stroke="${FK}" stroke-width="2.6" stroke-linecap="round"/><path d="M40 55l4-2M68 55l4-2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`
    : k==='chop' ? `<rect x="39" y="-2" width="42" height="34" rx="3" fill="#2B3A67" ${FS}/><rect x="39" y="21" width="42" height="7" fill="#E0685C"/><rect x="25" y="29" width="70" height="9" rx="4.5" fill="#2B3A67" ${FS}/>`
    : k==='ria' ? `<path d="M60 77q-7-7-16-3q-7 3-13-1q4 12 17 8q8-2 12-4zM60 77q7-7 16-3q7 3 13-1q-4 12-17 8q-8-2-12-4z" fill="#4A3426" ${FS}/>`
    : k==='noel' ? `<path d="M27 45Q30 6 66 8Q96 10 104 40Q96 26 88 24L94 45Z" fill="#E0453A" ${FS}/><path d="M48 16Q60 11 72 13" fill="none" stroke="#F06A5F" stroke-width="3" stroke-linecap="round"/><rect x="24" y="37" width="72" height="13" rx="6.5" fill="#FFFDF6" ${FS}/><circle cx="104" cy="44" r="8" fill="#FFFDF6" ${FS}/>`
    : k==='tuanloc' ? (d => `<path d="${d}" fill="none" stroke="${FK}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#B07A50" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`)('M42 36L34 10M37 20L22 12M34 10L26 0M36 13L42 2M78 36L86 10M83 20L98 12M86 10L94 0M84 13L78 2') + `<circle cx="60" cy="74" r="7.5" fill="#FF3B30" ${FS}/><circle cx="57.5" cy="71.5" r="2.2" fill="#fff"/>`
    : k==='raunoel' ? `<path d="M30 70Q30 118 60 122Q90 118 90 70Q80 84 60 84Q40 84 30 70Z" fill="#FFFDF6" ${FS}/><path d="M40 92q4 8 2 16M52 96q2 10 0 18M68 96q-2 10 0 18M80 92q-4 8-2 16" fill="none" stroke="#D9DEE8" stroke-width="2" stroke-linecap="round"/><path d="M60 77q-7-7-16-3q-7 3-13-1q4 12 17 8q8-2 12-4zM60 77q7-7 16-3q7 3 13-1q-4 12-17 8q-8-2-12-4z" fill="#FFFDF6" ${FS}/>`
    : k==='choi' ? `<path d="M-2 136L104 112" stroke="#8A5A2B" stroke-width="6" stroke-linecap="round"/><path d="M-2 136L104 112" stroke="${FK}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".45"/><path d="M100 113L124 98L128 114L126 128L104 120Z" fill="#E8B34A" ${FS}/><path d="M108 110L126 104M108 116L127 116M107 120L125 125" stroke="#B9822A" stroke-width="1.6"/><path d="M96 110L104 109L106 120L98 121Z" fill="#7C3AED" ${FS}/><g fill="#FFE27A"><path d="M14 120l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" opacity=".9"/><path d="M30 140l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" opacity=".7"/></g>`
    : k==='sinhnhat' ? `<path d="M42 37L60 -4L78 37Z" fill="#C38FE0" ${FS}/><circle cx="53" cy="24" r="3" fill="#F4C542"/><circle cx="65" cy="13" r="2.8" fill="#5FA8D3"/><circle cx="67" cy="29" r="2.8" fill="#E0685C"/><circle cx="60" cy="-5" r="6" fill="#F4C542" ${FS}/>` : '';
  f.full = (k, fit) => {
    const a = ((+k || 0) % FULL.length + FULL.length) % FULL.length, [bc, bl, back, front, leg] = FULL[a];
    return `<svg class="avfull" viewBox="0 0 120 152" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="60" cy="146" rx="34" ry="5" fill="rgba(20,16,50,.22)"/>`
      + back + fLegs(leg || FK, leg || FK) + `<path d="${EGG}" fill="${bc}" ${FS}/><path d="M36 112Q60 126 84 112Q86 96 60 92Q34 96 36 112Z" fill="${bl}"/><path d="${EGG}" fill="none" ${FS}/>`
      + front + fEyes + fCheek + fShine + fArms + fWear(fit || '') + `</svg>`;
  };
  // cảnh nền sau nhân vật trong Hồ sơ
  f.scene = k => {
    const a = ((+k || 0) % 7 + 7) % 7, W = 'fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"';
    const grass = c => `<path d="M0 200V182Q20 170 40 182Q70 168 100 182Q130 168 160 182Q182 172 200 180V200Z" fill="${c}" opacity=".55"/>`;
    const sc = [
      `<circle cx="160" cy="40" r="20" fill="#FFE27A" opacity=".85"/><path d="M160 8v8M160 64v8M128 40h8M184 40h8M138 18l6 6M176 56l6 6M182 18l-6 6M138 62l6-6" ${W}/>` + grass('#4E9E3E'),
      `<path d="M30 46q8-14 22-6q10-12 22 2q12 0 10 12h-58q-6-8 4-8z" fill="#fff" opacity=".7"/>` + `<path d="M0 200V170h200V200Z" fill="#7BC46A" opacity=".5"/><path d="M0 178h200M0 188h200M20 170v30M60 170v30M100 170v30M140 170v30M180 170v30" stroke="#5AA04C" stroke-width="2" opacity=".6"/>`,
      `<circle cx="34" cy="50" r="9" ${W}/><circle cx="52" cy="28" r="5" ${W}/><circle cx="168" cy="60" r="7" ${W}/><circle cx="180" cy="36" r="4" ${W}/>` + `<path d="M0 186q25-12 50 0t50 0t50 0t50 0V200H0Z" fill="#3E7FD0" opacity=".45"/>`,
      `<path d="M100 200L0 120M100 200L60 90M100 200L140 90M100 200L200 120" stroke="rgba(255,255,255,.35)" stroke-width="16"/><g fill="#fff" opacity=".85"><circle cx="30" cy="170" r="6"/><circle cx="170" cy="168" r="6"/></g><g fill="#F4C542"><circle cx="30" cy="170" r="2.5"/><circle cx="170" cy="168" r="2.5"/></g>` + grass('#6FB85A'),
      `<path d="M14 60q10-16 26-6q14-10 24 6z" fill="#fff" opacity=".7"/><path d="M140 40q10-16 26-6q14-10 24 6z" fill="#fff" opacity=".7"/><circle cx="170" cy="96" r="9" fill="#E0685C" opacity=".8"/><path d="M170 87v-8" stroke="#2B3A67" stroke-width="2"/>`,
      `<g opacity=".7"><rect x="12" y="20" width="12" height="180" rx="5" fill="#7BC46A"/><path d="M12 70h12M12 120h12" stroke="#4E9E3E" stroke-width="3"/><path d="M24 60q18-10 26 2q-14 6-26-2z" fill="#7BC46A"/><rect x="176" y="40" width="12" height="160" rx="5" fill="#7BC46A"/><path d="M176 90h12M176 140h12" stroke="#4E9E3E" stroke-width="3"/><path d="M176 80q-18-10-26 2q14 6 26-2z" fill="#7BC46A"/></g>`,
      `<path d="M170 22a20 20 0 1 0 14 34a16 16 0 1 1-14-34z" fill="#FFE9A0" opacity=".9"/><g fill="#fff"><circle cx="30" cy="30" r="2.5"/><circle cx="60" cy="52" r="2"/><circle cx="140" cy="70" r="2"/><circle cx="24" cy="80" r="1.8"/></g>` + grass('#2E5E3E')
    ];
    return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${sc[a]}</svg>`;
  };
  f.bg = k => [['#FF9E6B','#E0453A'],['#7CC4EE','#2E5E9E'],['#C7A6FF','#6B4FD1'],['#FFB3CF','#E0457F'],['#8EE0B4','#2F9E6E'],['#B5E88F','#4E9E3E'],['#FFD27F','#E07A2E']][((+k || 0) % 7 + 7) % 7];
  return f;
})();
// Vật phẩm cửa hàng
const ITEMS = {
  fruit:{i:'🍉', n:'Giỏ hoa quả', d:'Mời 1 người chơi ăn hoa quả: người đó nghỉ 1 lượt', p:30},
  tea:{i:'🧋', n:'Trà sữa', d:'2 lần qua Xuất phát kế tiếp nhận thêm 100', p:40},
  umb:{i:'☂️', n:'Ô dù', d:'Lần trả tiền thuê kế tiếp chỉ trả một nửa', p:30},
  dice:{i:'🎲', n:'Xúc xắc vàng', d:'Lượt này được gieo lại 1 lần nếu không ưng', p:20},
  banhmi:{i:'🥖', n:'Bánh mì', d:'Lượt này đi thêm 2 ô', p:25},
  cafe:{i:'☕', n:'Cà phê sữa đá', d:'Nhận ngay 60 tiền mặt', p:35},
  ot:{i:'🌶️', n:'Ớt hiểm', d:'Chọn 1 người: người đó lùi 3 ô', p:35},
  dua:{i:'🥥', n:'Dừa tươi', d:'Nhận 1 thẻ Ra tù', p:30},
  pho:{i:'🍜', n:'Tô phở', d:'Lần trả tiền thuê kế tiếp được miễn hẳn', p:45}
};
const PLATES = {tre:{n:'Tre xanh', p:50}, sen:{n:'Hoa sen', p:60}, neon:{n:'Đèn neon', p:70}, vang:{n:'Vàng son', p:90}, rong:{n:'Hoàng gia', p:150}, kimcuong:{n:'Kim cương', p:1e9, gem:1}, nganha:{n:'Dải ngân hà', p:1e9, gem:1}, rkvang:{n:'Cúp Vàng', p:1e9, gem:1, rk:1}, rkbk:{n:'Băng Bạch kim', p:1e9, gem:1, rk:1}, rkkc:{n:'Kim cương hạng', p:1e9, gem:1, rk:1}, rkht:{n:'Huyền thoại', p:1e9, gem:1, rk:1}};
// Hàng kim cương: món đẹp và giá trị hơn, chỉ mua bằng kim cương (kim cương có từ nạp thẻ hoặc xem video)
const GEMSHOP = [
  {id:'kimcuong', t:'plate', i:'💎', n:'Bảng tên Kim cương', d:'Lấp lánh đổi màu', p:40},
  {id:'nganha', t:'plate', i:'🌌', n:'Bảng tên Dải ngân hà', d:'Trời sao chuyển động', p:60},
  {id:'chest', t:'chest', i:'🧰', n:'Rương đại gia', d:'Mỗi vật phẩm 2 cái', p:30},
  {id:'safe', t:'coins', i:'🏦', n:'Két 500 xu', d:'Đổi kim cương ra xu', p:25, v:500},
  {id:'loa20', t:'loa', i:'📣', n:'Thùng 20 loa', d:'Nói thả ga kênh Thế giới', p:15, v:20}
];
const PREM = {4:{n:'Rồng', d:'Uy nghi, hên cả năm', p:200}, 5:{n:'Gấu trúc', d:'Tròn trịa, ai cũng mến', p:120}, 6:{n:'Cáo', d:'Tinh ranh, tính trước ba bước', p:120}};
const ITEM_MAX = 3, PACK_MAX = 6, ROUND_LIMIT = 60, TURN_SECS = 17;