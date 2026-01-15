import { createHash } from 'crypto';

function md5(stringToHash) {
  return createHash('md5').update(stringToHash).digest('hex');
}

export default md5;
