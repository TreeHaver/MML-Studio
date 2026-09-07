// Derived monophonic channels preserve every original onset and duration.
export function partitionChannels(source) {
    const notes = [...source].sort((a, b) => a.start - b.start || a.id - b.id);
    // Min-heap of channel end times: minimum voices for the interval partition.
    const lanes = [], heap = [];
    for (const n of notes) {
        let lane;
        if (heap.length && heap[0].end <= n.start) {
            lane = heap[0].index;
            heap[0] = heap[heap.length - 1];
            heap.pop();
            let p = 0;
            while (p < heap.length) {
                let c = p * 2 + 1;
                if (c >= heap.length)
                    break;
                if (c + 1 < heap.length && heap[c + 1].end < heap[c].end)
                    c++;
                if (heap[p].end <= heap[c].end)
                    break;
                [heap[p], heap[c]] = [heap[c], heap[p]];
                p = c;
            }
        }
        else {
            lane = lanes.length;
            lanes.push([]);
        }
        lanes[lane].push(n);
        heap.push({ end: n.start + n.length, index: lane });
        let p = heap.length - 1;
        while (p > 0) {
            const parent = (p - 1) >> 1;
            if (heap[parent].end <= heap[p].end)
                break;
            [heap[parent], heap[p]] = [heap[p], heap[parent]];
            p = parent;
        }
    }
    return lanes;
}
