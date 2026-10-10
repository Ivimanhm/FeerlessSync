import { cleanup } from '@testing-library/preact';
import { afterEach, vi } from 'vitest';

// jsdom has no layout engine; browser tests verify resize-driven alignment.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

// jsdom has no modal dialog implementation; browser tests cover its focus behavior.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}

afterEach(() => cleanup());
