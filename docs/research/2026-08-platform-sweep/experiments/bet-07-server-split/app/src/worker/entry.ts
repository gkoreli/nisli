import manifest from 'virtual:nisli-server-fns';

export const manifestIds = Object.keys(manifest).sort();

export const manifestNames = Object.fromEntries(
  Object.entries(manifest).map(([id, entry]) => [id, `${entry.module}#${entry.name}`]),
);

export const dispatch = async (id: string, input: unknown, request: Request) => {
  const entry = manifest[id];
  if (!entry) return { ok: false as const, error: { code: 'UNKNOWN_FN' } };
  const module = await entry.load();
  const data = await module[entry.name](input, { request });
  return { ok: true as const, data };
};

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const id = url.pathname.replace('/_nisli/fn/', '');
    const { input } = await request.json();
    const body = await dispatch(id, input, request);
    return new Response(JSON.stringify(body), {
      status: body.ok ? 200 : 404,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  },
};
