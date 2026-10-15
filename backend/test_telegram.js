
require("dotenv").config();

const {
  sendTelegramNotification
} = require("./telegram");

(async () => {
  const ok = await sendTelegramNotification(
    "🟢 <b>MNL ATTENDANCE TEST</b>\n\nTelegram notification is working!"
  );

  console.log("Telegram test result:", ok);
})();
