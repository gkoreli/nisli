// Negative control: runtime-computed dynamic import — invisible to resolveId.
// A static import cannot express this control; the whole point is that the
// specifier is not a literal, so no bundler hook ever sees it.
const specifier = ['..', 'server', 'users.server.js'].join('/');

export const load = async () => {
  const module = await import(/* @vite-ignore */ specifier);
  return Object.keys(module).sort();
};
