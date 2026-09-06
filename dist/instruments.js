import { mmlControls, updateMml } from './mml.js';
import { GM_PROGRAMS } from './playback/gm-programs.js';
import { DRUM_KIT_NAME, DRUM_MS2_WARNING } from './playback/drums.js';
import { INSTRUCTIONS_NAME } from './model/instructions.js';
import { draw } from './painting.js';
import { info } from './inspector.js';
import { checkpoint } from './history.js';
import { refresh } from './commands.js';
import { $, view } from './dom.js';
import { ROW } from './constants.js';
import { updatePlaybackMutes } from './playback/transport.js';
import { state, instrumentView, isMuted } from './state.js';
import { colors } from './model/project.js';
import { name } from './music/pitch.js';
export function instruments() {
    $('instruments').replaceChildren();
    state.project.instruments.forEach((i, index) => {
        const row = document.createElement('div');
        row.className = 'instrument';
        const color = document.createElement('input');
        color.type = 'color';
        color.value = i.color;
        color.onchange = () => { checkpoint(); i.color = color.value; draw(); };
        const button = document.createElement('button');
        button.textContent = i.name + (isMuted(index) ? ' (muted)' : '');
        button.className = 'instrument-name';
        button.classList.toggle('active', index === state.active);
        button.onclick = () => { state.active = index; state.selection.clear(); document.querySelectorAll('.instrument-name').forEach((el, j) => el.classList.toggle('active', j === index)); if (i.isInstructions) {
            const event = state.project.notes.find(n => n.instrument === index);
            view.scrollTop = Math.max(0, (state.topPitch - (event?.pitch ?? 60) - 5) * ROW);
        } info(); draw(); };
        button.ondblclick = () => { const field = document.createElement('input'); field.type = 'text'; field.value = i.name; button.replaceWith(field); field.focus(); field.select(); let done = false; const finish = (save) => { if (done)
            return; done = true; if (save && field.value.trim() && i.name !== field.value.trim()) {
            checkpoint();
            i.name = field.value.trim();
        } instruments(); }; field.onblur = () => finish(true); field.onkeydown = e => { if (e.key === 'Enter')
            finish(true); if (e.key === 'Escape')
            finish(false); }; };
        const preset = document.createElement('select');
        preset.title = 'General MIDI playback instrument';
        preset.setAttribute('aria-label', 'Playback preset for ' + i.name);
        GM_PROGRAMS.forEach((name, program) => { const option = document.createElement('option'); option.value = String(program); option.textContent = `${program + 1}. ${name}`; preset.append(option); });
        const drums = document.createElement('option');
        drums.value = 'drums';
        drums.textContent = `${DRUM_KIT_NAME} (not valid in MS2)`;
        preset.append(drums);
        const instructions = document.createElement('option');
        instructions.value = 'instructions';
        instructions.textContent = 'Instructions (silent)';
        preset.append(instructions);
        preset.value = i.isInstructions ? 'instructions' : i.isDrum ? 'drums' : String(i.midiProgram ?? 0);
        preset.onchange = () => { checkpoint(); i.isDrum = preset.value === 'drums'; i.isInstructions = preset.value === 'instructions'; i.midiProgram = i.isDrum || i.isInstructions ? 0 : Number(preset.value); if (i.isInstructions)
            i.name = INSTRUCTIONS_NAME; instruments(); updateMml(true); info(); draw(); };
        row.append(color, button, preset);
        $('instruments').append(row);
        if (i.isDrum) {
            const warning = document.createElement('small');
            warning.className = 'instrument-warning';
            warning.textContent = DRUM_MS2_WARNING;
            row.append(warning);
        }
        if (i.isInstructions) {
            const help = document.createElement('small');
            help.className = 'instrument-help';
            help.textContent = 'Silent events. Draw a marker, then edit its tempo. Yellow lines indicate changes.';
            row.append(help);
        }
        const controls = document.createElement('div');
        controls.className = 'instrument-controls';
        const changed = () => { state.selection.clear(); updatePlaybackMutes(); instruments(); info(); draw(); };
        const mute = document.createElement('button');
        mute.textContent = 'Mute';
        mute.setAttribute('aria-pressed', String(isMuted(index)));
        mute.classList.toggle('active', isMuted(index));
        mute.onclick = () => { instrumentView.solo = null; if (instrumentView.muted.has(index))
            instrumentView.muted.delete(index);
        else
            instrumentView.muted.add(index); changed(); };
        const solo = document.createElement('button');
        solo.textContent = 'Solo';
        solo.setAttribute('aria-pressed', String(instrumentView.solo === index));
        solo.classList.toggle('active', instrumentView.solo === index);
        solo.onclick = () => { instrumentView.solo = instrumentView.solo === index ? null : index; instrumentView.muted.clear(); if (instrumentView.solo !== null)
            state.project.instruments.forEach((_, other) => { if (other !== index)
                instrumentView.muted.add(other); }); changed(); };
        controls.append(mute, solo);
        row.append(controls);
        const collapse = document.createElement('button');
        const collapsed = instrumentView.collapsed.has(index);
        collapse.textContent = collapsed ? '▸' : '▾';
        collapse.className = 'instrument-collapse';
        collapse.title = collapsed ? 'Expand instrument' : 'Collapse instrument';
        collapse.setAttribute('aria-label', collapse.title + ' ' + i.name);
        collapse.setAttribute('aria-expanded', String(!collapsed));
        collapse.onclick = () => { if (collapsed)
            instrumentView.collapsed.delete(index);
        else
            instrumentView.collapsed.add(index); instruments(); };
        row.append(collapse);
        row.classList.toggle('collapsed', collapsed);
        mmlControls(row, index);
    });
}
export function installInstruments() {
    $('add').onclick = () => { checkpoint(); state.project.instruments.push({ name: `Instrument ${state.project.instruments.length + 1}`, color: colors[state.project.instruments.length % colors.length], midiProgram: 0 }); state.active = state.project.instruments.length - 1; state.selection.clear(); refresh(); };
}
