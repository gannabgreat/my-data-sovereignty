// 내 데이터 주권 진단기 — 전부 브라우저 안에서만 계산한다. 네트워크 요청은 같은 폴더의 data.json 하나뿐.
'use strict';

const STORE_KEY = 'ds-diagnosis-v1';
const WEIGHTS = { mission: 50, diversity: 30, exposure: 20 };
const GRADES = [
  [85, 'A', '데이터 주권자! 권리를 알고, 실제로 쓰고 있어요.'],
  [70, 'B', '꽤 잘 지키고 있어요. 남은 미션 몇 개면 A.'],
  [55, 'C', '절반쯤 되찾았어요. 권리는 있는데 쓰기가 번거롭죠?'],
  [40, 'D', '앱들이 내 데이터를 더 많이 쥐고 있어요.'],
  [0,  'F', '내 데이터, 아직 내 것이 아니에요. 미션 하나부터!'],
];
const TOPICS = {
  '게임': ['게임', '롤', 'lol', '리그오브레전드', '발로란트', '배그', '마크', '마인크래프트', '메이플', '스팀', 'game', 'gameplay', '공략', '티어'],
  '음악': ['mv', 'm/v', '뮤비', '노래', '커버', 'cover', '플레이리스트', 'playlist', '라이브', 'live', '음악', '앨범', 'official audio', '가사'],
  '먹방·요리': ['먹방', '레시피', '요리', '맛집', 'mukbang', '쿡', '자취요리', '디저트'],
  '뉴스·시사': ['뉴스', '속보', '정치', '대통령', '국회', '시사', '기자', 'news', '사건'],
  '주식·경제': ['주식', '코인', '비트코인', '부동산', '투자', '경제', '금리', 'etf', '재테크', '나스닥'],
  '공부·지식': ['강의', '공부', '수능', '토익', '역사', '과학', '설명', '원리', '다큐', '지식', 'lecture', 'tutorial', '스터디'],
  '운동·건강': ['운동', '헬스', '다이어트', '홈트', '러닝', '필라테스', '요가', '스트레칭', '식단'],
  '뷰티·패션': ['메이크업', '화장', '뷰티', '코디', '패션', '하울', '무신사', 'ootd', '스킨케어', '룩북'],
  '예능·연예': ['예능', '드라마', '아이돌', '런닝맨', '무한도전', '케이팝', 'kpop', '직캠', '리액션', '웃긴', '레전드'],
  '스포츠': ['축구', '야구', '농구', '하이라이트', 'highlights', 'epl', 'kbo', '손흥민', '골'],
  '테크': ['아이폰', '갤럭시', '리뷰', '언박싱', 'unboxing', '노트북', '맥북', 'ai', '코딩', '개발'],
  '브이로그': ['vlog', '브이로그', '일상', '여행', 'travel'],
};
const DETOX = [
  ['1일', '유튜브 「시청 기록 일시중지」 켜고 하루 지내 보기 — 홈 화면이 어떻게 바뀌나요?'],
  ['2일', '맞춤광고 끄기 미션 2개 완료하기'],
  ['3일', '구독하지 않은 분야의 영상 3편을 직접 검색해서 보기'],
  ['4일', '앱 위치 권한을 「앱 사용 중에만」으로 바꾸기 (설정 › 개인정보 보호)'],
  ['5일', '안 쓰는 앱 하나 지우기 — 지우기 전에 탈퇴(데이터 삭제)부터'],
  ['6일', '추천 피드 대신 검색·즐겨찾기로만 하루 보내기'],
  ['7일', '내 데이터 다운로드 파일을 열어 보고, 놀란 점 하나 적기'],
];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let DATA = null;
let state = load();
let diversity = null; // { score, ... } — 시청 기록 분석 결과는 저장하지 않는다(새로고침하면 사라짐)

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.apps)) return { apps: s.apps, missions: s.missions || {}, detox: s.detox || [] };
  } catch (e) { /* 저장소를 못 쓰면 이번 방문 동안만 기억 */ }
  return { apps: [], missions: {}, detox: [] };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
}

