// GM1 percussion: channel 10 (zero-based 9), Standard Kit, keys 35–81.
export const DRUM_KIT_NAME='Standard Drum Kit';
export const DRUM_MS2_WARNING='Not a valid MS2 instrument. Available for editing and preview.';
const names=[
 'Acoustic Bass Drum','Bass Drum 1','Side Stick','Acoustic Snare','Hand Clap','Electric Snare',
 'Low Floor Tom','Closed Hi-Hat','High Floor Tom','Pedal Hi-Hat','Low Tom','Open Hi-Hat',
 'Low-Mid Tom','Hi-Mid Tom','Crash Cymbal 1','High Tom','Ride Cymbal 1','Chinese Cymbal',
 'Ride Bell','Tambourine','Splash Cymbal','Cowbell','Crash Cymbal 2','Vibraslap','Ride Cymbal 2',
 'Hi Bongo','Low Bongo','Mute Hi Conga','Open Hi Conga','Low Conga','High Timbale','Low Timbale',
 'High Agogo','Low Agogo','Cabasa','Maracas','Short Whistle','Long Whistle','Short Guiro','Long Guiro',
 'Claves','Hi Wood Block','Low Wood Block','Mute Cuica','Open Cuica','Mute Triangle','Open Triangle'
];
export const drumName=(pitch:number)=>names[pitch-35]??`Drum note ${pitch} (outside GM standard map)`;
