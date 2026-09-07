import { $ } from './dom.js';
export function installChrome() {
    const menus = [$('file-menu'), $('theme-menu'), $('export-menu')];
    document.onclick = event => {
        const target = event.target;
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
