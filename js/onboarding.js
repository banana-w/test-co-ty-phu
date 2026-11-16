/* ===== onboarding.js: Hướng dẫn người chơi mới (v130) ===== */
/* ===== Người chơi mới (v130): đặt tên sau khi đăng nhập Google, rồi giới thiệu các mục trong giao diện và luật chơi ===== */
window.ONB = (() => {
  const D = () => STORE.dump(), mark = (k) => { D()[k] = 1; STORE.setName(STORE.name || ''); };
  const ready = () => document.body.dataset.scr==='home' && !document.body.classList.contains('splash') && !document.getElementById('loginFx') && document.getElementById('modal').hidden;
  const when = fn => { const t = () => ready() ? fn() : setTimeout(t, 700); t(); };
  const esc2 = v => String(v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // ----- đặt tên
  function askName(u, next){
    const dn = (u && u.displayName ? u.displayName.trim().split(/\s+/).slice(-1)[0] : '') || '';
    const pre = (STORE.name && STORE.name!=='Bạn') ? STORE.name : dn;
    openModal('👋 Chào người chơi mới!', `<div class="onbname"><p>Đặt tên hiển thị của bạn. Mọi người sẽ thấy tên này ở bàn chơi, bảng xếp hạng và kênh chat.</p>
      <input id="onbN" maxlength="14" autocomplete="off" value="${esc2(pre)}" placeholder="Tên của bạn" aria-label="Tên hiển thị"><small id="onbE" class="onberr">2 đến 14 ký tự, gồm chữ, số và khoảng trắng.</small></div>`,
      [{label:'Xong', primary:true, fn: async () => {
        const inp = document.getElementById('onbN'), er = document.getElementById('onbE'), v = (inp.value || '').trim().replace(/\s+/g, ' ');
        const bad = t => { er.textContent = t; er.classList.add('on'); inp.focus(); };
        if(v.length < 2 || v.length > 14) return bad('Tên cần từ 2 đến 14 ký tự.');
        if(!/^[\p{L}\p{N} ]+$/u.test(v)) return bad('Tên chỉ gồm chữ, số và khoảng trắng.');
        if(/🤖|^máy\s*\d*$|^bạn$/i.test(v)) return bad('Chọn tên khác nhé.');
        er.textContent = 'Đang kiểm tra tên…'; er.classList.remove('on');
        try { const db = await FBNET.db(), me = window.FR_ ? window.FR_.uid() : '', sn = await db.ref('users').orderByChild('n').equalTo(v).limitToFirst(3).once('value');
          let taken = false; sn.forEach(c => { if(c.key!==me) taken = true; }); if(taken) return bad('Tên này đã có người dùng, chọn tên khác nhé.'); } catch(e) {}
        D().named = 1; STORE.setName(v); try { window.FR_ && window.FR_.touch(); } catch(e) {} try { window.paintCoins && window.paintCoins(); } catch(e) {}
        closeModal(); next && next(); }}], 'onbdlg');
    setTimeout(() => { const i = document.getElementById('onbN'); if(i) i.onkeydown = e => { if(e.key==='Enter'){ const b = document.querySelector('#mOpts .btn.primary'); if(b) b.click(); } }; }, 50);
  }
  // ----- giới thiệu các mục ở trang chính: chiếu sáng từng chỗ, có lời giải thích
  const STEPS = [
    ['.pan.pA, .lob .pA', '🎲 Chơi với máy', 'Vào ván ngay với 1 đến 3 máy. Chọn con vật, ván nhanh 20 vòng hoặc ván dài 60 vòng.'],
    ['#homeProf', '🐮 Hồ sơ', 'Đổi con vật, mặc trang phục, chọn đồ mang vào ván và đeo danh hiệu. Mọi người sẽ thấy bạn như thế này.'],
    ['.pan.pB', '🤝 Chơi với bạn', 'Tạo phòng riêng rồi gửi mã cho bạn bè cùng vào chơi.'],
    ['.pShop', '🛍️ Cửa hàng', 'Mua trang phục, bảng tên, nhân vật mới và vật phẩm bằng xu hoặc kim cương.'],
    ['.pan.pE', '🏆 Xếp hạng', 'Đấu với người chơi thật. Thắng lên điểm, leo từ hạng Đồng lên các hạng cao hơn.'],
    ['#homeQuest', '🎯 Nhiệm vụ', 'Việc nhỏ mỗi ngày và nhiệm vụ theo cấp. Làm xong nhận xu và kinh nghiệm.'],
    ['#homeDaily', '📅 Điểm danh', 'Vào game mỗi ngày bấm điểm danh để nhận quà.'],
    ['#homePals', '👥 Bạn bè', 'Kết bạn bằng mã 8 số hoặc tên, nhắn tin riêng, tặng quà cho nhau.'],
    ['#homeMail', '✉️ Hộp thư', 'Quà tặng và thông báo mới từ game gửi vào đây.'],
    ['#ticker', '📣 Kênh Thế giới', 'Tin của mọi người chạy ở đây. Chạm vào để chat với tất cả người chơi, mỗi câu tốn 1 loa.'],
    ['.cmtop .walpill, .lob .walpill', '🪙 Ví', 'Xu và kim cương của bạn. Bấm vào để tới Cửa hàng.']
  ];
  const RULES = [
    ['🎯 Mục tiêu', 'Mua đất, xây nhà, thu tiền thuê. Hết số vòng, ai có tổng tài sản lớn nhất thì thắng. Người phá sản bị loại.'],
    ['🎲 Mỗi lượt', 'Bấm GIEO để đi. Dừng ở ô đất trống: mua, đấu giá kín hoặc bỏ qua. Mỗi lượt có 17 giây, hết giờ game tự làm.'],
    ['❓ Ô đặc biệt', 'Cơ hội và Khí vận: rút thẻ may hoặc xui. Quỹ: gieo ra đôi là ăn trọn Quỹ. Khởi nghiệp: rót vốn chờ công ty lớn lên.'],
    ['💡 Mẹo nhỏ', 'Gom đủ nhóm màu để có huy hiệu. Đủ 4 sân bay được bay tới ô bất kỳ. Lần đầu vào ván sẽ có gợi ý nhỏ chỉ cách chơi.']
  ];
  function tour(done){
    const L = STEPS.map(([sel, t, d]) => [document.querySelector(sel), t, d]).filter(x => x[0] && x[0].getClientRects().length);
    const o = document.createElement('div'); o.id = 'tutFx'; o.innerHTML = '<div class="tspot"></div><div class="tbub"></div>'; document.body.appendChild(o);
    const spot = o.querySelector('.tspot'), bub = o.querySelector('.tbub'); let i = 0;
    const end = () => { o.remove(); window.removeEventListener('resize', place); done && done(); };
    function place(){ const it = L[i]; if(!it) return; const r = it[0].getBoundingClientRect(), pad = 6, W = innerWidth, H = innerHeight;
      Object.assign(spot.style, {left:(r.left - pad) + 'px', top:(r.top - pad) + 'px', width:(r.width + pad*2) + 'px', height:(r.height + pad*2) + 'px'});
      const bw = Math.min(300, W - 24); bub.style.width = bw + 'px';
      const bh = bub.offsetHeight, below = r.bottom + pad + 10 + bh < H;
      bub.style.top = (below ? r.bottom + pad + 10 : Math.max(8, r.top - pad - 10 - bh)) + 'px';
      bub.style.left = Math.max(12, Math.min(W - bw - 12, r.left + r.width/2 - bw/2)) + 'px'; }
    function show(){ const it = L[i]; if(!it){ end(); return; } try { it[0].scrollIntoView({block:'nearest'}); } catch(e) {}
      bub.innerHTML = `<small>${i+1}/${L.length}</small><b>${it[1]}</b><p>${it[2]}</p><div class="tbtns"><button type="button" class="btn" data-t="skip">Bỏ qua</button><button type="button" class="btn primary" data-t="next">${i===L.length-1 ? 'Xem luật chơi ›' : 'Tiếp ›'}</button></div>`;
      place(); }
    o.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if(!b){ return; } try { SFX.play('click'); } catch(err) {} if(b.dataset.t==='skip'){ o.remove(); window.removeEventListener('resize', place); done && done(true); return; } i++; show(); });
    window.addEventListener('resize', place); show();
  }
  function rules(done){
    let i = 0;
    const page = () => { const r = RULES[i];
      openModal(r[0], `<div class="onbrule"><p>${r[1]}</p><div class="onbdots">${RULES.map((x, j) => `<i class="${j===i ? 'on' : ''}"></i>`).join('')}</div></div>`,
        [{label:i===RULES.length-1 ? '🎲 Vào chơi thôi!' : 'Tiếp ›', primary:true, fn: () => { closeModal(); i++; if(i < RULES.length) page(); else done && done(); }},
         {label:'Bỏ qua', fn: () => { closeModal(); done && done(); }}], 'onbdlg'); };
    page();
  }
  let busy = false;   /* đăng nhập có thể báo hai lần: chỉ chạy một luồng tân thủ */
  function after(isNew, u){
    if(busy) return; busy = true;
    const d = D(), veteran = !isNew && STORE.name && STORE.name!=='Bạn';
    if(veteran){ if(!d.named || !d.tut){ d.named = 1; d.tut = 1; STORE.setName(STORE.name); } return; }
    const doTut = () => { if(D().tut) return;
      /* v142: người mới vào thẳng ván hướng dẫn với máy; chơi xong quay về trang chính mới giới thiệu các mục ở trang chính */
      if(window.TUTM && window.TUTM.want()){ when(() => { try { if(!localStorage.getItem('lendoi_len')) localStorage.setItem('lendoi_len', 'q'); } catch(e) {} const sb = document.getElementById('startBtn'); if(sb) sb.click();
          setTimeout(() => when(() => tour(() => mark('tut'))), 4000); }); return; }
      when(() => tour(skipped => { mark('tut'); if(!skipped) rules(); })); };
    if(!d.named) when(() => askName(u, doTut)); else doTut();
    if(d.named && d.tut) busy = false;
  }
  return { after, tour: () => when(() => tour(sk => { if(!sk) rules(); })) };
})();

/* bản local: không đăng nhập; người mới vẫn được đặt tên rồi vào ván hướng dẫn */
setTimeout(() => { try { window.ONB && window.ONB.after(!STORE.name || STORE.name==='Bạn', null); } catch(e) {} }, 0);