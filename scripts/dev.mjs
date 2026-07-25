import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath,['server/index.mjs'],{stdio:'inherit'}),
  spawn('pnpm',['exec','vite'],{stdio:'inherit'}),
];

const stop = signal => {
  for (const child of children) child.kill(signal);
};
process.on('SIGINT',() => { stop('SIGINT'); process.exit(0); });
process.on('SIGTERM',() => { stop('SIGTERM'); process.exit(0); });
for (const child of children) child.on('exit',code => {
  if(code && code!==0) { stop('SIGTERM'); process.exit(code); }
});
