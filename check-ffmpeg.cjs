const fs = require('node:fs');
const path = require('node:path');

// A source checkout can run without the optional audio-export encoder.
// Resolve against this script, so startup does not depend on the shell's cwd.
function checkFFmpeg(root = __dirname, warn = console.warn) {
  const encoder = path.join(root, 'vendor', 'ffmpeg.exe');
  try {
    const file = fs.statSync(encoder);
    if (file.isFile() && file.size > 0) return true;
  } catch (error) {
    if (error.code !== 'ENOENT') warn(`Could not inspect FFmpeg: ${error.message}`);
  }
  warn([
    '',
    'FFmpeg is missing: audio export needs vendor/ffmpeg.exe.',
    'The editor will still open; editing and preview playback remain available.',
    '',
    'Download a Windows x64 static build from:',
    'https://www.gyan.dev/ffmpeg/builds/',
    'The release essentials ZIP is the easiest archive to extract on Windows.',
    `Extract its bin/ffmpeg.exe to: ${encoder}`,
    'Keep the downloaded build\'s LICENSE and README as vendor/FFmpeg-LICENSE.txt',
    'and vendor/FFmpeg-README.txt when replacing the encoder.',
    'Then retry audio export. The executable is ignored by Git.',
    '',
  ].join('\n'));
  return false;
}

if (require.main === module) checkFFmpeg();
module.exports = { checkFFmpeg };
