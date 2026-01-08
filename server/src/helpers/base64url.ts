function encode(stringToHash: any) {
    return Buffer.from(stringToHash).toString('base64url');
}

export default encode;

module.exports = encode;