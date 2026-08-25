// Negative control: emit the server module as a static asset next to the bundle.
export const assetUrl = new URL('../server/users.server.ts', import.meta.url).href;
