import { partName, partsSummary } from './music/ms2-parts.js';
const bridge = window.mml;
const el = (id) => document.getElementById(id);
let data = { name: '', channels: [], bytes: 0, warnings: [], stale: false }, selected = 0;
function render() {
    el('mml-title').textContent = data.name + ' · MS2 code';
    el('mml-summary').textContent = `MS2 code: ${data.bytes} characters · ${partsSummary(data.channels.length)}${data.stale ? ' · Out of date — use Update code in the editor' : ''}`;
    el('mml-warning').textContent = data.warnings.join(' ');
    el('mml-copy-status').textContent = '';
    selected = Math.min(selected, Math.max(0, data.channels.length - 1));
    el('mml-tabs').replaceChildren();
    data.channels.forEach((text, index) => { const tab = document.createElement('button'); tab.textContent = `${partName(index)} · ${text.length} characters`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(index === selected)); tab.classList.toggle('active', index === selected); tab.onclick = () => { selected = index; render(); }; el('mml-tabs').append(tab); });
    el('mml-text').value = data.channels[selected] ?? '';
    el('mml-copy').disabled = !data.channels.length;
}
bridge.onData((next) => { if (next.name !== data.name)
    selected = 0; data = next; render(); });
bridge.ready();
el('mml-copy').onclick = async () => { try {
    await bridge.copy(data.channels[selected] ?? '');
    el('mml-copy-status').textContent = 'Copied channel to clipboard.';
}
catch {
    el('mml-copy-status').textContent = 'Copy failed. Select the text and copy manually.';
} };
