/* ===== extensions.js: Đồng bộ modal, ván tân thủ v142, toàn màn hình v143, hiệu ứng chủ phòng ===== */
/* v132: bật lớp mdlon/chaton trên body khi hộp thoại / khung chat mở (thay cho body:has trong CSS) */
(() => { const sync = () => { const m = document.getElementById('modal'), c = document.getElementById('sheetC'); document.body.classList.toggle('mdlon', !!(m && !m.hidden)); document.body.classList.toggle('chaton', !!(c && !c.hidden)); };
  const go = () => { const mo = new MutationObserver(sync); ['modal','sheetC'].forEach(id => { const e = document.getElementById(id); if(e) mo.observe(e, {attributes:true, attributeFilter:['hidden']}); }); sync(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', go); else go(); })();

/* ===== v142: VÁN HƯỚNG DẪN TÂN THỦ =====
   Lần đầu chơi (cấp 1, chưa xem hướng dẫn): ván Chơi với máy đầu tiên thành ván hướng dẫn.
   Đầu ván: chiếu sáng lần lượt từng loại ô trên bàn cờ (bàn cờ tối lại), giải thích ngắn.
   Trong ván: lần đầu gặp tình huống (mua đất, nâng nhà, đấu giá, vay, trả nợ, vào tù, đảo hoang, trả hoặc thu tiền thuê, qua Xuất phát) thì dừng lại giải thích.
   Mỗi bước có nút "Đã hiểu" và "Thoát". Game tạm dừng (PAUSED) trong lúc đọc. */
window.TUTM = (() => {
  const KEY = 'lendoi_tutm';
  const get = () => { try { return localStorage.getItem(KEY) || ''; } catch(e) { return '1'; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch(e) {} };
  const want = () => { const v = get(); if(v==='again') return true; if(v==='1') return false; try { return lvOf(STORE.exp).L <= 1; } catch(e) { return false; } };
  let o = null, cur = null, q = [], seen = {}, iv = null, idx = 0, total = 0, wasPaused = false;
  const cell = i => document.querySelector(`#board .cell[data-i="${i}"]`);
  const cellsOf = k => TILES.map((t,i) => t.k===k ? i : -1).filter(i => i>=0);
  const rot = () => { const b = document.body; return b.classList.contains('rotp') && b.classList.contains('ingame') && !document.documentElement.classList.contains('app'); };
  // body bị xoay 90 độ khi cầm dọc: đổi toạ độ màn hình về toạ độ của body
  const loc = r => rot() ? {l:r.top, t:innerWidth - r.right, w:r.height, h:r.width} : {l:r.left, t:r.top, w:r.width, h:r.height};
  const rects = els => (els || []).filter(Boolean).map(e => { const rr = e.getBoundingClientRect(); return rr.width || rr.height ? loc(rr) : null; }).filter(Boolean);
  const box = els => { let a = null; (els || []).filter(Boolean).forEach(e => { const rr = e.getBoundingClientRect(); if(!rr.width && !rr.height) return; const r = loc(rr);
      a = a ? {l:Math.min(a.l, r.l), t:Math.min(a.t, r.t), r:Math.max(a.r, r.l + r.w), b:Math.max(a.b, r.t + r.h)} : {l:r.l, t:r.t, r:r.l + r.w, b:r.t + r.h}; }); return a; };
  const VW = () => rot() ? innerHeight : innerWidth, VH = () => rot() ? innerWidth : innerHeight;
  function place(){
    if(!o || !cur) return; const dim = o.querySelector('.tdim'), rings = o.querySelector('.trings'), bub = o.querySelector('.tbub'), W = VW(), H = VH(), pad = 6, gap = 10;
    let RS = cur.els ? rects(cur.els()).filter(r => !(r.l + r.w < 0 || r.t + r.h < 0 || r.l > W || r.t > H)) : [];
    for(let ch = true; ch;){ ch = false; for(let i=0;i<RS.length && !ch;i++) for(let j=i+1;j<RS.length;j++){ const A = RS[i], B = RS[j];   // gộp các ô chồng lên nhau (lỗ chồng nhau sẽ bị tô lại)
        if(A.l - 12 < B.l + B.w && B.l - 12 < A.l + A.w && A.t - 12 < B.t + B.h && B.t - 12 < A.t + A.h){ const l = Math.min(A.l, B.l), t = Math.min(A.t, B.t); RS[i] = {l, t, w:Math.max(A.l + A.w, B.l + B.w) - l, h:Math.max(A.t + A.h, B.t + B.h) - t}; RS.splice(j, 1); ch = true; break; } } }
    dim.style.clipPath = RS.length ? `path(evenodd, "M0 0H${W}V${H}H0Z ${RS.map(r => `M${r.l - pad} ${r.t - pad}h${r.w + pad*2}v${r.h + pad*2}h${-(r.w + pad*2)}Z`).join(' ')}")` : 'none';
    const sig = RS.map(r => [r.l, r.t, r.w, r.h].map(Math.round).join(',')).join('|');
    if(rings.dataset.sig!==sig){ rings.dataset.sig = sig; rings.innerHTML = RS.map(r => `<i style="left:${r.l - pad}px;top:${r.t - pad}px;width:${r.w + pad*2}px;height:${r.h + pad*2}px"></i>`).join(''); }
    const bw = Math.min(cur.wide ? 360 : 310, W - 24); bub.style.width = bw + 'px'; const bh = bub.offsetHeight;
    let a = cur.els ? box(cur.els()) : null;
    if(a && (a.r < 0 || a.b < 0 || a.l > W || a.t > H)) a = null;               // ô đang nằm ngoài màn hình: chỉ hiện lời giải thích
    if(!a){ bub.style.left = ((W - bw)/2) + 'px'; bub.style.top = Math.max(10, (H - bh)/2) + 'px'; return; }
    const L = a.l - pad, T = a.t - pad, R = a.r + pad, B = a.b + pad;
    const cx = Math.max(12, Math.min(W - bw - 12, (L + R)/2 - bw/2)), cy = Math.max(10, Math.min(H - bh - 10, (T + B)/2 - bh/2));
    const opts = [[cx, B + gap, B + gap + bh <= H - 6], [cx, T - gap - bh, T - gap - bh >= 6], [R + gap, cy, R + gap + bw <= W - 6], [L - gap - bw, cy, L - gap - bw >= 6]];
    let pick = opts.find(x => x[2]);
    if(!pick){ const sp = [H - B, T, W - R, L], k = sp.indexOf(Math.max(...sp)); pick = opts[k]; pick[0] = Math.max(8, Math.min(W - bw - 8, pick[0])); pick[1] = Math.max(8, Math.min(H - bh - 8, pick[1])); }
    bub.style.left = pick[0] + 'px'; bub.style.top = pick[1] + 'px';
  }
  function paint(){
    const bub = o.querySelector('.tbub'), n = cur.n ? `<small>${cur.n}</small>` : '';
    bub.innerHTML = cur.ask ? `<b>Thoát hướng dẫn?</b><p>Bạn có thể chơi tiếp ván này mà không có hướng dẫn, hoặc về trang chính. Xem lại hướng dẫn bất cứ lúc nào ở ⚙️ › 📖 Hướng dẫn.</p><div class="tbtns tb3"><button type="button" class="btn" data-t="back">‹ Quay lại</button><button type="button" class="btn" data-t="home">Về trang chính</button><button type="button" class="btn primary" data-t="off">Chơi tiếp</button></div>`
      : `${n}<b>${cur.t}</b><p>${cur.d}</p><div class="tbtns"><button type="button" class="btn" data-t="quit">Thoát</button><button type="button" class="btn primary" data-t="next">${cur.last ? 'Bắt đầu chơi 🎲' : 'Đã hiểu'}</button></div>`;
    place();
  }
  function open(){ if(o) return; o = document.createElement('div'); o.id = 'tutM'; o.innerHTML = '<div class="tdim"></div><div class="trings"></div><div class="tbub" role="dialog" aria-live="polite"></div>'; document.body.appendChild(o);
    o.addEventListener('click', onClick); iv = setInterval(place, 350); window.addEventListener('resize', place); }
  function close(){ clearInterval(iv); window.removeEventListener('resize', place); if(o) o.remove(); o = null; cur = null; }
  function show(st){ if(!o){ wasPaused = PAUSED; open(); } cur = st; PAUSED = true; paint(); try { SFX.play('pop'); } catch(e) {} }
  function next(){ const st = cur; if(st && st.intro) idx++; if(st && st.last) set('1');
    if(q.length){ show(q.shift()); return; } close(); PAUSED = wasPaused && false; }
  function stopAll(){ q = []; if(S) S.tutm = false; set('1'); close(); PAUSED = false; }
  function onClick(e){ const b = e.target.closest('[data-t]'); if(!b) return; try { SFX.play('click'); } catch(err) {}
    const t = b.dataset.t;
    if(t==='next') next();
    else if(t==='quit'){ cur = Object.assign({}, cur, {ask:true, back:cur}); paint(); }
    else if(t==='back'){ cur = cur.back; paint(); }
    else if(t==='off') stopAll();
    else if(t==='home'){ stopAll(); setTimeout(() => { if(S && window.leaveSoon){ S.leave = true; window.leaveSoon(); } }, 50); } }
  const T = (t, d, els, x) => Object.assign({t, d, els}, x || {});
  function intro(){
    const one = k => { const i = TILES.findIndex(x => x.k===k); return i>=0 ? () => [cell(i)] : null; }, all = (...ks) => () => ks.flatMap(cellsOf).map(cell);
    const g0 = TILES.find(x => x.k==='land').g, land = () => TILES.map((x,i) => x.k==='land' && x.g===g0 ? cell(i) : null);
    const L = [
      T('👋 Chào mừng tới Lên Voi Xuống Chó!', 'Đây là <b>ván hướng dẫn</b>. Mục tiêu: mua đất, xây nhà, thu tiền thuê. Hết ván, ai có <b>tổng tài sản lớn nhất</b> thì thắng. Cùng xem từng ô trên bàn cờ nhé!', null, {wide:true}),
      T('🙋 Đây là bạn', 'Khung của bạn: <b>tiền mặt</b>, số ô đất đang có và <b>thứ hạng</b> trong ván.', () => [document.querySelector(`.pc[data-p="${S.viewer}"]`)]),
      one('go') && T('🚩 Xuất phát', 'Mỗi lần đi qua ô này bạn nhận <b>200</b>.', one('go')),
      T('🏠 Ô đất', 'Số trên ô là <b>giá mua</b>. Dừng ở ô trống thì được mua. Ai dừng ở đất của bạn phải <b>trả tiền thuê</b> cho bạn. Mỗi màu là một nhóm: gom đủ nhóm được <b>huy hiệu</b> và tiền thuê tăng mạnh.', land),
      one('air') && T('✈️ Sân bay', 'Có càng nhiều sân bay, tiền thuê càng cao (25 → 300). Đủ 4 sân bay thì được bay tới ô bất kỳ.', all('air')),
      one('co') && T('💡 Công ty Điện · 💧 Nước', 'Tiền thuê = số xúc xắc × 4, có cả hai công ty thì × 10. Chủ công ty được <b>cắt điện nước</b> một ô đất của người khác.', all('co')),
      (one('chance') || one('fortune')) && T('❓ Cơ hội · 🍀 Khí vận', 'Dừng ở đây thì <b>rút một thẻ</b>: có thẻ may (được tiền, đi tiếp) và thẻ xui (mất tiền, lùi bước).', all('chance', 'fortune')),
      one('tax') && T('💰 Thuế thu nhập', 'Nộp <b>10% tiền mặt</b> đang có vào Quỹ phúc lợi.', all('tax')),
      one('gotojail') && T('🔒 Vào tù', 'Bị giam. Nộp 100, dùng thẻ Ra tù hoặc <b>gieo ra đôi</b> để ra. Đang bị giam chỉ thu được nửa tiền thuê.', one('gotojail')),
      one('island') && T('🏝️ Đảo hoang', 'Bị giam <b>4 lượt</b>. Nộp 100 để đi tiếp, hoặc kéo 1 người vào cùng: mỗi người 2 lượt.', one('island')),
      one('fund') && T('🏦 Quỹ phúc lợi', 'Thuế và tiền phạt chảy vào Quỹ. Dừng ở đây <b>gieo ra đôi là ăn trọn Quỹ</b>, không ra đôi nhận 10%.', one('fund')),
      one('startup') && T('🚀 Khởi nghiệp', 'Rót 100 đến 300 mở công ty. Mỗi lần qua Xuất phát, công ty có thể <b>lớn gấp rưỡi</b>, đứng yên hoặc phá sản. Tới lượt thì bán lấy tiền.', one('startup')),
      one('gift') && T('🎁 Hộp quà bí ẩn', 'Quà ngẫu nhiên: được đi thêm lượt, đổi chỗ với người khác, hoặc mất 30.', one('gift')),
      one('grave') && T('🪦 Nghĩa trang', 'Bị ma hù, mất 200.', all('grave')),
      (one('visit') || one('park')) && T('🦁 Vườn thú · 🌳 Công viên', 'Ô nghỉ chân, dừng ở đây không mất gì.', all('visit', 'park')),
      T('🎲 Nút GIEO', 'Tới lượt bạn thì bấm <b>GIEO</b>. Có 17 giây, hết giờ game tự gieo. Gieo ra đôi được đi thêm lượt.', () => [document.getElementById('rollBtn')]),
      T('🎒 Túi đồ', 'Trước khi gieo, mở Túi đồ để dùng vật phẩm: ô dù giảm tiền thuê, hoa quả bắt người khác nghỉ lượt…', () => [document.getElementById('bagBtn')]),
      T('✅ Sẵn sàng rồi!', 'Trong ván, mỗi khi có tình huống mới như <b>mua đất, đấu giá, vay tiền</b>, game sẽ dừng lại giải thích. Bắt đầu thôi!', null, {last:true, wide:true})
    ].filter(Boolean);
    total = L.length; L.forEach((s, k) => { s.intro = true; s.n = (k+1) + '/' + total; });
    q = L.slice(1); show(L[0]);
  }
  // nội dung giải thích theo tình huống (mỗi loại chỉ một lần)
  const modal = () => [document.getElementById('mOpts')], bidEls = () => [document.querySelector('#mBody .bidrow'), document.getElementById('mOpts')], panel = () => [document.querySelector(`.pc[data-p="${S.viewer}"]`)];
  const EV = {
    buy: T('🏠 Mua đất', 'Bấm <b>Mua</b> để sở hữu ô này. Thiếu tiền thì nút đổi thành <b>Vay</b>. <b>Mở đấu giá kín</b>: mọi người cùng trả giá, ai trả cao nhất được ô, bạn hưởng 10% hoa hồng. <b>Bỏ qua</b>: không mua.', modal, {wide:true}),
    build: T('🏗️ Nâng cấp nhà', 'Về lại đất của mình thì được nâng nhà. Nhà càng cao, <b>tiền thuê càng lớn</b>. Cao nhất là Cao ốc.', modal),
    bid: T('🔨 Đấu giá kín', 'Nhập giá muốn trả, không thấp hơn <b>giá sàn</b>. Không ai thấy giá của nhau, <b>giá cao nhất thắng</b>. Bấm Chốt giá, hoặc bỏ qua.', bidEls, {wide:true}),
    loan: T('🏦 Vay tiền', '<b>Vay ngân hàng</b>: thế chấp nhà, lãi thấp. <b>Vay xã hội</b>: không cần thế chấp nhưng lãi cao, trễ hạn bị đòi gắt. Mỗi vòng phải trả lãi.', modal, {wide:true}),
    debt: T('🏦 Trả nợ khi qua vòng', 'Các khoản vay tính lãi mỗi vòng. Bạn chọn trả hết, chỉ trả lãi, hoặc để sau (lãi cộng vào nợ).', modal),
    jail: T('🚓 Đang bị giam', 'Nộp tiền để ra ngay, hoặc gieo tìm đôi: ra đôi là được ra miễn phí.', modal),
    island: T('🏝️ Đảo hoang', 'Nộp tiền để đi tiếp, chịu giam, hoặc kéo một người vào cùng để mỗi người chỉ bị giam 2 lượt.', modal),
    rent: T('💸 Trả tiền thuê', 'Bạn vừa dừng ở đất của người khác nên phải <b>trả tiền thuê</b> cho họ. Đất có nhà càng cao, tiền thuê càng đắt.', panel),
    rentIn: T('💰 Thu tiền thuê', 'Có người dừng ở đất của bạn và <b>trả tiền thuê cho bạn</b>. Càng nhiều đất, càng nhiều tiền!', panel),
    go: T('🚩 Qua Xuất phát', 'Bạn vừa đi qua Xuất phát và nhận <b>+200</b>.', panel),
    tax: T('💰 Nộp thuế', 'Ô Thuế thu nhập: nộp 10% tiền mặt vào Quỹ phúc lợi.', panel)
  };
  // hộp thoại đúng loại đang mở (để không giải thích nhầm hộp khác)
  const ttl = () => (document.getElementById('mTitle') || {}).textContent || '';
  const MCHK = {buy: () => !!document.querySelector('#mBody .buyp'), build: () => /^Về nhà/i.test(ttl()), bid: () => !!document.getElementById('bidIn'),
    loan: () => /vay/i.test(ttl()) || /Vay tối đa/.test((document.getElementById('mBody') || {}).textContent || ''), debt: () => !!document.querySelector('#mBody .dblist'), jail: () => /giam/i.test(ttl()), island: () => /Đảo hoang/i.test(ttl())};
  return {
    want, again: () => set('again'), done: () => get()==='1',
    // gọi khi ván bắt đầu: chờ lật bài chọn lượt xong rồi mở phần giới thiệu bàn cờ
    begin(){ seen = {}; idx = 0; set('1'); let n = 0; const go = () => { if(!S || !S.tutm) return; if(document.getElementById('orderFx') || document.getElementById('modal').hidden===false || !document.querySelector('#board .cell')){ if(++n < 120) setTimeout(go, 400); return; } setTimeout(intro, 500); }; setTimeout(go, 800); },
    ev(k){ if(!S || !S.tutm || seen[k] || !EV[k] || (typeof HEADLESS!=='undefined' && HEADLESS)) return; seen[k] = 1; const st = Object.assign({}, EV[k]), chk = MCHK[k];
      if(!chk){ setTimeout(() => { if(!S || !S.tutm) return; if(cur) q.push(st); else show(st); }, 700); return; }
      let n = 0; const tick = () => { if(!S || !S.tutm) return; const m = document.getElementById('modal'); if(m && !m.hidden && chk()){ if(cur) q.push(st); else show(st); return; } if(++n < 60) setTimeout(tick, 80); else delete seen[k]; }; tick(); },
    stop: stopAll, active: () => !!o
  };
})();

/* ===== v143: TOÀN MÀN HÌNH trên web điện thoại =====
   - Android Chrome, máy tính, iPad: Fullscreen API. Tự bật ở lần chạm đầu tiên trên điện thoại (trình duyệt chỉ cho bật sau một lần chạm), có nút ⛶ ở trang chính và trong ⚙️ Hệ thống.
   - iPhone Safari: Apple không cho trang web tự bật toàn màn hình. Cách duy nhất là "Thêm vào Màn hình chính": mở từ biểu tượng đó game chạy toàn màn hình như app (manifest + apple-mobile-web-app-capable). Game hiện hướng dẫn từng bước.
   - Trình duyệt trong Facebook, Messenger, Zalo, Instagram, TikTok: không bật được toàn màn hình, hướng dẫn mở bằng Safari hoặc Chrome. */
window.FS_ = (() => {
  const ua = navigator.userAgent || '', d = document, de = d.documentElement;
  const iOS = /iPhone|iPod/.test(ua) || (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !de.requestFullscreen && !de.webkitRequestFullscreen);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Zalo|Messenger|Line\/|TikTok|musical_ly|BytedanceWebview|; wv\)/i.test(ua);
  const app = () => (typeof IS_APP!=='undefined' && IS_APP) || (window.matchMedia && ((matchMedia('(display-mode: fullscreen)').matches && !(d.fullscreenElement || d.webkitFullscreenElement)) || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone===true;
  const can = () => !!(de.requestFullscreen || de.webkitRequestFullscreen);
  const on = () => app() || !!(d.fullscreenElement || d.webkitFullscreenElement);
  const touch = () => !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const enter = () => { try { const p = de.requestFullscreen ? de.requestFullscreen({navigationUI:'hide'}) : de.webkitRequestFullscreen ? de.webkitRequestFullscreen() : null;
      return Promise.resolve(p).then(() => { try { if(touch() && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch(e) {} }).catch(() => {}); } catch(e) { return Promise.resolve(); } };
  const exit = () => { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch(e) {} };
  const step = (n, t) => `<li><b>${n}</b><span>${t}</span></li>`;
  function guide(){
    const share = '<i class="fsico">⬆️</i>';
    const body = inApp
      ? `<p class="fsp">Bạn đang mở game trong ứng dụng ${/Zalo/i.test(ua) ? 'Zalo' : /Instagram/i.test(ua) ? 'Instagram' : /TikTok|musical_ly|Bytedance/i.test(ua) ? 'TikTok' : 'Facebook'}, ở đây không bật được toàn màn hình.</p><ol class="fsg">${step(1, 'Bấm nút <b>⋯</b> hoặc <b>⋮</b> ở góc màn hình')}${step(2, `Chọn <b>Mở bằng ${iOS ? 'Safari' : 'Chrome'}</b> (hoặc "Mở trong trình duyệt")`)}${step(3, iOS ? 'Trong Safari, làm theo hướng dẫn thêm game vào Màn hình chính' : 'Trong Chrome, bấm ⛶ để chơi toàn màn hình')}</ol>`
      : `<p class="fsp">iPhone không cho trang web tự bật toàn màn hình. Thêm game vào <b>Màn hình chính</b> một lần, sau đó mở từ biểu tượng là chơi toàn màn hình như app.</p><ol class="fsg">${step(1, `Bấm nút <b>Chia sẻ</b> ${share} ở thanh dưới của Safari`)}${step(2, 'Kéo xuống, chọn <b>Thêm vào MH chính</b>')}${step(3, 'Bấm <b>Thêm</b>, rồi mở game bằng biểu tượng <b>Lên Voi Xuống Chó</b> trên màn hình')}</ol>`;
    openModal(inApp ? '🌐 Mở bằng trình duyệt' : '📲 Chơi toàn màn hình', body, [{label:'Đã hiểu', primary:true, fn:closeModal}], 'one fsdlg');
  }
  function toggle(){ if(on() && !app()){ exit(); return; } if(app()) return; if(can() && !inApp) enter(); else guide(); }
  const paint = () => { const b = d.getElementById('homeFs'); if(!b) return; b.hidden = app() || !touch(); b.textContent = on() ? '🗗' : '⛶'; b.setAttribute('aria-label', on() ? 'Thoát toàn màn hình' : 'Toàn màn hình'); };
  d.addEventListener('fullscreenchange', paint); d.addEventListener('webkitfullscreenchange', paint);
  // tự bật ở lần chạm đầu tiên trên điện thoại (Android Chrome); không bật trên máy tính để khỏi làm phiền
  let tried = false;
  d.addEventListener('pointerup', e => { if(tried || app() || !touch() || !can() || inApp || on()) return; if(e.target && e.target.closest && e.target.closest('input,textarea,select,#loginFx a')) return; tried = true; enter(); }, true);
  // gợi ý một lần mỗi 3 ngày cho iPhone Safari và trình duyệt trong app: dải nhỏ ở trang chính
  function hint(){ if(app() || !touch() || (can() && !inApp)) return; let last = 0; try { last = +localStorage.getItem('lendoi_fshint') || 0; } catch(e) {} if(Date.now() - last < 3*864e5) return;
    const t = () => { if(d.body.dataset.scr!=='home' || d.body.classList.contains('splash') || d.getElementById('loginFx') || !d.getElementById('modal').hidden){ setTimeout(t, 2000); return; }
      try { localStorage.setItem('lendoi_fshint', Date.now()); } catch(e) {}
      const h = d.createElement('div'); h.id = 'fsHint'; h.innerHTML = `<span>${inApp ? '🌐 Mở bằng trình duyệt để chơi toàn màn hình' : '📲 Thêm vào Màn hình chính để chơi toàn màn hình'}</span><button type="button" class="fsgo">Cách làm</button><button type="button" class="fsx" aria-label="Đóng">✕</button>`;
      d.body.appendChild(h); h.querySelector('.fsgo').onclick = () => { h.remove(); guide(); }; h.querySelector('.fsx').onclick = () => h.remove(); setTimeout(() => h.remove(), 15000); };
    setTimeout(t, 4000); }
  const init = () => { const b = d.getElementById('homeFs'); if(b) b.onclick = () => { try { SFX.play('click'); } catch(e) {} toggle(); }; paint(); hint(); };
  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded', init); else init();
  return {on, app, can, toggle, guide, enter, iOS, inApp};
})();

/* ===== Chơi chung: khách thấy đủ hiệu ứng như chủ phòng =====
   Chủ phòng ghi lại từng lời gọi hiệu ứng (quân nảy từng bước, xu bay, rung bàn, biển tên ô, xây nhà, xe cảnh sát, camera...) và tiếng lẻ,
   gửi cùng gói với trạng thái mới nhất; khách áp trạng thái rồi chạy lại đúng các hàm đó. Hiệu ứng gọi bên trong hiệu ứng khác không gửi lại. */
(() => {
  const FX = ['czHop','czHopEnd','czFly','fxShake','fxLight','fxSign','fxNum','fxLose','fxGain','fxEmote','fxBuild','fxBuildDust','cornerNote','policeRide','camTo','camReset'];
  const SND = new Set(['step','fly','land','go','isle','coin','coinbig','lose','buy','build','hotel','saw','cry']);
  const ORIG = {}; let depth = 0, queued = false;
  const isP = v => !!(v && typeof v==='object' && S && S.players && S.players.indexOf(v) >= 0);
  const enc = v => isP(v) ? {_p:v.id} : (typeof v==='function' ? null : v);
  const dec = v => (v && typeof v==='object' && v._p!=null) ? (S && S.players[v._p]) || null : v;
  const live = () => netHost() && !depth;
  const out = (f, a) => { FXQ.push([f, a.map(enc)]); if(FXQ.length > 80) FXQ.splice(0, FXQ.length - 80);
    if(!queued){ queued = true; queueMicrotask(() => { queued = false; if(FXQ.length) netSync(true); }); } };
  FX.forEach(f => { const o = window[f]; if(typeof o!=='function') return; ORIG[f] = o;
    window[f] = function(...a){ if(live() && !(f==='fxLight' && !a[1])) out(f, a);   /* fxLight nhỏ (mỗi bước) không làm gì */ depth++; try { return o.apply(this, a); } finally { depth--; } }; });
  const play0 = SFX.play, tile0 = SFX.tile;
  SFX.play = function(n, ...a){ if(live() && SND.has(n)) out('~play', [n, ...a]); return play0.call(this, n, ...a); };
  SFX.tile = function(n){ if(live()) out('~tile', [n]); return tile0.call(this, n); };
  // khách: chạy lại (không gửi đi đâu vì khách không phải chủ phòng)
  window.FXPLAY = list => (list || []).slice(0, 80).forEach(x => { try {
    const f = x[0], a = (x[1] || []).map(dec);
    if(f==='~play') play0.apply(SFX, a); else if(f==='~tile') tile0.apply(SFX, a);
    else if(ORIG[f] && !a.some((v, k) => v===null && x[1][k] && x[1][k]._p!=null)){ if(f==='camTo' && typeof warmPts==='function') warmPts(); ORIG[f](...a); }
  } catch(e) {} });
})();