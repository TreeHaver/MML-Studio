export const EDGE_SCROLL = { zone: 52, startSpeed: 600, maxSpeed: 3000, delay: 300, ramp: 3000 };
/** Shared, time-based edge acceleration. Each axis resets on exit or reversal. */
export function createEdgeScroll() {
    let previous;
    const axes = [{ direction: 0, since: 0 }, { direction: 0, since: 0 }];
    return {
        reset() { previous = undefined; for (const axis of axes)
            axis.direction = 0; },
        step(point, bounds, vertical, time = previous === undefined ? 0 : previous + 1000 / 60) {
            const elapsed = previous === undefined ? 1000 / 60 : Math.max(0, Math.min(50, time - previous));
            previous = time;
            const axis = (index, value, low, high, enabled = true) => {
                const near = value - low, far = high - value;
                const direction = !enabled ? 0 : near < EDGE_SCROLL.zone && near <= far ? -1 : far < EDGE_SCROLL.zone ? 1 : 0;
                const state = axes[index];
                if (direction !== state.direction) {
                    state.direction = direction;
                    state.since = time;
                }
                if (!direction)
                    return 0;
                const pressure = Math.min(1, Math.max(0, 1 - (direction < 0 ? near : far) / EDGE_SCROLL.zone));
                const progress = Math.min(1, Math.max(0, (time - state.since - EDGE_SCROLL.delay) / EDGE_SCROLL.ramp));
                const speed = EDGE_SCROLL.startSpeed + (EDGE_SCROLL.maxSpeed - EDGE_SCROLL.startSpeed) * progress;
                return direction * pressure * speed * elapsed / 1000;
            };
            return { dx: axis(0, point.x, bounds.left, bounds.right), dy: axis(1, point.y, bounds.top, bounds.bottom, vertical) };
        }
    };
}
