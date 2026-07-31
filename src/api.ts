export type User={id:number;name:string;email:string;role:'admin'|'student';subscriptionStatus:string};
const request=async<T>(path:string,options:RequestInit={})=>{const token=localStorage.getItem('afit_token');const headers=new Headers(options.headers);if(!(options.body instanceof FormData))headers.set('Content-Type','application/json');if(token)headers.set('Authorization',`Bearer ${token}`);const r=await fetch(path,{...options,headers});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Não foi possível concluir a operação.');return data as T};
export const api={
 login:(email:string,password:string)=>request<{token:string;user:User}>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
 register:(body:any)=>request<{token:string;user:User}>('/api/auth/register',{method:'POST',body:JSON.stringify(body)}),
 me:()=>request<{user:User}>('/api/auth/me'),
 plans:()=>request<{plans:any[]}>('/api/plans'),
 checkout:(planId:number)=>request<{invoiceUrl:string;paymentId:string}>('/api/payments/checkout',{method:'POST',body:JSON.stringify({planId})}),
 paymentStatus:()=>request<{status:string}>('/api/payments/status'),
 content:()=>request<any>('/api/student/content'),
 adminList:(kind:string)=>request<any>(`/api/admin/${kind}`),
 adminSave:(kind:string,body:any)=>request<any>(`/api/admin/${kind}`,{method:'POST',body:JSON.stringify(body)}),
 upload:async(file:File)=>{const fd=new FormData();fd.append('file',file);return request<{url:string;key:string}>('/api/admin/upload',{method:'POST',body:fd})}
};
