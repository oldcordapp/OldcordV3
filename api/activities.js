const express = require('express');
const router = express.Router({ mergeParams: true });

router.get("/statistics/applications/:applicationid", async (req, res) => {
    return res.status(200).json([]);
});

module.exports = router;