// ---------- 시작 ----------
document.addEventListener('DOMContentLoaded', async () => {
  setupReveal();
  setupStepNav();
  setupUpload();
  $('#detoxBtn').addEventListener('click', openDetox);
  $('#cardBtn').addEventListener('click', saveCard);
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('고른 앱·미션 체크·챌린지 기록을 이 브라우저에서 모두 지울까요?')) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    state = { apps: [], missions: {}, detox: [] };
    diversity = null; $('#divResult').hidden = true;
    renderAll();
  });
  $('#selectAll').addEventListener('click', () => {
    state.apps = state.apps.length === DATA.apps.length ? [] : DATA.apps.map(a => a.id);
    save(); renderAll();
  });
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    // 「못 읽음」을 「앱 없음」으로 보여주지 않는다
    const box = $('#loadError');
    box.hidden = false;
    box.textContent = `앱 정보(data.json)를 읽지 못했어요: ${e.message}. 파일을 더블클릭해서 열었다면 브라우저가 막은 거예요 — 폴더에서 「python3 -m http.server」를 실행하고 http://localhost:8000 으로 열어 주세요.`;
    return;
  }
  state.apps = state.apps.filter(id => DATA.apps.some(a => a.id === id));
  const researched = DATA.apps.filter(a => a.researched).length;
  $('#dataStatus').textContent = `앱 정보 ${DATA.apps.length}개 중 ${researched}개 조사 완료 (${DATA.meta.updated} 기준)`;
  renderAll();
});

function renderAll() {
  renderApps();
  renderMap();
  renderMissions();
  renderReport();
}
const selected = () => DATA.apps.filter(a => state.apps.includes(a.id));

// ---------- ① 앱 고르기 ----------
function renderApps() {
  const grid = $('#appGrid');
  grid.replaceChildren(...DATA.apps.map(app => h('button', {
    type: 'button', class: 'app', 'aria-pressed': String(state.apps.includes(app.id)),
    onclick: () => {
      const i = state.apps.indexOf(app.id);
      if (i >= 0) state.apps.splice(i, 1); else state.apps.push(app.id);
      save(); renderAll();
    },
  }, h('span', { class: 'e', 'aria-hidden': 'true' }, app.emoji), h('span', {}, h('b', {}, app.name), h('small', {}, app.company)))));
  $('#appCount').textContent = state.apps.length;
  $('#selectAll').textContent = state.apps.length === DATA.apps.length ? '모두 해제' : '모두 선택';
}

// ---------- ② 노출 지도 ----------
function renderMap() {
  const apps = selected();
  const types = Object.entries(DATA.dataTypes);
  $('#typeSummary').replaceChildren(...types.map(([k, t]) => {
    const n = apps.filter(a => a.collects[k] === true).length;
    const unk = apps.filter(a => a.collects[k] == null).length;
    return h('div', { class: 'tsum' },
      h('span', { class: 'i', 'aria-hidden': 'true' }, t.icon),
      h('b', {}, `${n}개 앱`),
      h('span', {}, `${t.label} 데이터를 모음${unk ? ` · ${unk}개 확인 안 됨` : ''}`));
  }));
  const table = $('#exposureMap');
  $('#mapEmpty').hidden = apps.length > 0;
  table.hidden = apps.length === 0;
  if (!apps.length) return;
  $('thead', table).replaceChildren(h('tr', {},
    h('th', { scope: 'col' }, '앱'),
    types.map(([, t]) => h('th', { scope: 'col' }, h('span', { class: 'i', 'aria-hidden': 'true' }, t.icon), t.label)),
    h('th', { scope: 'col' }, '제3자 제공'),
    h('th', { scope: 'col' }, '유출·오용 사례')));
  $('tbody', table).replaceChildren(...apps.map(app => h('tr', {},
    h('th', { scope: 'row' }, h('span', { class: 'e', 'aria-hidden': 'true' }, app.emoji), app.name,
      h('small', {}, app.company),
      app.policy ? h('a', { class: 'src', href: app.policy, target: '_blank', rel: 'noopener noreferrer' }, '처리방침 ↗') : null,
      app.collectsNote ? h('small', { class: 'cnote' }, app.collectsNote) : null,
      app.researched ? null : h('span', { class: 'stamp' }, '조사 필요 · 예시값')),
    types.map(([k, t]) => {
      const v = app.collects[k];
      if (v === true) return h('td', {}, h('span', { class: 'dot on', title: `${t.label} 모음` }, '●'));
      if (v === false) return h('td', {}, h('span', { class: 'dot off', title: `${t.label} 안 모음` }, '○'));
      return h('td', {}, h('span', { class: 'dot unk', title: '확인 안 됨 — 처리방침에 명시 없음 또는 못 읽음' }, '?'));
    }),
    h('td', { class: 'tp', title: app.thirdPartyNote || '' }, app.thirdPartyLabel
      ? [h('b', {}, app.thirdPartyLabel), app.thirdPartyNote ? h('small', { class: 'tnote' }, app.thirdPartyNote) : null]
      : h('span', { class: 'q' }, '? 곳', h('br'), '확인 안 됨')),
    h('td', {}, app.incidents.length
      ? h('div', { class: 'badges' }, app.incidents.map(inc => {
          const label = `⚠ ${inc.year ? inc.year + ' ' : ''}${inc.title}`;
          return inc.url
            ? h('a', { class: 'badge' + (inc.verified ? '' : ' unv'), href: inc.url, target: '_blank', rel: 'noopener noreferrer' }, label)
            : h('span', { class: 'badge' + (inc.verified ? '' : ' unv') }, label);
        }))
      : h('span', { class: 'fine' }, app.researched ? '찾은 사례 없음' : '조사 필요')),
  )));
}

