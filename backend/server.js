require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const pool = require("./db"); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors(
	{
	  origin: "*"
	}));
app.use(express.json());

// ✅ test-db 放最前面（避免被 static 吃掉）
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      time: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

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
console.log("DATABASE_URL:", process.env.DATABASE_URL);