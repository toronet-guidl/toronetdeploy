import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deployContract } = require('./index.js');

export { deployContract };
export default { deployContract };
