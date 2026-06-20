const express = require("express");

const smsController = require("./sms.controller");

const router = express.Router();

router.post("/webhook", smsController.receiveWebhook);
router.post("/status", smsController.receiveStatus);
router.post("/send", smsController.sendTextMessage);

module.exports = router;
