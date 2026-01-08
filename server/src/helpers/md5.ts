
import crypto from "crypto";

function md5(stringToHash: any) {
    return crypto.createHash('md5').update(stringToHash).digest("hex");
}

export default md5;

module.exports = md5;