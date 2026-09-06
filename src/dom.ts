export const $=(id:string)=>document.getElementById(id)!;
export const canvas=$("canvas") as HTMLCanvasElement;
export const ctx=canvas.getContext("2d")!;
export const view=$("view");
export const input=(id:string)=>$(id) as HTMLInputElement;
export function status(text:string){$("status").textContent=text;}
