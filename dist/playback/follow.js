// Pure viewport calculation; the caller applies only the horizontal offset.
export function playheadScroll(tick, zoom, width, scroll, keyWidth) {
    if (!Number.isFinite(tick) || tick < 0 || zoom <= 0 || width <= keyWidth)
        return scroll;
    const available = width - keyWidth, position = tick * zoom - scroll;
    if (position < Math.min(16, available / 4))
        return Math.max(0, tick * zoom - available / 4);
    if (position > available * .75)
        return Math.max(0, tick * zoom - available * .75);
    return scroll;
}
