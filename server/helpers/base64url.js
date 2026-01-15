function encode(stringToHash) {
  return Buffer.from(stringToHash).toString('base64url');
}

export default encode;
