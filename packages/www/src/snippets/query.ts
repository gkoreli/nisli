import { component, query, computed, html } from '@nisli/core';

interface UserProps {
  id: string;
}

component<UserProps>('user-card', (props) => {
  const user = query(
    () => ['user', props.id.value], // cache key (tracked)
    () => fetch(`/api/users/${props.id.value}`).then((r) => r.json()),
  );

  const view = computed(() => {
    if (user.loading.value) return html`<p>Loading…</p>`;
    const err = user.error.value;
    if (err) return html`<p>Error: ${err.message}</p>`;
    return html`<p>${user.data.value?.name}</p>`;
  });

  return html`${view}`;
});
