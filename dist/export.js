import { exportSegments } from './music/structure.js';
import { state } from './state.js';
import { createSheetPlanner, ms2Xml } from './music/sheets.js';
import { $, status } from './dom.js';
import { sheetSettings, setCharacterLimit } from './sheet-settings.js';
import { draw } from './painting.js';
function choose(name, bytes, limit) {
    const dialog = $('export-limit-dialog');
    $('export-limit-message').textContent = `${name} uses ${bytes.toLocaleString()} characters, exceeding your ${limit.toLocaleString()} character limit. Do you still wish to export?`;
    return new Promise(resolve => {
        let done = false, chosen = 'cancel';
        const finish = (choice) => { if (done)
            return; done = true; chosen = choice; dialog.close(); };
        $('export-limit-single').onclick = () => finish('single');
        $('export-limit-parts').onclick = () => finish('parts');
        $('export-limit-no').onclick = () => finish('cancel');
        dialog.oncancel = e => { e.preventDefault(); finish('cancel'); };
        dialog.onclose = () => { dialog.onclose = null; resolve(chosen); };
        dialog.showModal();
    });
}
export function installExport() {
    const input = $('character-limit');
    input.value = String(sheetSettings.limit);
    input.onchange = () => { if (!setCharacterLimit(Number(input.value))) {
        input.value = String(sheetSettings.limit);
        status('Character limit must be a positive whole number.');
        return;
    } draw(); status(`Character limit set to ${sheetSettings.limit.toLocaleString()}. The red line marks the selected instrument’s first sheet boundary.`); };
    let exporting = false;
    const selected = $('export-selected'), all = $('export-project');
    const run = async (projectExport) => {
        if (exporting)
            return;
        exporting = true;
        selected.disabled = all.disabled = true;
        try {
            const project = structuredClone(state.project), limit = sheetSettings.limit;
            const indexes = projectExport ? project.instruments.map((_, i) => i) : [state.active];
            const files = [];
            for (const segment of exportSegments(project, !state.segment && $('export-sections').checked))
                for (const index of indexes) {
                    if (segment.project.instruments[index].isInstructions || !segment.project.notes.some(n => n.instrument === index))
                        continue;
                    const plan = createSheetPlanner(segment.project, index, limit), prefix = state.segment?.projection.range.name ?? segment.name, name = (prefix ? prefix + '-' : '') + project.instruments[index].name;
                    if (!plan.whole.channels.length)
                        continue;
                    const choice = plan.whole.bytes > limit ? await choose(name, plan.whole.bytes, limit) : 'single';
                    if (choice === 'cancel') {
                        status('Export canceled.');
                        return;
                    }
                    if (choice === 'parts') {
                        const parts = plan.split();
                        parts.forEach((part, i) => files.push({ name: `${name}-part-${String(i + 1).padStart(2, '0')}.ms2mml`, text: ms2Xml(part.channels) }));
                    }
                    else
                        files.push({ name: name + '.ms2mml', text: ms2Xml(plan.whole.channels) });
                }
            if (!files.length) {
                status('No musical MML to export.');
                return;
            }
            let count = 0;
            for (const file of files) {
                if (!await window.files.exportMml(file.name, file.text)) {
                    status(`Export canceled after saving ${count} of ${files.length} files.`);
                    return;
                }
                count++;
            }
            status(`Exported ${count} file${count === 1 ? '' : 's'}.`);
        }
        catch (error) {
            status('Export failed: ' + error);
        }
        finally {
            exporting = false;
            selected.disabled = all.disabled = false;
        }
    };
    selected.onclick = () => run(false);
    all.onclick = () => run(true);
}
