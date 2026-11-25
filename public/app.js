'use strict';

/**
 * SOSUKE CHECKER — front end
 * Built by sosuke.
 */

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const STORE = {
    history: 'sosuke.history.v1',
    scans: 'sosuke.scans.v1',
    targets: 'sosuke.targets.v1',
  };

  const GROUP_LABELS = {
    gaming: 'Gaming & streaming',
    social: 'Social',
    creator: 'Creator',
    dev: 'Developer',
  };

  const GROUP_ORDER = ['gaming', 'social', 'creator', 'dev'];

  const STATUS_LABEL = {
    available: 'AVAILABLE',
    taken: 'TAKEN',
    unknown: 'UNKNOWN',
    invalid: 'INVALID',
    rate_limited: 'LIMITED',
    error: 'ERROR',
  };

  const STATUS_CLASS = {
    available: 'available',
    taken: 'taken',
    unknown: 'unknown',
    invalid: 'invalid',
    rate_limited: 'limited',
    error: 'error',
  };

  const SAMPLE_NAMES = [
    'sosuke', 'nova', 'mirai', 'kyro', 'ronin', 'akira', 'kaito', 'lumen',
    'sable', 'vanta', 'shiro', 'tsuki', 'cipher', 'pixel', 'ghost', 'echo',
    'yoru', 'haze', 'kaze', 'renji', 'tokyo', 'zenith', 'orbit', 'north',
  ];

  const state = {
    platforms: [],
    selected: new Set(),
    results: new Map(),
    username: '',
    scanning: false,
    stopped: false,
    scanToken: 0,
    controller: null,
    total: 0,
    startedAt: 0,
    lastScanDuration: 0,
    filter: 'all',
    history: [],
    scans: 0,
    variants: [],
    variantNonce: 0,
    ready: false,
  };

  const els = {
    input: $('#username'),
    scanForm: $('#scanForm'),
    scanBtn: $('#scanBtn'),
    scanBtnLabel: $('#scanBtnLabel'),
    scanReadout: $('#scanReadout'),
    scanStatus: $('#scanStatus'),
    scanCounter: $('#scanCounter'),
    liveCount: $('#liveCount'),
    platformCount: $('#platformCount'),
    chipGroups: $('#chipGroups'),
    selectionCount: $('#selectionCount'),
    selectAll: $('#selectAll'),
    selectNone: $('#selectNone'),
    tickerTrack: $('#tickerTrack'),
    resultsList: $('#resultsList'),
    emptyState: $('#emptyState'),
    verdict: $('#verdict'),
    scoreRing: $('#scoreRing'),
    scorePct: $('#scorePct'),
    verdictLabel: $('#verdictLabel'),
    verdictMeta: $('#verdictMeta'),
    verdictTitle: $('#verdictTitle'),
    verdictNote: $('#verdictNote'),
    bestGrabs: $('#bestGrabs'),
    progressFill: $('#progressFill'),
    resultTools: $('#resultTools'),
    resultCount: $('#resultCount'),
    filterEmpty: $('#filterEmpty'),
    reportActions: $('#reportActions'),
    copyAvailable: $('#copyAvailable'),
    exportJson: $('#exportJson'),
    exportCsv: $('#exportCsv'),
    shareBtn: $('#shareBtn'),
    rescanBtn: $('#rescanBtn'),
    variantList: $('#variantList'),
    copyVariants: $('#copyVariants'),
    shuffleVariants: $('#shuffleVariants'),
    historyList: $('#historyList'),
    clearHistory: $('#clearHistory'),
    howDialog: $('#howDialog'),
    closeHow: $('#closeHow'),
    toasts: $('#toasts'),
    rowTemplate: $('#rowTemplate'),
  };

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  init();

  async function init() {
    state.history = readStore(STORE.history, []);
    if (!Array.isArray(state.history)) state.history = [];
    state.history = state.history
      .filter((item) => item && typeof item.username === 'string' && Number.isFinite(item.at))
      .slice(0, 8);
    state.scans = Number(readStore(STORE.scans, 0)) || 0;

    renderScanCounter();
    renderHistory();
    bindEvents();

    try {
      const response = await fetch('/api/platforms', {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.platforms) || data.platforms.length === 0) {
        throw new Error('No platforms returned');
      }
      state.platforms = data.platforms;
      const savedTargets = readStore(STORE.targets, null);
      const saved = Array.isArray(savedTargets)
        ? savedTargets.filter((id) => state.platforms.some((p) => p.id === id))
        : [];
      state.selected = new Set(saved.length ? saved : state.platforms.map((p) => p.id));
      state.ready = true;

      els.liveCount.textContent = String(state.platforms.length);
      els.platformCount.textContent = `${state.platforms.length} platforms`;
      els.scanBtn.disabled = false;

      renderChips();
      renderTicker();
      updateSelectionUI();
      updateVariants(els.input.value);

      const shared = cleanUsername(new URLSearchParams(location.search).get('u') || '');
      if (shared) {
        els.input.value = shared;
        updateVariants(shared);
        window.setTimeout(() => runScan(), 350);
      }
    } catch (error) {
      console.error(error);
      renderOffline();
    }
  }

  /* ------------------------------------------------------------------ */
  /* events                                                              */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    els.scanForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (state.scanning) stopScan();
      else runScan();
    });

    let inputTimer;
    els.input.addEventListener('input', () => {
      const cleaned = cleanUsername(els.input.value);
      if (cleaned !== els.input.value) els.input.value = cleaned;
      window.clearTimeout(inputTimer);
      inputTimer = window.setTimeout(() => updateVariants(els.input.value), 180);
    });

    $('#randomBtn').addEventListener('click', () => {
      if (state.scanning) {
        toast('Let the current sweep finish, or stop it first.', 'warn');
        return;
      }
      const current = cleanUsername(els.input.value);
      const pool = SAMPLE_NAMES.filter((name) => name !== current);
      const next = pool[Math.floor(Math.random() * pool.length)] || 'sosuke';
      els.input.value = next;
      updateVariants(next);
      runScan();
    });

    els.selectAll.addEventListener('click', () => {
      if (state.scanning) return toast('Targets are locked while a sweep runs.', 'warn');
      state.selected = new Set(state.platforms.map((p) => p.id));
      persistTargets();
      updateSelectionUI();
    });

    els.selectNone.addEventListener('click', () => {
      if (state.scanning) return toast('Targets are locked while a sweep runs.', 'warn');
      state.selected.clear();
      persistTargets();
      updateSelectionUI();
    });

    els.chipGroups.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      toggleTarget(chip.dataset.id);
    });

    $$('.filter').forEach((button) => {
      button.addEventListener('click', () => setFilter(button.dataset.filter || 'all'));
    });

    $$('.try-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.scanning) {
          toast('A sweep is already running.', 'warn');
          return;
        }
        const name = button.dataset.try || 'sosuke';
        els.input.value = name;
        updateVariants(name);
        runScan();
      });
    });

    els.variantList.addEventListener('click', (event) => {
      const scanButton = event.target.closest('.variant-scan');
      if (scanButton) {
        if (state.scanning) {
          toast('Stop the current sweep first.', 'warn');
          return;
        }
        const name = scanButton.dataset.name || '';
        if (!name) return;
        els.input.value = name;
        updateVariants(name);
        runScan();
        return;
      }

      const nameButton = event.target.closest('.variant-name');
      if (nameButton) {
        copyText(nameButton.dataset.name || '', 'Variant copied.');
      }
    });

    els.copyVariants.addEventListener('click', () => {
      if (!state.variants.length) {
        toast('Type a handle to generate variants first.', 'warn');
        return;
      }
      copyText(state.variants.map((item) => item.text).join('\n'), 'Variant list copied.');
    });

    els.shuffleVariants.addEventListener('click', () => {
      state.variantNonce += 1;
      updateVariants(els.input.value);
    });

    els.historyList.addEventListener('click', (event) => {
      const retry = event.target.closest('.history-retry');
      const load = event.target.closest('.history-load');
      const source = retry || load;
      if (!source) return;
      const username = source.dataset.username || '';
      if (!username) return;

      if (state.scanning) {
        toast('Stop the current sweep first.', 'warn');
        return;
      }

      els.input.value = username;
      updateVariants(username);

      if (retry) runScan();
      else {
        els.input.focus();
        toast(`Loaded @${username}. Hit scan.`, 'info');
      }
    });

    els.clearHistory.addEventListener('click', () => {
      if (!state.history.length) return;
      state.history = [];
      writeStore(STORE.history, state.history);
      renderHistory();
      toast('History cleared.');
    });

    [els.copyAvailable, els.exportJson, els.exportCsv].forEach((button) => {
      button.addEventListener('click', () => {
        if (!state.results.size) return;
        if (button === els.copyAvailable) copyAvailable();
        if (button === els.exportJson) exportJsonReport();
        if (button === els.exportCsv) exportCsvReport();
      });
    });

    els.shareBtn.addEventListener('click', shareReport);
    els.rescanBtn.addEventListener('click', () => {
      if (state.scanning) return;
      runScan({ fresh: true });
    });

    [els.closeHow, $('#howBtn'), $('#howBtn2'), $('#howBtn3')].forEach((button) => {
      if (!button) return;
      button.addEventListener('click', () => {
        if (els.howDialog.open) closeManual();
        else openManual();
      });
    });

    els.howDialog.addEventListener('click', (event) => {
      if (event.target === els.howDialog) closeManual();
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.key === '/' && !typing && !els.howDialog.open) {
        event.preventDefault();
        els.input.focus();
        els.input.select();
        return;
      }

      if (event.key === 'Escape') {
        if (els.howDialog.open) return;
        if (state.scanning) {
          event.preventDefault();
          stopScan();
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* platform selection                                                  */
  /* ------------------------------------------------------------------ */

  function renderChips() {
    const groups = GROUP_ORDER.filter((group) =>
      state.platforms.some((platform) => platform.group === group)
    );
    for (const platform of state.platforms) {
      if (!groups.includes(platform.group)) groups.push(platform.group);
    }

    const fragment = document.createDocumentFragment();

    for (const group of groups) {
      const platforms = state.platforms.filter((platform) => platform.group === group);
      if (!platforms.length) continue;

      const block = document.createElement('div');
      block.className = 'chip-group';

      const head = document.createElement('div');
      head.className = 'chip-group-head';
      head.textContent = GROUP_LABELS[group] || group;
      block.append(head);

      const grid = document.createElement('div');
      grid.className = 'chip-grid';

      for (const platform of platforms) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.id = platform.id;
        chip.setAttribute('aria-pressed', String(state.selected.has(platform.id)));
        chip.title = `${platform.name} — ${platform.source}`;

        const logo = document.createElement('span');
        logo.className = 'chip-logo';

        const fallback = document.createElement('span');
        fallback.className = 'logo-fallback';
        fallback.textContent = platform.name.charAt(0).toUpperCase();

        const img = document.createElement('img');
        img.alt = '';
        img.width = 17;
        img.height = 17;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener(
          'error',
          () => {
            img.style.display = 'none';
            fallback.style.display = 'grid';
          },
          { once: true }
        );
        img.src = platformIcon(platform);

        logo.append(fallback, img);

        const name = document.createElement('span');
        name.className = 'chip-name';
        name.textContent = platform.name;

        const tick = document.createElement('span');
        tick.className = 'chip-tick';
        tick.setAttribute('aria-hidden', 'true');

        chip.append(logo, name, tick);
        grid.append(chip);
      }

      block.append(grid);
      fragment.append(block);
    }

    els.chipGroups.replaceChildren(fragment);
  }

  function toggleTarget(id) {
    if (!state.ready) return;
    if (state.scanning) {
      toast('Targets are locked while a sweep runs.', 'warn');
      return;
    }
    if (!id) return;
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    persistTargets();
    updateSelectionUI();
  }

  function updateSelectionUI() {
    for (const chip of $$('.chip', els.chipGroups)) {
      const active = state.selected.has(chip.dataset.id);
      chip.setAttribute('aria-pressed', String(active));
    }
    els.selectionCount.textContent = `${state.selected.size} / ${state.platforms.length}`;
    if (!state.scanning) {
      els.scanBtn.disabled = !state.ready || state.selected.size === 0;
    }
  }

  function persistTargets() {
    writeStore(STORE.targets, Array.from(state.selected));
  }

  /* ------------------------------------------------------------------ */
  /* ticker                                                              */
  /* ------------------------------------------------------------------ */

  function renderTicker() {
    const makeGroup = () => {
      const group = document.createElement('div');
      group.className = 'ticker-group';
      for (let pass = 0; pass < 2; pass += 1) {
        for (const platform of state.platforms) {
          const item = document.createElement('span');
          item.className = 'ticker-item';
          item.textContent = platform.name;
          group.append(item);
        }
      }
      return group;
    };
    els.tickerTrack.replaceChildren(makeGroup(), makeGroup());
  }

  /* ------------------------------------------------------------------ */
  /* scan flow                                                           */
  /* ------------------------------------------------------------------ */

  async function runScan(options = {}) {
    if (!state.ready) {
      toast('The checker backend is not ready yet.', 'warn');
      return;
    }
    if (state.scanning) return;

    const username = cleanUsername(els.input.value);
    if (!username) {
      toast('Type a username first.', 'warn');
      els.input.focus();
      return;
    }
    if (!state.selected.size) {
      toast('Pick at least one platform.', 'warn');
      return;
    }

    els.input.value = username;
    state.username = username;
    state.results = new Map();
    state.scanning = true;
    state.stopped = false;
    state.scanToken += 1;
    state.controller = new AbortController();
    state.total = state.selected.size;
    state.startedAt = performance.now();
    state.lastScanDuration = 0;
    state.filter = 'all';
    state.scans += 1;

    writeStore(STORE.scans, state.scans);
    renderScanCounter();

    const token = state.scanToken;

    els.verdict.hidden = false;
    els.resultTools.hidden = false;
    els.reportActions.hidden = true;
    els.emptyState.hidden = true;
    els.filterEmpty.hidden = true;
    els.resultsList.replaceChildren();
    els.bestGrabs.replaceChildren();
    els.scanBtn.classList.add('is-scanning');
    els.scanBtnLabel.textContent = 'STOP';
    els.scanBtn.disabled = false;
    els.scanForm.classList.add('is-scanning');
    els.scanReadout.classList.remove('is-done');
    els.scanReadout.classList.add('is-live');
    els.scanStatus.textContent = 'sweeping';
    els.scanCounter.textContent = `${state.scans} sweep${state.scans === 1 ? '' : 's'} run`;

    setFilter('all');
    renderRows();
    updateVerdict();
    updateVariants(username);
    updateDocTitle();

    const checks = Array.from(state.selected).map((id) =>
      checkPlatform(id, { fresh: Boolean(options.fresh), token })
    );

    await Promise.allSettled(checks);
    if (token !== state.scanToken) return;
    finishScan();
  }

  function renderRows() {
    const order = state.platforms.filter((platform) => state.selected.has(platform.id));
    const fragment = document.createDocumentFragment();

    order.forEach((platform, index) => {
      const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.id = platform.id;
      row.dataset.status = 'scanning';
      row.style.animationDelay = `${Math.min(index * 18, 180)}ms`;
      row.title = `${platform.name} — ${platform.source}`;

      $('.row-index', row).textContent = String(index + 1).padStart(2, '0');
      $('.platform-name', row).textContent = platform.name;
      $('.platform-group', row).textContent = GROUP_LABELS[platform.group] || platform.group;
      $('.row-platform-mobile', row).textContent = platform.name;
      $('.tile-letter', row).textContent = platform.name.charAt(0).toUpperCase();
      $('.row-handle', row).textContent = `@${state.username}`;
      $('.row-message', row).textContent = `Querying ${platform.name}…`;

      const tile = $('.platform-tile', row);
      loadTileImage(tile, platformIcon(platform), false, null);

      $('.js-copy', row).addEventListener('click', () => {
        copyText(`@${state.username}`, 'Username copied.');
      });

      $('.js-refresh', row).addEventListener('click', () => recheckPlatform(platform.id));

      fragment.append(row);
    });

    els.resultsList.append(fragment);
    els.resultCount.textContent = `0 / ${state.total} answered`;
  }

  async function checkPlatform(id, { fresh, token }) {
    const platform = platformById(id);
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          platform: id,
          username: state.username,
          fresh: Boolean(fresh),
        }),
        signal: state.controller ? state.controller.signal : undefined,
      });

      const payload = await response.json().catch(() => ({}));
      if (token !== state.scanToken || !state.scanning) return;

      const result = response.ok
        ? payload
        : {
            platform: id,
            name: platform ? platform.name : id,
            username: state.username,
            status: response.status === 429 ? 'rate_limited' : 'error',
            message:
              payload.error ||
              (response.status === 429
                ? 'Slow down — the local checker is rate limiting requests.'
                : `Checker returned HTTP ${response.status}.`),
            ms: 0,
            checkedAt: new Date().toISOString(),
          };

      applyResult(id, result);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (token !== state.scanToken || !state.scanning) return;

      applyResult(id, {
        platform: id,
        name: platform ? platform.name : id,
        username: state.username,
        status: 'error',
        message: 'Could not reach the checker server. Is it still running?',
        ms: 0,
        checkedAt: new Date().toISOString(),
      });
    }
  }

  function applyResult(id, result) {
    state.results.set(id, result);
    updateRow(id, result);
    if (state.scanning) {
      els.scanStatus.textContent = `sweeping · ${state.results.size}/${state.total}`;
    }
    updateVerdict();
  }

  function updateRow(id, result) {
    const row = rowById(id);
    if (!row) return;
    const platform = platformById(id);

    row.classList.remove('is-scanning');
    row.dataset.status = result.status || 'unknown';

    const status = result.status || 'unknown';
    const pill = $('.pill', row);
    pill.className = `pill st-${STATUS_CLASS[status] || 'unknown'}`;
    $('.pill-text', row).textContent = STATUS_LABEL[status] || status.toUpperCase();

    $('.row-message', row).textContent = result.message || defaultMessage(status);
    $('.row-latency', row).textContent = formatLatency(result);

    if (platform) {
      const tile = $('.platform-tile', row);
      if (result.avatar) {
        loadTileImage(tile, result.avatar, true, platformIcon(platform));
      } else {
        loadTileImage(tile, platformIcon(platform), false, null);
      }
    }

    const link = $('.row-link', row);
    link.hidden = true;
    if (result.status === 'taken' && result.url) {
      link.href = result.url;
      link.textContent = 'view';
      link.hidden = false;
    } else if (result.status === 'available') {
      const claim = (platform && platform.claim) || result.url;
      if (claim) {
        link.href = claim;
        link.textContent = 'claim';
        link.hidden = false;
      }
    }

    const source = result.source || (platform && platform.source);
    if (source) {
      row.title = `${platform ? platform.name : id} — ${source}`;
    }

    applyFilterToRow(row);
  }

  function finishScan() {
    if (!state.scanning) return;
    state.scanning = false;
    state.controller = null;
    const duration = Math.max(0.1, (performance.now() - state.startedAt) / 1000);
    state.lastScanDuration = Math.round(duration * 10) / 10;

    els.scanBtn.classList.remove('is-scanning');
    els.scanBtnLabel.textContent = 'SCAN';
    els.scanForm.classList.remove('is-scanning');
    els.scanReadout.classList.remove('is-live');
    els.scanReadout.classList.add('is-done');
    els.scanStatus.textContent = `complete · ${state.lastScanDuration}s`;
    els.scanBtn.disabled = state.selected.size === 0;

    updateVerdict();
    updateReportActionsState();
    updateDocTitle();
    recordHistory();

    const summary = summarize();
    if (summary.available > 0) {
      toast(
        `${summary.available} open · ${summary.taken} taken · ${state.lastScanDuration}s`,
        'success'
      );
    } else {
      toast(`Sweep complete in ${state.lastScanDuration}s. Nothing open this time.`, 'info');
    }

    if (summary.denom >= 5 && summary.available === summary.denom) {
      celebrate();
      toast('Clean sweep. Every checked platform is open.', 'success');
    }
  }

  function stopScan() {
    if (!state.scanning) return;
    state.scanToken += 1;
    state.scanning = false;
    state.stopped = true;
    if (state.controller) state.controller.abort();
    state.controller = null;

    for (const row of $$('.result-row.is-scanning', els.resultsList)) {
      const id = row.dataset.id;
      const result = {
        platform: id,
        name: (platformById(id) || {}).name || id,
        username: state.username,
        status: 'unknown',
        message: 'Sweep stopped before this platform answered.',
        ms: 0,
        checkedAt: new Date().toISOString(),
      };
      state.results.set(id, result);
      updateRow(id, result);
    }

    els.scanBtn.classList.remove('is-scanning');
    els.scanBtnLabel.textContent = 'SCAN';
    els.scanForm.classList.remove('is-scanning');
    els.scanReadout.classList.remove('is-live');
    els.scanReadout.classList.add('is-done');
    els.scanStatus.textContent = `stopped · ${state.results.size}/${state.total}`;
    els.scanBtn.disabled = state.selected.size === 0;

    updateVerdict();
    updateReportActionsState();
    updateDocTitle();
    recordHistory();
    toast('Sweep stopped.', 'info');
  }

  async function recheckPlatform(id) {
    if (!state.ready || !state.username) return;
    if (state.scanning) {
      toast('Wait for the sweep to finish first.', 'warn');
      return;
    }

    const row = rowById(id);
    const platform = platformById(id);
    if (!row || !platform) return;

    const token = state.scanToken;
    row.classList.add('is-scanning');
    row.dataset.status = 'scanning';
    const pill = $('.pill', row);
    pill.className = 'pill';
    $('.pill-text', row).textContent = 'CHECKING';
    $('.row-message', row).textContent = `Re-querying ${platform.name}…`;
    $('.row-latency', row).textContent = '—';
    $('.row-link', row).hidden = true;

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ platform: id, username: state.username, fresh: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (token !== state.scanToken) return;

      const result = response.ok
        ? payload
        : {
            platform: id,
            name: platform.name,
            username: state.username,
            status: response.status === 429 ? 'rate_limited' : 'error',
            message: payload.error || `Checker returned HTTP ${response.status}.`,
            ms: 0,
            checkedAt: new Date().toISOString(),
          };

      applyResult(id, result);
      updateReportActionsState();
      updateDocTitle();

      const label = STATUS_LABEL[result.status] || result.status;
      if (result.status === 'available') toast(`${platform.name}: available. Go get it.`, 'success');
      else if (result.status === 'taken') toast(`${platform.name}: still taken.`, 'info');
      else toast(`${platform.name}: ${label.toLowerCase()}.`, result.status === 'error' ? 'error' : 'warn');
    } catch (error) {
      if (token !== state.scanToken) return;
      const result = {
        platform: id,
        name: platform.name,
        username: state.username,
        status: 'error',
        message: 'Re-check failed. Is the server still running?',
        ms: 0,
        checkedAt: new Date().toISOString(),
      };
      applyResult(id, result);
      updateReportActionsState();
      toast(`${platform.name}: re-check failed.`, 'error');
    }
  }

  /* ------------------------------------------------------------------ */
  /* verdict / summary                                                   */
  /* ------------------------------------------------------------------ */

  function summarize() {
    let available = 0;
    let taken = 0;
    let other = 0;

    for (const result of state.results.values()) {
      if (result.status === 'available') available += 1;
      else if (result.status === 'taken') taken += 1;
      else other += 1;
    }

    return {
      available,
      taken,
      other,
      denom: available + taken,
      checked: state.results.size,
    };
  }

  function updateVerdict() {
    const summary = summarize();
    const results = Array.from(state.results.values());
    const total = state.total || state.selected.size || 0;
    const pct = summary.denom ? Math.round((summary.available / summary.denom) * 100) : 0;

    els.scoreRing.style.setProperty('--pct', String(pct));
    els.scorePct.textContent = summary.denom ? String(pct) : '—';

    const word = verdictWord(summary, pct);
    let label = word.label;
    if (state.scanning) label = 'SWEEPING';
    else if (state.stopped) label = 'SWEEP STOPPED';

    els.verdictLabel.textContent = label;
    els.verdictLabel.classList.toggle('is-clean', !state.scanning && pct === 100 && summary.denom > 0);
    els.verdictMeta.textContent = `${results.length} / ${total} checked`;

    if (state.scanning) {
      els.verdictTitle.textContent =
        summary.available > 0
          ? `${summary.available} open so far.`
          : 'Warming up the radar.';
      els.verdictNote.textContent = 'Hold tight — the platforms are answering.';
    } else if (state.stopped) {
      els.verdictTitle.textContent = `${summary.available} open when you stopped.`;
      els.verdictNote.textContent =
        summary.other > 0
          ? `${summary.other} row${summary.other === 1 ? '' : 's'} never got a clean answer. Hit refresh to retry.`
          : 'Run it back whenever you are ready.';
    } else {
      els.verdictTitle.textContent = word.title;
      els.verdictNote.textContent = word.note;
    }

    const best = results
      .filter((result) => result.status === 'available')
      .map((result) => ({ result, platform: platformById(result.platform) }))
      .filter((entry) => entry.platform)
      .sort((a, b) => (b.platform.weight || 0) - (a.platform.weight || 0))
      .slice(0, 3);

    if (best.length && !state.scanning) {
      const leader = best[0].platform.name;
      els.verdictNote.textContent = `Best grab: ${leader}. ${word.tail}`;
    }

    const fragment = document.createDocumentFragment();
    for (const entry of best) {
      const link = document.createElement('a');
      link.className = 'best-grab';
      link.href = entry.platform.claim || entry.result.url || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.title = `Claim on ${entry.platform.name}`;

      if (entry.result.avatar) {
        link.classList.add('is-avatar');
        const avatar = document.createElement('img');
        avatar.alt = '';
        avatar.width = 11;
        avatar.height = 11;
        avatar.loading = 'lazy';
        avatar.referrerPolicy = 'no-referrer';
        avatar.src = entry.result.avatar;
        avatar.addEventListener('error', () => {
          avatar.remove();
          const logo = document.createElement('img');
          logo.alt = '';
          logo.src = platformIcon(entry.platform);
          link.prepend(logo);
        }, { once: true });
        link.append(avatar);
      } else {
        const logo = document.createElement('img');
        logo.alt = '';
        logo.width = 11;
        logo.height = 11;
        logo.loading = 'lazy';
        logo.referrerPolicy = 'no-referrer';
        logo.src = platformIcon(entry.platform);
        link.append(logo);
      }

      const text = document.createElement('span');
      text.textContent = entry.platform.name;
      link.append(text);
      fragment.append(link);
    }
    els.bestGrabs.replaceChildren(fragment);

    els.progressFill.style.width = `${total ? Math.min(100, (results.length / total) * 100) : 0}%`;
    els.resultCount.textContent = state.scanning
      ? `${results.length} / ${total} answered`
      : `${results.length} checked · ${summary.available} open`;
  }

  function verdictWord(summary, pct) {
    if (!summary.denom) {
      return {
        label: 'NO SIGNAL',
        title: 'No clean answers yet.',
        note: 'Nothing conclusive came back. Amber rows can be retried individually.',
        tail: 'Retry the amber rows when you are ready.',
      };
    }
    if (pct === 100) {
      return {
        label: 'WIDE OPEN',
        title: `${summary.available} of ${summary.denom} checked platforms open.`,
        note: 'A clean sweep. Move fast before someone else does.',
        tail: 'Move fast before someone else does.',
      };
    }
    if (pct >= 60) {
      return {
        label: 'MOSTLY OPEN',
        title: `${summary.available} of ${summary.denom} checked platforms open.`,
        note: 'Most of the board is green. Lock in the big ones.',
        tail: 'Lock in the big ones.',
      };
    }
    if (pct >= 30) {
      return {
        label: 'MIXED',
        title: `${summary.available} of ${summary.denom} checked platforms open.`,
        note: 'A mixed bag. Take the wins and try a variant for the rest.',
        tail: 'Take the wins while they last.',
      };
    }
    if (pct > 0) {
      return {
        label: 'CONTESTED',
        title: `${summary.available} of ${summary.denom} checked platforms open.`,
        note: 'Mostly locked. A rare opening is still an opening.',
        tail: 'A rare opening is still an opening.',
      };
    }
    return {
      label: 'LOCKED',
      title: `0 of ${summary.denom} checked platforms open.`,
      note: 'Every platform that answered is taken. The variant lab exists for this.',
      tail: 'Try the variant lab.',
    };
  }

  function updateReportActionsState() {
    const summary = summarize();
    const hasResults = state.results.size > 0;
    els.reportActions.hidden = !hasResults;
    els.copyAvailable.disabled = summary.available === 0;
    els.exportJson.disabled = !hasResults;
    els.exportCsv.disabled = !hasResults;
    els.shareBtn.disabled = !state.username;
    els.rescanBtn.disabled = state.scanning;
  }

  function updateDocTitle() {
    if (state.scanning) {
      document.title = `Sweeping @${state.username} — SOSUKE`;
      return;
    }
    if (state.username && state.results.size) {
      const summary = summarize();
      document.title = `${summary.available}/${summary.denom || state.results.size} open — @${state.username} — SOSUKE`;
      return;
    }
    document.title = 'SOSUKE — Username Checker';
  }

  /* ------------------------------------------------------------------ */
  /* filters                                                             */
  /* ------------------------------------------------------------------ */

  function setFilter(filter) {
    state.filter = ['all', 'available', 'taken', 'other'].includes(filter) ? filter : 'all';
    for (const button of $$('.filter')) {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    for (const row of $$('.result-row', els.resultsList)) {
      applyFilterToRow(row);
    }
    updateFilterEmpty();
  }

  function applyFilterToRow(row) {
    if (!row) return;
    const status = row.dataset.status || 'unknown';
    let visible = true;
    if (state.filter === 'available') visible = status === 'available';
    else if (state.filter === 'taken') visible = status === 'taken';
    else if (state.filter === 'other') visible = status !== 'available' && status !== 'taken';
    row.hidden = !visible;
    updateFilterEmpty();
  }

  function updateFilterEmpty() {
    const rows = $$('.result-row', els.resultsList);
    if (!state.results.size) {
      els.filterEmpty.hidden = true;
      return;
    }
    els.filterEmpty.hidden = rows.some((row) => !row.hidden);
  }

  /* ------------------------------------------------------------------ */
  /* variant lab                                                         */
  /* ------------------------------------------------------------------ */

  function updateVariants(raw) {
    const username = cleanUsername(raw);
    state.variants = buildVariants(username);
    renderVariants(username);
  }

  function buildVariants(username) {
    const base = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!base) return [];

    const out = [];
    const seen = new Set();

    const add = (text, tag) => {
      const value = String(text || '').toLowerCase();
      if (!value || value.length < 2 || value.length > 32) return;
      if (!/^[a-z0-9._-]+$/.test(value)) return;
      if (seen.has(value)) return;
      seen.add(value);
      out.push({ text: value, tag });
    };

    add(`its${base}`, 'prefix');
    add(`the${base}`, 'prefix');
    add(`real${base}`, 'prefix');
    add(`${base}hq`, 'suffix');
    add(`${base}gg`, 'suffix');
    add(`${base}xo`, 'suffix');
    add(`${base}live`, 'suffix');
    add(`${base}official`, 'suffix');
    add(`${base}1`, 'digit');
    add(`${base}x`, 'suffix');
    add(`${base}z`, 'suffix');
    add(`${base}2026`, 'year');
    add(`_${base}`, 'prefix');
    add(`${base}_`, 'suffix');
    add(
      base
        .replace(/o/g, '0')
        .replace(/e/g, '3')
        .replace(/i/g, '1')
        .replace(/a/g, '4'),
      'leet'
    );
    add(`${base}irl`, 'suffix');
    add(`not${base}`, 'prefix');

    if (out.length > 1) {
      const offset = (state.variantNonce * 5 + base.length) % out.length;
      out.push(...out.splice(0, offset));
    }

    return [{ text: base, tag: 'exact' }, ...out.slice(0, 11)];
  }

  function renderVariants(username) {
    if (!state.variants.length) {
      const empty = document.createElement('p');
      empty.className = 'side-empty';
      empty.textContent = username
        ? 'This handle is too long or too short to spin variants cleanly.'
        : 'Type a handle to generate variants.';
      els.variantList.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const variant of state.variants) {
      const row = document.createElement('div');
      row.className = 'variant-row';

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'variant-name';
      name.dataset.name = variant.text;
      name.textContent = variant.text;
      name.title = 'Copy variant';

      const tag = document.createElement('span');
      tag.className = 'variant-tag';
      tag.textContent = variant.tag;

      const scan = document.createElement('button');
      scan.type = 'button';
      scan.className = 'variant-scan';
      scan.dataset.name = variant.text;
      scan.textContent = '↗';
      scan.title = `Sweep @${variant.text}`;
      scan.setAttribute('aria-label', `Sweep ${variant.text}`);

      row.append(name, tag, scan);
      fragment.append(row);
    }
    els.variantList.replaceChildren(fragment);
  }

  /* ------------------------------------------------------------------ */
  /* history                                                             */
  /* ------------------------------------------------------------------ */

  function recordHistory() {
    if (!state.username || !state.results.size) return;
    const summary = summarize();
    const entry = {
      username: state.username,
      at: Date.now(),
      available: summary.available,
      taken: summary.taken,
      checked: summary.checked,
      denom: summary.denom,
      total: state.total,
      seconds: state.lastScanDuration,
    };

    // One row per handle: a repeat sweep replaces its previous history entry.
    state.history = [
      entry,
      ...state.history.filter((item) => item.username !== entry.username),
    ].slice(0, 8);

    writeStore(STORE.history, state.history);
    renderHistory();
  }

  function renderHistory() {
    if (!state.history.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'No sweeps yet. Your last eight land here.';
      els.historyList.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const entry of state.history) {
      const row = document.createElement('div');
      row.className = 'history-row';

      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'history-load';
      load.dataset.username = entry.username;

      const name = document.createElement('span');
      name.className = 'history-name';
      name.textContent = `@${entry.username}`;

      const meta = document.createElement('span');
      meta.className = 'history-meta';
      const strong = document.createElement('b');
      strong.textContent = String(entry.available || 0);
      meta.append(strong, ` open · ${timeAgo(entry.at)}`);

      load.append(name, meta);

      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'history-retry';
      retry.dataset.username = entry.username;
      retry.textContent = '↻';
      retry.title = `Sweep @${entry.username} again`;
      retry.setAttribute('aria-label', `Sweep ${entry.username} again`);

      row.append(load, retry);
      fragment.append(row);
    }
    els.historyList.replaceChildren(fragment);
  }

  function renderScanCounter() {
    els.scanCounter.textContent = `${state.scans} sweep${state.scans === 1 ? '' : 's'} run`;
  }

  /* ------------------------------------------------------------------ */
  /* exports / sharing                                                   */
  /* ------------------------------------------------------------------ */

  function orderedResults() {
    return state.platforms
      .filter((platform) => state.results.has(platform.id))
      .map((platform) => ({ platform, result: state.results.get(platform.id) }));
  }

  function copyAvailable() {
    const summary = summarize();
    if (!summary.available) {
      toast('No available platforms in this sweep.', 'warn');
      return;
    }
    const lines = [
      `@${state.username} is open on ${summary.available} platform${summary.available === 1 ? '' : 's'}:`,
    ];
    for (const { platform, result } of orderedResults()) {
      if (result.status !== 'available') continue;
      lines.push(`• ${platform.name} — ${platform.claim || result.url || ''}`);
    }
    lines.push('', 'checked live with SOSUKE · by sosuke');
    copyText(lines.join('\n'), 'Available handles copied.');
  }

  function reportObject() {
    const summary = summarize();
    return {
      tool: 'SOSUKE Checker',
      by: 'sosuke',
      version: '1.1.0',
      username: state.username,
      scannedAt: new Date().toISOString(),
      durationMs: Math.round(state.lastScanDuration * 1000),
      summary: {
        available: summary.available,
        taken: summary.taken,
        other: summary.other,
        checked: summary.checked,
        platforms: state.total,
      },
      platforms: orderedResults().map(({ platform, result }) => ({
        ...result,
        platformName: platform.name,
        claimUrl: platform.claim || null,
        profileUrl: result.status === 'taken' ? result.url : null,
      })),
    };
  }

  function exportJsonReport() {
    const report = reportObject();
    downloadFile(
      `sosuke-${safeFile(state.username)}-${fileStamp()}.json`,
      JSON.stringify(report, null, 2),
      'application/json'
    );
    toast('JSON report downloaded.', 'success');
  }

  function exportCsvReport() {
    const header = ['platform', 'status', 'message', 'url', 'source', 'latency_ms', 'checked_at'];
    const rows = orderedResults().map(({ result }) => [
      result.platform,
      result.status,
      result.message || '',
      result.url || '',
      result.source || '',
      result.ms ?? '',
      result.checkedAt || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadFile(
      `sosuke-${safeFile(state.username)}-${fileStamp()}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    toast('CSV report downloaded.', 'success');
  }

  async function shareReport() {
    if (!state.username) return;
    const summary = summarize();
    let url;
    try {
      url = new URL(location.href);
      url.searchParams.set('u', state.username);
      url.hash = '';
    } catch {
      url = null;
    }
    const text = `@${state.username}: ${summary.available} of ${summary.denom} checked platforms open — checked with SOSUKE.`;
    const payload = {
      title: 'SOSUKE Checker',
      text,
      url: url ? url.toString() : undefined,
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    copyText(`${text}\n${url ? url.toString() : ''}`.trim(), 'Share link copied.');
  }

  /* ------------------------------------------------------------------ */
  /* manual                                                              */
  /* ------------------------------------------------------------------ */

  function openManual() {
    if (typeof els.howDialog.showModal === 'function') els.howDialog.showModal();
    else els.howDialog.setAttribute('open', '');
  }

  function closeManual() {
    if (typeof els.howDialog.close === 'function') els.howDialog.close();
    else els.howDialog.removeAttribute('open');
  }

  /* ------------------------------------------------------------------ */
  /* utilities                                                           */
  /* ------------------------------------------------------------------ */

  function platformById(id) {
    return state.platforms.find((platform) => platform.id === id) || null;
  }

  function platformIcon(platform) {
    // Brand marks are bundled in /icons so the UI never waits on a CDN.
    return `/icons/${encodeURIComponent(platform.id)}.svg`;
  }

  function rowById(id) {
    return els.resultsList.querySelector(`.result-row[data-id="${id}"]`);
  }

  function loadTileImage(tile, src, isAvatar, fallbackSrc) {
    if (!tile || !src) return;
    const img = $('img', tile);
    if (!img) return;
    tile.classList.toggle('is-avatar', Boolean(isAvatar));
    tile.classList.remove('has-image');
    img.style.display = '';
    img.referrerPolicy = 'no-referrer';

    let triedFallback = false;
    img.onload = () => tile.classList.add('has-image');
    img.onerror = () => {
      tile.classList.remove('has-image');
      if (!triedFallback && fallbackSrc) {
        triedFallback = true;
        tile.classList.remove('is-avatar');
        img.src = fallbackSrc;
      } else {
        img.style.display = 'none';
      }
    };
    img.src = src;
  }

  function cleanUsername(raw) {
    let value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        const parts = url.pathname.split('/').filter(Boolean);
        value = parts.pop() || '';
      } catch {
        /* keep the raw value */
      }
    }
    value = value.replace(/^@+/, '');
    value = value.replace(/[^A-Za-z0-9._-]/g, '');
    return value.slice(0, 64);
  }

  function defaultMessage(status) {
    if (status === 'available') return 'Looks unclaimed right now.';
    if (status === 'taken') return 'Already in use.';
    if (status === 'rate_limited') return 'Rate limited — retry in a minute.';
    if (status === 'invalid') return "Doesn't fit this platform's rules.";
    return 'No clean answer from this platform.';
  }

  function formatLatency(result) {
    if (result.cached) return 'cached';
    if (typeof result.ms !== 'number' || result.ms <= 0) return '—';
    if (result.ms < 1000) return `${result.ms} ms`;
    return `${(result.ms / 1000).toFixed(1)} s`;
  }

  function timeAgo(timestamp) {
    const delta = Math.max(0, Date.now() - timestamp);
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return `${Math.floor(delta / 86_400_000)}d ago`;
  }

  function fileStamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
      date.getHours()
    )}${pad(date.getMinutes())}`;
  }

  function safeFile(value) {
    return String(value || 'scan').replace(/[^A-Za-z0-9._-]/g, '') || 'scan';
  }

  function csvCell(value) {
    const text = String(value == null ? '' : value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function copyText(text, message = 'Copied.') {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      toast(message, 'success');
    } catch {
      toast('Could not copy. Select the text manually.', 'error');
    }
  }

  function toast(message, type = 'info') {
    const node = document.createElement('div');
    node.className = `toast is-${type}`;
    node.textContent = message;
    els.toasts.append(node);
    window.setTimeout(() => {
      node.classList.add('is-out');
      window.setTimeout(() => node.remove(), 260);
    }, type === 'error' ? 5000 : 3400);
  }

  function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff4d2e', '#f4f1ea', '#8df29b', '#ffc46b'];
    for (let index = 0; index < 46; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.setProperty('--confetti-color', colors[index % colors.length]);
      piece.style.setProperty('--confetti-x', `${(Math.random() * 2 - 1) * 220}px`);
      piece.style.setProperty('--confetti-rotate', `${Math.random() * 900}deg`);
      piece.style.setProperty('--confetti-duration', `${1.2 + Math.random() * 1.1}s`);
      piece.style.setProperty('--confetti-delay', `${Math.random() * 0.25}s`);
      document.body.append(piece);
      window.setTimeout(() => piece.remove(), 3000);
    }
  }

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage can be full or blocked — the app still works */
    }
  }

  function renderOffline() {
    state.ready = false;
    els.chipGroups.replaceChildren();
    const box = document.createElement('div');
    box.className = 'offline-note';
    const title = document.createElement('h3');
    title.textContent = 'BACKEND OFFLINE';
    const copy = document.createElement('p');
    copy.append('The interface loaded, but the checker server did not answer. Run ');
    const code = document.createElement('code');
    code.textContent = 'npm start';
    copy.append(code, ' in the sosuke-checker folder, then reload.');
    box.append(title, copy);
    els.chipGroups.append(box);
    els.scanBtn.disabled = true;
    els.liveCount.textContent = '0';
    els.platformCount.textContent = 'offline';
    toast('Backend offline. Run npm start, then reload.', 'error');
  }
})();
