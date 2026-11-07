import {Env} from '../_lib/core';
type Context={request:Request;env:Env;params:{path?:string|string[]}};
export const onRequestGet=async ({env,params}:Context):Promise<Response>=>{
 const token=Array.isArray(params.path)?params.path.join('/'):params.path||'';
 let key='';try{key=decodeURIComponent(token);}catch{return new Response('URL inválida',{status:400});}
 // Provas de Pix e arquivos privados NUNCA são públicos; objetos R2 apenas por rota autenticada.
 if(!key.startsWith('public/')&&!key.startsWith('profiles/')&&!key.startsWith('uploads/'))return new Response('Acesso negado',{status:403});
 if(key.includes('..')||key.includes('\\')||key.length>600)return new Response('URL inválida',{status:400});
 const object=await env.MEDIA.get(key);if(!object)return new Response('Imagem ou vídeo não encontrado',{status:404});
 const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','public,max-age=7200');headers.set('x-content-type-options','nosniff');headers.set('content-security-policy',"default-src 'none'; sandbox");return new Response(object.body,{headers});
};
