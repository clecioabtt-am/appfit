
export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "student";
  subscriptionStatus: string;
};

const token = () => localStorage.getItem("afit_token");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const currentToken = token();
  if (currentToken) headers.set("authorization", `Bearer ${currentToken}`);
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");

  const response = await fetch(path, { ...init, headers });
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data as T;
}

export const api = {
  setupStatus: () => request<{ configured: boolean }>("/api/setup/status"),
  setupAdmin: (payload: { name: string; email: string; password: string; setupToken: string }) =>
    request<{ ok: boolean }>("/api/setup/admin", {
      method: "POST",
      headers: { "x-setup-token": payload.setupToken },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
      }),
    }),
  register: (payload: unknown) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>("/api/auth/me"),
  plans: () => request<{ plans: any[] }>("/api/plans"),
  checkout: (planId: number) =>
    request<{ invoiceUrl: string; paymentId: string }>("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ planId }),
    }),
  paymentStatus: () => request<{ status: string; until?: string }>("/api/payments/status"),
  content: () => request<any>("/api/student/content"),
  adminList: (resource: string) => request<{ items: any[] }>(`/api/admin/${resource}`),
  adminSave: (resource: string, body: unknown) =>
    request<{ ok: boolean }>(`/api/admin/${resource}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  upload: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<{ key: string; url: string }>("/api/admin/upload", {
      method: "POST",
      body,
    });
  },
};
