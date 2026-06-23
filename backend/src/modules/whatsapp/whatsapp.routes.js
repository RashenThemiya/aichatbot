const express = require("express");

const whatsappController = require("./whatsapp.controller");

const router = express.Router();

router.get("/webhook", whatsappController.verifyWebhook);
router.post("/webhook", whatsappController.receiveWebhook);
router.post("/send", whatsappController.sendTextMessage);

module.exports = router;