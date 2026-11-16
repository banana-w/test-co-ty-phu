/* ===== data.js: Hằng số bàn cờ TILES, màu sắc địa phương, biểu tượng ===== */

const HEADLESS = typeof document === 'undefined';
const IS_APP = !HEADLESS && !!window.IS_APP;
const LAND = !HEADLESS && document.documentElement.classList.contains('land');   // bố cục ngang cho mọi màn hình
const G = {nau:'#B08A62',xn:'#79BEDC',hong:'#E29DB4',cam:'#EBA65A',do:'#DF6F61',vang:'#E3C04C',xl:'#86BC82',xd:'#6079B8',sb:'#98A4B3'};
const GN = {nau:'Miền Tây',xn:'Tây Nguyên',hong:'Tây Bắc',cam:'Bắc Trung Bộ',do:'Miền Bắc',vang:'Miền Trung',xl:'TP. Hồ Chí Minh',xd:'Hà Nội'};
const PC = ['#E0685C','#5FA8D3','#E6B44A','#9B7BC4'], PT = ['#FFFFFF','#FFFFFF','#2B3A67','#FFFFFF'];
const PA = ['🐯','🐃','🐘','🐓'], PAN = ['Hổ','Trâu','Voi','Gà'];
const L = (n,g,p,b) => ({k:'land',n,g,p,b});
const A = n => ({k:'air',n:'Sân bay '+n,p:200,i:'✈️',g:'sb'});
const AIR_RENT = [25,50,100,200];   // thuê sân bay theo số sân bay cùng chủ (đủ 4 trước là 300)
const CH = {k:'chance',n:'Cơ hội',i:'❓'}, KV = {k:'fortune',n:'Khí vận',i:'🍀'}, TX = {k:'tax',n:'Thuế thu nhập',i:'💰'}, GV = {k:'grave',n:'Nghĩa trang',i:'🪦'};
const TILES = [
  {k:'go',n:'Xuất phát',i:'🚩'},
  L('An Giang','nau',60,50), KV, L('Cà Mau','nau',80,50), TX, A('Tân Sơn Nhất'),
  L('Đắk Lắk','xn',100,50), CH, L('Langbiang','xn',100,50), {k:'gift',n:'Hộp quà bí ẩn',i:'🎁'}, L('Đà Lạt','xn',120,50),
  {k:'visit',n:'Vườn thú',i:'🦁'},
  L('Lũng Cú','hong',140,100), {k:'co',n:'Công ty Điện',p:150,i:'💡'}, L('Yên Bái','hong',140,100), L('Sa Pa','hong',160,100), A('Cam Ranh'),
  L('Quảng Bình','cam',180,100), {k:'island',n:'Đảo hoang',i:'🏝️'}, L('Tràng Tiền','cam',180,100), KV, L('Huế','cam',200,100),
  {k:'park',n:'Công viên',i:'🌳'},
  L('Tràng An','do',220,150), CH, L('Cát Bà','do',220,150), L('Hạ Long','do',240,150), A('Đà Nẵng'),
  L('Nha Trang','vang',260,150), L('Đà Nẵng','vang',260,150), {k:'co',n:'Công ty Nước',p:150,i:'💧'}, L('Hội An','vang',280,150), {k:'fund',n:'Quỹ phúc lợi',i:'🏦'},
  {k:'gotojail',n:'Vào tù',i:'🔒'},
  L('Nhà thờ Đức Bà','xl',300,200), L('Nguyễn Huệ','xl',300,200), KV, L('Bến Thành','xl',320,200), A('Nội Bài'),
  {k:'startup',n:'Khởi nghiệp',i:'🚀'}, L('Chùa Một Cột','xd',350,200), CH, TX, L('Hoàn Kiếm','xd',400,200)
];
const LICON = {'An Giang':'🛶','Cà Mau':'🌴','Đắk Lắk':'🐘','Langbiang':'⛰️','Đà Lạt':'🌸','Lũng Cú':'🚩','Yên Bái':'🌾','Sa Pa':'🏔️',
  'Quảng Bình':'🦇','Tràng Tiền':'🌉','Huế':'🏯','Tràng An':'🚣','Cát Bà':'🏝️','Hạ Long':'⛵','Nha Trang':'🏖️','Đà Nẵng':'🐉','Hội An':'🏮',
  'Nhà thờ Đức Bà':'⛪','Nguyễn Huệ':'🌆','Bến Thành':'🛍️','Chùa Một Cột':'🛕','Hoàn Kiếm':'🐢'};