// ---------- ③ 되찾기 미션 ----------
function missionStats() {
  let total = 0, done = 0; const clicks = [];
  for (const app of selected()) for (const k of Object.keys(DATA.actionTypes)) {
    total++;
    const m = state.missions[app.id]?.[k];
    if (m?.done) { done++; if (Number.isFinite(m.clicks) && m.clicks > 0) clicks.push(m.clicks); }
  }
  return { total, done, clicks, score: total ? Math.round(done / total * 100) : 0 };
}

function renderMissions() {
  const apps = selected();
  $('#missionEmpty').hidden = apps.length > 0;
  const openIds = new Set($$('.mcard[open]').map(d => d.dataset.id));
  $('#missions').replaceChildren(...apps.map((app, idx) => {
    const ms = state.missions[app.id] || {};
    const n = Object.keys(DATA.actionTypes).filter(k => ms[k]?.done).length;
    return h('details', { class: 'mcard', 'data-id': app.id, open: openIds.has(app.id) || (openIds.size === 0 && idx === 0) },
      h('summary', {}, h('span', { class: 'e', 'aria-hidden': 'true' }, app.emoji), h('b', {}, app.name),
        h('span', { class: 'prog' }, `${n} / ${Object.keys(DATA.actionTypes).length}`)),
      h('ul', { class: 'mlist' }, Object.entries(DATA.actionTypes).map(([k, at]) => {
        const act = app.actions?.[k] || {};
        const m = ms[k] || {};
        const id = `m-${app.id}-${k}`;
        return h('li', { class: 'mi' + (m.done ? ' done' : '') },
          h('input', { type: 'checkbox', id, checked: !!m.done, onchange: e => setMission(app.id, k, { done: e.target.checked }, e) }),
          h('label', { class: 't', for: id }, h('b', {}, at.label),
            h('small', {}, `${at.right}${act.note ? ' · ' + act.note : ''}${act.url && !act.verified ? ' · 링크 확인 필요' : ''}`)),
          act.url
            ? h('a', { class: 'go' + (act.url === app.policy ? ' doc' : ''), href: act.url, target: '_blank', rel: 'noopener noreferrer',
                title: act.url === app.policy ? '바로 가는 설정 페이지가 없어 처리방침의 해당 조항으로 연결돼요' : null },
                act.url === app.policy ? '방침 보기 ↗' : '열기 ↗')
            : h('span', { class: 'go none' }, '공식 링크 없음'),
          h('label', { class: 'clicks' }, '몇 번 클릭했나요?',
            h('input', { type: 'number', min: '0', max: '999', inputmode: 'numeric', placeholder: '예: 7', value: m.clicks ?? '',
              onchange: e => { const v = parseInt(e.target.value, 10); setMission(app.id, k, { clicks: Number.isFinite(v) && v >= 0 ? v : null }); } }),
            '번'));
      })));
  }));
  const st = missionStats();
  $('#missionDone').textContent = st.done;
  $('#missionTotal').textContent = st.total;
  $('#missionScore').textContent = st.score;
  $('#missionFill').style.width = st.score + '%';
}

function setMission(appId, k, patch, ev) {
  state.missions[appId] = state.missions[appId] || {};
  const before = state.missions[appId][k]?.done;
  state.missions[appId][k] = { ...state.missions[appId][k], ...patch };
  save();
  if (patch.done && !before && ev && !reduced) {
    const r = ev.target.getBoundingClientRect();
    const p = h('span', { class: 'plus' }, `+${Math.round(100 / Math.max(1, missionStats().total))}`);
    p.style.left = r.right + 8 + 'px'; p.style.top = r.top - 6 + 'px';
    document.body.append(p); setTimeout(() => p.remove(), 950);
  }
  renderMissions();
  renderReport();
}

