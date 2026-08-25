// Negative control: statically analysable dynamic import of a server module.
// Dynamic import is the subject under test here — a static import would not
// exercise the resolveId path this control probes.
export const load = async () => {
  const module = await import('../server/users.server.js');
  return Object.keys(module).sort();
};
