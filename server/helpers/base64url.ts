function encode(stringToHash: string): string {
  return Buffer.from(stringToHash).toString('base64url');
}

export default encode;