// ---------- ④ 다양성 진단 ----------
function setupUpload() {
  const drop = $('#drop'), input = $('#historyFile');
  input.addEventListener('change', () => input.files[0] && readFile(input.files[0]));
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));
  $('#sampleBtn').addEventListener('click', () => showDiversity(sampleHistory(), '예시 데이터예요 — 실제 시청 기록이 아니라, 처음엔 여러 주제를 보다가 점점 한두 주제로 쏠리는 가상의 사람을 만들어 넣었어요.'));
}

async function readFile(file) {
  let rows;
  try {
    const text = await file.text();
    rows = /^\s*[\[{]/.test(text) ? parseJson(text) : parseHtml(text);
  } catch (e) {
    return showDivError(`파일을 읽지 못했어요 (${e.message}). 테이크아웃의 watch-history.json 또는 시청 기록.html 인지 확인해 주세요.`);
  }
  if (!rows.length) return showDivError('파일은 열었지만 시청 기록을 한 건도 찾지 못했어요. 「검색 기록」 파일이 아니라 「시청 기록」 파일인지 확인해 주세요.');
  showDivError(null);
  showDiversity(rows, `「${file.name}」 — 내 브라우저 안에서만 분석했어요. 파일은 어디에도 올라가지 않았고, 새로고침하면 결과도 사라져요.`);
}

function cleanTitle(t) {
  return String(t || '')
    .replace(/^Watched\s+/i, '')
    .replace(/\s*을\(를\)\s*시청했습니다\.?\s*$/, '')
    .replace(/\s*시청함\s*$/, '')
    .trim();
}
function parseJson(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error('배열 형식이 아님');
  return arr
    .filter(x => !(x.details || []).some(d => /ads|광고/i.test(d.name || ''))) // 광고 시청 기록 제외
    .filter(x => x.titleUrl || x.title)
    .map(x => ({
      title: cleanTitle(x.title),
      channel: x.subtitles?.[0]?.name || null,
      time: x.time ? new Date(x.time) : null,
    }));
}
function parseHtml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const rows = [];
  for (const cell of doc.querySelectorAll('.content-cell')) {
    const links = [...cell.querySelectorAll('a')];
    const v = links.find(a => /watch\?v=|youtu\.be|\/shorts\//.test(a.getAttribute('href') || ''));
    if (!v) continue;
    const ch = links.find(a => /\/channel\/|\/@|\/user\//.test(a.getAttribute('href') || ''));
    const texts = [...cell.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean);
    rows.push({ title: v.textContent.trim(), channel: ch ? ch.textContent.trim() : null, time: parseKoDate(texts[texts.length - 1]) });
  }
  return rows;
}
function parseKoDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s.replace(/\s+[A-Z]{2,4}$/, ''));
  return isNaN(d) ? null : d;
}

function topicOf(title) {
  const t = title.toLowerCase();
  for (const [name, words] of Object.entries(TOPICS)) if (words.some(w => t.includes(w))) return name;
  return '기타';
}
function entropy(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return -counts.reduce((s, c) => (c ? s + (c / total) * Math.log(c / total) : s), 0);
}
const tally = arr => arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());

