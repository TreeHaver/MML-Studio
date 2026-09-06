import { getPreviewEngine } from './engine.js';
import { status } from '../dom.js';
import { name } from '../music/pitch.js';
import { drumName } from './drums.js';
let generation = 0;
export async function previewNote(pitch, program, isDrum = false) {
    const token = ++generation;
    if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
        status('Preview supports MIDI pitches 0–127.');
        return;
    }
    try {
        const engine = await getPreviewEngine();
        if (token !== generation)
            return;
        await engine.preview(pitch, program, isDrum);
        if (token === generation)
            status(`Preview: ${isDrum ? drumName(pitch) : name(pitch)}.`);
    }
    catch (error) {
        if (token === generation)
            status('Note preview failed: ' + error);
    }
}
