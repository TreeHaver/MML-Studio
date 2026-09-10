import { $, view } from './dom.js';
function metrics() {
    const width = view.clientWidth, total = Math.max(width, view.scrollWidth || parseFloat($('extent').style.width) || width);
    const thumb = Math.min(width, Math.max(24, width * width / total)), maximum = total - width;
    return { width, thumb, maximum, travel: width - thumb };
}
export function refreshHorizontalScroll() {
    const bar = $('horizontal-scroll'), thumb = $('horizontal-thumb'), m = metrics();
    bar.style.width = m.width + 'px';
    thumb.style.width = m.thumb + 'px';
    thumb.style.left = (m.maximum ? view.scrollLeft / m.maximum * m.travel : 0) + 'px';
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(Math.round(m.maximum)));
    bar.setAttribute('aria-valuenow', String(Math.round(view.scrollLeft)));
    bar.setAttribute('aria-disabled', String(!m.maximum));
}
export function installHorizontalScroll() {
    const bar = $('horizontal-scroll');
    let drag = null;
    const place = (clientX) => {
        if (!drag)
            return;
        const m = metrics(), x = clientX - bar.getBoundingClientRect().left;
        view.scrollLeft = m.travel ? Math.max(0, Math.min(m.maximum, (x - drag.offset) / m.travel * m.maximum)) : 0;
        refreshHorizontalScroll();
    };
    bar.onpointerdown = e => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        bar.focus();
        const m = metrics(), x = e.clientX - bar.getBoundingClientRect().left, left = m.maximum ? view.scrollLeft / m.maximum * m.travel : 0;
        drag = { offset: x >= left && x <= left + m.thumb ? x - left : m.thumb / 2, pointer: e.pointerId };
        bar.setPointerCapture(e.pointerId);
        place(e.clientX);
    };
    bar.onpointermove = e => { if (drag?.pointer === e.pointerId)
        place(e.clientX); };
    const stop = (e) => { drag = null; if (bar.hasPointerCapture(e.pointerId))
        bar.releasePointerCapture(e.pointerId); };
    bar.onpointerup = stop;
    bar.onpointercancel = stop;
    bar.onlostpointercapture = () => { drag = null; };
    bar.onkeydown = e => {
        const delta = { ArrowLeft: -40, ArrowRight: 40, PageUp: -view.clientWidth, PageDown: view.clientWidth, Home: -Infinity, End: Infinity };
        if (!(e.key in delta))
            return;
        e.preventDefault();
        e.stopPropagation();
        const m = metrics();
        view.scrollLeft = Math.max(0, Math.min(m.maximum, view.scrollLeft + delta[e.key]));
        refreshHorizontalScroll();
    };
}
