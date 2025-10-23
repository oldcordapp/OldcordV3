const express = require('express');
const globalUtils = require('../helpers/globalutils');
const config = globalUtils.config;

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        ping: "pong! this is oldcord! not spacebar! you got FOOLED!",
        instance: {
            id: "what the fuck is this?",
            name: config.instance.name,
            description: config.instance.description,
            image: null,
            correspondenceEmail: null,
            correspondenceUserID: null,
            frontPage: null,
            tosPage: config.instance.legal.terms
        }
    })
})

module.exports = router