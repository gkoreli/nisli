import { component, html } from '../../core/src/index.js';
import '../../ui/registry/default/ui/accordion.js';

// Issue #1's platform-only reproduction. Register before parsing/cloning:
// upgrading a tree after insertion would exercise a different lifecycle path.
const order = [];
let childSawContext = false;
class ParentElement extends HTMLElement {
  connectedCallback() {
    order.push('parent');
    Reflect.set(this, 'context', true);
  }
}
class ChildElement extends HTMLElement {
  connectedCallback() {
    order.push('child');
    childSawContext = Reflect.get(this.closest('x-parent') ?? {}, 'context') === true;
  }
}
customElements.define('x-parent', ParentElement);
customElements.define('x-child', ChildElement);
const template = document.createElement('template');
template.innerHTML = '<x-parent><x-child></x-child></x-parent>';
document.body.append(template.content.cloneNode(true));

// Deliberately preserve the issue's plain-HTML-in-one-template reproduction.
// Replacing it with typed factories or connected-host innerHTML would bypass
// the cloned nested fragment whose connection ordering this proof protects.
component('accordion-test-host', () => html`
  <ui-accordion type="single" collapsible>
    <ui-accordion-item value="first">
      <ui-accordion-trigger>First question</ui-accordion-trigger>
      <ui-accordion-content>First answer</ui-accordion-content>
    </ui-accordion-item>
  </ui-accordion>
`);

// Two mounts exercise both the first parse and the cached-template clone.
for (let index = 0; index < 2; index += 1) {
  document.body.append(document.createElement('accordion-test-host'));
}
window.__compoundLifecycleProof = { order, childSawContext };