const {build:czBuild, buildSide:czBuildSide} = (() => {
const N='#2b3a67', S=`stroke="${N}"`;
const st=(w=5)=>`stroke="${N}" stroke-width="${w}"`;
const grad=(id,a,cx=.32,cy=.25,r=.85)=>`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a[0]}"/><stop offset=".5" stop-color="${a[1]}"/><stop offset="1" stop-color="${a[2]}"/></radialGradient>`;
const tigerTail=`<path d="M258 285 C310 290 330 250 318 215 C312 198 300 205 304 222 C310 250 292 266 258 262 Z" fill="url(#fur)" ${st()} stroke-linejoin="round"/><path d="M312 232 l-14 4 M304 252 l-14 6" ${st()} stroke-linecap="round"/>`;
const mouthDef={
 closed:`<path d="M200 165 v7 M200 172 q-11 9 -20 0 M200 172 q11 9 20 0" fill="none" ${st(4)} stroke-linecap="round"/>`,
 open:`<path d="M180 171 q20 28 40 0 Z" fill="#e8605a" ${st(4)} stroke-linejoin="round"/><path d="M190 184 q10 8 20 0 q-10 -4 -20 0" fill="#ff9a94"/><path d="M200 165 v6" ${st(4)} stroke-linecap="round"/>`
};
const mouthWide={
 closed:`<path d="M184 188 q16 10 32 0" fill="none" ${st(4)} stroke-linecap="round"/>`,
 open:`<path d="M180 184 q20 30 40 0 Z" fill="#e8605a" ${st(4)} stroke-linejoin="round"/><path d="M190 197 q10 8 20 0 q-10 -4 -20 0" fill="#ff9a94"/>`
};
const nose=`<path d="M190 154 h20 l-10 11 Z" fill="${N}" ${st(4)} stroke-linejoin="round"/>`;
const blush=`<ellipse cx="140" cy="160" rx="13" ry="8" fill="#f6a6ac" opacity=".75"/><ellipse cx="260" cy="160" rx="13" ry="8" fill="#f6a6ac" opacity=".75"/>`;

const CH={
ho:{name:'Hổ',hs:1.08,fur:['#ffc986','#f4a050','#d9772b'],belly:['#fff6e2','#f0d4a4'],skin:['#fffaf0','#f3dcb4'],
 tail:tigerTail,
 body:`<path d="M128 232 l16 6 M126 256 l18 4 M272 232 l-16 6 M274 256 l-18 4" ${st()} stroke-linecap="round"/>`,
 back:`<path d="M130 112 L94 102 L112 124 L88 134 L112 148 L94 166 L130 160 Z" fill="url(#fur)" ${st()} stroke-linejoin="round"/><path d="M270 112 L306 102 L288 124 L312 134 L288 148 L306 166 L270 160 Z" fill="url(#fur)" ${st()} stroke-linejoin="round"/><circle cx="136" cy="82" r="27" fill="url(#fur)" ${st()}/><circle cx="138" cy="86" r="13" fill="#f5a3a3" ${st(3)}/><circle cx="264" cy="82" r="27" fill="url(#fur)" ${st()}/><circle cx="262" cy="86" r="13" fill="#f5a3a3" ${st(3)}/>`,
 face:`<path d="M200 70 v22 M178 74 l5 20 M222 74 l-5 20 M122 126 l18 3 M124 146 l17 -2 M278 126 l-18 3 M276 146 l-17 -2" ${st()} stroke-linecap="round"/><ellipse cx="200" cy="168" rx="40" ry="29" fill="url(#skin)" ${st(4)}/>${nose}`,
 mouth:mouthDef},
ga:{name:'Gà',hs:1.1,N:24,fur:['#ffffff','#f3f2f8','#cfd0e0'],belly:['#ffffff','#e9e6f1'],skin:['#fff','#eee'],
 legs:x=>`<path d="M${x} 296 V338" stroke="${N}" stroke-width="13" stroke-linecap="round"/><path d="M${x} 296 V338" stroke="#f6a12e" stroke-width="7" stroke-linecap="round"/><ellipse cx="${x+6}" cy="343" rx="20" ry="8" fill="#f6a12e" ${st(4)}/>`,
 lids:`<path d="M139.5 121 A22.5 22.5 0 0 1 184.5 121 Z" fill="#8f7bd0" ${st(4)} stroke-linejoin="round"/><path d="M215.5 121 A22.5 22.5 0 0 1 260.5 121 Z" fill="#8f7bd0" ${st(4)} stroke-linejoin="round"/>`,
 tail:`<g ${st(4)}><ellipse cx="292" cy="246" rx="13" ry="34" fill="#e8503a" transform="rotate(28 292 246)"/><ellipse cx="300" cy="262" rx="12" ry="30" fill="#f7f4fb" transform="rotate(58 300 262)"/><ellipse cx="282" cy="236" rx="11" ry="30" fill="#8b6fc0" transform="rotate(5 282 236)"/></g>`,
 body:'',
 back:`<g fill="#e8503a" ${st(5)}><circle cx="176" cy="66" r="17"/><circle cx="224" cy="66" r="17"/><circle cx="200" cy="56" r="19"/></g>`,
 face:`${blush}<path d="M182 150 h36 l-18 30 Z" fill="#f6a12e" ${st(4)} stroke-linejoin="round"/><ellipse cx="200" cy="186" rx="8" ry="10" fill="#e8503a" ${st(3.5)}/>`,
 mouth:{closed:'',open:`<path d="M190 168 q10 26 20 0 Z" fill="#ff8c94" ${st(3.5)} stroke-linejoin="round"/>`}},
rong:{name:'Rồng',hs:1.05,fur:['#a6e68e','#62c05b','#3b9046'],belly:['#fff4ae','#f3d457'],skin:['#c9eeae','#92d07a'],
 wings:`<g class="wingL"><path d="M140 205 C108 168 68 166 50 190 C72 192 86 204 90 224 C100 212 112 216 118 230 C124 222 134 224 142 234 Z" fill="#c9a6ea" ${st()} stroke-linejoin="round"/></g><g class="wingR"><path d="M260 205 C292 168 332 166 350 190 C328 192 314 204 310 224 C300 212 288 216 282 230 C276 222 266 224 258 234 Z" fill="#c9a6ea" ${st()} stroke-linejoin="round"/></g>`,
 tail:`<path d="M258 285 C310 290 330 250 318 215 C312 198 300 205 304 222 C310 250 292 266 258 262 Z" fill="url(#fur)" ${st()} stroke-linejoin="round"/><path d="M316 212 l16 -14 l-4 24 Z" fill="#8e6bb8" ${st(4)} stroke-linejoin="round"/>`,
 body:`<path d="M170 230 q30 12 60 0 M168 252 q32 12 64 0 M170 274 q30 12 60 0 M176 296 q24 10 48 0" fill="none" stroke="#e0a82a" stroke-width="4" stroke-linecap="round"/>`,
 back:`<path d="M142 80 C120 68 114 40 132 22 C140 42 156 52 172 60 Z" fill="#fff" ${st()} stroke-linejoin="round"/><path d="M258 80 C280 68 286 40 268 22 C260 42 244 52 228 60 Z" fill="#fff" ${st()} stroke-linejoin="round"/>`,
 face:`<path d="M140 98 q22 -12 44 2 M216 100 q22 -14 44 -2" fill="none" ${st(6)} stroke-linecap="round"/><ellipse cx="200" cy="176" rx="54" ry="30" fill="url(#skin)" ${st(4)}/><ellipse cx="172" cy="168" rx="5" ry="7" fill="${N}"/><ellipse cx="228" cy="168" rx="5" ry="7" fill="${N}"/>`,
 mouth:mouthWide},
khi:{name:'Khỉ',hs:1.1,fur:['#eab27c','#d08c56','#a46432'],belly:['#fbe6c8','#edcb9f'],skin:['#fcd9b8','#f0bb92'],
 tail:`<path d="M258 292 C320 304 340 252 314 224 C300 208 282 222 294 236" fill="none" stroke="${N}" stroke-width="13" stroke-linecap="round"/><path d="M258 292 C320 304 340 252 314 224 C300 208 282 222 294 236" fill="none" stroke="#d08c56" stroke-width="6" stroke-linecap="round"/>`,
 body:'',
 back:`<circle cx="106" cy="134" r="28" fill="url(#fur)" ${st()}/><circle cx="110" cy="136" r="16" fill="url(#skin)" ${st(3)}/><circle cx="294" cy="134" r="28" fill="url(#fur)" ${st()}/><circle cx="290" cy="136" r="16" fill="url(#skin)" ${st(3)}/>`,
 face:`<path d="M200 110 C172 82 120 100 126 142 C128 178 162 208 200 208 C238 208 272 178 274 142 C280 100 228 82 200 110 Z" fill="url(#skin)" ${st(4)} stroke-linejoin="round"/>${blush}<circle cx="192" cy="164" r="3.5" fill="${N}"/><circle cx="208" cy="164" r="3.5" fill="${N}"/>`,
 mouth:{closed:`<path d="M200 170 v4 M200 174 q-11 10 -22 0 M200 174 q11 10 22 0" fill="none" ${st(4)} stroke-linecap="round"/>`,open:`<path d="M180 172 q20 28 40 0 Z" fill="#e8605a" ${st(4)} stroke-linejoin="round"/><path d="M190 185 q10 8 20 0 q-10 -4 -20 0" fill="#ff9a94"/>`}}
};
function build(k){
 const c=CH[k], arc=c.arc||N, leg=c.leg||'url(#fur)', arm=c.arm||'url(#fur)', N0=c.N||0, hs=c.hs||1, er=c.er||23, pr=c.pr||12, pc=c.pc||N;
 const pupils=pc===N?`<circle cx="158" cy="122" r="${pr}" fill="${N}"/><circle cx="242" cy="122" r="${pr}" fill="${N}"/>`:`<circle cx="160" cy="124" r="${pr}" fill="${pc}"/><circle cx="240" cy="124" r="${pr}" fill="${pc}"/><circle cx="160" cy="124" r="${pr*.55}" fill="${N}"/><circle cx="240" cy="124" r="${pr*.55}" fill="${N}"/>`;
 const ex=er>23?[158,242]:[162,238];
 const eyes=`<g class="eyes eyes-open"><circle cx="${ex[0]}" cy="126" r="${er}" fill="#fff" ${st(4)}/><circle cx="${ex[1]}" cy="126" r="${er}" fill="#fff" ${st(4)}/>${pupils}<circle cx="${ex[0]-8}" cy="117" r="4.5" fill="#fff"/><circle cx="${ex[1]-8}" cy="117" r="4.5" fill="#fff"/>${c.lids||''}</g>
 <g class="eyes-cry"><path d="M142 112 L178 128 L142 144 M258 112 L222 128 L258 144" fill="none" stroke="${arc==='#fff'?'#fff':N}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path class="tear" d="M150 146 q-6 22 -4 44" fill="none" stroke="#8fd3ff" stroke-width="9" stroke-linecap="round"/><path class="tear" d="M250 146 q6 22 4 44" fill="none" stroke="#8fd3ff" stroke-width="9" stroke-linecap="round"/><g transform="translate(146 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:-46px;--dy:-70px;animation-delay:0s" fill="#8fd3ff"/></g><g transform="translate(146 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:-26px;--dy:-96px;animation-delay:0.1s" fill="#8fd3ff"/></g><g transform="translate(146 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:-60px;--dy:-34px;animation-delay:0.2s" fill="#8fd3ff"/></g><g transform="translate(146 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:-12px;--dy:-60px;animation-delay:0.3s" fill="#8fd3ff"/></g><g transform="translate(146 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:-38px;--dy:-110px;animation-delay:0.4s" fill="#8fd3ff"/></g><g transform="translate(254 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:46px;--dy:-70px;animation-delay:0.05s" fill="#8fd3ff"/></g><g transform="translate(254 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:26px;--dy:-96px;animation-delay:0.15s" fill="#8fd3ff"/></g><g transform="translate(254 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:60px;--dy:-34px;animation-delay:0.25s" fill="#8fd3ff"/></g><g transform="translate(254 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:12px;--dy:-60px;animation-delay:0.35s" fill="#8fd3ff"/></g><g transform="translate(254 116)"><path class="spray" d="M0 -9 C6 -2 6 6 0 8 C-6 6 -6 -2 0 -9Z" style="--dx:38px;--dy:-110px;animation-delay:0.45s" fill="#8fd3ff"/></g></g>
 <g class="eyes-happy"><path d="M140 134 q22 -26 44 0 M216 134 q22 -26 44 0" fill="none" stroke="${arc}" stroke-width="6" stroke-linecap="round"/><ellipse cx="130" cy="158" rx="12" ry="7" fill="#f58c8c" opacity=".7"/><ellipse cx="270" cy="158" rx="12" ry="7" fill="#f58c8c" opacity=".7"/></g>`;
 const legs=c.noLimbs?'':(c.legs?`<g class="legL">${c.legs(165)}</g><g class="legR">${c.legs(235)}</g>`:`<g class="legL"><ellipse cx="163" cy="322" rx="28" ry="22" fill="${leg}" ${st()}/></g><g class="legR"><ellipse cx="237" cy="322" rx="28" ry="22" fill="${leg}" ${st()}/></g>`);
 const arms=c.noLimbs?'':`<g class="armL"><path d="M140 212 C118 220 112 250 124 266 C134 276 150 262 148 244 C147 232 146 222 140 212 Z" fill="${arm}" ${st()} stroke-linejoin="round"/></g><g class="armR"><path d="M260 212 C282 220 288 250 276 266 C266 276 250 262 252 244 C253 232 254 222 260 212 Z" fill="${arm}" ${st()} stroke-linejoin="round"/></g>`;
 const body=c.bodyShape||`<g class="body"><ellipse cx="200" cy="248" rx="74" ry="76" fill="url(#fur)" ${st()}/><g class="front"><ellipse cx="200" cy="262" rx="44" ry="50" fill="url(#belly)" ${st(4)}/>${c.body||''}</g><ellipse cx="160" cy="215" rx="22" ry="12" fill="#fff" opacity=".28" transform="rotate(-25 160 215)"/></g>`;
 const neck=N0?`<rect x="175" y="${170-N0}" width="50" height="${130+N0}" rx="24" fill="url(#fur)" ${st()}/><g class="front">${c.neckX||''}</g>`:'';
 const back=c.back.replace(/fill="(#f5a3a3|#f5a9b8|#f293a6|url\(#skin\))"/g,'class="inr" fill="$1"');
 const hy=c.hcy||135, hx=c.hrx||82, hh=c.hry||70;
 return `<defs>${grad('fur',c.fur)}${grad('belly',[c.belly[0],c.belly[0],c.belly[1]],.4,.3,.8)}${grad('skin',[c.skin[0],c.skin[0],c.skin[1]],.4,.3,.8)}${c.limb?grad('limb',c.limb):''}</defs>
<line class="ground" x1="20" y1="350" x2="380" y2="350" stroke="${N}" stroke-width="5" stroke-linecap="round" stroke-dasharray="30 30" opacity=".35"/>
<ellipse class="shadow" cx="200" cy="348" rx="82" ry="13" fill="${N}" opacity=".28"/>
<g class="fx fx-dustB"><g transform="translate(118 326)"><g class="pf " style="--tx:-60px;--ty:-26px"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="28" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(250 326)"><g class="pf q2" style="--tx:60px;--ty:-26px"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="28" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(184 316)"><g class="pf q3" style="--tx:0px;--ty:-40px"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="28" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g></g>
<ellipse class="puddle" cx="200" cy="350" rx="60" ry="9" fill="#8fd3ff" opacity="0"/>
<g class="mir"><g class="fig">
 <g class="tailB"><g class="tailpos"><g class="tail">${c.tail}</g></g></g>
 ${legs}${c.wings||''}${neck}${body}${arms}<g class="tailF"><g class="tailpos"><g class="tail">${c.tail}</g></g></g>
 <g class="head"><g transform="translate(0 ${-N0}) translate(200 200) scale(${hs}) translate(-200 -200)">${back}<ellipse cx="200" cy="${hy}" rx="${hx}" ry="${hh}" fill="url(#fur)" ${st()}/><ellipse cx="160" cy="92" rx="30" ry="14" fill="#fff" opacity=".3" transform="rotate(-20 160 92)"/><g class="face">${c.face}
  <g class="mouth-closed">${c.mouth.closed}</g><g class="mouth-open">${c.mouth.open}</g>${eyes}</g></g></g>
</g>
<g class="fx fx-dust"><g transform="translate(120 334)"><g class="puff p1"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="30" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(100 342)"><g class="puff p2"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="30" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(140 342)"><g class="puff p3"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="30" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g></g>
</g>
<g class="fx fx-dustF"><g transform="translate(112 348)"><g class="pf " style="--tx:-70px;--ty:6px"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="28" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(262 348)"><g class="pf q2" style="--tx:70px;--ty:6px"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="28" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(186 352)"><g class="pf q3" style="--tx:0px;--ty:12px"><circle cx="0" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="28" cy="0" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g></g>
<g class="fx fx-cheer">
 <path class="star" d="M60 120 l6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6 Z" fill="#ffd54a" ${st(3)} stroke-linejoin="round"/>
 <path class="star" d="M340 100 l6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6 Z" fill="#fff" ${st(3)} stroke-linejoin="round"/>
 <path class="star" d="M335 230 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z" fill="#ffd54a" ${st(3)} stroke-linejoin="round"/>
 <path class="star" d="M70 250 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z" fill="#fff" ${st(3)} stroke-linejoin="round"/>
</g>`;
}
const whisk=`<path d="M286 166 h34 M286 176 l32 9 M286 156 l30 -8" ${st(3.5)} stroke-linecap="round"/>`;
const tri=(d,f='url(#fur)')=>`<path d="${d}" fill="${f}" ${st()} stroke-linejoin="round"/>`;
const SP={
ho:{far:`<circle cx="164" cy="90" r="22" fill="url(#fur)" ${st()}/>`,near:`<path d="M152 140 L124 132 L144 152 L120 160 L146 170 L132 186 L164 176 Z" fill="url(#fur)" ${st()} stroke-linejoin="round"/><circle cx="196" cy="78" r="26" fill="url(#fur)" ${st()}/><circle cx="198" cy="82" r="13" fill="#f5a3a3" ${st(3)}/><path d="M214 70 v20 M194 70 l4 18 M234 74 l-4 16" ${st()} stroke-linecap="round"/>`,mz:'short',nc:N,body:`<path d="M140 222 l14 6 M136 248 l16 4 M140 274 l14 2" ${st()} stroke-linecap="round"/>`},
rong:{far:tri('M196 82 C184 60 190 38 206 28 C206 48 218 58 230 68 Z','#fff'),near:tri('M150 104 L134 60 L186 84 Z')+`<path d="M200 70 L214 42 L226 72 Z" fill="#8e6bb8" ${st(4)} stroke-linejoin="round"/>`,mz:'snout',nc:N,wing:1,body:`<path d="M214 232 q16 8 32 0 M214 256 q16 8 32 0 M214 280 q16 8 32 0" fill="none" stroke="#e0a82a" stroke-width="4" stroke-linecap="round"/>`},
khi:{far:`<circle cx="164" cy="104" r="22" fill="url(#fur)" ${st()}/>`,near:`<circle cx="186" cy="124" r="28" fill="url(#fur)" ${st()}/><circle cx="190" cy="126" r="16" fill="url(#skin)" ${st(3)}/>`,mz:'short',nc:N,patch:1},
ga:{far:`<g fill="#e8503a" ${st(5)}><circle cx="190" cy="72" r="16"/><circle cx="238" cy="72" r="16"/><circle cx="214" cy="62" r="19"/></g>`,near:'',mz:'beak',lid:1,neck:1}
};
function mzOf(t,nc,teeth){
 const o=(d,f='#e8605a')=>`<path d="${d}" fill="${f}" ${st(4)} stroke-linejoin="round"/>`;
 const sm=d=>`<path d="${d}" fill="none" ${st(4)} stroke-linecap="round"/>`;
 if(t==='short')return{shape:`<ellipse cx="270" cy="162" rx="30" ry="22" fill="url(#skin)" ${st(4)}/>`,nose:`<ellipse cx="296" cy="152" rx="8" ry="6" fill="${nc}" ${st(3)}/>`,closed:sm('M262 172 q12 9 28 0')+(teeth?`<rect x="274" y="174" width="12" height="11" rx="3" fill="#fff" ${st(3)}/>`:''),open:o('M260 170 q16 26 36 0 Z')+(teeth?`<rect x="274" y="168" width="12" height="10" rx="3" fill="#fff" ${st(3)}/>`:'')};
 if(t==='long')return{shape:`<ellipse cx="276" cy="168" rx="40" ry="26" fill="url(#skin)" ${st(4)}/>`,nose:`<ellipse cx="308" cy="160" rx="${nc===N?10:5}" ry="${nc===N?8:6}" fill="${N}"/>`,closed:sm('M262 182 q16 9 36 0'),open:o('M260 178 q20 30 42 0 Z')};
 if(t==='snout')return{shape:`<ellipse cx="278" cy="166" rx="32" ry="28" fill="url(#skin)" ${st(4)}/>`,nose:`<ellipse cx="302" cy="158" rx="5" ry="9" fill="${nc}" ${st(3)}/>`,closed:sm('M264 186 q12 9 28 0'),open:o('M262 182 q16 26 34 0 Z')};
 if(t==='beak')return{shape:`<path d="M268 122 L326 144 L268 164 Z" fill="#f6a12e" ${st(4)} stroke-linejoin="round"/><ellipse cx="274" cy="176" rx="8" ry="12" fill="#e8503a" ${st(3.5)}/>`,nose:'',closed:'',open:o('M272 150 L320 146 L272 180 Z','#ff8c94')};
 return{shape:`<ellipse cx="276" cy="164" rx="36" ry="24" fill="url(#skin)" ${st(4)}/>`,nose:`<circle cx="300" cy="156" r="3.5" fill="${N}"/>`,closed:sm('M266 174 q18 9 36 0')+`<path d="M284 180 v12 l-6 6 M284 192 l6 6" fill="none" stroke="#e8404a" stroke-width="4" stroke-linecap="round"/>`,open:o('M264 172 q20 26 40 0 Z')+`<path d="M286 192 v18 l-8 8 M286 210 l8 8" fill="none" stroke="#e8404a" stroke-width="5" stroke-linecap="round"/>`};
}
function buildSide(k){
 const c=CH[k], p=SP[k], N0=c.N||0, noL=c.noLimbs, m=mzOf(p.mz,p.nc||N,p.teeth);
 const er=c.er||23, pr=c.pr||12, pc=c.pc||N;
 const arm=(x)=>`<path d="M${x} 212 C${x-22} 220 ${x-28} 250 ${x-16} 266 C${x-6} 276 ${x+10} 262 ${x+8} 244 C${x+7} 232 ${x+6} 222 ${x} 212 Z" fill="${c.arm||'url(#fur)'}" ${st()} stroke-linejoin="round"/>`;
 const leg=(x,cls)=>c.legs?`<g class="${cls}">${c.legs(x)}</g>`:`<g class="${cls}"><ellipse cx="${x}" cy="322" rx="28" ry="22" fill="${c.leg||'url(#fur)'}" ${st()}/></g>`;
 const eye=`<g class="eyes eyes-open"><circle cx="242" cy="126" r="${er}" fill="#fff" ${st(4)}/>${pc===N?`<circle cx="250" cy="123" r="${pr}" fill="${N}"/>`:`<circle cx="250" cy="125" r="${pr}" fill="${pc}"/><circle cx="250" cy="125" r="${pr*.55}" fill="${N}"/>`}<circle cx="245" cy="116" r="4.5" fill="#fff"/>${p.lid?`<path d="M${242-er-.5} 121 A${er+.5} ${er+.5} 0 0 1 ${242+er+.5} 121 Z" fill="#8f7bd0" ${st(4)} stroke-linejoin="round"/>`:''}</g>`;
 const wing=p.wing?`<g class="wingL"><path d="M176 212 C146 172 104 172 88 196 C108 196 122 208 126 228 C136 216 148 220 154 234 Z" fill="#c9a6ea" ${st()} stroke-linejoin="round"/></g>`:'';
 const body=c.bodyShape?`${c.bodyShape}<rect x="184" y="${170-N0}" width="48" height="140" rx="22" fill="url(#fur)" ${st()}/><rect x="214" y="${176-N0}" width="14" height="${120+N0}" rx="7" fill="url(#belly)"/>`:
  `${N0?`<rect x="182" y="${170-N0}" width="50" height="${130+N0}" rx="24" fill="url(#fur)" ${st()}/>`:''}<g class="body"><ellipse cx="196" cy="250" rx="62" ry="76" fill="url(#fur)" ${st()}/><ellipse cx="226" cy="262" rx="28" ry="48" fill="url(#belly)" ${st(4)}/>${p.body||''}<ellipse cx="160" cy="215" rx="20" ry="11" fill="#fff" opacity=".28" transform="rotate(-25 160 215)"/></g>`;
 const patch=p.patch?`<ellipse cx="252" cy="142" rx="44" ry="38" fill="url(#skin)" ${st(4)}/>`:'';
 const dog=p.dogpatch?`<ellipse cx="244" cy="124" rx="30" ry="30" fill="#9a6a3a" opacity=".85"/>`:'';
 const bl=p.blush?`<ellipse cx="226" cy="160" rx="13" ry="8" fill="#f6a6ac" opacity=".75"/>`:'';
 const beard=p.beard?`<path d="M262 190 q10 34 22 0 Z" fill="url(#skin)" ${st(4)} stroke-linejoin="round"/>`:'';
 const forelock=p.mane?`<path d="M206 66 q20 -10 38 0 q-6 24 -20 34 q-14 -10 -18 -34 Z" fill="#7a4422" ${st(4)} stroke-linejoin="round"/>`:'';
 return `<defs>${grad('fur',c.fur)}${grad('belly',[c.belly[0],c.belly[0],c.belly[1]],.4,.3,.8)}${grad('skin',[c.skin[0],c.skin[0],c.skin[1]],.4,.3,.8)}</defs>
<line class="ground" x1="20" y1="350" x2="380" y2="350" stroke="${N}" stroke-width="5" stroke-linecap="round" stroke-dasharray="30 30" opacity=".35"/>
<ellipse class="shadow" cx="200" cy="348" rx="82" ry="13" fill="${N}" opacity=".28"/>
<g class="mir"><g class="fig">
 <g transform="translate(400 0) scale(-1 1)"><g class="tail">${c.tail}</g></g>
 ${noL?'':`<g class="armR">${arm(190)}</g>${leg(218,'legR')}`}
 ${body}
 ${noL?'':`${leg(176,'legL')}<g class="armL">${arm(214)}</g>`}
 ${wing}
 <g class="head"><g transform="translate(0 ${-N0})">${p.far}<ellipse cx="214" cy="134" rx="68" ry="64" fill="url(#fur)" ${st()}/><ellipse cx="180" cy="94" rx="26" ry="12" fill="#fff" opacity=".3" transform="rotate(-20 180 94)"/>${p.near}${patch}${dog}${bl}${m.shape}${m.nose}${beard}${p.deco||''}${forelock}
  <g class="mouth-closed">${m.closed}</g><g class="mouth-open">${m.open}</g>${eye}</g></g>
 <g class="fx fx-dust"><g transform="translate(120 334)"><g class="puff p1"><circle r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="30" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(100 342)"><g class="puff p2"><circle r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="30" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g><g transform="translate(140 342)"><g class="puff p3"><circle r="12" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="14" cy="-8" r="16" fill="#fff" stroke="${N}" stroke-width="3"/><circle cx="30" r="12" fill="#fff" stroke="${N}" stroke-width="3"/></g></g></g>
</g></g>`;
}
return {build, buildSide};
})();