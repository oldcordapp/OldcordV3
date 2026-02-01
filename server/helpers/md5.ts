import { createHash } from 'crypto';

function md5(stringToHash: string): string {
  return createHash('md5').update(stringToHash).digest('hex');
}

export default md5;
