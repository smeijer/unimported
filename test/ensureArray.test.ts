import { ensureArray } from '../src/ensureArray';

it('shoudl return the given value if it is an array', () => {
  const arrayWithTestString = ensureArray(['test']);

  expect(arrayWithTestString).toEqual(['test']);
});

it('should return an array with the given value', () => {
  const getFourtyTwo: () => number = () => 42;
  const fourtyTwo = 42;
  const objFourtyTwo = { num: 42 };

  const testPrimitive = ensureArray(fourtyTwo);
  const testFunction = ensureArray(getFourtyTwo);
  const testObject = ensureArray(objFourtyTwo);

  expect(testPrimitive).toEqual([fourtyTwo]);
  expect(testFunction).toEqual([getFourtyTwo]);
  expect(testObject).toEqual([objFourtyTwo]);
});
