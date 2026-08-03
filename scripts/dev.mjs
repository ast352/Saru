import { spawn, spawnSync } from 'node:child_process';

const run = (command,args) => spawnSync(command,args,{stdio:'inherit'});
const wait = milliseconds => new Promise(resolve=>setTimeout(resolve,milliseconds));

async function ensureDatabase() {
  if(process.env.DATABASE_URL){
    console.log('SARU: используется PostgreSQL из DATABASE_URL');
    return;
  }

  console.log('SARU: запускаю PostgreSQL…');
  const started=run('docker',['compose','up','-d','db']);
  if(started.error?.code==='ENOENT'){
    console.error('\nDocker не найден. Установите и запустите Docker Desktop.');
    process.exit(1);
  }
  if(started.status!==0){
    console.error('\nНе удалось запустить PostgreSQL. Убедитесь, что Docker Desktop открыт.');
    process.exit(started.status||1);
  }

  for(let attempt=1;attempt<=30;attempt++){
    const ready=spawnSync('docker',['compose','exec','-T','db','pg_isready','-U','saru','-d','saru'],{stdio:'ignore'});
    if(ready.status===0){
      console.log('SARU: PostgreSQL готов');
      return;
    }
    await wait(500);
  }
  console.error('\nPostgreSQL не успел запуститься. Проверьте: pnpm db:logs');
  process.exit(1);
}

await ensureDatabase();

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
