export const $ = (id) => document.getElementById(id);
export const canvas = $("canvas");
export const ctx = canvas.getContext("2d");
export const view = $("view");
export const input = (id) => $(id);
export function status(text) { $("status").textContent = text; }
