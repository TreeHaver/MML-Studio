import {$} from './dom.ts';
export function installChrome(){
 const menus=[$('file-menu'),$('export-menu')] as HTMLDetailsElement[];
 document.onclick=event=>{
  const target=event.target as HTMLElement;
  for(const menu of menus)if(!menu.contains(target)||target.closest('button'))menu.open=false;
 };
 document.onkeyup=event=>{if(event.key==='Escape')for(const menu of menus){if(menu.open){menu.open=false;menu.querySelector('summary')?.focus();}}};
}
