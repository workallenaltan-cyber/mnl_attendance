
const TELEGRAM_API = "https://api.telegram.org";

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Always use Malaysia timezone, independent of Render server timezone.
function getMalaysiaDateTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return {
    date: `${values.day}/${values.month}/${values.year}`,
    time: `${values.hour}:${values.minute}:${values.second}`
  };
}

async function sendTelegramNotification(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Missing Telegram environment variables");
    return false;
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML"
        }),
        signal: AbortSignal.timeout(5000)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram send failed:", result.description);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Telegram error:", err.message);
    return false;
  }
}

function buildAttendanceMessage({
  type,
  employeeId,
  employeeName,
  companyName,
  date,
  time,
  lat,
  lng,
  reason,
  distance
}) {
  const titles = {
    checkin: "🟢 ATTENDANCE CHECK IN",
    checkout: "🔵 ATTENDANCE CHECK OUT",
    failed: "🔴 ATTENDANCE FAILED"
  };

  // Generate the Telegram display time in Malaysia timezone.
  // Do not use the potentially misconverted date/time from attendance.js.
  const malaysiaDateTime = getMalaysiaDateTime();

  const lines = [
    `<b>${titles[type] || "⚠️ ATTENDANCE NOTICE"}</b>`,
    "",
    `👤 Employee ID: ${escapeHtml(employeeId)}`,
    `🧑 Employee Name: ${escapeHtml(employeeName || "Unknown")}`,
    `🏢 Company: ${escapeHtml(companyName || "Unknown")}`,
    `📅 Date: ${escapeHtml(malaysiaDateTime.date)}`,
    `🕒 Time: ${escapeHtml(malaysiaDateTime.time)}`
  ];

  const hasCoordinates =
    lat !== undefined &&
    lat !== null &&
    lng !== undefined &&
    lng !== null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180;

  if (hasCoordinates) {
    const latitude = Number(lat);
    const longitude = Number(lng);

    const mapUrl =
      `https://www.google.com/maps?q=${latitude},${longitude}`;

    const locationLabel =
      type === "checkin"
        ? "📍 Check-in Location"
        : type === "checkout"
          ? "📍 Check-out Location"
          : "📍 Recorded Location";

    lines.push(
      `${locationLabel}: <a href="${mapUrl}">Open in Google Maps ↗</a>`,
      `Coordinates: ${latitude}, ${longitude}`
    );
  } else {
    lines.push("📍 Location: GPS coordinates unavailable");
  }

  if (type === "failed") {
    lines.push(`❗ Reason: ${escapeHtml(reason || "Unknown")}`);
  }

  if (distance !== undefined && distance !== null) {
    lines.push(
      `📏 Nearest branch distance: ${Math.round(distance)} m`
    );
  }

  return lines.join("\n");
}

module.exports = {
  sendTelegramNotification,
  buildAttendanceMessage
};
