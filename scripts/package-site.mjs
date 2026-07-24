import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const files = {};

async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collect(full);
    else {
      const key = `/${relative(dist, full).replaceAll('\\', '/')}`;
      files[key] = await readFile(full, 'utf8');
    }
  }
}

await collect(dist);
await mkdir(join(dist, 'server'), { recursive: true });
await mkdir(join(dist, '.openai'), { recursive: true });
await copyFile(join(root, '.openai', 'hosting.json'), join(dist, '.openai', 'hosting.json'));

const worker = `const files=${JSON.stringify(files)};
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};
export default {async fetch(request){
  const url=new URL(request.url);
  const path=url.pathname==="/" ? "/index.html" : url.pathname;
  const body=files[path] ?? files["/index.html"];
  const ext=path.slice(path.lastIndexOf("."));
  return new Response(body,{headers:{"content-type":types[ext]||"text/html; charset=utf-8","cache-control":path.startsWith("/assets/")?"public, max-age=31536000, immutable":"no-cache"}});
}};`;
await writeFile(join(dist, 'server', 'index.js'), worker);
