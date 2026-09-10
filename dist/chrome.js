import { $ } from './dom.js';
export function installChrome() {
    // Chromium's blocking JavaScript dialogs can leave Electron's renderer
    // without keyboard focus on Windows. Keep confirmation behavior native.
    const nativeDialogs = window.nativeDialogs;
    if (nativeDialogs)
        window.confirm = message => nativeDialogs.confirm(String(message));
    const appInfo = window.appInfo;
    if (appInfo)
        void appInfo.version().then((version) => { if (typeof version === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version))
            $('app-version').textContent = 'v' + version; });
    const menus = [$('file-menu'), $('theme-menu'), $('tools-menu'), $('section-menu'), $('playback-menu')];
    document.onclick = event => {
        const target = event.target;
        // Our select lists are appended to <body>, so a click in one is not outside its menu.
        if (target.closest('.select-panel'))
            return;
        const button = target.closest('button');
        // Keep the scale estimate visible after its read-only calculation.
        for (const menu of menus)
            if (!menu.contains(target) || button && button.id !== 'detect-scale')
                menu.open = false;
    };
    document.onkeyup = event => { if (event.key === 'Escape')
        for (const menu of menus) {
            if (menu.open) {
                menu.open = false;
                menu.querySelector('summary')?.focus();
            }
        } };
}
