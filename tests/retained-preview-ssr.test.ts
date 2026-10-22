import { expect, it } from 'vitest';
import { mountRetainedPreview } from '../src/retained-preview';

it('imports and returns a harmless cleanup without browser globals during SSR', () => {
  expect(typeof document).toBe('undefined');
  expect(() => mountRetainedPreview(null, null)()).not.toThrow();
});
