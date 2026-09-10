import { $, view } from './dom.js';
import { state } from './state.js';
import { KEY } from './constants.js';
import { sectionMarkers } from './model/segment-view.js';
let previousNotes, previousCount = -1, previousRoles = '';
let markers = [], previousLayout = '';
/** Whole-view landmarks sit just above the native horizontal scrollbar. */
export function refreshScrollMarkers() {
    const notes = state.project.notes, roles = state.project.instruments.map(i => i.isInstructions ? '1' : '0').join('');
    if (notes !== previousNotes || notes.length !== previousCount || roles !== previousRoles) {
        markers = sectionMarkers(state.project);
        previousNotes = notes;
        previousCount = notes.length;
        previousRoles = roles;
        previousLayout = '';
    }
    const strip = $('scroll-markers'), width = view.clientWidth;
    const extent = Math.max(width, view.scrollWidth || parseFloat($('extent').style.width) || width);
    const bottom = $('horizontal-scroll').offsetHeight || 12;
    const key = `${width}:${extent}:${bottom}:${state.zoom}`;
    if (key === previousLayout)
        return;
    previousLayout = key;
    strip.hidden = !markers.length;
    strip.style.width = width + 'px';
    strip.style.bottom = bottom + 'px';
    strip.replaceChildren();
    for (const marker of markers) {
        const tick = document.createElement('span');
        tick.className = 'scroll-marker' + (marker.song ? ' song' : '');
        const label = `${marker.song ? 'Song' : 'Section'}: ${marker.name}`;
        tick.title = label;
        tick.setAttribute('aria-label', label);
        tick.setAttribute('role', 'img');
        tick.style.left = Math.max(4, Math.min(width - 4, (KEY + marker.start * state.zoom) / extent * width)) + 'px';
        strip.append(tick);
    }
}
