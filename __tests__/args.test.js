const { parseConstructorArgs } = require('../src/args');

describe('parseConstructorArgs', () => {
  test('empty/nullish input returns []', () => {
    expect(parseConstructorArgs(undefined)).toEqual([]);
    expect(parseConstructorArgs(null)).toEqual([]);
    expect(parseConstructorArgs('')).toEqual([]);
  });

  test('valid JSON array of strings', () => {
    expect(parseConstructorArgs('["0xabc", "1000"]')).toEqual([
      '0xabc',
      '1000',
    ]);
  });

  test('valid JSON array of mixed types', () => {
    expect(parseConstructorArgs('["0xabc", 1000, true]')).toEqual([
      '0xabc',
      1000,
      true,
    ]);
  });

  test('invalid JSON string starting with [', () => {
    expect(() => parseConstructorArgs('["0xabc",')).toThrow(
      'Invalid JSON for --args',
    );
  });

  test('CSV single value', () => {
    expect(parseConstructorArgs('0xabc')).toEqual(['0xabc']);
  });

  test('CSV multiple values', () => {
    expect(parseConstructorArgs('0xabc,1000')).toEqual(['0xabc', 1000]);
  });

  test('CSV with extra whitespace', () => {
    expect(parseConstructorArgs(' 0xabc , 1000 ')).toEqual(['0xabc', 1000]);
  });

  test('CSV with empty segments', () => {
    expect(parseConstructorArgs('0xabc,,1000')).toEqual(['0xabc', 1000]);
  });
});
