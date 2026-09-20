export const $=(id:string)=>document.getElementById(id)!;
export const canvas=$("canvas") as HTMLCanvasElement;
export const ctx=canvas.getContext("2d")!;
export const view=$("view");
export const input=(id:string)=>$(id) as HTMLInputElement;
// A tool applied from the Tools screen writes its result to the footer, which that screen
// covers, so the same text is repeated inside it whenever the element is present.
export function status(text:string){
 $("status").textContent=text;
 const inDialog=document.getElementById("tools-status");
 if(inDialog)inDialog.textContent=text;
}
