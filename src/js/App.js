const App = (() => {

    const $ = id => document.getElementById(id);

    const D = {
        landing:       $('landing-page'),
        reader:        $('reader-page'),
        input:         $('text-input'),
        content:       $('content-area'),
        progress:      $('progress-bar'),
        continueBtn:   $('continue-btn'),
        resetRow:      $('reset-row'),
        fileUpload:    $('file-upload'),
        toolbar:       $('toolbar'),
        proximity:     $('toolbar-proximity'),
        fszLabel:      $('fsz-label'),
        panelFsz:      $('panel-fsz'),
        wordCount:     $('word-count'),
        widthBtn:      $('width-btn'),
        overlay:       $('settings-overlay'),
        panel:         $('settings-panel'),
        wNarrow:       $('w-narrow'),
        wWide:         $('w-wide'),
        lhTight:       $('lh-tight'),
        lhNormal:      $('lh-normal'),
        lhRelaxed:     $('lh-relaxed'),
        dropOverlay:   $('drop-overlay'),
        tabPaste:      $('tab-paste'),
        tabPreview:    $('tab-preview'),
        panePaste:     $('pane-paste'),
        panePreview:   $('pane-preview'),
        previewContent:$('preview-content'),
        previewMeta:   $('preview-meta'),
        previewName:   $('preview-filename'),
        previewBadge:  $('preview-badge'),
        previewStatsRow: $('preview-stats-row'),
        mastTagline:   $('mast-tagline'),
        pageView:      $('page-view'),
        pageCanvas:    $('page-canvas'),
        pageText:      $('page-text'),
        pageNav:       $('page-nav'),
        pagePrevBtn:   $('page-prev'),
        pageNextBtn:   $('page-next'),
        pageNum:       $('page-num'),
        pageTotal:     $('page-total'),
        pageKeyHint:   $('page-key-hint'),
        pageModeToggle:$('page-mode-toggle'),
        toolbarWrap:   $('toolbar-wrap'),
    };

    const FONT_CLASSES = {
        source:    'font-source',
        lora:      'font-lora',
        garamond:  'font-garamond',
        literata:  'font-literata',
        crimson:   'font-crimson',
        cormorant: 'font-cormorant',
    };

    const THEME_TAGLINES = {
        ember:     'warm light, open pages',
        midnight:  'deep night, quiet hours',
        forest:    'still air, green light',
        parchment: 'old paper, new words',
        slate:     'cool distance, clear prose',
    };

    let S = {
        fontSize:   20,
        theme:      'ember',
        font:       'source',
        wide:       false,
        lineHeight: 'normal',
        pageMode:   false,
    };

    let loadedText     = '';
    let parsedBlocks   = [];
    let pages          = [];
    let currentPage    = 0;
    let toolbarVisible = false;
    let settingsOpen   = false;
    let scrollTimer    = null;
    let proximityActive= false;
    let isDesktop      = window.matchMedia('(pointer:fine)').matches;
    let ticking        = false;
    let lastFocusedElement = null;
    let previewDebounceTimer = null;

    /* ── UI Logic ───────────────────────────────────── */
    const setWordCount = text => {
        if (!D.wordCount) return;
        const { words } = Utils.getTextStats(text);
        D.wordCount.textContent = words > 0 ? `~${words.toLocaleString()} words` : '';
    };

    const buildPreviewStats = (words, mins) => {
        D.previewStatsRow.innerHTML = '';
        const stats = [
            { val: words >= 1000 ? (words / 1000).toFixed(1) + 'k' : words.toString(), lbl: 'words' },
            { val: Utils.formatReadTime(mins), lbl: 'to read' },
        ];
        stats.forEach(s => {
            const el = document.createElement('div');
            el.className = 'preview-stat';
            el.innerHTML = `<span class="preview-stat-val">${s.val}</span><span class="preview-stat-lbl">${s.lbl}</span>`;
            D.previewStatsRow.appendChild(el);
        });
    };

    const showPreview = (text, filename, format) => {
        const { words, mins } = Utils.getTextStats(text);
        D.previewName.textContent  = filename || 'Pasted Text';
        D.previewBadge.textContent = (format || 'TXT').toUpperCase();
        buildPreviewStats(words, mins);

        const rawParas = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
        const paras = rawParas.slice(0, 8);
        D.previewContent.innerHTML = '';

        if (paras.length === 0) {
            D.previewContent.innerHTML = '<p class="preview-empty">Nothing to preview yet…</p>';
            return;
        }

        paras.forEach(t => {
            const p = document.createElement('p');
            p.textContent = t.length > 380 ? t.slice(0, 380) + '…' : t;
            D.previewContent.appendChild(p);
        });

        if (rawParas.length > 8) {
            const el = document.createElement('p');
            el.className = 'preview-ellipsis'; el.textContent = '· · ·';
            D.previewContent.appendChild(el);
        }
        D.tabPreview.disabled = false;
    };

    const updatePreviewFromPaste = text => {
        const trimmed = text.trim();
        if (trimmed.length > 30) {
            showPreview(trimmed, 'Pasted Text', 'TXT');
            D.tabPreview.disabled = false;
            if (!D.tabPreview.classList.contains('active')) switchTab('preview');
        } else {
            D.tabPreview.disabled = true;
            D.previewContent.innerHTML = '<p class="preview-empty">Start typing or open a file to see a preview…</p>';
            D.previewStatsRow.innerHTML = ''; D.previewName.textContent = '—'; D.previewBadge.textContent = 'TXT';
            if (D.tabPreview.classList.contains('active')) switchTab('paste');
        }
    };

    const switchTab = mode => {
        const isPaste = mode === 'paste';
        D.tabPaste.classList.toggle('active', isPaste); D.tabPreview.classList.toggle('active', !isPaste);
        D.panePaste.classList.toggle('active', isPaste); D.panePreview.classList.toggle('active', !isPaste);
    };

    const processFile = async file => {
        const ext = file.name.split('.').pop().toLowerCase();
        const ab  = await file.arrayBuffer();
        let text = '', fmt = 'TXT';
        try {
            if (ext === 'epub')                  { fmt='EPUB'; text = await FileParser.parseEpub(ab); }
            else if (ext==='md'||ext==='markdown'){ fmt='MD';   text = FileParser.parseMd(ab); }
            else                                  {             text = FileParser.parseTxt(ab); }
        } catch(err) { Utils.showToast('Error: ' + err.message); return; }

        loadedText = text;
        if (text.length < 100000) { D.input.value = text; } 
        else { D.input.value = ''; D.input.placeholder = `[File loaded: ${file.name}]\n\nBook is too large to render in the editor. Click "Start Reading" to begin.`; }
        setWordCount(text);
        showPreview(text, file.name, fmt);
        D.tabPreview.disabled = false;
        switchTab('preview');
    };

    /* ── Render Modes ───────────────────────────────── */
    const renderScrollMode = blocks => {
        const frag = document.createDocumentFragment();
        blocks.forEach(b => frag.appendChild(Pagination.makeBlockEl(b)));
        D.content.innerHTML = ''; D.content.appendChild(frag);
    };

    const renderPage = (idx, direction) => {
        if (!pages.length) return;
        idx = Math.max(0, Math.min(pages.length - 1, idx));
        currentPage = idx;

        const frag = document.createDocumentFragment();
        pages[idx].forEach(b => frag.appendChild(Pagination.makeBlockEl(b)));

        D.pageText.innerHTML = ''; D.pageText.appendChild(frag);
        D.pageText.classList.remove('entering-fwd', 'entering-back');
        D.pageCanvas.scrollTop = 0;
        
        void D.pageText.offsetWidth;
        if (direction === 'fwd')  D.pageText.classList.add('entering-fwd');
        if (direction === 'back') D.pageText.classList.add('entering-back');

        D.pageNum.textContent   = (idx + 1).toString();
        D.pageTotal.textContent = ` / ${pages.length}`;
        D.pagePrevBtn.disabled  = idx === 0;
        D.pageNextBtn.disabled  = idx === pages.length - 1;

        updateProgress();
        Utils.Stor.set('novelPage', idx);
    };

    const enterPageMode = () => {
        pages = Pagination.buildPages(parsedBlocks, D.pageCanvas, S.fontSize);
        D.content.style.display = 'none';
        D.pageView.classList.add('active'); D.pageNav.classList.add('active'); D.reader.classList.add('page-mode');

        const savedPage = parseInt(Utils.Stor.get('novelPage')) || 0;
        renderPage(Math.min(savedPage, pages.length - 1), null);

        if (isDesktop) { D.pageKeyHint.classList.add('visible'); setTimeout(() => D.pageKeyHint.classList.remove('visible'), 3000); }
        document.body.style.overflow = 'hidden';
    };

    const exitPageMode = () => {
        D.content.style.display = '';
        D.pageView.classList.remove('active'); D.pageNav.classList.remove('active'); D.reader.classList.remove('page-mode');
        document.body.style.overflow = '';
        updateProgress();
    };

    const display = (text, startPage) => {
        parsedBlocks = Pagination.buildBlocks(text);

        if (S.pageMode) {
            D.content.style.display = 'none';
            renderScrollMode(parsedBlocks);
        } else {
            D.content.style.display = '';
            renderScrollMode(parsedBlocks);
        }

        D.landing.style.display = 'none'; D.reader.style.display  = 'block';
        document.body.classList.add('reading-mode');
        if (typeof CanvasAurora !== 'undefined') CanvasAurora.setReadingMode(true);
        toolbarVisible = false; D.toolbar.classList.remove('visible');

        if (S.pageMode) {
            pages = Pagination.buildPages(parsedBlocks, D.pageCanvas, S.fontSize);
            D.content.style.display = 'none'; D.pageView.classList.add('active'); D.pageNav.classList.add('active'); D.reader.classList.add('page-mode');
            document.body.style.overflow = 'hidden';

            const pg = (startPage !== undefined) ? startPage : (parseInt(Utils.Stor.get('novelPage')) || 0);
            currentPage = 0;
            renderPage(Math.min(pg, pages.length - 1), null);
            if (isDesktop) { D.pageKeyHint.classList.add('visible'); setTimeout(() => D.pageKeyHint.classList.remove('visible'), 3000); }
        } else {
            document.body.style.overflow = '';
            D.pageView.classList.remove('active'); D.pageNav.classList.remove('active'); D.reader.classList.remove('page-mode');
        }
        updateProgress(); applyAll();
    };

    const updateProgress = () => {
        if (S.pageMode && pages.length > 0) {
            const pct = pages.length > 1 ? (currentPage / (pages.length - 1)) * 100 : 100;
            D.progress.style.width = pct + '%';
        } else {
            const s = document.documentElement;
            D.progress.style.width = (s.scrollHeight - s.clientHeight > 0 ? (s.scrollTop / (s.scrollHeight - s.clientHeight)) * 100 : 0) + '%';
        }
    };

    /* ── Settings Application ───────────────────────── */
    const applyAll = () => {
        S.fontSize = Math.min(40, Math.max(14, S.fontSize));
        const html = document.documentElement;
        if (S.theme === 'ember') html.removeAttribute('data-theme');
        else html.setAttribute('data-theme', S.theme);

        if (typeof CanvasAurora !== 'undefined') CanvasAurora.sync();
        if (D.mastTagline) D.mastTagline.textContent = THEME_TAGLINES[S.theme] || THEME_TAGLINES.ember;

        const fontClass = FONT_CLASSES[S.font] || FONT_CLASSES.source;
        Object.values(FONT_CLASSES).forEach(c => { D.content.classList.remove(c); D.pageCanvas.classList.remove(c); });
        D.content.classList.add(fontClass); D.pageCanvas.classList.add(fontClass);
        D.content.style.fontSize   = S.fontSize + 'px'; D.pageCanvas.style.fontSize = S.fontSize + 'px';

        if (D.fszLabel) D.fszLabel.textContent = S.fontSize;
        if (D.panelFsz) D.panelFsz.textContent = S.fontSize;

        const lhClass = 'lh-' + (S.lineHeight || 'normal');
        D.content.classList.remove('lh-tight','lh-normal','lh-relaxed'); D.pageCanvas.classList.remove('lh-tight','lh-normal','lh-relaxed');
        D.content.classList.add(lhClass); D.pageCanvas.classList.add(lhClass);

        D.content.classList.toggle('wide', S.wide); D.pageCanvas.classList.toggle('wide', S.wide);
        D.widthBtn.classList.toggle('on', S.wide);
        if (D.wNarrow) D.wNarrow.classList.toggle('on', !S.wide);
        if (D.wWide)   D.wWide.classList.toggle('on',  S.wide);
        if (D.pageModeToggle) D.pageModeToggle.checked = S.pageMode;

        Utils.Stor.set('novelSettings', JSON.stringify(S));
    };

    const syncThemeUI = () => document.querySelectorAll('.theme-swatch').forEach(el => el.classList.toggle('active', el.dataset.theme === S.theme));
    const syncFontUI = () => document.querySelectorAll('.font-card').forEach(el => el.classList.toggle('active', el.dataset.font === S.font));
    const syncLineHeightUI = () => ['tight','normal','relaxed'].forEach(v => { const el = D['lh' + v.charAt(0).toUpperCase() + v.slice(1)]; if (el) el.classList.toggle('on', v === (S.lineHeight||'normal')); });

    const adjustFont = delta => {
        S.fontSize += delta * 2; applyAll();
        if (S.pageMode && parsedBlocks.length) {
            pages = Pagination.buildPages(parsedBlocks, D.pageCanvas, S.fontSize);
            renderPage(currentPage, null);
        }
    };

    const closeSettings = () => { settingsOpen = false; D.overlay.classList.remove('open'); D.panel.classList.remove('open'); if (lastFocusedElement?.focus) setTimeout(() => lastFocusedElement.focus(), 100); };

    /* ── Events & Binds ─────────────────────────────── */
    const showToolbar = () => { if (settingsOpen) return; toolbarVisible=true; D.toolbar.classList.add('visible'); };
    const hideToolbar = () => { if (settingsOpen) return; toolbarVisible=false; D.toolbar.classList.remove('visible'); };

    const bindProximity = () => {
        if (!isDesktop || !D.proximity) return;
        D.proximity.addEventListener('mouseenter', () => { if (D.reader.style.display !== 'block') return; proximityActive = true; showToolbar(); });
        D.proximity.addEventListener('mouseleave', () => { proximityActive = false; setTimeout(() => { if (!proximityActive && !D.toolbar.matches(':hover') && !settingsOpen) hideToolbar(); }, 600); });
        D.toolbar.addEventListener('mouseenter', () => { proximityActive = true; });
        D.toolbar.addEventListener('mouseleave', () => { proximityActive = false; setTimeout(() => { if (!proximityActive && !settingsOpen) hideToolbar(); }, 600); });
    };

    const bindDragDrop = () => {
        let dragCounter = 0;
        document.addEventListener('dragenter', e => { e.preventDefault(); for (const item of e.dataTransfer.items) { if (item.kind==='file') { dragCounter++; D.dropOverlay.classList.add('active'); return; } } });
        document.addEventListener('dragleave', () => { if (--dragCounter <= 0) { dragCounter=0; D.dropOverlay.classList.remove('active'); } });
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', async e => {
            e.preventDefault(); dragCounter=0; D.dropOverlay.classList.remove('active');
            const file = e.dataTransfer.files[0]; if (!file) return;
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['txt','epub','md','markdown'].includes(ext)) { Utils.showToast('Unsupported format. Use .txt, .epub, or .md'); return; }
            document.body.style.cursor = 'wait';
            try { await processFile(file); } finally { document.body.style.cursor = ''; }
        });
    };

    const bindEvents = () => {
        D.fileUpload.addEventListener('change', async e => {
            const f = e.target.files[0]; if (!f) return;
            document.body.style.cursor = 'wait';
            try { await processFile(f); } finally { document.body.style.cursor=''; e.target.value=''; }
        });

        D.input.addEventListener('input', e => {
            const text = e.target.value; if (text) loadedText = ''; setWordCount(text);
            clearTimeout(previewDebounceTimer); previewDebounceTimer = setTimeout(() => updatePreviewFromPaste(text), 250);
        });

        window.addEventListener('scroll', () => {
            if (D.reader.style.display !== 'block' || S.pageMode) return;
            if (!ticking) { window.requestAnimationFrame(() => { updateProgress(); ticking=false; }); ticking = true; }
            clearTimeout(scrollTimer); scrollTimer = setTimeout(() => Utils.Stor.set('novelScroll', window.scrollY), 150);
        }, { passive: true });

        if (!isDesktop) {
            D.reader.addEventListener('click', e => {
                if (window.getSelection().toString()) return;
                if (e.target.closest('#toolbar') || e.target.closest('#page-nav')) return;
                if (settingsOpen) { closeSettings(); return; }
                toolbarVisible = !toolbarVisible; D.toolbar.classList.toggle('visible', toolbarVisible);
            });
        }

        document.addEventListener('keydown', e => {
            if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
            if (e.key === 'Escape') { if (settingsOpen) { closeSettings(); return; } if (toolbarVisible) hideToolbar(); return; }
            if (settingsOpen && e.key === 'Tab') {
                const foc = D.panel.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
                if (!foc.length) return;
                const first=foc[0], last=foc[foc.length-1];
                if (e.shiftKey && document.activeElement===first) { last.focus(); e.preventDefault(); }
                else if (!e.shiftKey && document.activeElement===last) { first.focus(); e.preventDefault(); }
                return;
            }
            if (D.reader.style.display !== 'block' || settingsOpen) return;
            if (S.pageMode) {
                if (e.key==='ArrowRight'||e.key==='ArrowDown') { e.preventDefault(); App.pageNext(); }
                if (e.key==='ArrowLeft'||e.key==='ArrowUp')   { e.preventDefault(); App.pagePrev(); }
            } else {
                if (e.key==='[') adjustFont(-1);
                if (e.key===']') adjustFont(1);
            }
        });
    };

    const init = () => {
        const saved = Utils.Stor.get('novelText');
        if (saved) {
            D.continueBtn.style.display = 'inline-flex'; D.resetRow.style.display    = 'block';
            loadedText = saved;
            if (saved.length < 100000) { D.input.value = saved; updatePreviewFromPaste(saved); }
            else { D.input.placeholder = `[Previous session loaded]\n\nBook is too large to render in the editor. Click "Start Reading" or "Continue" to resume.`; }
            setWordCount(saved);
        }
        try { const savedSettings = JSON.parse(Utils.Stor.get('novelSettings') || '{}'); if (Object.keys(savedSettings).length) S = { ...S, ...savedSettings }; else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) S.theme = 'midnight'; } catch {}
        applyAll(); bindEvents(); bindProximity(); bindDragDrop();
    };

    return {
        init, switchTab, adjustFont, closeSettings,
        pageNext() { if (currentPage < pages.length - 1) renderPage(currentPage + 1, 'fwd'); },
        pagePrev() { if (currentPage > 0) renderPage(currentPage - 1, 'back'); },

        startReading() {
            let text = D.input.value.trim(); if (!text && loadedText) text = loadedText;
            if (!text) { D.input.focus(); return; }
            Utils.Stor.set('novelText', text); Utils.Stor.set('novelScroll', '0'); Utils.Stor.set('novelPage', '0');
            display(text, 0);
            if (!S.pageMode) window.scrollTo(0, 0);
            D.continueBtn.style.display = 'inline-flex'; D.resetRow.style.display = 'block';
        },

        loadSaved() {
            const text = Utils.Stor.get('novelText'); if (!text) return;
            if (S.pageMode) { const pg = parseInt(Utils.Stor.get('novelPage')) || 0; display(text, pg); }
            else { const pos = parseInt(Utils.Stor.get('novelScroll')) || 0; display(text); setTimeout(() => window.scrollTo(0, pos), 10); }
        },

        goBack() {
            D.landing.style.display = 'flex'; D.reader.style.display = 'none';
            document.body.classList.remove('reading-mode'); if (typeof CanvasAurora !== 'undefined') CanvasAurora.setReadingMode(false);
            D.progress.style.width = '0%'; document.body.style.overflow = '';
            D.pageView.classList.remove('active'); D.pageNav.classList.remove('active'); D.reader.classList.remove('page-mode');
            closeSettings(); window.scrollTo(0, 0);
        },

        async clearAll() {
            if (await Utils.showConfirm('Erase all saved text and progress?')) { Utils.Stor.clearBook(); location.reload(); }
        },

        setTheme(name)  { S.theme = name; applyAll(); syncThemeUI(); },
        setFont(name)   { S.font  = name; applyAll(); syncFontUI(); },
        toggleWidth()   { S.wide = !S.wide; applyAll(); },
        setWidth(mode)  { S.wide = (mode==='wide'); applyAll(); },
        setLineHeight(v){ S.lineHeight = v; applyAll(); syncLineHeightUI(); },

        setPageMode(enabled) {
            S.pageMode = enabled; applyAll();
            if (D.reader.style.display === 'block') {
                if (enabled) { enterPageMode(); }
                else {
                    exitPageMode();
                    if (pages.length && currentPage > 0) {
                        const approxPct = currentPage / Math.max(pages.length - 1, 1);
                        const s = document.documentElement;
                        setTimeout(() => window.scrollTo(0, approxPct * (s.scrollHeight - s.clientHeight)), 50);
                    }
                }
            }
        },

        openSettings() {
            lastFocusedElement = document.activeElement; settingsOpen = true;
            syncThemeUI(); syncFontUI(); syncLineHeightUI();
            D.overlay.classList.add('open'); D.panel.classList.add('open');
            setTimeout(() => { const first = D.panel.querySelector('.panel-handle,button'); if (first) first.focus(); }, 100);
        }
    };
})();