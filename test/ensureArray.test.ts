import { ensureArray } from '../src/ensureArray';

it('any value passed should return array', () => {
  const arrayWithOne = ensureArray(['test']);
  const numberOne = ensureArray('test');

  expect(arrayWithOne).toEqual(['test']);
  expect(numberOne).toEqual(['test']);
});
