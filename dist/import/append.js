import { ensureInstructions } from '../model/instructions.js';
import { valid } from '../model/validation.js';
import { condenseImportInstructions } from './instructions.js';
/** Add independent instrument instances, keeping the single global Instructions lane. */
export function appendImportedSongs(target, sources) {
    const project = structuredClone(target), added = [], instruments = [], warnings = [];
    let id = project.notes.reduce((max, n) => Math.max(max, n.id), 0);
    for (const source of sources) {
        const tempos = new Map(source.notes.filter(n => n.tempo != null).map(n => [n.start, n.tempo]));
        let replaced = 0;
        for (const note of project.notes)
            if (note.tempo != null && tempos.has(note.start) && tempos.get(note.start) !== note.tempo) {
                delete note.tempo;
                replaced++;
            }
        if (replaced)
            warnings.push(`${replaced} conflicting existing tempo instruction(s) were replaced by imported tempos at the same positions. Later dropped files take precedence.`);
        if (project.notes.some(n => n.speedEntry || n.speedExit) && source.notes.some(n => n.speedEntry || n.speedExit))
            throw Error('Both projects have Speed Multiplier zones. Their global clocks cannot be combined automatically.');
        const routes = source.instruments.map(instrument => {
            if (instrument.isInstructions)
                return ensureInstructions(project);
            const index = project.instruments.length;
            project.instruments.push({ ...instrument });
            instruments.push(index);
            return index;
        });
        for (const note of source.notes) {
            const next = { ...note, id: ++id, instrument: routes[note.instrument] };
            project.notes.push(next);
            added.push(next.id);
        }
    }
    const aliases = condenseImportInstructions(project, warnings);
    if (!valid(project.notes))
        throw Error('The imported song contains invalid timing or conflicting time signature, section or other instructions.');
    return { project, added: [...new Set(added.map(id => aliases.get(id) ?? id))], instruments, warnings };
}
