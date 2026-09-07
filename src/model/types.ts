export type Note={id:number,instrument:number,start:number,length:number,pitch:number,volume:number|null,tempo?:number|null};
export type Project={format:'mml-studio',version:2,grid:number,instruments:{name:string,color:string,midiProgram?:number,ms2Drum?:import('../playback/drums.ts').Ms2Drum,isDrum?:boolean,isInstructions?:boolean}[],notes:Note[]};
