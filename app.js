// 台股每日戰情總看板 - 前端互動邏輯
let currentData = null;
let currentSearch = '';
let currentHitrate = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  const tab = new URLSearchParams(location.search).get('tab');
  if (tab) switchTab(tab);
});

async function loadData() {
  try {
    const res = await fetch('data/latest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    currentData = await res.json();
    renderAll(currentData);
  } catch (err) {
    console.warn('無法從 data/latest.json 載入，使用預設資料渲染：', err);
    currentData = getFallbackData();
    renderAll(currentData);
  }
  try {
    const hr = await fetch('data/confluence-hitrate.json', { cache: 'no-store' });
    if (hr.ok) {
      currentHitrate = await hr.json();
      renderHitrate(currentHitrate);
    } else {
      renderHitrate(null);
    }
  } catch (err) {
    console.warn('無法載入 confluence-hitrate.json', err);
    renderHitrate(null);
  }
}

function renderHitrate(hr) {
  const bar = document.getElementById('hitrateBar');
  const headline = document.getElementById('hitrateHeadline');
  const meta = document.getElementById('hitrateMeta');
  if (!headline) return;
  if (!hr) {
    headline.textContent = '尚無回算檔（樣本不足，不下結論）';
    if (meta) meta.textContent = '隔日開盤進／第 5 日收盤出／扣 0.6%；n<30 不下結論';
    return;
  }
  headline.textContent = hr.headline || '樣本不足，不下結論';
  headline.className = `text-sm font-semibold mt-0.5 ${hr.sample_ok ? 'text-emerald-300' : 'text-amber-300'}`;
  const n3 = (hr.stars3 && hr.stars3.n) || 0;
  const nDone = hr.n_completed != null ? hr.n_completed : '—';
  if (meta) {
    meta.textContent = `完成 ${nDone} 筆｜⭐⭐⭐ n=${n3}｜門檻 ${hr.min_sample || 30}`;
  }
  if (bar) bar.classList.remove('hidden');
}

function hasMetric(v) {
  return v !== undefined && v !== null && v !== '';
}

function hasIndexMa(v) {
  return hasMetric(v) && Number(v) !== 0;
}

function marketExtrasMissing(m) {
  return !hasIndexMa(m.ma20) && !hasIndexMa(m.ma60);
}

function fmtPct(v, digits) {
  if (!hasMetric(v)) return '—';
  return `${(Number(v) * 100).toFixed(digits)}%`;
}

function fmtSignedPct(v, digits, prefix) {
  if (!hasMetric(v)) return `${prefix || ''}—`;
  const n = Number(v) * 100;
  const sign = n > 0 ? '+' : '';
  return `${prefix || ''}${sign}${n.toFixed(digits)}%`;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

/** 舊 latest.json 沒有 share_d5，且把 5 日佔比變化誤塞在 rs5、share_z 全為 0。 */
function isLegacySectorRow(s) {
  return !hasOwn(s, 'share_d5') && (!hasMetric(s.share_z) || Number(s.share_z) === 0);
}

function sectorShareD5(s) {
  if (hasOwn(s, 'share_d5')) {
    return hasMetric(s.share_d5) ? Number(s.share_d5) : null;
  }
  if (isLegacySectorRow(s) && hasMetric(s.rs5)) return Number(s.rs5);
  return null;
}

function sectorRelRs5(s) {
  if (isLegacySectorRow(s)) return null;
  return hasMetric(s.rs5) ? Number(s.rs5) : null;
}

function renderAll(data) {
  if (!data) return;

  // 1. Header & Market Overview
  document.getElementById('displayDate').textContent = data.date || '最新';
  
  const m = data.market || {};
  const lightColors = {
    green: { text: '🟢 綠燈 多頭許可', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', stat: 'text-emerald-400' },
    yellow: { text: '🟡 黃燈 警戒減碼', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', stat: 'text-amber-400' },
    red: { text: '🔴 紅燈 防禦空手', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', stat: 'text-rose-400' }
  };
  const cfg = lightColors[m.light] || lightColors.green;
  
  const badgeEl = document.getElementById('headerMarketBadge');
  badgeEl.textContent = cfg.text;
  badgeEl.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.badge}`;

  document.getElementById('statLightText').textContent = cfg.text;
  document.getElementById('statLightText').className = `text-base font-bold mt-1 ${cfg.stat}`;
  document.getElementById('statAdvice').textContent = m.advice || '正常操作';
  document.getElementById('statTaiex').textContent = Number(m.taiex || 0).toLocaleString();
  const extrasMissing = marketExtrasMissing(m);
  document.getElementById('statTaiex5d').textContent =
    (extrasMissing && !Number(m.taiex_r5)) ? '5日 —' : fmtSignedPct(m.taiex_r5, 1, '5日 ');

  const ma20 = Number(m.ma20 || 0);
  const ma60 = Number(m.ma60 || 0);
  const taiex = Number(m.taiex || 0);
  if (!hasIndexMa(m.ma20) && !hasIndexMa(m.ma60)) {
    document.getElementById('statMaPosition').textContent = '—';
    document.getElementById('statMaValues').textContent = '20MA — ｜ 60MA —';
  } else {
    const pos20 = hasIndexMa(m.ma20) ? (taiex >= ma20 ? '站上' : '跌破') : '—';
    const pos60 = hasIndexMa(m.ma60) ? (taiex >= ma60 ? '站上' : '跌破') : '—';
    document.getElementById('statMaPosition').textContent = `${pos20} / ${pos60}`;
    document.getElementById('statMaValues').textContent =
      `20MA ${hasIndexMa(m.ma20) ? ma20.toLocaleString() : '—'} ｜ 60MA ${hasIndexMa(m.ma60) ? ma60.toLocaleString() : '—'}`;
  }
  document.getElementById('statAdvRatio').textContent =
    (extrasMissing && !Number(m.adv_ratio)) ? '—' : fmtPct(m.adv_ratio, 0);
  document.getElementById('statAboveMa20').textContent = fmtPct(m.above_ma20, 1);
  document.getElementById('statConc3').textContent = fmtPct(m.conc3, 1);

  // AI Briefing
  const ai = data.ai_briefing;
  const aiBox = document.getElementById('aiBriefingBox');
  if (ai) {
    aiBox.classList.remove('hidden');
    document.getElementById('aiToneBadge').textContent = ai.tone || '中性';
    document.getElementById('aiSummaryText').textContent = ai.summary || '';
    const hlContainer = document.getElementById('aiHighlightsList');
    hlContainer.innerHTML = (ai.highlights || []).map(hl => `
      <span class="px-2 py-0.5 rounded bg-darkBg border border-indigo-500/20 text-indigo-200">
        ✨ ${escapeHtml(hl)}
      </span>
    `).join('');
  } else {
    aiBox.classList.add('hidden');
  }

  // 2. Tab 1: Candidates / watch
  const lists = planLists(data);
  renderPlanListHeadings(data.market || {});
  renderPlanCandidates(lists.buy, 'planCandidatesContainer', data.market || {});
  renderPlanWatch(lists.watch);
  renderPlanExits(data.exit_warnings || []);

  // 3. Tab 2: Rotation
  renderRotation(data.hot_sectors || []);
  renderThemeSectors(data.theme_sectors || []);

  // 4. Tab 3: Momentum
  renderMomentum(data.momentum_top || []);

  // 5. Tab 4: News
  renderNews(data.news_stocks || []);

  // 6. Tab 5: Swing
  renderSwing(data.swing_picks || []);
}

function planLists(data) {
  const light = (data.market || {}).light;
  const buy = data.candidates || [];
  const watch = data.watchlist || [];
  // 舊黃燈 JSON 沒有 watchlist：把 candidates 當觀察名單
  if (watch.length === 0 && buy.length && light === 'yellow') {
    return { buy: [], watch: buy };
  }
  return { buy, watch };
}

function renderPlanListHeadings(market) {
  const buyH = document.getElementById('planBuyHeading');
  const watchH = document.getElementById('planWatchHeading');
  if (!buyH || !watchH) return;
  if (market.light === 'red') {
    buyH.textContent = '新倉：紅燈禁止';
    watchH.textContent = '觀察名單';
  } else if (market.light === 'yellow') {
    buyH.textContent = '黃燈不開新倉';
    watchH.textContent = '黃燈觀察名單（不是買進指令）';
  } else {
    buyH.textContent = '明日買進候選（須右側＋族群）';
    watchH.textContent = '觀察名單（動能掃描或缺右側／族群）';
  }
}

function renderPlanWatch(watch) {
  const section = document.getElementById('planWatchSection');
  const container = document.getElementById('planWatchContainer');
  if (!container) return;
  if (section) {
    section.classList.toggle('hidden', !watch.length && currentData?.market?.light === 'green');
  }
  renderPlanCandidates(watch, 'planWatchContainer', currentData?.market || {});
}

function renderPlanCandidates(candidates, containerId, market) {
  const container = document.getElementById(containerId || 'planCandidatesContainer');
  if (!container) return;
  const filtered = candidates.filter(c => matchSearch(c.code, c.name, c.sector, c.setup));
  const isBuyBox = containerId !== 'planWatchContainer';

  if (!filtered.length) {
    let empty = '今日無符合條件之標的';
    if (market.light === 'red' && isBuyBox) empty = '🔴 紅燈防禦日：暫停開立新多單';
    else if (market.light === 'yellow' && isBuyBox) empty = '🟡 黃燈：買進欄為空，請看下方觀察名單';
    else if (isBuyBox) empty = '今日無符合右側＋族群的買進候選';
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 text-xs bg-darkBg/40 rounded-xl border border-darkBorder/40">
        ${empty}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const starMap = { 3: '⭐⭐⭐', 2: '⭐⭐', 1: '⭐' };
    const starsText = starMap[c.stars] || '⭐⭐';
    const borderGlow = c.stars === 3 ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-darkCard' : 'border-darkBorder';

    return `
      <div class="rounded-xl border ${borderGlow} p-4 bg-darkCard hover:bg-darkCardHover transition space-y-3 shadow-lg">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-sm font-bold text-amber-400">${starsText}</span>
              <span class="text-sm font-bold text-white font-mono">${c.code}</span>
              <span class="text-sm font-bold text-slate-100">${escapeHtml(c.name)}</span>
            </div>
            <div class="flex items-center space-x-2 mt-1">
              <span class="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium">${escapeHtml(c.sector)}</span>
              <span class="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">${escapeHtml(c.setup || '動能候選')}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400">參考收盤</div>
            <div class="text-sm font-mono font-bold text-white">${Number(c.price).toFixed(1)}</div>
          </div>
        </div>

        <!-- 建議部位與停損 -->
        <div class="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-darkBg/60 border border-darkBorder/60 text-xs">
          <div>
            <div class="text-slate-400 text-[10px]">建議停損</div>
            <div class="font-mono font-bold text-rose-400">${c.stop_price != null ? Number(c.stop_price).toFixed(1) : '—'}</div>
          </div>
          <div>
            <div class="text-slate-400 text-[10px]">建議部位 (風險2萬)</div>
            <div class="font-bold text-emerald-400 truncate">${escapeHtml(c.suggested_text || '試算中')}</div>
          </div>
        </div>

        <!-- 核心共振邏輯 -->
        <div class="text-[11px] text-slate-300 space-y-1">
          ${(c.reasons || []).map(r => `<div class="flex items-start space-x-1.5"><span class="text-indigo-400">•</span><span class="leading-tight">${escapeHtml(r)}</span></div>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderPlanExits(exits) {
  const tbody = document.getElementById('exitTableBody');
  const filtered = exits.filter(e => matchSearch(e.code, e.name, e.sector, e.status, e.action_advice));

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-6 text-center text-slate-400">未設定持股或今日持股無異常訊號</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    const isAlert = (e.status || '').includes('退場') || (e.warnings && e.warnings.length);
    const statusClass = isAlert ? 'text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-semibold' : 'text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium';
    return `
      <tr class="hover:bg-darkCardHover/50 transition">
        <td class="px-4 py-3 font-semibold text-white font-mono">${e.code} <span class="font-sans font-normal text-slate-300 ml-1">${escapeHtml(e.name)}</span></td>
        <td class="px-4 py-3 text-slate-400">${escapeHtml(e.sector || '—')}</td>
        <td class="px-4 py-3 font-mono font-medium">${e.price ? Number(e.price).toFixed(1) : '—'}</td>
        <td class="px-4 py-3 font-mono font-medium text-rose-400">${e.stop_price ? Number(e.stop_price).toFixed(1) : '—'}</td>
        <td class="px-4 py-3 text-slate-300">${(e.warnings && e.warnings.length) ? escapeHtml(e.warnings.join('、')) : '無異常'}</td>
        <td class="px-4 py-3"><span class="${statusClass}">${escapeHtml(e.status)}</span></td>
        <td class="px-4 py-3 text-slate-300">${escapeHtml(e.action_advice || '維持持有')}</td>
      </tr>
    `;
  }).join('');
}

function renderRotation(sectors) {
  const tbody = document.getElementById('rotationTableBody');
  const filtered = sectors.filter(s => matchSearch(s.name, s.stage));

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">無族群資料</td></tr>`;
    return;
  }

  const stageColors = {
    '初升': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    '主升': 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    '過熱': 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    '退潮': 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  };

  tbody.innerHTML = filtered.map(s => {
    const badge = stageColors[s.stage] || 'bg-slate-500/10 text-slate-400';
    const d5 = sectorShareD5(s);
    const rel = sectorRelRs5(s);
    return `
      <tr class="hover:bg-darkCardHover/50 transition">
        <td class="px-4 py-3 font-bold text-white">${escapeHtml(s.name)}</td>
        <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold ${badge}">${escapeHtml(s.stage)}</span></td>
        <td class="px-4 py-3 font-mono font-semibold text-slate-200">${(Number(s.share || 0) * 100).toFixed(1)}%</td>
        <td class="px-4 py-3 font-mono ${d5 == null ? 'text-slate-500' : d5 >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${d5 == null ? '—' : fmtSignedPct(d5, 1)}</td>
        <td class="px-4 py-3 font-mono ${rel == null ? 'text-slate-500' : rel >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${rel == null ? '—' : fmtSignedPct(rel, 1)}</td>
        <td class="px-4 py-3">
          <div class="flex items-center space-x-2">
            <div class="w-16 bg-darkBg rounded-full h-1.5 overflow-hidden">
              <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${Math.min(100, Math.max(0, s.score || 50))}%"></div>
            </div>
            <span class="font-mono text-slate-300 font-semibold">${Number(s.score || 0).toFixed(0)}</span>
          </div>
        </td>
        <td class="px-4 py-3 font-mono text-slate-300">${hasMetric(s.heat_days) ? Number(s.heat_days) + ' 日' : '—'}</td>
      </tr>
    `;
  }).join('');
}

function renderThemeSectors(sectors) {
  const section = document.getElementById('themeSectorsSection');
  const tbody = document.getElementById('themeTableBody');
  if (!section || !tbody) return;
  const rows = (sectors || []).filter(s => matchSearch(s.name, s.stage));
  if (!rows.length) {
    section.classList.add('hidden');
    tbody.innerHTML = '';
    return;
  }
  section.classList.remove('hidden');
  const stageColors = {
    '初升': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    '主升': 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    '過熱': 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    '退潮': 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  };
  tbody.innerHTML = rows.map(s => {
    const badge = stageColors[s.stage] || 'bg-slate-500/10 text-slate-400';
    const d5 = sectorShareD5(s);
    const rel = sectorRelRs5(s);
    return `
      <tr class="hover:bg-darkCardHover/50 transition">
        <td class="px-4 py-3 font-bold text-white">${escapeHtml(s.name)}</td>
        <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold ${badge}">${escapeHtml(s.stage || '—')}</span></td>
        <td class="px-4 py-3 font-mono font-semibold text-slate-200">${(Number(s.share || 0) * 100).toFixed(1)}%</td>
        <td class="px-4 py-3 font-mono ${d5 == null ? 'text-slate-500' : d5 >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${d5 == null ? '—' : fmtSignedPct(d5, 1)}</td>
        <td class="px-4 py-3 font-mono ${rel == null ? 'text-slate-500' : rel >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${rel == null ? '—' : fmtSignedPct(rel, 1)}</td>
        <td class="px-4 py-3 font-mono text-slate-300 font-semibold">${Number(s.score || 0).toFixed(0)}</td>
      </tr>
    `;
  }).join('');
}

function renderMomentum(momentumList) {
  const tbody = document.getElementById('momentumTableBody');
  const filtered = momentumList.filter(m => matchSearch(m.code, m.name, m.signals));

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">無成交動能資料</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((m, idx) => `
    <tr class="hover:bg-darkCardHover/50 transition">
      <td class="px-4 py-3 font-mono text-slate-400">${idx + 1}</td>
      <td class="px-4 py-3 font-bold text-white font-mono">${m.code} <span class="font-sans font-normal text-slate-300 ml-1">${escapeHtml(m.name)}</span></td>
      <td class="px-4 py-3 font-mono font-medium">${Number(m.close || 0).toFixed(1)}</td>
      <td class="px-4 py-3 font-mono font-semibold ${Number(m.ret_5d || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(m.ret_5d || 0) >= 0 ? '+' : ''}${(Number(m.ret_5d || 0) * 100).toFixed(1)}%</td>
      <td class="px-4 py-3 font-mono font-bold text-amber-400">${Number(m.vol_ratio || 1).toFixed(1)}x</td>
      <td class="px-4 py-3 font-mono font-bold text-indigo-400">${Number(m.score || 0).toFixed(0)}</td>
      <td class="px-4 py-3 text-slate-300 text-[11px]">${escapeHtml(m.signals || '量價齊揚')}</td>
    </tr>
  `).join('');
}

function renderNews(newsList) {
  const container = document.getElementById('newsCardsContainer');
  const filtered = newsList.filter(n => matchSearch(n.code, n.name, n.sector, n.sentiment, ...(n.events || [])));

  if (!filtered.length) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs">無消息面焦點資料</div>`;
    return;
  }

  container.innerHTML = filtered.map(n => `
    <div class="rounded-xl border border-darkBorder p-4 bg-darkCard hover:bg-darkCardHover transition space-y-2.5 shadow-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-sm font-bold text-white font-mono">${n.code}</span>
          <span class="text-sm font-bold text-slate-100">${escapeHtml(n.name)}</span>
          <span class="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium">${escapeHtml(n.sector || '焦點')}</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${n.sentiment === '偏多' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400'}">${escapeHtml(n.sentiment || '中性')}</span>
      </div>
      <div class="text-xs text-slate-300 space-y-1">
        ${(n.events || []).map(ev => `<div class="flex items-center space-x-1.5"><span class="text-amber-400">⚡</span><span>${escapeHtml(ev)}</span></div>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderSwing(swings) {
  const tbody = document.getElementById('swingTableBody');
  const filtered = swings.filter(s => matchSearch(s.code, s.name, s.sector, s.setup, s.signals));

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">今日無符合右側選股標的</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr class="hover:bg-darkCardHover/50 transition">
      <td class="px-4 py-3 font-bold text-white font-mono">${s.code} <span class="font-sans font-normal text-slate-300 ml-1">${escapeHtml(s.name)}</span></td>
      <td class="px-4 py-3 text-slate-400">${escapeHtml(s.sector || '—')}</td>
      <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">${escapeHtml(s.setup || '突破確認')}</span></td>
      <td class="px-4 py-3 font-mono font-medium">${Number(s.close || 0).toFixed(1)}</td>
      <td class="px-4 py-3 font-mono font-medium text-rose-400">${Number(s.stop || 0).toFixed(1)}</td>
      <td class="px-4 py-3 font-mono font-bold text-indigo-400">${Number(s.score || 0).toFixed(0)}</td>
      <td class="px-4 py-3 text-slate-300 text-[11px]">${escapeHtml(s.signals || '均線多頭')}</td>
    </tr>
  `).join('');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
    btn.classList.toggle('text-slate-400', btn.dataset.tab !== tabId);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== `tab-${tabId}`);
  });
}

function handleSearch(val) {
  currentSearch = (val || '').trim().toLowerCase();
  if (currentData) {
    renderPlanListHeadings(currentData.market || {});
    const lists = planLists(currentData);
    renderPlanCandidates(lists.buy, 'planCandidatesContainer', currentData.market || {});
    renderPlanWatch(lists.watch);
    renderPlanExits(currentData.exit_warnings || []);
    renderRotation(currentData.hot_sectors || []);
    renderThemeSectors(currentData.theme_sectors || []);
    renderMomentum(currentData.momentum_top || []);
    renderNews(currentData.news_stocks || []);
    renderSwing(currentData.swing_picks || []);
  }
}

function matchSearch(...terms) {
  if (!currentSearch) return true;
  return terms.some(t => String(t || '').toLowerCase().includes(currentSearch));
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function copyPlanToClipboard() {
  if (!currentData) return;
  const m = currentData.market || {};
  let text = `🎯【台股每日作戰計劃書】${currentData.date || '最新'}\n`;
  const r5txt = hasMetric(m.taiex_r5) ? `，5日 ${fmtSignedPct(m.taiex_r5, 1)}` : '';
  const maTxt = (hasIndexMa(m.ma20) || hasIndexMa(m.ma60))
    ? `，MA20 ${hasIndexMa(m.ma20) ? Number(m.ma20).toLocaleString() : '—'} / MA60 ${hasIndexMa(m.ma60) ? Number(m.ma60).toLocaleString() : '—'}`
    : '';
  text += `大盤環境：${m.light?.toUpperCase() || 'GREEN'}（加權 ${Number(m.taiex || 0).toLocaleString()}${r5txt}${maTxt}）\n`;
  text += `方針指引：${m.advice || '正常操作'}\n\n`;
  
  const lists = planLists(currentData);
  if (lists.buy.length) {
    text += `🚀 買進候選：\n`;
    lists.buy.forEach(c => {
      text += `• ${c.code} ${c.name} (${c.stars}星, ${c.setup || '動能候選'}, 停損${c.stop_price ?? '—'}, ${c.suggested_text || ''})\n`;
    });
    text += `\n`;
  }
  if (lists.watch.length) {
    text += `👀 觀察名單：\n`;
    lists.watch.forEach(c => {
      text += `• ${c.code} ${c.name} (${c.stars}星, ${c.setup || '觀察'})\n`;
    });
    text += `\n`;
  }
  
  if (currentData.exit_warnings && currentData.exit_warnings.length) {
    text += `⚠️ 持股警示：\n`;
    currentData.exit_warnings.forEach(e => {
      text += `• ${e.code} ${e.name}: ${e.status} (${e.action_advice})\n`;
    });
  }

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyPlanBtn');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span>✅ 已複製！</span>';
    setTimeout(() => { btn.innerHTML = oldText; }, 2000);
  });
}

function getFallbackData() {
  return {
    date: "2026-09-01",
    market: {
      light: "green",
      taiex: 22450.0,
      taiex_r5: 0.015,
      ma20: 22100.0,
      ma60: 21800.0,
      adv_ratio: 0.62,
      above_ma20: 0.68,
      conc3: 0.38,
      advice: "綠燈環境，資金健康，正常操作多單"
    },
    ai_briefing: {
      tone: "積極做多",
      summary: "AI 矽光子與重電受外資擴大買超，資金持續向電子半導體與主流設備集中。",
      highlights: ["聯鈞(3450) CPO 題材跨 3 來源高度共識", "華城(1519) 重電外銷動能強勁"],
      risks: ["航運族群運價回落面臨退潮整理"]
    },
    candidates: [
      {
        code: "3450", name: "聯鈞", sector: "半導體", price: 240.0, stop_price: 225.0, stars: 3, role: "buy", setup: "突破確認",
        suggested_text: "1 張", reasons: ["技術面：突破確認（跳空創高+爆量）", "動能面：成交前50大（量比 2.1x、5日 +8.2%）", "族群面：身處主流資金流入板塊【半導體】", "消息面（註解、不加星）：偏多（營收創高、投信買超）"]
      },
      {
        code: "1519", name: "華城", sector: "電機機械", price: 680.0, stop_price: 645.0, stars: 3, role: "buy", setup: "回測再起",
        suggested_text: "367 股（零股）", reasons: ["技術面：回測再起（守穩20MA反彈）", "動能面：成交前50大（量比 1.5x、5日 +6.5%）", "族群面：身處主流資金流入板塊【電機機械】"]
      }
    ],
    watchlist: [
      {
        code: "2330", name: "台積電", sector: "半導體", price: 980.0, stop_price: 945.0, stars: 2, role: "watch", setup: "動能跟隨",
        suggested_text: "觀察", reasons: ["動能面：成交前50大", "族群面：半導體主升（無右側確認）"]
      }
    ],
    exit_warnings: [
      { code: "2330", name: "台積電", sector: "半導體", price: 980.0, stop_price: 950.0, warnings: [], status: "✓ 續抱觀察", action_advice: "維持持有續抱" },
      { code: "2603", name: "長榮", sector: "航運", price: 185.0, stop_price: 190.0, warnings: ["跌破MA10", "族群退潮"], status: "⚠️ 退場警示", action_advice: "⚠️ 留意停損並依紀律調節" }
    ],
    hot_sectors: [
      { name: "半導體", stage: "主升", share: 0.185, share_z: 1.4, share_d5: 0.012, rs5: 0.032, score: 88.0, heat_days: 4 },
      { name: "電腦及週邊", stage: "初升", share: 0.124, share_z: 0.8, share_d5: 0.008, rs5: 0.021, score: 76.0, heat_days: 2 },
      { name: "電機機械", stage: "初升", share: 0.095, share_z: 0.5, share_d5: 0.006, rs5: 0.018, score: 70.0, heat_days: 1 }
    ],
    theme_sectors: [
      { name: "CPO / 矽光子", stage: "初升", share: 0.08, share_z: 1.1, share_d5: 0.015, rs5: 0.04, score: 90.0, heat_days: 3 }
    ],
    momentum_top: [
      { code: "3450", name: "聯鈞", close: 240.0, ret_5d: 0.082, vol_ratio: 2.1, score: 78.0, signals: "RSI強,均線多頭,量能激增" },
      { code: "1519", name: "華城", close: 680.0, ret_5d: 0.065, vol_ratio: 1.5, score: 72.0, signals: "突破20日高,MACD↑" },
      { code: "2330", name: "台積電", close: 980.0, ret_5d: 0.035, vol_ratio: 1.3, score: 65.0, signals: "RSI強,均線多頭" }
    ],
    news_stocks: [
      { code: "3450", name: "聯鈞", sector: "半導體", sentiment: "偏多", events: ["營收創高", "投信買超"] },
      { code: "1519", name: "華城", sector: "電機機械", sentiment: "偏多", events: ["外資買超", "海外訂單"] }
    ],
    swing_picks: [
      { code: "3450", name: "聯鈞", sector: "半導體", setup: "突破確認", close: 240.0, stop: 225.0, score: 88.0, signals: "跳空創高+爆量" },
      { code: "1519", name: "華城", sector: "電機機械", setup: "回測再起", close: 680.0, stop: 645.0, score: 82.0, signals: "守穩20MA反彈" }
    ]
  };
}
