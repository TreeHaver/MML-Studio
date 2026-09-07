const key = 'mml-studio-character-limit';
export const sheetSettings = { limit: 10000 };
try {
    const value = Number(localStorage.getItem(key));
    if (Number.isSafeInteger(value) && value > 0)
        sheetSettings.limit = value;
}
catch { }
export function setCharacterLimit(value) {
    if (!Number.isSafeInteger(value) || value < 1)
        return false;
    sheetSettings.limit = value;
    try {
        localStorage.setItem(key, String(value));
    }
    catch { }
    return true;
}
