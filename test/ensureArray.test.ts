import { ensureArray } from '../src/ensureArray';

it('any value passed should return array', () => {
  const arrayWithTestSting = ensureArray(['test']);
  const testString = ensureArray('test');

  expect(arrayWithTestSting).toEqual(['test']);
  expect(testString).toEqual(['test']);
});
