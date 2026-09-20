export const $ = (id) => document.getElementById(id);
export const canvas = $("canvas");
export const ctx = canvas.getContext("2d");
export const view = $("view");
export const input = (id) => $(id);
// A tool applied from the Tools screen writes its result to the footer, which that screen
// covers, so the same text is repeated inside it whenever the element is present.
export function status(text) {
    $("status").textContent = text;
    const inDialog = document.getElementById("tools-status");
    if (inDialog)
        inDialog.textContent = text;
}
