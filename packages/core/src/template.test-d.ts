/** Compile-time API proofs for typed native template event handlers. */
import type { TypedEventHandler } from './index.js';

const onKeydown: TypedEventHandler<'keydown'> = (event) => {
  const key: string = event.key;
  const keyboardEvent: KeyboardEvent = event;
  void key;
  void keyboardEvent;
};

const onClick: TypedEventHandler<'click'> = (event) => {
  const mouseEvent: MouseEvent = event;
  void mouseEvent;
};

void onKeydown;
void onClick;

// @ts-expect-error keydown handlers receive KeyboardEvent, not MouseEvent
const wrongEvent: TypedEventHandler<'keydown'> = (event: MouseEvent) => {
  void event;
};

// @ts-expect-error event names are constrained to HTMLElementEventMap
type UnknownEvent = TypedEventHandler<'not-a-native-event'>;
