import { state, instrumentView } from './state.js';
import { generateMml } from './music/mml.js';
import { tempoMap } from './music/tempo.js';
const entries = new Map();
let epoch = instrumentView.mmlEpoch;
let previous, count = -1, revision = 0, buckets = new Map(), tempos = [];
let sentResult, sentStale, sentName = '';
let opened;
function entry(i) { let e = entries.get(i); if (!e) {
    e = { live: true, revision: -1 };
    entries.set(i, e);
} return e; }
function payload(i, e) { return { name: i.name, ...e.result, stale: e.revision !== revision }; }
function publish(i, e, index) {
    if (e.label)
        e.label.textContent = `Instrument character count: ${e.result?.bytes ?? '—'} bytes · ${e.result?.channels.length ?? '—'} Channels${e.revision !== revision ? ' · Out of date' : ''}`;
    if (e.warning) {
        const text = e.result?.warnings.join(' ') ?? '';
        e.warning.setAttribute('data-message', text);
        e.warning.hidden = !text;
        e.warning.setAttribute('aria-label', text);
    }
    if (opened === index && (sentResult !== e.result || sentStale !== (e.revision !== revision) || sentName !== i.name)) {
        sentResult = e.result;
        sentStale = e.revision !== revision;
        sentName = i.name;
        void window.mml?.update(payload(i, e));
    }
}
function generate(index, e) { e.result = generateMml(state.project, index, buckets.get(index) ?? [], tempos); e.revision = revision; }
function reset() { if (epoch !== instrumentView.mmlEpoch) {
    epoch = instrumentView.mmlEpoch;
    entries.clear();
    opened = undefined;
    void window.mml?.update({ name: 'Project changed — reopen MML', channels: [], bytes: 0, warnings: [], stale: true });
} }
export function updateMml(force = false) {
    reset();
    const changed = force || previous !== state.project.notes || count !== state.project.notes.length;
    if (changed) {
        previous = state.project.notes;
        count = previous.length;
        revision++;
        buckets = new Map();
        tempos = [];
    }
    // With every lane paused, editing does no sorting or string generation.
    const needed = state.project.instruments.some((i, index) => entry(index).live && entry(index).revision !== revision);
    if (needed && tempos.length === 0) {
        tempos = tempoMap(state.project.notes);
        state.project.notes.forEach(n => { if (!buckets.has(n.instrument))
            buckets.set(n.instrument, []); buckets.get(n.instrument).push(n); });
    }
    state.project.instruments.forEach((i, index) => { const e = entry(index); if (e.live && e.revision !== revision)
        generate(index, e); publish(i, e, index); });
    if (opened !== undefined && !state.project.instruments[opened]) {
        opened = undefined;
        void window.mml?.update({ name: 'Project changed — reopen MML', channels: [], bytes: 0, warnings: [], stale: true });
    }
}
export function mmlControls(row, body, index) {
    reset();
    const i = state.project.instruments[index], e = entry(index), box = document.createElement('div');
    box.className = 'instrument-mml';
    e.label = document.createElement('small');
    // A marker, not a control: it says what is wrong on hover and does nothing when clicked.
    e.warning = document.createElement('span');
    e.warning.className = 'instrument-warning';
    e.warning.setAttribute('role', 'img');
    e.warning.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
    const label = document.createElement('label'), toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = e.live;
    toggle.onchange = () => { e.live = toggle.checked; updateMml(); };
    const caption = document.createElement('span');
    caption.textContent = 'Real time updating';
    label.append(toggle, caption);
    const refresh = document.createElement('button');
    refresh.textContent = 'Update MML';
    refresh.title = 'Regenerate this instrument’s MML from the notes now. Only needed with real time updating off.';
    refresh.onclick = () => { e.result = generateMml(state.project, index); e.revision = revision; publish(i, e, index); };
    const show = document.createElement('button');
    show.textContent = 'Open MML';
    show.title = 'Show the generated MML text in a separate window, one tab per channel, ready to copy into MapleStory 2.';
    show.onclick = async () => { if (!e.result)
        refresh.onclick({}); opened = index; try {
        await window.mml.open(payload(i, e));
    }
    catch {
        e.warning.textContent = 'Could not open the MML window.';
    } };
    // Generating MML is the last step of a session, so it sits inside Instrument actions,
    // opened only when wanted. Warnings stay in the card, where they must be seen.
    box.append(e.label, label, refresh, show);
    body.append(box);
    row.append(e.warning);
    publish(i, e, index);
}
