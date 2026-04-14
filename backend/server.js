require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors(
	{
	  origin: "*"
	}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});
// routes
app.use("/api", require("./routes/auth"));
app.use("/api", require("./routes/attendance"));
app.use("/api", require("./routes/staff"));

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

const bcrypt = require("bcryptjs");

console.log(
  "TEST:",
  await bcrypt.compare("admin123", "$2b$10$F1FoQpjwn8Hk4Ks5SXGYK.Ag1.lVxmF23g/M8Cs.Io11XdaKfNFmy")
);

/*const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ 测试 API
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// ✅ 测试数据库
const pool = require("./db");

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(err.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});*/