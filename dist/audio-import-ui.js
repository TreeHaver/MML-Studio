import { $ } from './dom.js';
import { estimateAudioCharacters } from './import/audio.js';
/** Decode first to obtain the real clip duration; no project changes until accepted. */
export function chooseAudioSampling(name, seconds, budget) {
    const dialog = $('audio-import-options'), field = $('audio-sample-rate');
    const accept = $('audio-import-accept'), estimate = $('audio-import-estimate'), details = $('audio-sample-details');
    const voiceField = $('audio-voice-count');
    $('audio-import-source').textContent = `${name} · ${seconds.toFixed(3)} seconds`;
    field.value = '30';
    voiceField.value = '5';
    let chosen = null;
    const update = () => {
        try {
            const voices = Number(voiceField.value), plan = estimateAudioCharacters(seconds, Number(field.value), voices), over = plan.characters > budget;
            chosen = { interval: plan.intervalMs, voices };
            accept.disabled = false;
            accept.textContent = over ? 'Import anyway' : 'Import';
            details.textContent = `${plan.intervalMs} ms per sample (${(1000 / plan.intervalMs).toFixed(1)} samples/second).${plan.intervalMs !== Number(field.value) ? ' Rounded to the nearest supported timing step.' : ''}`;
            estimate.textContent = `Estimated ${plan.characters.toLocaleString('en-US')} / ${budget.toLocaleString('en-US')} characters.${over ? ' Likely over budget. Reduce voices, increase milliseconds per sample or shorten the clip.' : ' Within the estimated budget.'}`;
            estimate.classList.toggle('over-budget', over);
        }
        catch (error) {
            chosen = null;
            accept.disabled = true;
            details.textContent = String(error.message);
            estimate.textContent = '';
            estimate.classList.remove('over-budget');
        }
    };
    field.oninput = update;
    voiceField.oninput = update;
    update();
    return new Promise(resolve => {
        const finish = (value) => { dialog.onclose = null; dialog.oncancel = null; field.oninput = null; voiceField.oninput = null; accept.onclick = null; $('audio-import-cancel').onclick = null; dialog.close(); resolve(value); };
        accept.onclick = () => { if (chosen !== null)
            finish(chosen); };
        $('audio-import-cancel').onclick = () => finish(null);
        dialog.oncancel = event => { event.preventDefault(); finish(null); };
        dialog.onclose = () => finish(null);
        dialog.showModal();
        field.focus();
        field.select();
    });
}
