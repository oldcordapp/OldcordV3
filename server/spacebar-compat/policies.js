const express = require('express');
const gateway = require('../gateway');
const globalUtils = require('../helpers/globalutils');
const config = globalUtils.config;

const router = express.Router();

router.get("/instance/domains", (req, res) => {
    res.json({
        cdn: `${config.secure ? "https://" : "http://"}${global.full_url}`,
        gateway: globalUtils.generateGatewayURL(req),
        defaultApiVersion: "6",
        apiEndpoint: `${config.secure ? "https://" : "http://"}${global.full_url}/api`
    })
})

module.exports = router