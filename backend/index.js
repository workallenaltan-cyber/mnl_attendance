// =====================
// ✅ 引入
// =====================
const express = require("express");
const pkg = require("pg");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const { Pool } = pkg;

// =====================
// ✅ 初始化
// =====================
const app = express();

// =====================
// ✅ 中间件
// =====================
app.use(cors({
  origin: "*"
}));

app.use(express.json());

// ✅ 前端页面
app.use(express.static(path.join(__dirname, "public")));

// =====================
// ✅ 数据库
// =====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// =====================
// ✅ 测试
// =====================
app.get("/", (req, res) => {
  res.send("API running 🚀");
});

// =====================
// ✅ 路由（🔥重点）
// =====================
const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");

// 👉 登录
app.use("/api", authRoutes);

// 👉 打卡 / 状态 / 全部记录
app.use("/api", attendanceRoutes);

// =====================
// ❗ 启动
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});