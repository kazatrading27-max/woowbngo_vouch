// Drives `bubblewrap init` non-interactively: watches output for each known
// prompt and writes the matching answer to stdin, keeping the pipe open.
const { spawn } = require('child_process');
const { platform } = require('os');

const ANSWERS = [
  ['? Domain:', '\n'],
  ['? URL path:', '\n'],
  ['? Application name:', '\n'],
  ['? Short name:', '\n'],
  ['? Application ID:', 'com.wowbingo.vouchers\n'],
  ['? Starting version code', '\n'],
  ['? Display mode:', '\n'],
  ['? Orientation:', '\n'],
  ['? Status bar color:', '\n'],
  ['? Splash screen color:', '\n'],
  ['? Icon URL:', '\n'],
  ['? Maskable icon URL:', '\n'],
  ['? Monochrome icon URL:', '\n'],
  ['? Include support for Play Billing?', '\n'],
  ['? Request geolocation permission?', '\n'],
  ['? Key store location:', 'wowbingo-signing.jks\n'],
  ['? Key name:', 'wowbingo\n'],
];

const cmd = platform() === 'win32' ? 'bubblewrap.cmd' : 'bubblewrap';
const args = ['init', '--manifest=https://wowbingo-web.vercel.app/manifest.webmanifest'];
const child = spawn(cmd, args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

let pending = ANSWERS.map(([key, answer]) => ({ key, answer, done: false }));
let buffer = '';

function answerPending(chunk) {
  buffer += chunk;
  for (const item of pending) {
    if (!item.done && buffer.includes(item.key)) {
      item.done = true;
      setTimeout(() => {
        process.stderr.write(`[driver] answering "${item.key.trim()}" -> ${item.answer === '\n' ? '<enter>' : item.answer.trim()}\n`);
        child.stdin.write(item.answer);
      }, 600);
    }
  }
}

child.stdout.on('data', answerPending);
child.stderr.on('data', (d) => {
  process.stderr.write(d);
  // inquirer renders prompts on stderr in some paths
  answerPending(d);
});
child.on('close', (code) => {
  process.stderr.write(`[driver] init exited with ${code}\n`);
  process.exit(code ?? 0);
});
