import { ensureArray } from '../ensureArray';

it('should return the given value if it is an array', () => {
  const fourtyTwoArray = [42];
  const getFourtyTwoArray = [(): number => 42];
  const objFourtyTwoArray = [{ num: 42 }];

  const ensureArrayFourtyTwoArray = ensureArray(fourtyTwoArray);
  const ensureArrayGetFourtyTwoArray = ensureArray(getFourtyTwoArray);
  const ensureArrayObjFourtyTwoArray = ensureArray(objFourtyTwoArray);

  expect(ensureArrayFourtyTwoArray).toBe(fourtyTwoArray);
  expect(ensureArrayGetFourtyTwoArray).toBe(getFourtyTwoArray);
  expect(ensureArrayObjFourtyTwoArray).toBe(objFourtyTwoArray);
});

it('should return an array with the given value', () => {
  const fourtyTwo = 42;
  const getFourtyTwo = (): number => 42;
  const objFourtyTwo = { num: 42 };

  const fourtyTwoArray = ensureArray(fourtyTwo);
  const getFourtyTwoArray = ensureArray(getFourtyTwo);
  const objFourtyTwoArray = ensureArray(objFourtyTwo);

  expect(fourtyTwoArray).toEqual([fourtyTwo]);
  expect(getFourtyTwoArray).toEqual([getFourtyTwo]);
  expect(objFourtyTwoArray).toEqual([objFourtyTwo]);
});
