const Pagination = (() => {
    const isPoetryBlock = rawParagraph => {
        const lines = rawParagraph.split(/\r?\n/);
        if (lines.length < 2) return false;
        const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
        const shortLines = lines.filter(l => l.trim().length <= 72).length;
        return avgLen <= 60 && shortLines / lines.length >= 0.75;
    };

    const buildBlocks = text => {
        const blocks = [];
        let firstTextParaApplied = false;

        text.split(/\r?\n\s*\r?\n/).forEach(raw => {
            const t = raw.trim();
            if (!t) return;

            if (/^[\-\*\u2014\u2015\s]{3,}$/.test(t)) {
                blocks.push({ type: 'break' });
                return;
            }

            if (t.includes('\n') && isPoetryBlock(t)) {
                const lines = t.split(/\r?\n/);
                lines.forEach((line, i) => {
                    const lt = line.trim();
                    if (!lt) { blocks.push({ type: 'verse-spacer' }); return; }
                    blocks.push({ type: 'verse', text: lt, stanzaStart: i === 0 });
                });
                return;
            }

            let isFirstPara = false;
            if (!firstTextParaApplied) {
                const isAllCaps     = t === t.toUpperCase() && /\p{L}/u.test(t);
                const isHeadingWord = /^(chapter|chap|book|part|prologue|epilogue|section|act|scene)\b/i.test(t);
                const hasPunct      = /[.!?"'"'»]$/.test(t);
                const isLikelyTitle = isAllCaps || isHeadingWord || (!hasPunct && t.length < 150);
                if (!isLikelyTitle && t.length > 15) {
                    isFirstPara = true;
                    firstTextParaApplied = true;
                }
            }
            blocks.push({ type: 'para', text: t, isFirstPara });
        });
        return blocks;
    };

    const makeBlockEl = block => {
        if (block.type === 'break') {
            const el = document.createElement('p');
            el.className = 'chap-break';
            el.setAttribute('aria-hidden', 'true');
            el.textContent = '— ✦ —';
            return el;
        }
        if (block.type === 'verse') {
            const el = document.createElement('p');
            el.className = 'verse-line';
            if (block.stanzaStart) el.classList.add('stanza-start');
            el.textContent = block.text;
            return el;
        }
        if (block.type === 'verse-spacer') {
            const el = document.createElement('p');
            el.className = 'verse-spacer';
            el.setAttribute('aria-hidden', 'true');
            return el;
        }
        const el = document.createElement('p');
        el.textContent = block.text;
        if (block.isFirstPara) el.classList.add('first-paragraph');
        return el;
    };

    const buildPages = (blocks, pageCanvas, fontSize) => {
        const canvasStyle = window.getComputedStyle(pageCanvas);
        const paddingTop    = parseFloat(canvasStyle.paddingTop)    || 0;
        const paddingBottom = parseFloat(canvasStyle.paddingBottom) || 0;
        const availableHeight = window.innerHeight - paddingTop - paddingBottom - 4;

        const paraSpacing = fontSize * 1.7;
        const canvasWidth = pageCanvas.clientWidth - parseFloat(canvasStyle.paddingLeft || 0) - parseFloat(canvasStyle.paddingRight || 0);

        const measureEl = document.createElement('div');
        measureEl.style.cssText = `
            position: absolute; top: -9999px; left: 0; visibility: hidden; pointer-events: none;
            width: ${canvasWidth}px; font-family: ${canvasStyle.fontFamily};
            font-size: ${fontSize}px; line-height: ${canvasStyle.lineHeight};
        `;
        document.body.appendChild(measureEl);

        const pages = [];
        let currentPageBlocks = [];
        let currentHeight = 0;

        blocks.forEach(block => {
            const blockEl = makeBlockEl(block);
            measureEl.innerHTML = ''; measureEl.appendChild(blockEl);
            const blockHeight = blockEl.offsetHeight;

            const spacingToAdd = currentPageBlocks.length > 0 ? paraSpacing : 0;
            const totalHeightWithBlock = currentHeight + spacingToAdd + blockHeight;

            if (totalHeightWithBlock > availableHeight && currentPageBlocks.length > 0) {
                if (block.type === 'para' && blockHeight > (availableHeight - currentHeight) * 0.7) {
                    const words = block.text.split(' ');
                    let left = 0, right = words.length, bestSplit = Math.floor(words.length * 0.5);

                    while (left < right) {
                        const mid = Math.floor((left + right) / 2);
                        const testEl = document.createElement('p');
                        testEl.textContent = words.slice(0, mid).join(' ');
                        if (block.isFirstPara) testEl.classList.add('first-paragraph');
                        measureEl.innerHTML = ''; measureEl.appendChild(testEl);
                        
                        if (testEl.offsetHeight <= availableHeight - currentHeight - spacingToAdd) {
                            bestSplit = mid; left = mid + 1;
                        } else { right = mid; }
                    }

                    const firstPart = words.slice(0, bestSplit).join(' ');
                    const secondPart = words.slice(bestSplit).join(' ');
                    
                    const lastCharFirst = firstPart[firstPart.length - 1];
                    const firstCharSecond = secondPart[0];
                    const isMidWord = lastCharFirst && firstCharSecond && !/\s/.test(lastCharFirst) && !/\s/.test(firstCharSecond) && firstPart.length > 0 && secondPart.length > 0;

                    let finalFirstPart = firstPart, finalSecondPart = secondPart;

                    if (isMidWord) {
                        const lastSpace = firstPart.lastIndexOf(' ');
                        if (lastSpace > firstPart.length * 0.3) {
                            finalFirstPart = firstPart.substring(0, lastSpace) + '-';
                            finalSecondPart = firstPart.substring(lastSpace + 1) + ' ' + secondPart;
                        } else { finalFirstPart = firstPart + '-'; }
                    }

                    currentPageBlocks.push({ type: 'para', text: finalFirstPart, isFirstPara: block.isFirstPara });
                    pages.push(currentPageBlocks);
                    currentPageBlocks = [{ type: 'para', text: finalSecondPart, isFirstPara: false }];
                    
                    const newEl = document.createElement('p');
                    newEl.textContent = finalSecondPart;
                    measureEl.innerHTML = ''; measureEl.appendChild(newEl);
                    currentHeight = newEl.offsetHeight;
                } else {
                    pages.push(currentPageBlocks);
                    currentPageBlocks = [block];
                    currentHeight = blockHeight;
                }
            } else {
                currentPageBlocks.push(block);
                currentHeight += spacingToAdd + blockHeight;
            }
        });

        if (currentPageBlocks.length > 0) pages.push(currentPageBlocks);
        document.body.removeChild(measureEl);
        return pages;
    };

    return { buildBlocks, makeBlockEl, buildPages };
})();