import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain','.xml':'application/xml'};
export function serve(port=4173){return createServer(async(req,res)=>{try{let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const prefix='/su-27-flanker-fathomed';if(url===prefix){res.writeHead(301,{Location:prefix+'/'});res.end();return;}if(url.startsWith(prefix+'/'))url=url.slice(prefix.length);let file=path.resolve(root,'.'+url);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}let info=await stat(file);if(info.isDirectory()){if(!url.endsWith('/')){res.writeHead(301,{Location:req.url+'/'});res.end();return;}file=path.join(file,'index.html');}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1');}
if(process.argv[1]===fileURLToPath(import.meta.url)){serve(Number(process.env.PORT)||4173);console.log(`Preview: http://127.0.0.1:${Number(process.env.PORT)||4173}/su-27-flanker-fathomed/`);}
