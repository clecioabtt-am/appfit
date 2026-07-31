
export type Env = {
  DB: any;
  MEDIA: any;
  JWT_SECRET: string;
  SETUP_TOKEN: string;
  ASAAS_ENV?: string;
  ASAAS_API_KEY?: string;
  ASAAS_WEBHOOK_TOKEN?: string;
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const error = (message: string, status = 400) => json({ error: message }, status);

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || crypto.randomUUID();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(actualSalt),
      iterations: 120_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `${actualSalt}.${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(".");
  return Boolean(salt) && (await hashPassword(password, salt)) === stored;
}

export async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ ...payload, exp: Date.now() + 7 * 86_400_000 })),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function readUser(request: Request, env: Env): Promise<any | null> {
  const raw = request.headers.get("authorization");
  const token = raw?.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) return null;

  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(`${header}.${body}`),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function asaasBase(env: Env): string {
  return env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

export async function asaasRequest(
  env: Env,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  if (!env.ASAAS_API_KEY) throw new Error("A chave ASAAS_API_KEY ainda não foi configurada.");
  const response = await fetch(`${asaasBase(env)}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      access_token: env.ASAAS_API_KEY,
      "user-agent": "AFIT-Cloudflare-Pages/3.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.description || "Falha ao comunicar com o Asaas.");
  }
  return data;
}
