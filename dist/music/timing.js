export const snap = (t, grid) => Math.round(t / (128 / grid)) * (128 / grid);
export const cellStart = (t, grid) => Math.floor(t / (128 / grid)) * (128 / grid);
