import { $ } from './dom.js';
import { draw } from './painting.js';
export const palette = { gridA: '#e5f1fa', gridB: '#deedf8', row: '#275d8010', octave: '#387ba447', cRow: '#398bce16', bar: '#3e789760', beat: '#3c73951c', ruler: '#c8dfef', text: '#284d68', keyDark: '#3f4144', keyLight: '#ffffff', keyLine: '#c9ced2', corner: '#b7d3e7', background: '#deedf8', playhead: '#1689dc', loop: '#e0a20016', loopBar: '#e0a200', pianoWhite: '#ffffff', pianoBlack: '#2b3238', pianoLine: '#b7c4cd', pianoLabel: '#5d7382' };
export const keyboardView = { piano: false };
const sky = { ...palette };
const night = { gridA: '#171717', gridB: '#1b1b1b', row: '#ffffff08', octave: '#ffffff25', cRow: '#5b9cda18', bar: '#ffffff38', beat: '#ffffff12', ruler: '#252525', text: '#dddddd', keyDark: '#111111', keyLight: '#bfbfbf', keyLine: '#2a2a2a', corner: '#202020', background: '#171717', playhead: '#eeeeee', loop: '#ffcc6614', loopBar: '#ffcc66', pianoWhite: '#bfbfbf', pianoBlack: '#101010', pianoLine: '#8f8f8f', pianoLabel: '#3d3d3d' };
const key = 'mml-studio-workspace-v1';
export function installAppearance() {
    if (!document.documentElement)
        return;
    const main = $('workspace'), left = $('left-divider'), right = $('right-divider');
    // The native popup is painted by the browser and ignores page CSS, so selects get our own list.
    let closeOpenList = null, openOwner = null;
    const decorateSelect = (select) => {
        if (select.parentElement?.classList.contains('select-control'))
            return;
        const shell = document.createElement('span'), chevron = document.createElement('span');
        shell.className = 'select-control';
        chevron.className = 'select-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        select.replaceWith(shell);
        shell.append(select, chevron);
        let panel = null, items = [], active = -1, typed = '', typedTimer;
        // Options read "12. Vibraphone", so type-ahead has to match the name, not the number.
        const label = (option) => (option.textContent ?? '').replace(/^\s*\d+\.\s*/, '').toLowerCase();
        // A select may hold only its current value until it is used: fill it before reading it.
        const fill = () => { select.fillOptions?.(); };
        select.addEventListener('focus', fill);
        const visibleOptions = () => { fill(); return [...select.options].filter(option => !option.hidden); };
        const close = () => { panel?.remove(); panel = null; items = []; active = -1; typed = ''; shell.classList.remove('open'); if (closeOpenList === close) {
            closeOpenList = null;
            openOwner = null;
        } };
        const highlight = (index) => {
            if (!panel || index < 0 || index >= items.length)
                return;
            items[active]?.classList.remove('current');
            active = index;
            const item = items[index];
            item.classList.add('current');
            if (item.offsetTop < panel.scrollTop)
                panel.scrollTop = item.offsetTop - 4;
            else if (item.offsetTop + item.offsetHeight > panel.scrollTop + panel.clientHeight)
                panel.scrollTop = item.offsetTop + item.offsetHeight - panel.clientHeight + 4;
        };
        const typeAhead = (character) => {
            window.clearTimeout(typedTimer);
            typedTimer = window.setTimeout(() => { typed = ''; }, 900);
            typed += character.toLowerCase();
            const options = visibleOptions();
            let found = options.findIndex(option => label(option).startsWith(typed));
            // A dead end usually means a new word was started rather than a typo.
            if (found < 0 && typed.length > 1) {
                typed = character.toLowerCase();
                found = options.findIndex(option => label(option).startsWith(typed));
            }
            if (found < 0)
                found = options.findIndex(option => label(option).includes(typed));
            highlight(found);
        };
        const open = () => {
            if (panel) {
                close();
                return;
            }
            closeOpenList?.();
            panel = document.createElement('div');
            panel.className = 'menu-panel select-panel';
            panel.onpointerdown = e => e.preventDefault();
            items = visibleOptions().map(option => {
                const item = document.createElement('button');
                item.type = 'button';
                item.textContent = option.textContent;
                item.disabled = option.disabled;
                if (option.title)
                    item.title = option.title;
                item.classList.toggle('preset-warning', option.classList.contains('preset-warning'));
                item.onclick = () => { const changed = select.value !== option.value; select.value = option.value; close(); select.focus({ preventScroll: true }); if (changed)
                    select.dispatchEvent(new Event('change', { bubbles: true })); };
                panel.append(item);
                return item;
            });
            document.body.append(panel);
            shell.classList.add('open');
            closeOpenList = close;
            openOwner = shell;
            const box = select.getBoundingClientRect();
            panel.style.minWidth = box.width + 'px';
            panel.style.maxWidth = Math.round(innerWidth - 16) + 'px';
            const below = innerHeight - box.bottom - 14, above = box.top - 14, full = panel.offsetHeight;
            const height = Math.min(full, Math.max(below, above));
            panel.style.maxHeight = height + 'px';
            panel.style.left = Math.round(Math.max(8, Math.min(box.left, innerWidth - panel.offsetWidth - 8))) + 'px';
            panel.style.top = Math.round(below >= height ? box.bottom + 4 : box.top - height - 4) + 'px';
            const chosen = visibleOptions().findIndex(option => option.value === select.value);
            items[chosen]?.classList.add('current');
            active = chosen;
            if (height < full && items[chosen])
                panel.scrollTop = Math.max(0, items[chosen].offsetTop - height / 2);
            select.focus({ preventScroll: true });
        };
        select.addEventListener('pointerdown', e => { e.preventDefault(); open(); });
        select.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                close();
                return;
            }
            if (!panel) {
                if (e.key === 'Enter' || e.key === ' ' || (e.key === 'ArrowDown' && e.altKey)) {
                    e.preventDefault();
                    open();
                }
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                highlight(Math.max(0, Math.min(items.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1))));
                return;
            }
            if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                highlight(e.key === 'Home' ? 0 : items.length - 1);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                items[active]?.click();
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                typeAhead(e.key);
            }
        });
    };
    document.addEventListener('pointerdown', e => { const target = e.target; if (!target?.closest?.('.select-control') && !target?.closest?.('.select-panel'))
        closeOpenList?.(); }, true);
    // Only a scroll that moves the select detaches the fixed panel from it. The roll scrolls
    // constantly while following playback, and must not close a list in the toolbar.
    document.addEventListener('scroll', e => { const target = e.target; if (openOwner && target?.contains?.(openOwner))
        closeOpenList?.(); }, true);
    window.addEventListener('resize', () => closeOpenList?.());
    window.addEventListener('keydown', e => { if (e.key === 'Escape')
        closeOpenList?.(); });
    document.querySelectorAll('select').forEach(select => decorateSelect(select));
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (!(node instanceof Element))
        return; if (node.matches('select'))
        decorateSelect(node); node.querySelectorAll('select').forEach(select => decorateSelect(select)); }))).observe(document.body, { childList: true, subtree: true });
    let settings = { theme: 'sky', left: 264, right: 234, leftHidden: false, rightHidden: false, piano: false };
    try {
        const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (saved) {
            if (['sky', 'night'].includes(saved.theme))
                settings.theme = saved.theme;
            for (const side of ['left', 'right']) {
                if (Number.isFinite(saved[side]))
                    settings[side] = Math.max(180, Math.min(480, saved[side]));
            }
            settings.leftHidden = saved.leftHidden === true;
            settings.rightHidden = saved.rightHidden === true;
            settings.piano = saved.piano === true;
        }
    }
    catch { }
    const save = () => { try {
        localStorage.setItem(key, JSON.stringify(settings));
    }
    catch { } };
    const fit = () => {
        let l = settings.leftHidden ? 0 : settings.left, r = settings.rightHidden ? 0 : settings.right;
        const available = Math.max(0, main.clientWidth - 340 - 12), sum = l + r;
        if (sum > available) {
            const baseL = l ? 180 : 0, baseR = r ? 180 : 0, extra = Math.max(0, available - baseL - baseR), wanted = Math.max(1, sum - baseL - baseR);
            l = baseL + Math.floor((l - baseL) * extra / wanted);
            r = baseR + Math.floor((r - baseR) * extra / wanted);
        }
        main.style.gridTemplateColumns = `${l}px ${l ? 6 : 0}px minmax(0,1fr) ${r ? 6 : 0}px ${r}px`;
        $('track-panel').hidden = settings.leftHidden;
        $('note-properties').hidden = settings.rightHidden;
        for (const [side, handle, width] of [['left', left, l], ['right', right, r]]) {
            handle.dataset.collapsed = String(!width);
            handle.setAttribute('aria-valuenow', String(width));
            handle.setAttribute('aria-valuemax', String(Math.max(180, main.clientWidth - 340 - 12 - (side === 'left' ? r : l))));
            $('toggle-' + side).setAttribute('aria-pressed', String(!settings[side + 'Hidden']));
        }
    };
    // Dragging a panel most of the way shut closes it; dragging back out reopens it.
    const COLLAPSE = 120;
    const themeLabels = { sky: 'Sky', night: 'Night' };
    const theme = () => {
        document.documentElement.dataset.theme = settings.theme;
        Object.assign(palette, settings.theme === 'night' ? night : sky);
        $('theme-menu-label').textContent = themeLabels[settings.theme];
        document.querySelectorAll('#theme-menu .theme-option').forEach(btn => btn.setAttribute('aria-current', String(btn.dataset.theme === settings.theme)));
        draw();
    };
    document.querySelectorAll('#theme-menu .theme-option').forEach(btn => { btn.onclick = () => { settings.theme = btn.dataset.theme; theme(); save(); }; });
    for (const [side, handle] of [['left', left], ['right', right]]) {
        const hidden = side === 'left' ? 'leftHidden' : 'rightHidden', other = side === 'left' ? 'right' : 'left', otherHidden = side === 'left' ? 'rightHidden' : 'leftHidden';
        const clamp = (value) => Math.max(180, Math.min(value, 480, main.clientWidth - 340 - 12 - (settings[otherHidden] ? 0 : $(other === 'left' ? 'track-panel' : 'note-properties').getBoundingClientRect().width)));
        let drag = null;
        handle.onpointerdown = e => { if (e.button !== 0)
            return; e.preventDefault(); drag = { x: e.clientX, width: settings[hidden] ? 0 : $(side === 'left' ? 'track-panel' : 'note-properties').getBoundingClientRect().width, preferred: settings[side], hidden: settings[hidden] }; handle.setPointerCapture(e.pointerId); document.documentElement.classList.add('resizing'); fit(); };
        handle.onpointermove = e => { if (!drag)
            return; const raw = drag.width + (e.clientX - drag.x) * (side === 'left' ? 1 : -1); settings[hidden] = raw < COLLAPSE; if (raw >= COLLAPSE)
            settings[side] = clamp(raw); fit(); };
        const finish = (cancel = false) => { if (!drag)
            return; if (cancel) {
            settings[side] = drag.preferred;
            settings[hidden] = drag.hidden;
        } drag = null; document.documentElement.classList.remove('resizing'); fit(); save(); };
        handle.onpointerup = () => finish();
        handle.onpointercancel = () => finish(true);
        handle.onlostpointercapture = () => finish();
        handle.ondblclick = () => { settings[side] = side === 'left' ? 264 : 234; settings[hidden] = false; fit(); save(); };
        handle.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            settings[hidden] = false;
            settings[side] = clamp(settings[side] + (e.key === 'ArrowRight' ? 16 : -16) * (side === 'left' ? 1 : -1));
            fit();
            save();
        } if (e.key === 'Escape')
            finish(true); };
        $('toggle-' + side).onclick = () => { settings[hidden] = !settings[hidden]; fit(); save(); };
    }
    // Only the painting changes: pitch rows, hit testing and previews are the same either way.
    const keys = () => {
        keyboardView.piano = settings.piano;
        const button = $('key-style');
        button.setAttribute('aria-pressed', String(settings.piano));
        button.title = settings.piano ? 'Show the keys as note names' : 'Show the keys as a piano';
        draw();
    };
    $('key-style').onclick = () => { settings.piano = !settings.piano; keys(); save(); };
    // The playback button moved to the left of the toolbar, so its panel opens rightwards.
    // In a narrow editor that would reach over the inspector, so it is pulled back to fit.
    const playback = $('playback-menu');
    const playbackPanel = playback.querySelector('.playback-panel');
    const placePlayback = () => {
        playbackPanel.style.left = '';
        const editor = $('view').parentElement.parentElement.getBoundingClientRect(), box = playbackPanel.getBoundingClientRect();
        const over = box.right - (editor.right - 8), room = box.left - editor.left - 8;
        if (over > 0 && room > 0)
            playbackPanel.style.left = `${-Math.min(over, room)}px`;
    };
    // An open panel has to be placed again when the window changes, not only when it opens.
    playback.addEventListener('toggle', placePlayback);
    const layout = () => { fit(); placePlayback(); };
    theme();
    keys();
    layout();
    new ResizeObserver(layout).observe(main);
}
