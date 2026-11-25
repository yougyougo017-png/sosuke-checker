'use strict';

/**
 * SOSUKE Checker — desktop renderer.
 * Built by sosuke.
 */

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const byId = (id) => document.getElementById(id);

  const STORE_KEYS = {
    inputs: 'sosuke.desktop.inputs.v1',
    history: 'sosuke.desktop.history.v1',
    tab: 'sosuke.desktop.tab.v1',
    forge: 'sosuke.desktop.forge.v1',
  };

  const GROUP_ORDER = ['gaming', 'social', 'creator', 'dev'];
  const GROUP_LABEL = {
    gaming: 'Gaming & streaming',
    social: 'Social',
    creator: 'Creator',
    dev: 'Developer',
  };
  const GROUP_SHORT = {
    gaming: 'GAMING',
    social: 'SOCIAL',
    creator: 'CREATOR',
    dev: 'DEV',
  };

  const STATUS_LABEL = {
    available: 'AVAILABLE',
    taken: 'TAKEN',
    unknown: 'UNKNOWN',
    invalid: 'INVALID',
    rate_limited: 'LIMITED',
    error: 'ERROR',
    checking: 'CHECKING',
    idle: 'STANDBY',
  };

  const TAB_STATE = {
    available: 'open',
    taken: 'taken',
    unknown: 'unknown',
    invalid: 'invalid',
    rate_limited: 'limited',
    error: 'error',
    checking: 'checking',
    idle: 'ready',
  };

  const FILTERS = ['all', 'available', 'taken', 'other'];

  const FORGE_ICON_ATTRS =
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  const FORGE_MODES = [
    {
      id: 'smart4',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M12 3.4 13.9 8.1 18.6 10 13.9 11.9 12 16.6 10.1 11.9 5.4 10 10.1 8.1Z"/><path d="M18.3 15.6 18.9 17.2 20.5 17.8 18.9 18.4 18.3 20 17.7 18.4 16.1 17.8 17.7 17.2Z"/></svg>`,
      label: 'Smart 4C',
      desc: 'Rare 4-char, pronounceable lean',
    },
    {
      id: 'letters4',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M6.4 19 12 5l5.6 14"/><path d="M8.8 13.4h6.4"/></svg>`,
      label: 'Pure 4-letter',
      desc: 'a–z only, exactly 4',
    },
    {
      id: 'alnum4',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M9.6 4.5 7.5 19.5M16.5 4.5l-2.1 15M4.8 9.2h14.4M4.2 14.8h14.4"/></svg>`,
      label: '4-char alnum',
      desc: 'a–z + 0–9, highest hit rate',
    },
    {
      id: 'pronounceable4',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M4.2 5.2h15.6v10.4H9.4L4.2 19Z"/><path d="M8.6 8.8v3.2M12 7.8v5.2M15.4 8.8v3.2"/></svg>`,
      label: 'Pronounceable',
      desc: 'Clean CVCV: zuro, kiva',
    },
    {
      id: 'letters3',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M12 3.4 19.2 12 12 20.6 4.8 12Z"/><path d="M8.4 12h7.2"/></svg>`,
      label: 'Ultra-rare 3',
      desc: 'Pure 3-letter a–z',
    },
    {
      id: 'gaming',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M8 8.2h8a4.8 4.8 0 0 1 4.4 6.7l-1 2.5a2.3 2.3 0 0 1-3.9.6L13.8 16h-3.6l-1.7 2a2.3 2.3 0 0 1-3.9-.6l-1-2.5A4.8 4.8 0 0 1 8 8.2Z"/><path d="M8.3 11v2.6M7 12.3h2.6M15.6 11.2h.01M17.4 13h.01"/></svg>`,
      label: 'Gaming tags',
      desc: 'Esports culture handles',
    },
    {
      id: 'leet',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="m9 7.5-4.5 4.5L9 16.5M15 7.5l4.5 4.5L15 16.5"/></svg>`,
      label: 'Leet variants',
      desc: 'h4ck, n0va, z3r0',
    },
    {
      id: 'custom',
      icon: `<svg ${FORGE_ICON_ATTRS}><path d="M4.8 7h14.4M4.8 12h9.4M4.8 17h10.8"/><path d="M18.4 14.6v4.8M16 17h4.8"/></svg>`,
      label: 'Custom list',
      desc: 'Your own base words',
    },
  ];

  const FORGE_COUNTS = [12, 24, 48];
  const FORGE_LIMIT = 300;

  const FORGE_NOTES = {
    smart4:
      'Smart 4C leans on uncommon consonants and clean shapes. Nothing is checked until you scan.',
    letters4:
      'Uniform a–z four-letter names. The space is huge, but the obvious words are long gone.',
    alnum4:
      'Four characters with at least one letter and one digit. The highest hit-rate pool.',
    pronounceable4:
      'Strict consonant–vowel–consonant–vowel. Easy to say, easy to remember.',
    letters3:
      'Every three-letter a–z name. Only 17,576 exist, so expect the platform to say no.',
    gaming:
      'Esports and gaming culture tags with leet swaps, prefixes and suffixes.',
    leet:
      'Classic words rebuilt with numbers: h4ck, n0va, z3r0. The old internet never dies.',
    custom:
      'Type base words separated by commas. Forge exact names, leet variants and suffixes from your list.',
  };

  const state = {
    platforms: [],
    byId: new Map(),
    meta: { platform: '', version: '1.1.0' },
    activeTab: 'all',
    inputs: sanitizeInputs(readStore(STORE_KEYS.inputs, {})),
    history: sanitizeHistory(readStore(STORE_KEYS.history, {})),
    results: new Map(),
    checking: new Set(),
    tabEls: new Map(),
    cardEls: new Map(),
    sweeping: false,
    allToken: 0,
    startedAt: 0,
    lastDuration: null,
    filter: 'all',
    forge: sanitizeForge(readStore(STORE_KEYS.forge, {})),
    forgeCandidates: [],
    forgeSeen: new Set(),
    forgeCardEls: new Map(),
    forgeResults: new Map(),
    forgeStreaming: false,
    forgeStreamTimer: null,
    forgeScanning: false,
    forgeScanToken: 0,
    forgeChecking: '',
    forgeScanProgress: null,
  };

  const els = {
    body: document.body,
    titlebar: byId('titlebar'),
    titleVersion: byId('titleVersion'),
    sideVersion: byId('sideVersion'),
    sidePlatform: byId('sidePlatform'),
    statusPlatform: byId('statusPlatform'),
    liveCount: byId('liveCount'),
    creditVersion: byId('creditVersion'),
    manualVersion: byId('manualVersion'),
    sideNav: byId('sideNav'),
    viewAll: byId('viewAll'),
    viewGenerator: byId('viewGenerator'),
    viewPlatform: byId('viewPlatform'),
    allScroll: byId('allScroll'),
    genScroll: byId('genScroll'),
    platformScroll: byId('platformScroll'),
    winControls: byId('winControls'),
    winMax: byId('winMax'),
    helpBtn: byId('helpBtn'),
    creditsBtn: byId('creditsBtn'),
    manualDialog: byId('manualDialog'),
    closeManual: byId('closeManual'),
    allForm: byId('allForm'),
    allInput: byId('allInput'),
    allBtn: byId('allBtn'),
    allBtnLabel: byId('allBtnLabel'),
    allFilters: byId('allFilters'),
    targetGrid: byId('targetGrid'),
    boardEmpty: byId('boardEmpty'),
    resultCount: byId('resultCount'),
    scoreRing: byId('scoreRing'),
    scoreValue: byId('scoreValue'),
    verdictEyebrow: byId('verdictEyebrow'),
    verdictTitle: byId('verdictTitle'),
    verdictSub: byId('verdictSub'),
    bestGrabs: byId('bestGrabs'),
    tallyOpen: byId('tallyOpen'),
    tallyTaken: byId('tallyTaken'),
    tallyOther: byId('tallyOther'),
    tallyChecked: byId('tallyChecked'),
    statusDot: byId('statusDot'),
    statusText: byId('statusText'),
    statusMeta: byId('statusMeta'),
    pfNum: byId('pfNum'),
    pfGroup: byId('pfGroup'),
    pfName: byId('pfName'),
    pfHint: byId('pfHint'),
    pfTile: byId('pfTile'),
    pfIcon: byId('pfIcon'),
    pfWeight: byId('pfWeight'),
    pfQuickStatus: byId('pfQuickStatus'),
    pfSiteBtn: byId('pfSiteBtn'),
    pfSourceTag: byId('pfSourceTag'),
    pfForm: byId('pfForm'),
    pfLabel: byId('pfLabel'),
    pfInput: byId('pfInput'),
    pfBtn: byId('pfBtn'),
    pfBtnLabel: byId('pfBtnLabel'),
    pfRule: byId('pfRule'),
    pfFresh: byId('pfFresh'),
    pfResult: byId('pfResult'),
    pfStandby: byId('pfStandby'),
    pfStandbyText: byId('pfStandbyText'),
    pfCard: byId('pfCard'),
    pfPill: byId('pfPill'),
    pfPillText: byId('pfPillText'),
    pfLatency: byId('pfLatency'),
    pfAvatar: byId('pfAvatar'),
    pfMessage: byId('pfMessage'),
    pfSub: byId('pfSub'),
    pfCopy: byId('pfCopy'),
    pfProfile: byId('pfProfile'),
    pfSourceLine: byId('pfSourceLine'),
    pfHistory: byId('pfHistory'),
    pfHistoryEmpty: byId('pfHistoryEmpty'),
    pfHistoryCount: byId('pfHistoryCount'),
    pfClearHistory: byId('pfClearHistory'),
    factGroup: byId('factGroup'),
    factRule: byId('factRule'),
    factSource: byId('factSource'),
    factClaim: byId('factClaim'),
    genModes: byId('genModes'),
    genModeLabel: byId('genModeLabel'),
    genSeedWrap: byId('genSeedWrap'),
    genSeed: byId('genSeed'),
    genBatchOptions: byId('genBatchOptions'),
    genBatchMeta: byId('genBatchMeta'),
    genStream: byId('genStream'),
    genGenerate: byId('genGenerate'),
    genNote: byId('genNote'),
    genTarget: byId('genTarget'),
    genScan: byId('genScan'),
    genScanMeta: byId('genScanMeta'),
    genCount: byId('genCount'),
    genHint: byId('genHint'),
    genCopyAll: byId('genCopyAll'),
    genClear: byId('genClear'),
    genGrid: byId('genGrid'),
    genEmpty: byId('genEmpty'),
    genState: byId('genState'),
    toasts: byId('toasts'),
  };

  if (navigator.platform && /mac/i.test(navigator.platform)) {
    document.body.dataset.platform = 'darwin';
  }

  boot();

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  async function boot() {
    bindStaticUi();

    if (!window.sosuke) {
      updateStatus('Desktop bridge unavailable', 'error');
      els.allBtn.disabled = true;
      els.pfBtn.disabled = true;
      toast('Open SOSUKE Checker through the desktop app.', 'error');
      return;
    }

    try {
      const [platforms, meta] = await Promise.all([
        window.sosuke.platforms(),
        window.sosuke.meta(),
      ]);
      state.platforms = Array.isArray(platforms) ? platforms : [];
      state.byId = new Map(state.platforms.map((platform) => [platform.id, platform]));
      state.meta = meta || state.meta;
    } catch (error) {
      console.error(error);
      updateStatus('Could not load the checkers', 'error');
      toast('The checker list failed to load. Restart the app.', 'error');
      return;
    }

    document.body.dataset.platform = state.meta.platform || '';
    const version = state.meta.version || '1.1.0';
    const platformName = platformLabel(state.meta.platform);

    els.titleVersion.textContent = `v${version}`;
    els.sideVersion.textContent = version;
    els.creditVersion.textContent = version;
    els.manualVersion.textContent = version;
    els.sidePlatform.textContent = platformName;
    els.statusPlatform.textContent = platformName;
    els.liveCount.textContent = String(state.platforms.length);
    els.allInput.value = state.inputs.all || '';

    buildSidebar();
    buildTargetGrid();
    buildForge();
    setupWindowControls();
    setFilter('all');
    updateVerdict();
    updateBoard();
    updateStatusMeta();
    updateStatus('Ready — 17 checkers armed', 'ready');

    window.sosuke.onOpenHelp(openManual);

    const savedTab = readStore(STORE_KEYS.tab, 'all');
    const startTab =
      savedTab === 'all' || savedTab === 'generator' || state.byId.has(String(savedTab))
        ? String(savedTab)
        : 'all';
    switchTab(startTab, { initial: true });
  }

  /* ------------------------------------------------------------------ */
  /* static ui                                                           */
  /* ------------------------------------------------------------------ */

  function bindStaticUi() {
    $('.side-tab[data-tab="all"]', els.sideNav).addEventListener('click', () => {
      switchTab('all', { focus: true });
    });

    els.allFilters.addEventListener('click', (event) => {
      const button = event.target.closest('.filter');
      if (!button) return;
      setFilter(button.dataset.filter);
    });

    els.allForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (state.sweeping) {
        stopSweep();
        return;
      }
      if (state.checking.size) {
        toast('Wait for the current check to finish first.', 'warn');
        return;
      }
      sweepAll();
    });

    els.allInput.addEventListener('input', () => {
      state.inputs.all = els.allInput.value;
      persistInputs();
    });

    els.pfForm.addEventListener('submit', (event) => {
      event.preventDefault();
      runSingle({ fresh: els.pfFresh.checked });
    });

    els.pfInput.addEventListener('input', () => {
      const platform = activePlatform();
      if (!platform) return;
      state.inputs[platform.id] = els.pfInput.value;
      persistInputs();
      if (!state.checking.has(platform.id)) renderPlatformResult(platform.id);
    });

    els.pfCopy.addEventListener('click', copyCurrentResult);

    els.pfProfile.addEventListener('click', () => {
      openUrl(els.pfProfile.dataset.url);
    });

    els.pfClearHistory.addEventListener('click', () => {
      const platform = activePlatform();
      if (!platform) return;
      state.history[platform.id] = [];
      persistHistory();
      renderPlatformHistory(platform.id);
      toast('Activity cleared for this checker.', 'info');
    });

    els.factClaim.addEventListener('click', () => {
      const platform = activePlatform();
      if (platform) openUrl(platform.claim);
    });

    els.pfSiteBtn.addEventListener('click', () => {
      const platform = activePlatform();
      if (platform) openUrl(platform.claim);
    });

    $('.side-tab[data-tab="generator"]', els.sideNav).addEventListener('click', () => {
      switchTab('generator', { focus: true });
    });

    els.genModes.addEventListener('click', (event) => {
      const button = event.target.closest('.gen-mode');
      if (button) setForgeMode(button.dataset.mode);
    });

    els.genBatchOptions.addEventListener('click', (event) => {
      const button = event.target.closest('[data-count]');
      if (button) setForgeCount(Number(button.dataset.count));
    });

    els.genGenerate.addEventListener('click', () => {
      stopForgeStream({ silent: true });
      generateForge();
    });

    els.genStream.addEventListener('click', toggleForgeStream);
    els.genScan.addEventListener('click', toggleForgeScan);
    els.genCopyAll.addEventListener('click', copyForgeAll);
    els.genClear.addEventListener('click', clearForge);

    els.genTarget.addEventListener('change', () => {
      if (state.forgeScanning) cancelForgeScan({ silent: true });
      state.forge.target = els.genTarget.value;
      persistForge();
      refreshForgeStatuses();
      updateForgeScanMeta();
      updateStatusMeta();
    });

    els.genSeed.addEventListener('input', () => {
      state.forge.seed = els.genSeed.value.slice(0, 180);
      persistForge();
    });

    els.genSeed.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      stopForgeStream({ silent: true });
      generateForge();
    });

    els.helpBtn.addEventListener('click', () => openManual());
    els.creditsBtn.addEventListener('click', () => openManual());
    els.closeManual.addEventListener('click', () => els.manualDialog.close());
    els.manualDialog.addEventListener('click', (event) => {
      if (event.target === els.manualDialog) els.manualDialog.close();
    });

    els.winControls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-window]');
      if (!button) return;
      if (button.dataset.window === 'minimize') window.sosuke.window.minimize();
      if (button.dataset.window === 'maximize') window.sosuke.window.toggleMaximize();
      if (button.dataset.window === 'close') window.sosuke.window.close();
    });

    els.titlebar.addEventListener('dblclick', (event) => {
      if (state.meta.platform === 'darwin') return;
      if (event.target.closest('button')) return;
      window.sosuke.window.toggleMaximize();
    });

    document.addEventListener('keydown', (event) => {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusActiveInput();
        return;
      }

      if (
        event.altKey &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        !els.manualDialog.open
      ) {
        event.preventDefault();
        cycleTab(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }

      if (event.key === 'Escape' && !els.manualDialog.open) {
        if (state.forgeStreaming) {
          event.preventDefault();
          stopForgeStream();
          return;
        }
        if (state.forgeScanning) {
          event.preventDefault();
          cancelForgeScan();
          return;
        }
        if (state.sweeping) {
          event.preventDefault();
          stopSweep();
        }
      }
    });
  }

  function setupWindowControls() {
    const isMac = state.meta.platform === 'darwin';
    els.winControls.hidden = isMac;
    if (isMac) return;

    window.sosuke.window
      .state()
      .then((value) => {
        document.body.dataset.maximized = String(Boolean(value && value.maximized));
      })
      .catch(() => {});

    window.sosuke.window.onMaximized((maximized) => {
      document.body.dataset.maximized = String(Boolean(maximized));
    });
  }

  /* ------------------------------------------------------------------ */
  /* build rails                                                         */
  /* ------------------------------------------------------------------ */

  function buildSidebar() {
    for (const group of GROUP_ORDER) {
      const platforms = state.platforms.filter((platform) => platform.group === group);
      if (!platforms.length) continue;

      const label = document.createElement('p');
      label.className = 'side-group';
      label.textContent = GROUP_LABEL[group] || group;
      els.sideNav.append(label);

      for (const platform of platforms) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'side-tab';
        button.dataset.tab = platform.id;
        button.title = `${platform.name} — ${platform.source}`;

        const icon = document.createElement('span');
        icon.className = 'tab-ico';
        const image = document.createElement('img');
        image.src = `icons/${platform.id}.svg`;
        image.alt = '';
        icon.append(image);

        const copy = document.createElement('span');
        copy.className = 'tab-copy';
        const name = document.createElement('strong');
        name.textContent = platform.name;
        const status = document.createElement('small');
        status.className = 'tab-state';
        status.textContent = TAB_STATE.idle;
        copy.append(name, status);

        const dot = document.createElement('span');
        dot.className = 'tab-dot';

        button.append(icon, copy, dot);
        button.addEventListener('click', () => switchTab(platform.id, { focus: true }));
        els.sideNav.append(button);
        state.tabEls.set(platform.id, button);
      }
    }
  }

  function buildTargetGrid() {
    const fragment = document.createDocumentFragment();

    for (const platform of state.platforms) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'target-card';
      card.dataset.id = platform.id;
      card.dataset.status = 'idle';
      card.title = `${platform.name} — ${platform.source}`;
      card.innerHTML = `
        <span class="tc-top">
          <span class="tc-icon"><img src="icons/${platform.id}.svg" alt="" /></span>
          <span class="tc-name"></span>
          <span class="tc-dot"></span>
        </span>
        <span class="tc-status">STANDBY</span>
        <span class="tc-message">Awaiting sweep.</span>
        <span class="tc-foot"><span class="tc-ms">—</span><span class="tc-go">open checker →</span></span>
      `;
      $('.tc-name', card).textContent = platform.name;
      card.addEventListener('click', () => switchTab(platform.id, { focus: true }));
      fragment.append(card);
      state.cardEls.set(platform.id, card);
    }

    els.targetGrid.append(fragment);
  }

  /* ------------------------------------------------------------------ */
  /* navigation                                                          */
  /* ------------------------------------------------------------------ */

  function switchTab(id, options = {}) {
    if (id !== 'all' && id !== 'generator' && !state.byId.has(id)) return;

    if (state.forgeStreaming && id !== 'generator') stopForgeStream({ silent: true });
    if (state.forgeScanning && id !== 'generator') cancelForgeScan({ silent: true });

    state.activeTab = id;
    writeStore(STORE_KEYS.tab, id);

    for (const button of $$('.side-tab', els.sideNav)) {
      button.classList.toggle('is-active', button.dataset.tab === id);
    }

    const isAll = id === 'all';
    const isGen = id === 'generator';
    els.viewAll.hidden = !isAll;
    els.viewGenerator.hidden = !isGen;
    els.viewPlatform.hidden = isAll || isGen;
    els.viewAll.classList.toggle('is-active', isAll);
    els.viewGenerator.classList.toggle('is-active', isGen);
    els.viewPlatform.classList.toggle('is-active', !isAll && !isGen);

    if (isAll) {
      document.title = 'SOSUKE Checker';
      if (state.sweeping) {
        updateStatus(`Sweeping ${state.platforms.length} targets…`, 'busy');
      } else {
        updateStatus('Ready — 17 checkers armed', 'ready');
      }
      if (options.focus && !options.initial) els.allInput.focus();
    } else if (isGen) {
      document.title = 'Name forge — SOSUKE Checker';
      if (state.sweeping) {
        updateStatus(`Sweeping ${state.platforms.length} targets…`, 'busy');
      } else if (state.forgeStreaming) {
        updateStatus('Streaming candidates — local generator', 'busy');
      } else {
        updateStatus(`Name forge — ${state.forgeCandidates.length} candidates ready`, 'ready');
      }
      if (options.focus && !options.initial) {
        els.genSeedWrap.hidden ? els.genGenerate.focus() : els.genSeed.focus();
      }
      if (!options.initial) els.genScroll.scrollTop = 0;
    } else {
      const platform = state.byId.get(id);
      renderPlatform(platform);
      document.title = `${platform.name} — SOSUKE Checker`;

      const index = state.platforms.findIndex((item) => item.id === id);
      if (state.sweeping) {
        updateStatus(`Sweeping · ${platform.name} checker`, 'busy');
      } else if (state.checking.has(id)) {
        updateStatus(`Checking ${platform.name}…`, 'busy');
      } else {
        updateStatus(`Checker ${index + 1} of ${state.platforms.length} — ${platform.name}`, 'ready');
      }

      if (options.focus && !options.initial) {
        window.setTimeout(() => {
          els.pfInput.focus();
          els.pfInput.select();
        }, 40);
      }
      if (!options.initial) els.platformScroll.scrollTop = 0;
    }

    updateStatusMeta();
  }

  function cycleTab(step) {
    const order = ['all', 'generator', ...state.platforms.map((platform) => platform.id)];
    const current = Math.max(0, order.indexOf(state.activeTab));
    const next = (current + step + order.length) % order.length;
    switchTab(order[next], { focus: true });
  }

  function focusActiveInput() {
    if (state.activeTab === 'generator') {
      if (!els.genSeedWrap.hidden) {
        els.genSeed.focus();
        els.genSeed.select();
      } else {
        els.genGenerate.focus();
      }
      return;
    }
    const input = state.activeTab === 'all' ? els.allInput : els.pfInput;
    input.focus();
    input.select();
  }

  function activePlatform() {
    if (state.activeTab === 'all' || state.activeTab === 'generator') return null;
    return state.byId.get(state.activeTab) || null;
  }

  /* ------------------------------------------------------------------ */
  /* platform view                                                       */
  /* ------------------------------------------------------------------ */

  function renderPlatform(platform) {
    if (!platform) return;
    const index = state.platforms.findIndex((item) => item.id === platform.id);
    const result = state.results.get(platform.id);

    els.pfNum.textContent = pad2(index + 1);
    els.pfGroup.textContent = GROUP_SHORT[platform.group] || String(platform.group).toUpperCase();
    els.pfName.textContent = platform.name;
    els.pfHint.textContent = platform.hint;
    els.pfIcon.src = `icons/${platform.id}.svg`;
    els.pfIcon.alt = `${platform.name} logo`;
    els.pfWeight.textContent = String(platform.weight ?? '—');
    els.pfLabel.textContent = platform.name;
    els.pfRule.textContent = platform.hint;
    els.pfSourceTag.textContent = platform.source;
    els.factGroup.textContent = GROUP_LABEL[platform.group] || platform.group;
    els.factRule.textContent = platform.hint;
    els.factSource.textContent = platform.source;
    els.factClaim.textContent = `Open ${platform.name} →`;
    els.pfSiteBtn.title = platform.claim || '';

    const savedInput = state.inputs[platform.id];
    els.pfInput.value = savedInput || (result && result.username) || state.inputs.all || '';

    renderPlatformButton(platform.id);
    renderPlatformResult(platform.id);
    renderPlatformHistory(platform.id);
  }

  function renderPlatformButton(id) {
    const checking = state.checking.has(id);
    els.pfBtn.disabled = checking;
    els.pfBtn.classList.toggle('is-busy', checking);
    els.pfBtnLabel.textContent = checking ? 'CHECKING' : 'CHECK';
  }

  function renderPlatformResult(id) {
    const platform = state.byId.get(id);
    if (!platform) return;

    const input = normalize(els.pfInput.value);
    const checking = state.checking.has(id);
    const result = state.results.get(id);
    const matches =
      result && result.username && result.username.toLowerCase() === input.toLowerCase();

    if (checking) {
      els.pfStandby.hidden = true;
      els.pfCard.hidden = false;
      els.pfCard.dataset.status = 'checking';
      els.pfPill.className = 'pill checking';
      els.pfPillText.textContent = STATUS_LABEL.checking;
      els.pfLatency.textContent = 'live';
      els.pfMessage.textContent = `Querying ${platform.name}…`;
      els.pfSub.textContent = 'Waiting on the live endpoint.';
      els.pfAvatar.hidden = true;
      els.pfAvatar.removeAttribute('src');
      els.pfCopy.hidden = true;
      els.pfProfile.hidden = true;
      els.pfSourceLine.textContent = 'awaiting response';
      updateQuickStatus(id);
      return;
    }

    if (!matches) {
      els.pfCard.hidden = true;
      els.pfStandby.hidden = false;
      if (result && input) {
        els.pfStandbyText.textContent = `Last check was @${result.username}. Check @${input} when ready.`;
      } else if (result) {
        els.pfStandbyText.textContent = `Last check was @${result.username}. Enter a handle above.`;
      } else {
        els.pfStandbyText.textContent = 'No check yet. Enter a handle above.';
      }
      updateQuickStatus(id);
      return;
    }

    const bucket = statusBucket(result.status);
    els.pfStandby.hidden = true;
    els.pfCard.hidden = false;
    els.pfCard.dataset.status = bucket;
    els.pfPill.className = `pill ${result.status}`;
    els.pfPillText.textContent = STATUS_LABEL[result.status] || String(result.status).toUpperCase();
    els.pfLatency.textContent = `${result.cached ? 'cached · ' : ''}${result.ms} ms`;
    els.pfMessage.textContent = result.message || 'No message returned.';
    els.pfSub.textContent = buildResultSub(result);

    if (result.avatar && /^https:\/\//i.test(result.avatar)) {
      els.pfAvatar.src = result.avatar;
      els.pfAvatar.alt = result.extra && result.extra.displayName
        ? `${result.extra.displayName} avatar`
        : '';
      els.pfAvatar.hidden = false;
    } else {
      els.pfAvatar.hidden = true;
      els.pfAvatar.removeAttribute('src');
    }

    els.pfCopy.hidden = false;
    const action = resultAction(platform, result);
    els.pfProfile.hidden = !action;
    if (action) {
      els.pfProfile.textContent = action.label;
      els.pfProfile.dataset.url = action.url;
    } else {
      delete els.pfProfile.dataset.url;
    }
    els.pfSourceLine.textContent = result.source ? `via ${result.source}` : '';
    els.pfSourceLine.title = result.source || '';
    updateQuickStatus(id);
  }

  function updateQuickStatus(id) {
    const result = state.results.get(id);
    const input = normalize(els.pfInput.value);
    let status = 'idle';

    if (state.checking.has(id)) status = 'checking';
    else if (result && result.username.toLowerCase() === input.toLowerCase()) status = result.status;

    const bucket = statusBucket(status);
    els.pfQuickStatus.dataset.status =
      bucket === 'available' || bucket === 'taken' || bucket === 'other' || bucket === 'checking'
        ? bucket
        : '';
    els.pfQuickStatus.textContent =
      status === 'idle' ? 'IDLE' : STATUS_LABEL[status] || String(status).toUpperCase();
  }

  function buildResultSub(result) {
    const bits = [];

    if (
      result.extra &&
      result.extra.displayName &&
      !String(result.message || '').includes(result.extra.displayName)
    ) {
      bits.push(result.extra.displayName);
    }
    if (result.extra && Number.isFinite(result.extra.followers)) {
      bits.push(`${formatCount(result.extra.followers)} followers`);
    }
    if (result.extra && result.extra.verified) bits.push('verified');

    if (result.cached) {
      bits.push('served from cache');
    } else if (result.checkedAt) {
      const time = new Date(result.checkedAt);
      if (!Number.isNaN(time.getTime())) {
        bits.push(
          `checked ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        );
      }
    }

    return bits.join(' · ');
  }

  function resultAction(platform, result) {
    if (result.status === 'available') {
      const url = result.url || platform.claim;
      return url ? { label: 'CLAIM NAME', url } : null;
    }
    if (result.url) {
      return {
        label: result.status === 'taken' ? 'OPEN PROFILE' : 'OPEN PAGE',
        url: result.url,
      };
    }
    return null;
  }

  function renderPlatformHistory(id) {
    const list = Array.isArray(state.history[id]) ? state.history[id] : [];
    els.pfHistory.replaceChildren();
    els.pfHistoryCount.textContent = String(list.length);
    els.pfHistoryEmpty.hidden = list.length > 0;

    for (const item of list) {
      const row = document.createElement('li');
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'h-name';
      name.textContent = `@${item.username}`;
      name.title = `Check @${item.username} again`;
      name.addEventListener('click', () => {
        if (state.checking.size) {
          toast('Wait for the current check to finish first.', 'warn');
          return;
        }
        els.pfInput.value = item.username;
        state.inputs[id] = item.username;
        persistInputs();
        runSingle({ fresh: els.pfFresh.checked });
      });

      const status = document.createElement('span');
      status.className = `h-status is-${statusBucket(item.status)}`;
      status.textContent = STATUS_LABEL[item.status] || String(item.status).toUpperCase();

      const time = document.createElement('time');
      time.className = 'h-time';
      time.dateTime = new Date(item.at).toISOString();
      time.textContent = timeAgo(item.at);

      row.append(name, status, time);
      els.pfHistory.append(row);
    }
  }

  /* ------------------------------------------------------------------ */
  /* checks                                                              */
  /* ------------------------------------------------------------------ */

  async function sweepAll(handle = null) {
    const username = normalize(handle == null ? els.allInput.value : handle);
    els.allInput.value = username;

    if (!username) {
      toast('Type a handle first.', 'warn');
      els.allInput.focus();
      return;
    }

    state.inputs.all = username;
    for (const platform of state.platforms) state.inputs[platform.id] = username;
    persistInputs();

    state.sweeping = true;
    state.allToken += 1;
    state.startedAt = performance.now();
    state.lastDuration = null;
    state.results.clear();

    setFilter('all');
    setSweepBusy(true);
    updateStatus(`Sweeping ${state.platforms.length} targets…`, 'busy');
    updateStatusMeta();
    updateVerdict();
    updateBoard();

    const token = state.allToken;
    const tasks = state.platforms.map((platform) =>
      checkOne(platform, username, { token, batch: true })
    );

    await Promise.allSettled(tasks);
    if (token !== state.allToken) return;
    finishSweep();
  }

  function finishSweep() {
    state.sweeping = false;
    state.lastDuration = Math.round(
      Math.max(0.1, (performance.now() - state.startedAt) / 1000) * 10
    ) / 10;

    setSweepBusy(false);
    updateVerdict();
    updateBoard();
    updateStatusMeta();

    const summary = summarize();
    updateStatus(
      `Sweep complete · ${summary.available} open · ${state.lastDuration}s`,
      'ready'
    );
    toast(
      `${summary.available} open · ${summary.taken} taken · ${summary.other} other · ${state.lastDuration}s`,
      summary.available > 0 ? 'success' : 'info'
    );

    if (summary.available === state.platforms.length && state.platforms.length) {
      celebrate();
      window.setTimeout(() => toast('Clean sweep — every checker is open.', 'success'), 450);
    }

    if (state.activeTab !== 'all' && state.activeTab !== 'generator') {
      renderPlatformButton(state.activeTab);
      renderPlatformResult(state.activeTab);
    }
  }

  function stopSweep() {
    if (!state.sweeping) return;

    state.allToken += 1;
    state.sweeping = false;
    const username = normalize(state.inputs.all || els.allInput.value);

    for (const id of Array.from(state.checking)) {
      const platform = state.byId.get(id);
      if (!platform) continue;
      const stopped = {
        platform: platform.id,
        name: platform.name,
        username,
        status: 'unknown',
        message: 'Sweep stopped before this checker answered.',
        ms: 0,
        checkedAt: new Date().toISOString(),
        source: platform.source,
      };
      state.checking.delete(id);
      state.results.set(id, stopped);
      setCardResult(stopped);
      setTabState(id, 'unknown');
    }

    setSweepBusy(false);
    updateVerdict();
    updateBoard();
    updateStatusMeta();
    updateStatus(`Sweep stopped · ${state.results.size}/${state.platforms.length} answered`, 'ready');
    toast('Sweep stopped.', 'warn');

    if (state.activeTab !== 'all' && state.activeTab !== 'generator') {
      renderPlatformButton(state.activeTab);
      renderPlatformResult(state.activeTab);
    }
  }

  async function checkOne(platform, username, options = {}) {
    const { fresh = false, token = null, batch = false } = options;

    state.checking.add(platform.id);
    setCardChecking(platform.id);
    setTabState(platform.id, 'checking');
    if (state.activeTab === platform.id) {
      renderPlatformButton(platform.id);
      renderPlatformResult(platform.id);
    }
    updateStatusMeta();

    let result;
    try {
      result = await window.sosuke.check(platform.id, username, fresh);
    } catch (error) {
      console.error(error);
      result = errorResult(platform, username, error);
    }

    if (batch && token !== state.allToken) return null;

    state.checking.delete(platform.id);
    state.results.set(platform.id, result);
    addHistory(platform.id, result);
    setCardResult(result);
    setTabState(platform.id, result.status);

    if (state.activeTab === platform.id) {
      renderPlatformButton(platform.id);
      renderPlatformResult(platform.id);
    }

    updateVerdict();
    updateBoard();
    updateStatusMeta();
    return result;
  }

  async function runSingle(options = {}) {
    const platform = activePlatform();
    if (!platform) return;
    if (state.checking.has(platform.id)) return;

    const username = normalize(els.pfInput.value);
    els.pfInput.value = username;
    if (!username) {
      toast('Type a handle first.', 'warn');
      els.pfInput.focus();
      return;
    }

    state.inputs[platform.id] = username;
    persistInputs();

    els.pfBtn.disabled = true;
    els.pfBtn.classList.add('is-busy');
    els.pfBtnLabel.textContent = 'CHECKING';

    const result = await checkOne(platform, username, {
      fresh: Boolean(options.fresh),
    });

    if (state.activeTab === platform.id) {
      renderPlatformButton(platform.id);
      renderPlatformResult(platform.id);
    }

    if (!result) return;

    updateStatus(
      `${platform.name} · ${STATUS_LABEL[result.status] || result.status} · ${(result.ms / 1000).toFixed(1)}s`,
      result.status === 'error' ? 'error' : 'ready'
    );
    toast(
      `${platform.name} — ${STATUS_LABEL[result.status] || result.status}${result.cached ? ' · cached' : ''}`,
      toneFor(result.status)
    );
  }

  function setSweepBusy(busy) {
    els.allBtn.classList.toggle('is-busy', busy);
    els.allBtnLabel.textContent = busy ? 'STOP' : 'SWEEP ALL';
    els.allBtn.setAttribute('aria-label', busy ? 'Stop the sweep' : 'Sweep all checkers');
  }

  function errorResult(platform, username, error) {
    return {
      platform: platform.id,
      name: platform.name,
      username,
      status: 'error',
      message: 'The checker could not complete that lookup. Try again.',
      ms: 0,
      checkedAt: new Date().toISOString(),
      source: platform.source,
      error: String((error && error.message) || error || ''),
    };
  }

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
      answered: state.results.size,
      total: state.platforms.length,
    };
  }

  /* ------------------------------------------------------------------ */
  /* live board                                                          */
  /* ------------------------------------------------------------------ */

  function setCardChecking(id) {
    const card = state.cardEls.get(id);
    if (!card) return;
    card.dataset.status = 'checking';
    $('.tc-status', card).textContent = 'CHECKING';
    $('.tc-message', card).textContent = 'Querying the live endpoint…';
    $('.tc-ms', card).textContent = 'live';
  }

  function setCardResult(result) {
    const card = state.cardEls.get(result.platform);
    if (!card) return;
    const bucket = statusBucket(result.status);
    card.dataset.status = bucket;
    $('.tc-status', card).textContent =
      STATUS_LABEL[result.status] || String(result.status).toUpperCase();
    $('.tc-message', card).textContent = result.message || 'No message returned.';
    $('.tc-ms', card).textContent = result.cached ? 'cached' : `${result.ms} ms`;
  }

  function setTabState(id, status) {
    const button = state.tabEls.get(id);
    if (!button) return;
    button.dataset.status = statusBucket(status);
    const label = $('.tab-state', button);
    if (label) label.textContent = TAB_STATE[status] || TAB_STATE.idle;
  }

  function setFilter(filter) {
    state.filter = FILTERS.includes(filter) ? filter : 'all';
    for (const button of $$('.filter', els.allFilters)) {
      button.classList.toggle('is-active', button.dataset.filter === state.filter);
    }
    updateBoard();
  }

  function updateBoard() {
    let visible = 0;
    for (const platform of state.platforms) {
      const card = state.cardEls.get(platform.id);
      if (!card) continue;
      const match = state.filter === 'all' || card.dataset.status === state.filter;
      card.hidden = !match;
      if (match) visible += 1;
    }

    els.boardEmpty.hidden = visible !== 0;

    if (state.filter === 'all') {
      els.resultCount.textContent = `${state.results.size} / ${state.platforms.length} answered`;
    } else {
      els.resultCount.textContent = `${visible} ${state.filter === 'available' ? 'open' : state.filter}`;
    }
  }

  function updateVerdict() {
    const total = state.platforms.length || 17;
    const answered = state.results.size;
    let available = 0;
    let taken = 0;
    let other = 0;
    const open = [];

    for (const result of state.results.values()) {
      if (result.status === 'available') {
        available += 1;
        open.push(result);
      } else if (result.status === 'taken') {
        taken += 1;
      } else {
        other += 1;
      }
    }

    els.tallyOpen.textContent = answered ? String(available) : '—';
    els.tallyTaken.textContent = answered ? String(taken) : '—';
    els.tallyOther.textContent = answered ? String(other) : '—';
    els.tallyChecked.textContent = `${answered}/${total}`;

    const percent = answered ? Math.round((available / answered) * 100) : 0;
    els.scoreRing.style.setProperty('--pct', String(percent));
    els.scoreRing.style.setProperty('--ring-color', available > 0 ? 'var(--green)' : 'var(--red)');
    els.scoreValue.textContent = `${percent}%`;

    if (state.sweeping) {
      els.verdictEyebrow.textContent = 'SWEEPING';
      els.verdictTitle.textContent = `${answered} of ${total} answered — ${available} open so far.`;
      els.verdictSub.textContent = 'Live results are streaming in from the checkers.';
    } else if (!answered) {
      els.verdictEyebrow.textContent = 'STANDBY';
      els.verdictTitle.textContent = 'Drop a handle to begin.';
      els.verdictSub.textContent = 'All 17 checkers are armed and waiting.';
    } else if (available === total) {
      els.verdictEyebrow.textContent = 'CLEAN SWEEP';
      els.verdictTitle.textContent = 'Every checker is open.';
      els.verdictSub.textContent = 'Rare air. Claim them before the moment passes.';
    } else if (available > 0) {
      els.verdictEyebrow.textContent = 'CONTESTED';
      els.verdictTitle.textContent = `${available} of ${total} checkers open.`;
      const names = open.slice(0, 3).map((result) => result.name).join(' · ');
      const suffix = open.length > 3 ? ` +${open.length - 3} more` : '';
      els.verdictSub.textContent = `Best grabs: ${names}${suffix}. Move fast.`;
    } else {
      els.verdictEyebrow.textContent = 'LOCKED OUT';
      els.verdictTitle.textContent = 'Nothing open this time.';
      els.verdictSub.textContent =
        'Every answer came back taken or unreadable. Try another handle.';
    }

    els.bestGrabs.replaceChildren();
    els.bestGrabs.hidden = open.length === 0;
    for (const result of open.slice(0, 6)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = result.name;
      button.addEventListener('click', () => switchTab(result.platform, { focus: true }));
      els.bestGrabs.append(button);
    }
  }

  /* ------------------------------------------------------------------ */
  /* status / history                                                    */
  /* ------------------------------------------------------------------ */

  function updateStatus(text, tone = 'ready') {
    els.statusText.textContent = text;
    els.statusDot.classList.toggle('is-busy', tone === 'busy');
    els.statusDot.classList.toggle('is-error', tone === 'error');
  }

  function updateStatusMeta() {
    const total = state.platforms.length || 17;

    if (state.sweeping) {
      els.statusMeta.textContent = `${state.results.size}/${total} answered · live`;
      return;
    }

    if (state.activeTab === 'generator') {
      if (state.forgeScanProgress) {
        els.statusMeta.textContent = `forge scan · ${state.forgeScanProgress.done}/${state.forgeScanProgress.total} on ${forgeTargetName()}`;
      } else {
        els.statusMeta.textContent = `${state.forgeCandidates.length} candidates · ${forgeTargetName()}`;
      }
      return;
    }

    if (state.lastDuration != null) {
      els.statusMeta.textContent = `${state.results.size}/${total} answered · ${state.lastDuration}s`;
      return;
    }

    if (state.activeTab !== 'all') {
      const index = state.platforms.findIndex((platform) => platform.id === state.activeTab);
      els.statusMeta.textContent = `checker ${index + 1} / ${total}`;
      return;
    }

    els.statusMeta.textContent = 'no sweep yet';
  }

  function addHistory(platformId, result) {
    const entry = {
      username: result.username,
      status: result.status,
      ms: result.ms,
      at: Date.now(),
      cached: Boolean(result.cached),
    };
    const list = (state.history[platformId] || []).filter(
      (item) => String(item.username).toLowerCase() !== entry.username.toLowerCase()
    );
    list.unshift(entry);
    state.history[platformId] = list.slice(0, 8);
    persistHistory();
    if (state.activeTab === platformId) renderPlatformHistory(platformId);
  }

  /* ------------------------------------------------------------------ */
  /* name forge                                                          */
  /* ------------------------------------------------------------------ */

  function buildForge() {
    const forge = state.forge;

    els.genSeed.value = forge.seed || '';
    els.genBatchMeta.textContent = String(forge.count);

    for (const button of $$('#genBatchOptions button')) {
      button.classList.toggle('is-active', Number(button.dataset.count) === forge.count);
    }

    renderForgeModes();

    els.genTarget.replaceChildren();
    for (const platform of state.platforms) {
      const option = document.createElement('option');
      option.value = platform.id;
      option.textContent = platform.name;
      els.genTarget.append(option);
    }

    const fallback = state.byId.has('roblox') ? 'roblox' : state.platforms[0]?.id;
    const target = state.byId.has(forge.target) ? forge.target : fallback;
    if (target) {
      forge.target = target;
      els.genTarget.value = target;
    }

    setForgeMode(forge.mode, { persist: false, silent: true });
    els.genSeedWrap.hidden = forge.mode !== 'custom';
    refreshForgeStatuses();
    updateForgeBoard();
  }

  function renderForgeModes() {
    const fragment = document.createDocumentFragment();

    for (const mode of FORGE_MODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gen-mode';
      button.dataset.mode = mode.id;
      button.title = mode.desc;
      button.classList.toggle('is-active', state.forge.mode === mode.id);

      const glyph = document.createElement('span');
      glyph.className = 'gm-glyph';
      glyph.innerHTML = mode.icon;
      glyph.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('span');
      copy.className = 'gm-copy';
      const strong = document.createElement('strong');
      strong.textContent = mode.label;
      const small = document.createElement('small');
      small.textContent = mode.desc;
      copy.append(strong, small);

      button.append(glyph, copy);
      fragment.append(button);
    }

    els.genModes.replaceChildren(fragment);
  }

  function setForgeMode(id, options = {}) {
    const mode = FORGE_MODES.find((item) => item.id === id);
    if (!mode) return;

    if (state.forge.mode !== id && !options.silent) stopForgeStream({ silent: true });
    state.forge.mode = id;

    for (const button of $$('.gen-mode', els.genModes)) {
      button.classList.toggle('is-active', button.dataset.mode === id);
    }

    els.genModeLabel.textContent = mode.label.toUpperCase();
    els.genSeedWrap.hidden = id !== 'custom';
    els.genNote.textContent = FORGE_NOTES[id] || '';

    if (options.persist !== false) persistForge();
    updateForgeHint();
  }

  function setForgeCount(count) {
    if (!FORGE_COUNTS.includes(count)) return;
    state.forge.count = count;
    els.genBatchMeta.textContent = String(count);
    for (const button of $$('#genBatchOptions button')) {
      button.classList.toggle('is-active', Number(button.dataset.count) === count);
    }
    persistForge();
  }

  async function generateForge(options = {}) {
    if (!window.sosuke || typeof window.sosuke.generate !== 'function') {
      toast('The generator is not available in this build.', 'error');
      return 0;
    }

    const count = Number(options.count) || state.forge.count;
    const exclude = state.forgeCandidates.slice(-FORGE_LIMIT).map((item) => item.name);
    let response;

    try {
      response = await window.sosuke.generate(state.forge.mode, {
        count,
        seed: els.genSeed.value,
        exclude,
      });
    } catch (error) {
      console.error(error);
      toast('The generator could not build that batch.', 'error');
      return 0;
    }

    if (response && response.warning) {
      toast(response.warning, 'warn');
      return 0;
    }

    const fresh = [];
    for (const item of (response && response.names) || []) {
      const name = String(item.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (state.forgeSeen.has(key)) continue;

      state.forgeSeen.add(key);
      const candidate = {
        name,
        mode: item.mode || state.forge.mode,
        rarity: item.rarity || 'RARE',
      };
      state.forgeCandidates.push(candidate);
      fresh.push(candidate);
    }

    if (!fresh.length) {
      if (!options.silent) {
        toast(
          state.forge.mode === 'custom'
            ? 'No new names left in that list. Add more base words.'
            : 'No new names in that batch. Try again.',
          'warn'
        );
      }
      return 0;
    }

    while (state.forgeCandidates.length > FORGE_LIMIT) {
      const drop = state.forgeCandidates.shift();
      const card = state.forgeCardEls.get(drop.name);
      if (card) card.remove();
      state.forgeCardEls.delete(drop.name);
    }

    appendForgeCards(fresh);
    updateForgeBoard();

    if (state.activeTab === 'generator' && !options.silent) {
      updateStatus(
        `Forged ${fresh.length} candidates — ${forgeModeLabel(state.forge.mode).toLowerCase()}`,
        'ready'
      );
    }

    return fresh.length;
  }

  function appendForgeCards(items) {
    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'gen-card';
      card.dataset.name = item.name;
      card.dataset.status = 'idle';

      const top = document.createElement('div');
      top.className = 'fc-top';
      const name = document.createElement('strong');
      name.className = 'fc-name';
      name.textContent = item.name;
      name.title = 'Copy this handle';
      name.addEventListener('click', () => copyForgeName(item.name));
      const rarity = document.createElement('span');
      rarity.className = 'fc-rarity';
      rarity.textContent = item.rarity;
      top.append(name, rarity);

      const meta = document.createElement('div');
      meta.className = 'fc-meta';
      const mode = document.createElement('span');
      mode.className = 'fc-mode';
      mode.textContent = forgeModeLabel(item.mode);
      const status = document.createElement('span');
      status.className = 'fc-status';
      status.textContent = 'UNCHECKED';
      meta.append(mode, status);

      const actions = document.createElement('div');
      actions.className = 'fc-actions';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'fc-btn';
      copy.textContent = 'COPY';
      copy.addEventListener('click', () => copyForgeName(item.name));
      const sweep = document.createElement('button');
      sweep.type = 'button';
      sweep.className = 'fc-btn fc-sweep';
      sweep.textContent = 'SWEEP 17 →';
      sweep.addEventListener('click', () => sweepForgeName(item.name));
      actions.append(copy, sweep);

      card.append(top, meta, actions);
      state.forgeCardEls.set(item.name, card);
      fragment.append(card);
    }

    els.genGrid.append(fragment);
  }

  function updateForgeBoard() {
    const count = state.forgeCandidates.length;

    els.genCount.textContent = String(count);
    els.genEmpty.hidden = count > 0;
    els.genState.textContent = state.forgeStreaming
      ? 'STREAMING'
      : state.forgeScanning
        ? 'SCANNING'
        : 'READY';
    els.genState.dataset.state = els.genState.textContent.toLowerCase();
    updateForgeHint();
    updateForgeScanMeta();
    updateStatusMeta();
  }

  function updateForgeHint() {
    if (!state.forgeCandidates.length) {
      els.genHint.textContent = 'Pick a mode and forge a batch.';
      return;
    }
    if (state.forgeStreaming) {
      els.genHint.textContent = `Streaming — ${state.forgeCandidates.length} candidates, still going.`;
      return;
    }

    const modes = new Set(state.forgeCandidates.map((item) => item.mode));
    els.genHint.textContent =
      modes.size > 1
        ? `${state.forgeCandidates.length} candidates · mixed modes`
        : `${state.forgeCandidates.length} ${forgeModeLabel(state.forgeCandidates[0].mode)} candidates`;
  }

  async function copyForgeName(name) {
    const ok = await window.sosuke.copy(name);
    toast(ok ? `@${name} copied.` : 'Could not copy that handle.', ok ? 'success' : 'warn');
  }

  async function copyForgeAll() {
    if (!state.forgeCandidates.length) {
      toast('Forge some candidates first.', 'warn');
      return;
    }
    const text = state.forgeCandidates.map((item) => item.name).join('\n');
    const ok = await window.sosuke.copy(text);
    toast(
      ok ? `${state.forgeCandidates.length} handles copied.` : 'Could not copy the batch.',
      ok ? 'success' : 'warn'
    );
  }

  function clearForge() {
    if (state.forgeScanning) cancelForgeScan({ silent: true });
    if (state.forgeStreaming) stopForgeStream({ silent: true });

    state.forgeCandidates = [];
    state.forgeSeen.clear();
    state.forgeResults.clear();
    state.forgeCardEls.clear();
    els.genGrid.replaceChildren();
    refreshForgeStatuses();
    updateForgeBoard();
    updateStatus('Name forge cleared', 'ready');
    toast('Candidate board cleared.', 'info');
  }

  function sweepForgeName(name) {
    if (state.forgeScanning) cancelForgeScan({ silent: true });
    if (state.sweeping || state.checking.size) {
      toast('Wait for the current check to finish first.', 'warn');
      return;
    }
    switchTab('all');
    els.allInput.value = name;
    sweepAll(name);
  }

  function toggleForgeStream() {
    if (state.forgeStreaming) {
      stopForgeStream();
      return;
    }
    if (state.forgeScanning) cancelForgeScan({ silent: true });
    if (state.forgeCandidates.length >= FORGE_LIMIT) {
      toast('Clear the board before streaming more.', 'warn');
      return;
    }
    if (state.forge.mode === 'custom' && !els.genSeed.value.trim()) {
      toast('Type at least one base word first.', 'warn');
      els.genSeed.focus();
      return;
    }

    state.forgeStreaming = true;
    els.genStream.classList.add('is-on');
    els.genStream.textContent = 'STOP ∞';
    updateStatus(`Streaming ${forgeModeLabel(state.forge.mode).toLowerCase()} candidates…`, 'busy');
    updateForgeBoard();
    streamTick();
  }

  async function streamTick() {
    if (!state.forgeStreaming) return;
    if (state.forgeCandidates.length >= FORGE_LIMIT) {
      stopForgeStream({ silent: true });
      toast(`Stream paused at ${FORGE_LIMIT} candidates.`, 'info');
      return;
    }

    const added = await generateForge({
      silent: true,
      count: Math.min(6, FORGE_LIMIT - state.forgeCandidates.length),
    });

    if (!state.forgeStreaming) return;

    if (added === 0) {
      stopForgeStream({ silent: true });
      toast('Stream ended — the current mode is exhausted.', 'info');
      return;
    }

    updateForgeBoard();
    state.forgeStreamTimer = window.setTimeout(streamTick, 1450);
  }

  function stopForgeStream(options = {}) {
    const wasStreaming = state.forgeStreaming;
    state.forgeStreaming = false;

    if (state.forgeStreamTimer) {
      window.clearTimeout(state.forgeStreamTimer);
      state.forgeStreamTimer = null;
    }

    els.genStream.classList.remove('is-on');
    els.genStream.textContent = 'STREAM ∞';
    updateForgeBoard();

    if (!options.silent && wasStreaming && state.activeTab === 'generator') {
      updateStatus(`Name forge — ${state.forgeCandidates.length} candidates ready`, 'ready');
      toast('Stream stopped.', 'info');
    }
  }

  function forgeKey(platformId, name) {
    return `${platformId}:${name.toLowerCase()}`;
  }

  function forgeTargetName() {
    const platform = state.byId.get(els.genTarget.value || state.forge.target);
    return platform ? platform.name : 'platform';
  }

  function forgeModeLabel(id) {
    const mode = FORGE_MODES.find((item) => item.id === id);
    return mode ? mode.label : 'Forge';
  }

  function forgeStatusLabel(status) {
    if (!status || status === 'idle') return 'UNCHECKED';
    return STATUS_LABEL[status] || String(status).toUpperCase();
  }

  function refreshForgeStatuses() {
    const target = els.genTarget.value || state.forge.target;

    for (const item of state.forgeCandidates) {
      const card = state.forgeCardEls.get(item.name);
      if (!card) continue;

      const result = state.forgeResults.get(forgeKey(target, item.name));
      let status = result ? result.status : 'idle';
      if (state.forgeChecking === item.name) status = 'checking';

      const bucket = statusBucket(status);
      card.dataset.status = status === 'checking' ? 'checking' : bucket;

      const label = card.querySelector('.fc-status');
      if (label) {
        label.dataset.status = status === 'checking' ? 'checking' : bucket;
        label.textContent = forgeStatusLabel(status);
      }

      card.title =
        result && result.message
          ? result.message
          : `${item.name} — unchecked on ${forgeTargetName()}`;
    }
  }

  function updateForgeScanMeta() {
    const total = state.forgeCandidates.length;
    if (!total) {
      els.genScanMeta.textContent = 'No candidates yet.';
      return;
    }

    const target = els.genTarget.value || state.forge.target;
    const targetName = forgeTargetName();
    const checked = state.forgeCandidates.filter((item) =>
      state.forgeResults.has(forgeKey(target, item.name))
    );

    if (!checked.length) {
      els.genScanMeta.textContent = `${total} candidates ready on ${targetName}.`;
      return;
    }

    let open = 0;
    let taken = 0;
    let other = 0;
    for (const item of checked) {
      const result = state.forgeResults.get(forgeKey(target, item.name));
      if (result.status === 'available') open += 1;
      else if (result.status === 'taken') taken += 1;
      else other += 1;
    }

    els.genScanMeta.textContent = `${checked.length}/${total} checked · ${open} open · ${taken} taken · ${other} other`;
  }

  function toggleForgeScan() {
    if (state.forgeScanning) {
      cancelForgeScan();
      return;
    }
    if (!state.forgeCandidates.length) {
      toast('Forge some candidates first.', 'warn');
      return;
    }
    if (state.sweeping) {
      toast('Wait for the all-target sweep to finish.', 'warn');
      return;
    }

    const target = els.genTarget.value || state.forge.target;
    const pending = state.forgeCandidates.filter(
      (item) => !state.forgeResults.has(forgeKey(target, item.name))
    );

    if (!pending.length) {
      toast(`Every candidate is checked on ${forgeTargetName()}.`, 'info');
      return;
    }

    stopForgeStream({ silent: true });
    state.forge.target = target;
    persistForge();

    state.forgeScanning = true;
    state.forgeScanToken += 1;
    const token = state.forgeScanToken;
    state.forgeScanProgress = { done: 0, total: pending.length };
    state.forgeChecking = '';
    els.genScan.classList.add('is-busy');
    els.genScan.textContent = 'STOP SCAN';
    updateForgeBoard();
    updateStatus(`Scanning ${forgeTargetName()} · 0/${pending.length}`, 'busy');

    runForgeScan(target, pending, token);
  }

  async function runForgeScan(target, pending, token) {
    let checked = 0;
    let open = 0;
    let taken = 0;

    for (const candidate of pending) {
      if (!state.forgeScanning || token !== state.forgeScanToken) return;

      state.forgeChecking = candidate.name;
      refreshForgeStatuses();

      const result = await safeForgeCheck(target, candidate.name);
      if (!state.forgeScanning || token !== state.forgeScanToken) return;

      state.forgeChecking = '';
      state.forgeResults.set(forgeKey(target, candidate.name), result);
      checked += 1;
      if (result.status === 'available') open += 1;
      else if (result.status === 'taken') taken += 1;

      state.forgeScanProgress = { done: checked, total: pending.length };
      refreshForgeStatuses();
      updateForgeScanMeta();
      updateStatus(`Scanning ${forgeTargetName()} · ${checked}/${pending.length}`, 'busy');
      updateStatusMeta();
      await delay(620);
    }

    if (token !== state.forgeScanToken) return;
    finishForgeScan(open, taken, checked, pending.length);
  }

  async function safeForgeCheck(platformId, username) {
    try {
      const result = await window.sosuke.check(platformId, username, false);
      return result || { status: 'error', message: 'No response from the checker.' };
    } catch (error) {
      console.error(error);
      return { status: 'error', message: 'Lookup failed. Try again.' };
    }
  }

  function finishForgeScan(open, taken, checked, total) {
    state.forgeScanning = false;
    state.forgeScanProgress = null;
    state.forgeChecking = '';
    els.genScan.classList.remove('is-busy');
    els.genScan.textContent = 'CHECK BATCH';
    refreshForgeStatuses();
    updateForgeBoard();
    updateStatus(
      `Scan complete · ${open} open · ${taken} taken · ${checked}/${total}`,
      'ready'
    );
    toast(
      `${forgeTargetName()}: ${open} open · ${taken} taken · ${checked - open - taken} other`,
      open > 0 ? 'success' : 'info'
    );
  }

  function cancelForgeScan(options = {}) {
    if (!state.forgeScanning) return;

    state.forgeScanning = false;
    state.forgeScanToken += 1;
    state.forgeChecking = '';
    state.forgeScanProgress = null;
    els.genScan.classList.remove('is-busy');
    els.genScan.textContent = 'CHECK BATCH';
    refreshForgeStatuses();
    updateForgeBoard();

    if (!options.silent) {
      updateStatus('Batch scan stopped', 'ready');
      toast('Batch scan stopped.', 'warn');
    }
  }

  /* ------------------------------------------------------------------ */
  /* utilities                                                           */
  /* ------------------------------------------------------------------ */

  function normalize(value) {
    return String(value || '')
      .trim()
      .replace(/^@+/, '')
      .trim();
  }

  function statusBucket(status) {
    if (status === 'available') return 'available';
    if (status === 'taken') return 'taken';
    if (status === 'checking') return 'checking';
    if (status === 'idle') return 'idle';
    return 'other';
  }

  function toneFor(status) {
    if (status === 'available') return 'success';
    if (status === 'taken') return 'info';
    if (status === 'error') return 'error';
    return 'warn';
  }

  function platformLabel(platform) {
    if (platform === 'darwin') return 'macOS';
    if (platform === 'win32') return 'Windows';
    if (platform === 'linux') return 'Linux';
    return 'Desktop';
  }

  function formatCount(value) {
    try {
      return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
    } catch {
      return String(value);
    }
  }

  function timeAgo(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - Number(timestamp)) / 1000));
    if (seconds < 45) return 'just now';
    if (seconds < 90) return '1m';
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  async function openUrl(url) {
    if (!url) return;
    const ok = await window.sosuke.openExternal(url);
    if (!ok) toast('Could not open that link.', 'warn');
  }

  async function copyCurrentResult() {
    const platform = activePlatform();
    if (!platform) return;
    const result = state.results.get(platform.id);
    if (!result) return;

    const text = [
      `@${result.username} on ${platform.name} — ${STATUS_LABEL[result.status] || result.status}`,
      result.message,
      result.url,
    ]
      .filter(Boolean)
      .join('\n');

    const ok = await window.sosuke.copy(text);
    toast(ok ? 'Result copied.' : 'Could not copy the result.', ok ? 'success' : 'warn');
  }

  function openManual() {
    if (!els.manualDialog.open) els.manualDialog.showModal();
  }

  function toast(message, tone = 'info') {
    const element = document.createElement('div');
    element.className = `toast is-${tone}`;
    element.textContent = message;
    els.toasts.append(element);

    while (els.toasts.children.length > 4) {
      els.toasts.firstElementChild.remove();
    }

    window.setTimeout(() => {
      element.classList.add('is-out');
      window.setTimeout(() => element.remove(), 220);
    }, 3800);
  }

  function celebrate() {
    const colors = ['#ff4a24', '#4fe3a4', '#f4f1ea', '#ffc061'];

    for (let i = 0; i < 46; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
      document.body.append(piece);
      window.setTimeout(() => piece.remove(), 3800);
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
      /* storage is optional */
    }
  }

  function persistInputs() {
    writeStore(STORE_KEYS.inputs, state.inputs);
  }

  function persistHistory() {
    writeStore(STORE_KEYS.history, state.history);
  }

  function persistForge() {
    writeStore(STORE_KEYS.forge, state.forge);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function sanitizeInputs(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string') out[key] = item.slice(0, 64);
    }
    return out;
  }

  function sanitizeHistory(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [key, list] of Object.entries(value)) {
      if (!Array.isArray(list)) continue;
      out[key] = list
        .filter(
          (item) =>
            item &&
            typeof item.username === 'string' &&
            typeof item.status === 'string' &&
            Number.isFinite(item.at)
        )
        .slice(0, 8)
        .map((item) => ({
          username: item.username.slice(0, 64),
          status: item.status,
          ms: Number.isFinite(item.ms) ? item.ms : 0,
          at: item.at,
          cached: Boolean(item.cached),
        }));
    }
    return out;
  }

  function sanitizeForge(value) {
    const fallback = { mode: 'smart4', count: 12, target: 'roblox', seed: '' };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

    const mode = FORGE_MODES.some((item) => item.id === value.mode) ? value.mode : fallback.mode;
    const count = FORGE_COUNTS.includes(Number(value.count)) ? Number(value.count) : fallback.count;
    const target = typeof value.target === 'string' ? value.target.slice(0, 32) : fallback.target;
    const seed = typeof value.seed === 'string' ? value.seed.slice(0, 180) : '';

    return { mode, count, target, seed };
  }
})();
