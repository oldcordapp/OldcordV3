function encode(stringToHash) {
  return Buffer.from(stringToHash).toString('base64url');
}

module.exports = encode;
