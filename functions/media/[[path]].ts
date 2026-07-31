
import { type Env } from "../_lib/core";

type Context = {
  env: Env;
  params: { path?: string[] | string };
};

export const onRequestGet = async (context: Context): Promise<Response> => {
  const value = context.params.path;
  const encoded = Array.isArray(value) ? value.join("/") : value || "";
  const key = decodeURIComponent(encoded);
  const object = await context.env.MEDIA.get(key);

  if (!object) return new Response("Arquivo não encontrado.", { status: 404 });

  const headers = new Headers();
  headers.set("content-type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("cache-control", "public, max-age=86400");
  if (object.httpEtag) headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
};
