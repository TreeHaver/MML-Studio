/**
 * MapleStory 2's own composing window shows a score as one Melody tab followed by Harmony A
 * to Harmony I, and counts them as "Melodies: 1  Harmonies: 9". The editor generates exactly
 * that shape, one melody element and up to nine indexed chords, but called them Channel 1 to
 * Channel 10, so nobody copying a part across could tell which tab it belonged in.
 *
 * Past the tenth there is no tab in the game to name, and the export refuses that score
 * anyway, so the numbering carries on and the existing warning does the explaining.
 */
export const partName=(index:number)=>index===0?'Melody':index<=9?`Harmony ${String.fromCharCode(64+index)}`:`Channel ${index+1}`;

/** "1 melody and 3 harmonies", the way the game's own status line counts them. */
export function partsSummary(count:number){
 if(count<=0)return 'no parts yet';
 const harmonies=count-1;
 return `1 melody and ${harmonies||'no'} harmon${harmonies===1?'y':'ies'}`;
}