function analyze(rows) {
  const withCh = rows.filter(r => r.channel);
  const chMap = tally(withCh.map(r => r.channel));
  const chCounts = [...chMap.values()];
  const H = entropy(chCounts);
  const effective = Math.exp(H);
  const sorted = [...chMap.entries()].sort((a, b) => b[1] - a[1]);
  const top10 = sorted.slice(0, 10).reduce((s, [, c]) => s + c, 0) / (withCh.length || 1);
  const tpMap = tally(rows.map(r => topicOf(r.title)));
  const tpNamed = [...tpMap.entries()].filter(([k]) => k !== '기타');
  const tpEven = tpNamed.length > 1 ? entropy(tpNamed.map(([, c]) => c)) / Math.log(Object.keys(TOPICS).length) : 0;
  const chScore = Math.min(1, Math.log(Math.max(1, effective)) / Math.log(300));
  const score = Math.round((chScore * 0.6 + tpEven * 0.4) * 100);
  // 달별 유효 채널 수
  const byMonth = new Map();
  for (const r of withCh) {
    if (!r.time || isNaN(r.time)) continue;
    const key = `${r.time.getFullYear()}-${String(r.time.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(r.channel);
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
    .filter(([, list]) => list.length >= 10)
    .map(([k, list]) => ({ month: k, eff: Math.exp(entropy([...tally(list).values()])), n: list.length }))
    .slice(-12);
  return {
    videos: rows.length, channels: chMap.size, effective, top10, score,
    topChannels: sorted.slice(0, 10), topics: [...tpMap.entries()].sort((a, b) => b[1] - a[1]), months,
  };
}

function showDivError(msg) {
  let el = $('#divError');
  if (!msg) { el?.remove(); return; }
  if (!el) { el = h('p', { id: 'divError', class: 'notice danger' }); $('#drop').after(el); }
  el.textContent = msg;
}

function showDiversity(rows, note) {
  const r = analyze(rows);
  diversity = r;
  $('#divResult').hidden = false;
  $('#divNote').textContent = note;
  countUp($('#divScore'), r.score);
  $('#kVideos').textContent = r.videos.toLocaleString('ko-KR');
  $('#kChannels').textContent = r.channels.toLocaleString('ko-KR');
  $('#kEffective').textContent = r.effective.toFixed(1);
  $('#kTop10').textContent = Math.round(r.top10 * 100);
  barList($('#topChannels'), r.topChannels, r.videos);
  barList($('#topicBars'), r.topics, r.videos);
  drawTrend(r.months);
  renderReport();
  $('#divResult').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

function barList(ol, entries, total) {
  const max = entries[0]?.[1] || 1;
  ol.replaceChildren(...entries.map(([name, c]) => h('li', {},
    h('span', { class: 'n', title: name }, name),
    h('span', { class: 'v' }, `${Math.round(c / total * 1000) / 10}%`),
    h('span', { class: 'b' }, h('i', { 'data-w': (c / max * 100).toFixed(1) })))));
  requestAnimationFrame(() => requestAnimationFrame(() => $$('i[data-w]', ol).forEach(i => { i.style.width = i.dataset.w + '%'; })));
}

function drawTrend(months) {
  const box = $('#trend');
  if (months.length < 2) {
    box.replaceChildren(h('p', { class: 'fine' }, '달마다 비교하려면 시청 날짜가 있는 기록이 두 달 이상(달마다 10편 이상) 필요해요.'));
    return;
  }
  const W = 640, H = 220, L = 36, R = 12, T = 16, B = 30;
  const max = Math.max(...months.map(m => m.eff)) * 1.15;
  const x = i => L + (W - L - R) * (months.length === 1 ? 0.5 : i / (months.length - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  const pts = months.map((m, i) => [x(i), y(m.eff)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `${line} L${x(months.length - 1).toFixed(1)} ${H - B} L${L} ${H - B} Z`;
  const ticks = [0, max / 2, max].map(v => `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('');
  const labels = months.map((m, i) => (months.length <= 8 || i % 2 === 0 || i === months.length - 1)
    ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${m.month.slice(2).replace('-', '.')}</text>` : '').join('');
  const dots = pts.map((p, i) => `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="4.5"><title>${months[i].month}: 유효 채널 ${months[i].eff.toFixed(1)}곳 (${months[i].n}편)</title></circle>`).join('');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="달별 유효 채널 수 추이">${ticks}<path class="ar" d="${area}"/><path class="ln" d="${line}"/>${dots}${labels}</svg>`;
}

// 예시 데이터: 처음 몇 달은 여러 주제, 뒤로 갈수록 게임·주식으로 쏠림
function sampleHistory() {
  const pools = {
    '게임': ['게임 공략 채널', '롤 하이라이트', '마크 실험실', '스팀 신작 리뷰'],
    '주식·경제': ['오늘의 주식', '코인 브리핑', '재테크 언니'],
    '음악': ['커버 라이브', '플레이리스트 맛집', '아이돌 MV 모음'],
    '먹방·요리': ['자취요리 연구소', '먹방 일기'],
    '공부·지식': ['역사 한 입', '과학 원리 설명'],
    '운동·건강': ['홈트 30분', '러닝 크루'],
    '뉴스·시사': ['아침 뉴스 요약'],
    '브이로그': ['대학생 vlog', '여행 브이로그'],
    '테크': ['맥북 리뷰', 'AI 코딩'],
    '스포츠': ['축구 하이라이트', '야구 하이라이트'],
  };
  const kw = { '게임': '게임 공략', '주식·경제': '주식 투자', '음악': '노래 커버', '먹방·요리': '요리 레시피', '공부·지식': '역사 강의', '운동·건강': '운동 루틴', '뉴스·시사': '뉴스 속보', '브이로그': 'vlog 일상', '테크': '리뷰 언박싱', '스포츠': '축구 하이라이트' };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rows = []; const now = new Date(2026, 9, 15);
  for (let mo = 8; mo >= 0; mo--) {
    const focus = 1 - mo / 8; // 0 → 1 로 갈수록 쏠림
    for (let i = 0; i < 120; i++) {
      const topics = Object.keys(pools);
      let tp = rnd() < 0.85 * focus ? (rnd() < 0.65 ? '게임' : '주식·경제') : topics[Math.floor(rnd() * topics.length)];
      const chs = pools[tp];
      const ch = rnd() < 0.5 * focus ? chs[0] : chs[Math.floor(rnd() * chs.length)];
      rows.push({ title: `${kw[tp]} #${i}`, channel: ch, time: new Date(now.getFullYear(), now.getMonth() - mo, 1 + Math.floor(rnd() * 27)) });
    }
  }
  return rows;
}

// ---------- ⑤ 성적표 ----------
function exposureDefense() {
  const apps = selected();
  if (!apps.length) return 100;
  const types = Object.keys(DATA.dataTypes);
  // 앱마다 모으는 데이터 종류 비율(모름은 절반으로) + 제3자 제공 업체 수(10곳 이상이면 최대)
  const per = apps.map(a => {
    const t = types.reduce((s, k) => s + (a.collects[k] === true ? 1 : a.collects[k] == null ? 0.5 : 0), 0) / types.length;
    const tp = a.thirdPartyCount == null ? 0.5 : Math.min(1, a.thirdPartyCount / 10);
    return t * 0.7 + tp * 0.3;
  });
  const avg = per.reduce((a, b) => a + b, 0) / per.length;
  const spread = Math.min(1, apps.length / DATA.apps.length); // 쓰는 앱이 많을수록 노출 범위가 넓다
  return Math.round((1 - (avg * 0.6 + spread * 0.4)) * 100);
}

function computeScore() {
  const ms = missionStats();
  const expo = exposureDefense();
  const div = diversity ? diversity.score : null;
  let w = { ...WEIGHTS };
  if (div == null) { w = { mission: WEIGHTS.mission + WEIGHTS.diversity * 0.6, diversity: 0, exposure: WEIGHTS.exposure + WEIGHTS.diversity * 0.4 }; }
  const total = Math.round((ms.score * w.mission + (div || 0) * w.diversity + expo * w.exposure) / 100);
  const [, grade, msg] = GRADES.find(([min]) => total >= min);
  return { ms, expo, div, w, total, grade, msg };
}

function renderReport() {
  if (!DATA) return;
  const s = computeScore();
  const none = !state.apps.length;
  $('#grade').textContent = none ? '–' : s.grade;
  countUp($('#totalScore'), none ? 0 : s.total);
  $('#gradeMsg').textContent = none ? '① 에서 앱을 고르면 성적이 나와요.' : s.msg;
  $('#bMission').style.width = s.ms.score + '%'; $('#bMissionV').textContent = s.ms.score;
  $('#bDiv').style.width = (s.div ?? 0) + '%'; $('#bDivV').textContent = s.div ?? '–';
  $('#bExpo').style.width = s.expo + '%'; $('#bExpoV').textContent = s.expo;
  $('#weightNote').textContent = s.div == null
    ? `비중: 선택권 ${s.w.mission}% · 노출 방어 ${s.w.exposure}% (④ 다양성 진단을 하면 다양성 ${WEIGHTS.diversity}%가 더해져요)`
    : `비중: 선택권 ${s.w.mission}% · 다양성 ${s.w.diversity}% · 노출 방어 ${s.w.exposure}%`;
  const c = s.ms.clicks;
  $('#clickStat').textContent = c.length
    ? `권리 한 번 쓰는 데 평균 ${(c.reduce((a, b) => a + b, 0) / c.length).toFixed(1)}번 클릭했어요 (기록 ${c.length}건, 최대 ${Math.max(...c)}번).`
    : '미션에 클릭 수를 적으면, 권리를 쓰는 데 평균 몇 번 눌러야 했는지 여기 나와요.';
}

function countUp(el, to) {
  const from = parseInt(el.textContent, 10) || 0;
  if (reduced || from === to) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 600;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 공유 카드 — 캔버스로 그려 내 기기에 PNG 로 저장(업로드 없음)
async function saveCard() {
  if (!state.apps.length) { alert('① 에서 앱을 먼저 골라 주세요.'); return; }
  await document.fonts.ready;
  const s = computeScore();
  const cv = $('#shareCanvas'), x = cv.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const brand = cs.getPropertyValue('--brand').trim(), brandD = cs.getPropertyValue('--brand-d').trim(), acc = cs.getPropertyValue('--accent').trim();
  const g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, brand); g.addColorStop(1, brandD);
  x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(930, 170, 260, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = '800 40px Pretendard, sans-serif'; x.fillText('나의 데이터 주권 성적표', 90, 150);
  x.fillStyle = acc; x.font = '400 480px "Black Han Sans", sans-serif'; x.fillText(s.grade, 70, 640);
  x.fillStyle = '#fff'; x.font = '800 64px Pretendard, sans-serif'; x.fillText(`${s.total}점`, 90, 740);
  x.font = '600 34px Pretendard, sans-serif';
  wrapText(x, s.msg, 90, 820, 900, 48);
  const rows = [['🔑 되찾은 선택권', s.ms.score], ['🌈 알고리즘 다양성', s.div], ['🛡️ 노출 방어', s.expo]];
  rows.forEach(([k, v], i) => {
    const y = 960 + i * 92;
    x.fillStyle = '#fff'; x.font = '700 32px Pretendard, sans-serif'; x.fillText(k, 90, y);
    x.fillStyle = 'rgba(255,255,255,.22)'; roundRect(x, 460, y - 26, 440, 24, 12);
    if (v != null) { x.fillStyle = acc; roundRect(x, 460, y - 26, 440 * v / 100, 24, 12); }
    x.fillStyle = '#fff'; x.font = '800 32px Pretendard, sans-serif'; x.fillText(v == null ? '–' : String(v), 920, y);
  });
  x.font = '600 26px Pretendard, sans-serif'; x.fillStyle = 'rgba(255,255,255,.8)';
  x.fillText(`쓰는 앱 ${state.apps.length}개 · 미션 ${s.ms.done}/${s.ms.total}`, 90, 1250);
  x.fillText('#데이터주권성적표  ·  이 카드는 내 기기에서만 만들어졌어요', 90, 1292);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `데이터주권성적표_${s.grade}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '나의 데이터 주권 성적표' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function roundRect(x, l, t, w, hh, r) {
  if (w <= 0) return;
  r = Math.min(r, w / 2); x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + hh, r); x.arcTo(l + w, t + hh, l, t + hh, r);
  x.arcTo(l, t + hh, l, t, r); x.arcTo(l, t, l + w, t, r); x.fill();
}
function wrapText(x, text, l, t, maxW, lh) {
  let line = '';
  for (const ch of text) {
    if (x.measureText(line + ch).width > maxW) { x.fillText(line, l, t); line = ch; t += lh; } else line += ch;
  }
  x.fillText(line, l, t);
}

// ---------- 디톡스 챌린지 ----------
function openDetox() {
  const list = $('#detoxList');
  list.replaceChildren(...DETOX.map(([d, t], i) => h('li', {}, h('label', {},
    h('input', { type: 'checkbox', checked: state.detox.includes(i), onchange: e => {
      state.detox = e.target.checked ? [...new Set([...state.detox, i])] : state.detox.filter(n => n !== i);
      save(); detoxCount();
    } }),
    h('span', {}, h('b', {}, d), t)))));
  detoxCount();
  $('#detox').showModal();
}
function detoxCount() {
  const n = state.detox.length;
  $('#detoxCount').textContent = n === DETOX.length ? '🎉 7일 완주! 알고리즘 말고 내가 고른 일주일이었어요.' : `${n} / ${DETOX.length}일 완료 · 이 브라우저에만 저장돼요`;
}

// ---------- 모션·내비 ----------
function setupReveal() {
  const els = $$('.reveal');
  if (reduced || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
  els.forEach(e => io.observe(e));
}
function setupStepNav() {
  const links = $$('.steps a');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('.step').forEach(s => io.observe(s));
}
