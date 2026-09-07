import { $ } from './dom.js';
export function installChrome() {
    // Chromium's blocking JavaScript dialogs can leave Electron's renderer
    // without keyboard focus on Windows. Keep confirmation behavior native.
    const nativeDialogs = window.nativeDialogs;
    if (nativeDialogs)
        window.confirm = message => nativeDialogs.confirm(String(message));
    const menus = [$('file-menu'), $('theme-menu'), $('export-menu'), $('tools-menu')];
    document.onclick = event => {
        const target = event.target;
        // Our select lists are appended to <body>, so a click in one is not outside its menu.
        if (target.closest('.select-panel'))
            return;
        for (const menu of menus)
            if (!menu.contains(target) || target.closest('button'))
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
