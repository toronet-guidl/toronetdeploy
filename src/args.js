function parseConstructorArgs(argStr) {
  if (!argStr) return [];
  argStr = argStr.trim();
  if (argStr.startsWith('[')) {
    try {
      return JSON.parse(argStr);
    } catch (e) {
      throw new Error('Invalid JSON for --args');
    }
  }
  // comma-separated
  return argStr
    .split(',')
    .map((s) => {
      s = s.trim();
      if (s === 'true') return true;
      if (s === 'false') return false;
      if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
      return s;
    })
    .filter((s) => s !== '');
}

module.exports = { parseConstructorArgs };
