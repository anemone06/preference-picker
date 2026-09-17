(function () {
  'use strict';
  const E = window.PreferenceEngine;
  const $ = id => document.getElementById(id);
  const main = $('main');
  const storageKey = 'villain-preference-v1';
  const roundNames = ['48 → 24', '24 → 12', '12 → 6', '6 → 3', '3 → 1'];
  let state = E.fresh();
  let view = 'choose';
  let current = E.next(state).id;
  let editing = false;
  let undoSnapshot = null;
  let timer = null;
  let busy = false;
  let storageWarning = '';
  let graphTransform = null;
  let graphCleanup = () => {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      state = E.restore(parsed.state);
      view = parsed.view === 'overview' ? 'overview' : 'choose';
      current = E.byId[parsed.current] && E.ready(state, parsed.current) ? parsed.current : E.next(state)?.id || E.finalId;
      if (!E.next(state) && view !== 'overview') view = 'result';
    }
  } catch (error) {
    storageWarning = '无法读取已保存进度，本次从头开始';
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ state, view, current }));
      storageWarning = '';
    } catch (error) {
      storageWarning = '无法保存进度，请保持此页面打开';
    }
    $('save-status').textContent = storageWarning || '进度保存在此浏览器';
  }
  function cancelTransition() {
    clearTimeout(timer);
    timer = null;
    busy = false;
  }
  function updateChrome() {
    const count = Object.keys(state.winners).length;
    $('progress-text').textContent = '已选择 ' + count + ' / ' + E.total;
    $('progress-fill').style.width = count / E.total * 100 + '%';
    $('save-status').textContent = storageWarning || '进度保存在此浏览器';
    $('choose-view').textContent = E.next(state) ? '逐轮选择' : '最终结果';
    $('choose-view').classList.toggle('active', view !== 'overview');
    $('overview-view').classList.toggle('active', view === 'overview');
    $('choose-view').setAttribute('aria-pressed', String(view !== 'overview'));
    $('overview-view').setAttribute('aria-pressed', String(view === 'overview'));
  }
  function showNotice(text, canUndo) {
    $('notice-text').textContent = text;
    $('undo').hidden = !canUndo;
    $('notice').hidden = false;
  }
  function openChoose(id, fromOverview = false) {
    cancelTransition();
    const target = id ? E.byId[id] : E.next(state);
    if (!target) { view = 'result'; editing = false; }
    else if (E.ready(state, target.id)) { current = target.id; view = 'choose'; editing = fromOverview; }
    else return;
    render();
    persist();
  }
  function openOverview() {
    cancelTransition();
    view = 'overview';
    render();
    persist();
  }
  function render(focus = true) {
    graphCleanup();
    updateChrome();
    if (view === 'overview') renderOverview();
    else if (view === 'result') renderResult();
    else renderChoice();
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      main.querySelector('h1')?.focus({ preventScroll: true });
    }
  }
  function roundStrip(round) {
    return '<div class="rounds" aria-label="当前第 ' + (round + 1) + ' 轮">' + ['48', '24', '12', '6', '3'].map((n, i) => {
      const complete = E.rounds[i].every(node => state.winners[node.id]);
      return '<div class="round-step ' + (i === round ? 'current ' : '') + (complete ? 'complete' : '') + '"><b>' + n + '</b><span>' + (i === 4 ? '决选' : '第 ' + (i + 1) + ' 轮') + '</span></div>';
    }).join('') + '</div>';
  }
  function renderChoice() {
    const node = E.byId[current];
    if (!node || !E.ready(state, current)) { openChoose(); return; }
    const options = E.candidates(state, current);
    const winner = state.winners[current];
    main.innerHTML = '<section class="selection fade-in">' + roundStrip(node.round) +
      '<span class="eyebrow">' + (node.round === 4 ? 'THE FINAL THREE' : 'ROUND 0' + (node.round + 1) + ' · ' + roundNames[node.round]) + '</span>' +
      '<h1 tabindex="-1">' + (node.round === 4 ? '最后，留下你的偏爱。' : '哪一种，更让你着迷？') + '</h1>' +
      '<p class="subtext">' + (winner ? '这是你之前的选择。你也可以改变心意。' : node.round === 4 ? '三种特质，一个最终答案。' : '没有标准答案，只选更偏爱的那一个。') + '</p>' +
      '<div class="choice-grid ' + (options.length === 3 ? 'triple' : '') + '">' + options.map((id, i) =>
        '<button class="choice-card ' + (winner === id ? 'selected' : '') + '" data-option="' + id + '" aria-label="选择' + escape(E.labels[id]) + '" aria-pressed="' + (winner === id) + '">' +
        '<span class="card-top"><span class="card-letter">' + ['A', 'B', 'C'][i] + '</span><span class="card-id">TRAIT / ' + id.split('-')[1].padStart(2, '0') + '</span></span>' +
        '<span class="card-title">' + escape(E.labels[id]) + '</span><span class="card-bottom">' + (winner === id ? '已选择' : '选择这一项') + '<span class="card-arrow">' + (winner === id ? '✓' : '↗') + '</span></span></button>'
      ).join('') + '</div>' +
      '<div class="under-cards"><span>第 ' + (node.index + 1) + ' / ' + E.rounds[node.round].length + ' 组</span><span class="keyboard-hint"><kbd class="keycap">1</kbd><kbd class="keycap">2</kbd>' + (options.length === 3 ? '<kbd class="keycap">3</kbd>' : '') + ' 快速选择</span><button class="text-button" id="from-choice-overview">' + (editing ? '返回全局视图' : '查看选择全貌') + ' ↗</button></div></section>';
    main.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', event => {
      if (event.detail > 1) return;
      choose(button.dataset.option);
    }));
    $('from-choice-overview').addEventListener('click', openOverview);
  }
  function choose(option) {
    if (busy || view !== 'choose' || $('reset-dialog').open) return;
    const previous = state;
    const wasRevision = Boolean(state.winners[current]);
    const result = E.select(state, current, option);
    if (!result.changed) { if (editing) openOverview(); else openChoose(); return; }
    undoSnapshot = { state: previous, current, view, editing };
    state = result.state;
    const returnToOverview = editing;
    persist();
    updateChrome();
    $('notice').hidden = true;
    if (wasRevision) showNotice(result.cleared ? '已改选，' + result.cleared + ' 处后续选择需要重选' : '已更新选择', true);
    busy = true;
    main.querySelectorAll('[data-option]').forEach(button => {
      button.disabled = true;
      button.classList.toggle('selected', button.dataset.option === option);
      button.classList.toggle('picking', button.dataset.option === option);
      button.setAttribute('aria-pressed', String(button.dataset.option === option));
    });
    // 切换视图、撤销和重置都会取消这个定时器，避免旧动画把用户带离全局图。
    timer = setTimeout(() => {
      busy = false;
      timer = null;
      if (returnToOverview) openOverview(); else openChoose();
    }, reduceMotion.matches ? 0 : 250);
  }
  function renderResult() {
    const winner = state.winners[E.finalId];
    if (!winner) { openChoose(); return; }
    const path = E.nodes.filter(node => state.winners[node.id] === winner);
    main.innerHTML = '<section class="selection result fade-in">' + roundStrip(4) +
      '<span class="eyebrow">YOUR ULTIMATE PREFERENCE</span><h1 tabindex="-1">偏爱，终于有了名字。</h1><p class="subtext">从 48 种反派特质中，留下你的唯一选择。</p>' +
      '<div class="winner-card"><span class="winner-symbol" aria-hidden="true">♜</span><span class="eyebrow">最终偏好</span><strong>' + escape(E.labels[winner]) + '</strong><span class="winner-id">TRAIT / ' + winner.split('-')[1].padStart(2, '0') + '</span></div>' +
      '<div class="winner-path" aria-label="晋级路径">' + path.map(node => '<span>' + (node.round === 4 ? '最终胜出' : roundNames[node.round]) + '</span>').join('<i aria-hidden="true">→</i>') + '</div>' +
      '<button class="primary" id="result-overview">回看我的选择 <span aria-hidden="true">↗</span></button></section>';
    $('result-overview').addEventListener('click', openOverview);
  }

  const positions = {};
  const graphWidth = 1560;
  const graphHeight = 3260;
  for (const node of E.nodes) {
    const height = node.round === 4 ? 170 : 112;
    const center = node.round === 0 ? 125 + node.index * 130 : node.sources.reduce((sum, source) => sum + positions[source.node].center, 0) / node.sources.length;
    positions[node.id] = { x: 50 + node.round * 300, y: center - height / 2, center, height };
  }
  function renderOverview() {
    const next = E.next(state);
    main.innerHTML = '<section class="overview fade-in"><div class="overview-heading"><div><span class="eyebrow">THE BIG PICTURE</span><h1 tabindex="-1">偏爱的晋级之路</h1></div><button class="primary" id="continue">' + (next ? '继续选择' : '查看最终结果') + ' ↗</button></div>' +
      '<div class="graph-shell"><div class="graph-toolbar"><div class="legend"><span class="legend-done">已完成</span><span class="legend-ready">可选择</span><span class="legend-wait">等待上游</span></div><div class="graph-tools glass"><button id="zoom-out" aria-label="缩小">−</button><span id="zoom-label">100%</span><button id="zoom-in" aria-label="放大">＋</button><span class="tool-divider"></span><button id="fit">全貌</button><button id="locate">定位当前</button></div></div>' +
      '<div id="graph-viewport" tabindex="0" role="region" aria-label="全局晋级图，可拖动、缩放，方向键平移"><div id="graph-canvas" style="width:' + graphWidth + 'px;height:' + graphHeight + 'px"><svg aria-hidden="true" class="graph-lines" width="' + graphWidth + '" height="' + graphHeight + '"></svg></div></div>' +
      '<div class="graph-hint">拖动探索 · 滚轮平移 · Ctrl / ⌘ + 滚轮缩放<span>点击节点，查看或改选</span></div></div></section>';
    const canvas = $('graph-canvas');
    let lines = '';
    for (const node of E.nodes) {
      if (!node.parent) continue;
      const from = positions[node.id];
      const to = positions[node.parent];
      const active = Boolean(state.winners[node.id]);
      const x = from.x + 236;
      lines += '<path class="' + (active ? 'live' : '') + '" d="M ' + x + ' ' + from.center + ' H ' + (x + 32) + ' V ' + to.center + ' H ' + to.x + '" />';
    }
    canvas.querySelector('svg').innerHTML = lines;
    E.rounds.forEach((round, i) => {
      const heading = document.createElement('div');
      heading.className = 'graph-column-heading';
      heading.style.left = (50 + i * 300) + 'px';
      heading.innerHTML = '<span>' + (i === 4 ? '最终决选' : '第 ' + (i + 1) + ' 轮') + '</span><b>' + roundNames[i] + '</b>';
      canvas.append(heading);
    });
    for (const node of E.nodes) {
      const pos = positions[node.id];
      const options = E.candidates(state, node.id);
      const isReady = E.ready(state, node.id);
      const winner = state.winners[node.id];
      const button = document.createElement('button');
      button.className = 'graph-node ' + (winner ? 'done' : isReady ? 'ready' : 'waiting') + (node.id === (next?.id || E.finalId) ? ' next-node' : '');
      button.style.cssText = 'left:' + pos.x + 'px;top:' + pos.y + 'px;height:' + pos.height + 'px';
      button.dataset.node = node.id;
      button.disabled = !isReady;
      button.setAttribute('aria-label', (node.round === 4 ? '最终决选' : '第' + (node.round + 1) + '轮第' + (node.index + 1) + '组') + '：' + options.map(id => id ? E.labels[id] : '等待上游').join(' / ') + (winner ? '，已选' + E.labels[winner] : isReady ? '，可选择' : '，等待上游'));
      button.innerHTML = '<span class="node-heading"><span>' + (node.round === 4 ? '最终决选' : '第 ' + (node.index + 1) + ' 组') + '</span><span>' + (winner ? '已完成' : isReady ? '可选择 ↗' : '等待上游') + '</span></span>' + options.map(id => '<span class="node-option ' + (winner === id && id ? 'chosen' : '') + '"><span>' + (id ? escape(E.labels[id]) : '待选出') + '</span><span>' + (winner === id && id ? '✓' : '—') + '</span></span>').join('');
      button.addEventListener('click', () => openChoose(node.id, true));
      button.addEventListener('focus', () => {
        const v = $('graph-viewport').getBoundingClientRect();
        const b = button.getBoundingClientRect();
        if (b.left < v.left || b.right > v.right || b.top < v.top || b.bottom > v.bottom) centerNode(node.id);
      });
      canvas.append(button);
    }
    $('continue').addEventListener('click', () => openChoose());
    setupGraph();
  }
  function applyGraphTransform() {
    if (!$('graph-canvas') || !graphTransform) return;
    const { x, y, scale } = graphTransform;
    $('graph-canvas').style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    $('zoom-label').textContent = Math.round(scale * 100) + '%';
  }
  function centerNode(id) {
    const viewport = $('graph-viewport');
    if (!viewport) return;
    const pos = positions[id];
    const scale = Math.max(.75, graphTransform?.scale || .85);
    const x = viewport.clientWidth / 2 - (pos.x + 118) * scale;
    const y = viewport.clientHeight / 2 - pos.center * scale;
    graphTransform = {
      scale,
      x: Math.max(Math.min(24, viewport.clientWidth - graphWidth * scale - 24), Math.min(24, x)),
      y: Math.max(Math.min(24, viewport.clientHeight - graphHeight * scale - 24), Math.min(24, y))
    };
    applyGraphTransform();
  }
  function zoomAt(factor, x, y) {
    const previous = graphTransform.scale;
    const scale = Math.max(.12, Math.min(1.8, previous * factor));
    graphTransform.x = x - (x - graphTransform.x) * scale / previous;
    graphTransform.y = y - (y - graphTransform.y) * scale / previous;
    graphTransform.scale = scale;
    applyGraphTransform();
  }
  function setupGraph() {
    const viewport = $('graph-viewport');
    const controller = new AbortController();
    const signal = controller.signal;
    const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal });
    const center = () => [viewport.clientWidth / 2, viewport.clientHeight / 2];
    if (!graphTransform) centerNode(E.next(state)?.id || E.finalId); else applyGraphTransform();
    listen($('zoom-in'), 'click', () => zoomAt(1.2, ...center()));
    listen($('zoom-out'), 'click', () => zoomAt(1 / 1.2, ...center()));
    listen($('locate'), 'click', () => centerNode(E.next(state)?.id || E.finalId));
    listen($('fit'), 'click', () => {
      const scale = Math.min((viewport.clientWidth - 24) / graphWidth, (viewport.clientHeight - 24) / graphHeight);
      graphTransform = { scale, x: (viewport.clientWidth - graphWidth * scale) / 2, y: (viewport.clientHeight - graphHeight * scale) / 2 };
      applyGraphTransform();
    });
    listen(viewport, 'wheel', event => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = viewport.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * .007), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        graphTransform.x -= event.shiftKey ? event.deltaY : event.deltaX;
        graphTransform.y -= event.shiftKey ? 0 : event.deltaY;
        applyGraphTransform();
      }
    }, { passive: false });
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let moved = false;
    let blockClick = false;
    const distance = () => { const points = [...pointers.values()]; return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); };
    listen(viewport, 'pointerdown', event => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) { drag = { x: event.clientX, y: event.clientY }; moved = false; blockClick = false; }
      else if (pointers.size === 2) { pinch = distance(); moved = true; }
    });
    listen(window, 'pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2 && pinch) {
        const currentDistance = distance();
        const points = [...pointers.values()];
        const rect = viewport.getBoundingClientRect();
        zoomAt(currentDistance / pinch, (points[0].x + points[1].x) / 2 - rect.left, (points[0].y + points[1].y) / 2 - rect.top);
        pinch = currentDistance;
      } else if (drag && pointers.size === 1) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        graphTransform.x += dx;
        graphTransform.y += dy;
        drag = { x: event.clientX, y: event.clientY };
        viewport.classList.add('dragging');
        applyGraphTransform();
      }
    });
    const finish = event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      blockClick = moved;
      pinch = null;
      drag = pointers.size ? [...pointers.values()][0] : null;
      viewport.classList.remove('dragging');
    };
    listen(window, 'pointerup', finish);
    listen(window, 'pointercancel', finish);
    listen(viewport, 'click', event => { if (blockClick) { event.preventDefault(); event.stopPropagation(); blockClick = false; } }, { capture: true });
    listen(viewport, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const steps = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
      graphTransform.x += steps[event.key][0];
      graphTransform.y += steps[event.key][1];
      applyGraphTransform();
    });
    graphCleanup = () => controller.abort();
  }

  $('choose-view').addEventListener('click', () => openChoose());
  $('overview-view').addEventListener('click', openOverview);
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); openChoose(); });
  $('dismiss-notice').addEventListener('click', () => { $('notice').hidden = true; });
  $('undo').addEventListener('click', () => {
    if (!undoSnapshot) return;
    cancelTransition();
    ({ state, current, view, editing } = undoSnapshot);
    undoSnapshot = null;
    render();
    persist();
    showNotice('已恢复改选前的全部选择', false);
  });
  $('reset').addEventListener('click', () => {
    cancelTransition();
    render(false);
    $('reset-dialog').returnValue = 'cancel';
    $('reset-dialog').showModal();
  });
  $('reset-dialog').addEventListener('close', () => {
    if ($('reset-dialog').returnValue !== 'reset') return;
    cancelTransition();
    state = E.fresh();
    undoSnapshot = null;
    graphTransform = null;
    $('notice').hidden = true;
    openChoose();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || $('reset-dialog').open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (view === 'choose' && /^[123]$/.test(event.key)) {
      const option = E.candidates(state, current)[Number(event.key) - 1];
      if (option) { event.preventDefault(); choose(option); }
    }
  });
  render(false);
  if (storageWarning) showNotice(storageWarning, false);

  // 浏览器支持时提供与界面共用状态的结构化入口；不支持时不影响离线使用。
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
    const snapshot = () => ({ completed: Object.keys(state.winners).length, total: E.total, view, winner: E.labels[state.winners[E.finalId]] || null, nodes: E.nodes.map(node => ({ id: node.id, candidates: E.candidates(state, node.id).map(id => id ? { id, label: E.labels[id] } : null), winner: state.winners[node.id] || null, ready: E.ready(state, node.id) })) });
    const registrations = [
      { name: 'read_preference_progress', title: '读取选择进度', description: '读取已完成的选择、可选节点及最终结果，不修改进度。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: snapshot },
      { name: 'select_preference_option', title: '选择偏好', description: '为指定节点选择一个候选项；改选会清空受影响的后续选择，与页面点击行为一致。', inputSchema: { type: 'object', properties: { nodeId: { type: 'string' }, optionId: { type: 'string' } }, required: ['nodeId', 'optionId'], additionalProperties: false }, annotations: { readOnlyHint: false }, async execute(input) {
        if (!input || typeof input.nodeId !== 'string' || typeof input.optionId !== 'string' || !E.ready(state, input.nodeId) || !E.candidates(state, input.nodeId).includes(input.optionId) || busy || $('reset-dialog').open) throw new Error('节点或候选项无效，或当前操作尚未完成');
        openChoose(input.nodeId, true);
        choose(input.optionId);
        if (busy) await new Promise(resolve => setTimeout(resolve, reduceMotion.matches ? 10 : 280));
        return snapshot();
      } }
    ];
    for (const tool of registrations) {
      try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (error) { /* 可选能力不可用时保留正常界面。 */ }
    }
  }
})();
