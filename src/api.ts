export type User={id:number;name:string;email:string;role:'admin'|'student'|'doctor';phone?:string;profileImageUrl?:string|null;subscriptionStatus:string;subscriptionUntil?:string|null;activePlan?:{planId:number;planName:string;expiresAt:string}|null};
export type Settings={brandName:string;logoUrl:string;heroImageUrl:string;insideImageUrl:string;heroTitle:string;heroSubtitle:string;consultationPixKey?:string;consultationPixRecipient?:string};
export type Plan={id:number;name:string;price:number;period:string;durationDays:number;description:string;active?:number;pixKey?:string;pixType?:string;recipientName?:string;instructions?:string};
export type PlanRequest={id:number;studentId:number;studentName:string;studentEmail:string;studentPhone?:string;planId:number;planName:string;price:number;durationDays:number;pixKey:string;recipientName:string;status:'AWAITING_PROOF'|'PROOF_SENT'|'APPROVED'|'REJECTED'|'CANCELLED';proofName?:string;requestedAt:string;proofSentAt?:string;decidedAt?:string;decisionNote?:string;activatedUntil?:string};
const BASE='/api';
export const getToken=()=>localStorage.getItem('wagner_access_token')||'';
export const setToken=(t:string)=>{if(t)localStorage.setItem('wagner_access_token',t);else localStorage.removeItem('wagner_access_token');};
export async function api<T=any>(path:string,init:RequestInit={}):Promise<T>{
 const h=new Headers(init.headers);if(!(init.body instanceof FormData)&&init.body!==undefined)h.set('content-type','application/json');
 const token=getToken();if(token)h.set('authorization',`Bearer ${token}`);
 const res=await fetch(BASE+path,{...init,headers:h,cache:'no-store'});
 const result=await res.json().catch(()=>({}));if(!res.ok)throw new Error(result.error||`Erro ${res.status}`);return result as T;
}
export const get=<T=any>(path:string)=>api<T>(path);
export const post=<T=any>(path:string,payload:any)=>api<T>(path,{method:'POST',body:JSON.stringify(payload)});
export const put=<T=any>(path:string,payload:any)=>api<T>(path,{method:'PUT',body:JSON.stringify(payload)});
export const del=<T=any>(path:string)=>api<T>(path,{method:'DELETE'});
export const upload=<T=any>(path:string,file:File)=>{const fd=new FormData();fd.append('file',file);return api<T>(path,{method:'POST',body:fd});};
export async function previewPrivate(path:string):Promise<string>{const headers=new Headers();if(getToken())headers.set('authorization','Bearer '+getToken());const r=await fetch(BASE+path,{headers,cache:'no-store'});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Não foi possível abrir o comprovante.');}const b=await r.blob();return URL.createObjectURL(b);}
