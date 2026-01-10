const crypto = require('crypto');

function md5(stringToHash) {
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

module.exports = md5;
