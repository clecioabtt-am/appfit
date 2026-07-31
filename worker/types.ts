interface D1Result<T=unknown>{results:T[];success:boolean;meta?:unknown}
interface D1PreparedStatement{bind(...values:unknown[]):D1PreparedStatement;first<T=unknown>():Promise<T|null>;all<T=unknown>():Promise<D1Result<T>>;run():Promise<unknown>}
interface D1Database{prepare(query:string):D1PreparedStatement}
interface R2HttpMetadata{contentType?:string}
interface R2ObjectBody{body:ReadableStream;httpMetadata?:R2HttpMetadata}
interface R2Bucket{put(key:string,value:ReadableStream|ArrayBuffer|string,options?:unknown):Promise<unknown>;get(key:string):Promise<R2ObjectBody|null>}
interface Fetcher{fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>}
export interface Env {DB:D1Database;MEDIA:R2Bucket;ASSETS:Fetcher;JWT_SECRET:string;SETUP_TOKEN:string;ASAAS_API_KEY:string;ASAAS_WEBHOOK_TOKEN:string;ASAAS_ENV:string;APP_URL:string}
