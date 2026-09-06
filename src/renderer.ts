import {installPlayback} from './playback/transport.ts';
import {view} from './dom.ts';
import {state} from './state.ts';
import {ROW} from './constants.ts';
import {draw} from './painting.ts';
import {layout} from './viewport.ts';
import {refresh} from './commands.ts';
import {setTool} from './toolbar.ts';
import {installPointer} from './pointer.ts';
import {installToolbar} from './toolbar.ts';
import {installInspector} from './inspector.ts';
import {installInstruments} from './instruments.ts';
import {installHistory} from './history.ts';
import {installKeyboard} from './keyboard.ts';
import {installFiles} from './files.ts';
import {installExport} from './export.ts';
// Composition root: wire modules once, then initialize the editor.

installPointer();
installToolbar();
installInspector();
installInstruments();
installHistory();
installKeyboard();
installFiles();
installExport();
view.onscroll=draw;
new ResizeObserver(layout).observe(view);
setTool('draw');
refresh();
view.scrollTop=(state.topPitch-78)*ROW;
draw();

installPlayback();
