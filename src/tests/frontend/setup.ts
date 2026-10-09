import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// jsdom has no modal dialog implementation; browser tests cover its focus behavior.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}

afterEach(() => cleanup());
