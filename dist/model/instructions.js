export const INSTRUCTIONS_NAME = 'Instructions', INSTRUCTIONS_COLOR = '#f4d35e';
export function ensureInstructions(project) {
    const existing = project.instruments.findIndex(i => i.isInstructions);
    if (existing >= 0)
        return existing;
    project.instruments.push({ name: INSTRUCTIONS_NAME, color: INSTRUCTIONS_COLOR, isInstructions: true });
    return project.instruments.length - 1;
}
// Recognize only the previous importer's specifically named silent marker lane.
// This adds role metadata without changing version-2 note/event storage.
export function recognizeLegacyInstructions(project) {
    project.instruments.forEach((instrument, index) => {
        if (instrument.isInstructions === undefined && !instrument.isDrum && instrument.name === 'Tempo markers (silent)' &&
            project.notes.some(n => n.instrument === index) && project.notes.filter(n => n.instrument === index).every(n => n.volume === 0 && n.tempo != null)) {
            instrument.isInstructions = true;
            instrument.name = INSTRUCTIONS_NAME;
            instrument.color = INSTRUCTIONS_COLOR;
        }
    });
}
