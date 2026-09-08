import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { readFile, rename, unlink } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { renderAudio, SAMPLE_RATE } from './render.js';
let cancelled = false;
parentPort.on('message', () => { cancelled = true; });
async function run() {
    const { request, encoder, bank, target, temporary, codec } = workerData;
    let child;
    let finished, closed = false;
    try {
        const bytes = await readFile(bank);
        if (cancelled)
            throw Error('Audio export canceled.');
        child = spawn(encoder, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'f32le', '-ar', String(SAMPLE_RATE), '-ac', '2', '-i', 'pipe:0', ...codec, temporary], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
        let stderr = '', encoderError;
        child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
        child.stdin.on('error', error => { encoderError = error; });
        finished = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', code => { closed = true; code === 0 ? resolve() : reject(Error(stderr || `Audio encoder exited with code ${code}.`)); });
        });
        // Observe failures immediately, even while the synth is still rendering.
        finished.catch(error => { encoderError = error; });
        const result = await renderAudio(request, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), async (pcm) => {
            if (encoderError)
                throw encoderError;
            const buffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
            // A copy is necessary: the renderer reuses its PCM buffer on the next block.
            await new Promise((resolve, reject) => child.stdin.write(Buffer.from(buffer), error => error ? reject(error) : resolve()));
            await setImmediate();
        }, fraction => parentPort.postMessage({ progress: fraction }), () => cancelled);
        child.stdin.end();
        await finished;
        if (cancelled)
            throw Error('Audio export canceled.');
        await rename(temporary, target);
        parentPort.postMessage({ result });
    }
    catch (error) {
        parentPort.postMessage({ error: cancelled ? 'Audio export canceled.' : String(error), canceled: cancelled });
    }
    finally {
        if (child && !closed)
            child.kill();
        await finished?.catch(() => { });
        await unlink(temporary).catch(() => { });
        parentPort.close();
    }
}
void run();
