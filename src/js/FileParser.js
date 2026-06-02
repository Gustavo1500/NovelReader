const FileParser = (() => {
    const parseTxt = ab => new TextDecoder('utf-8').decode(ab);

    const parseMd = ab => {
        let text = new TextDecoder('utf-8').decode(ab);
        return text
            .replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n')
            .replace(/(?:\*\*|__)(.*?)(?:\*\*|__)/g, '$1')
            .replace(/(?:\*|_)(.*?)(?:\*|_)/g, '$1')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
            .replace(/^>+\s?/gm, '')
            .replace(/^[-*_]{3,}$/gm, '\n---\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    const parseEpub = async ab => {
        const bytes = new Uint8Array(ab);
        const readU16LE = (b,o) => b[o] | (b[o+1]<<8);
        const readU32LE = (b,o) => (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;

        if (bytes.length < 22) throw new Error('Not a valid EPUB/ZIP');
        let eocd = -1;
        const minSearch = Math.max(0, bytes.length - 65558);
        for (let i = bytes.length-22; i >= minSearch; i--) {
            if (bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06) { eocd=i; break; }
        }
        if (eocd < 0) throw new Error('Not a valid EPUB/ZIP');

        const cdOffset = readU32LE(bytes, eocd+16);
        const cdSize   = readU32LE(bytes, eocd+12);
        const entries  = {};

        let pos = cdOffset;
        while (pos < cdOffset + cdSize) {
            if (readU32LE(bytes, pos) !== 0x02014b50) break;
            const compMethod  = readU16LE(bytes, pos+10);
            const compSize    = readU32LE(bytes, pos+20);
            const fnLen       = readU16LE(bytes, pos+28);
            const extraLen    = readU16LE(bytes, pos+30);
            const commentLen  = readU16LE(bytes, pos+32);
            const localOffset = readU32LE(bytes, pos+42);
            const fname       = new TextDecoder('utf-8').decode(bytes.subarray(pos+46, pos+46+fnLen));
            entries[fname]    = { compMethod, compSize, localOffset };
            pos += 46 + fnLen + extraLen + commentLen;
        }

        const decompress = async name => {
            const e = entries[name];
            if (!e) return null;
            const lh = e.localOffset;
            const fnLen2    = readU16LE(bytes, lh+26);
            const extraLen2 = readU16LE(bytes, lh+28);
            const dataStart = lh + 30 + fnLen2 + extraLen2;
            const raw = bytes.subarray(dataStart, dataStart + e.compSize);
            if (e.compMethod === 0) return new TextDecoder('utf-8').decode(raw);
            try {
                const ds = new DecompressionStream('deflate-raw');
                return await new Response(new Blob([raw]).stream().pipeThrough(ds)).text();
            } catch { return null; }
        };

        const containerXml = await decompress('META-INF/container.xml');
        if (!containerXml) throw new Error('Cannot read EPUB container');
        const opfMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
        if (!opfMatch) throw new Error('Cannot find OPF in EPUB');
        const opfPath = opfMatch[1];
        const opfDir  = opfPath.includes('/') ? opfPath.replace(/\/[^/]+$/, '/') : '';
        const opfXml  = await decompress(opfPath);
        if (!opfXml) throw new Error('Cannot read OPF file');

        const xmlDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
        if (xmlDoc.querySelector('parsererror')) throw new Error('Invalid OPF XML format');

        const getElems = (doc, tag) => {
            const res = []; const walk = n => {
                if (n.localName === tag || n.nodeName === tag) res.push(n);
                for (let i=0;i<n.childNodes.length;i++) walk(n.childNodes[i]);
            };
            if (doc.documentElement) walk(doc.documentElement);
            return res;
        };

        const manifest = {};
        for (const item of getElems(xmlDoc, 'item')) {
            const id = item.getAttribute('id'), href = item.getAttribute('href'), mt = (item.getAttribute('media-type')||'').toLowerCase();
            if (id && href && (mt==='application/xhtml+xml'||mt==='text/html'||mt==='text/x-oeb1-document'))
                manifest[id] = href;
        }

        const spine = [];
        for (const ref of getElems(xmlDoc, 'itemref')) {
            const idref = ref.getAttribute('idref');
            if (idref && manifest[idref]) {
                const parts = (opfDir + decodeURIComponent(manifest[idref])).split('/');
                const res = [];
                for (const p of parts) { if (p==='..') res.pop(); else if (p!=='.'&&p!=='') res.push(p); }
                spine.push(res.join('/'));
            }
        }
        if (!spine.length) throw new Error('Empty EPUB reading spine');

        const parts = [];
        for (const href of spine) {
            const html = await decompress(href);
            if (html) { const t = Utils.stripHtml(html); if (t.length > 80) parts.push(t); }
        }
        if (!parts.length) throw new Error('No readable text content found in EPUB');
        return parts.join('\n\n');
    };

    return { parseTxt, parseMd, parseEpub };
})();