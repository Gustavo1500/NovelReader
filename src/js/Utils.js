const Utils = (() => {
    const Stor = {
        get:   k    => { try { return localStorage.getItem(k); } catch { return null; } },
        set:   (k,v)=> {
            try { localStorage.setItem(k,v); }
            catch { if (k === 'novelText') showToast('Book too large for local storage. Progress may be lost on refresh.'); }
        },
        clearBook: () => {
            try { localStorage.removeItem('novelText'); localStorage.removeItem('novelScroll'); localStorage.removeItem('novelPage'); } catch {}
        },
    };

    const showToast = msg => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    const showConfirm = msg => new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;animation:readerIn 0.2s ease;`;
        const box = document.createElement('div');
        box.style.cssText = `background:var(--bg-mid);border:1px solid var(--surface-border);padding:28px;border-radius:16px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);text-align:center;`;
        const text = document.createElement('p');
        text.textContent = msg;
        text.style.cssText = `color:var(--text-hi);font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.5;margin-bottom:24px;`;
        const btnRow = document.createElement('div');
        btnRow.style.cssText = `display:flex;gap:12px;justify-content:center;`;
        
        const cleanup = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            setTimeout(() => overlay.remove(), 200);
            if (escHandler) document.removeEventListener('keydown', escHandler);
        };

        const btnYes = document.createElement('button');
        btnYes.textContent = 'Confirm';
        btnYes.className = 'btn btn-primary';
        btnYes.style.cssText = `flex:1;margin:0;`;
        btnYes.onclick = () => { cleanup(); resolve(true); };
        
        const btnNo = document.createElement('button');
        btnNo.textContent = 'Cancel';
        btnNo.className = 'btn btn-secondary';
        btnNo.style.cssText = `flex:1;margin:0;`;
        btnNo.onclick = () => { cleanup(); resolve(false); };
        
        btnRow.append(btnNo, btnYes);
        box.append(text, btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        btnYes.focus();
        
        let escHandler = e => { if (e.key === 'Escape') { cleanup(); resolve(false); } };
        document.addEventListener('keydown', escHandler);
        overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); resolve(false); } });
    });

    const getTextStats = text => {
        const clean = (text || '').trim();
        const words = clean.length < 5 ? 0 : clean.split(/\s+/).filter(Boolean).length;
        const mins  = Math.ceil(words / 238);
        return { words, mins };
    };

    const formatReadTime = mins => {
        if (mins < 2)  return '~1 min';
        if (mins < 60) return `~${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
    };

    const stripHtml = html => {
        html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
        html = html.replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>/gi, '\n\n</$1>');
        html = html.replace(/<br\s*\/?>/gi, '\n');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let text = doc.body ? doc.body.textContent : '';
        return text.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    };

    return { Stor, showToast, showConfirm, getTextStats, formatReadTime, stripHtml };
})();