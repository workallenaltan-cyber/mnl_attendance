const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");


// =====================
// ✅ Token Middleware（统一🔥）
// =====================
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: "fail",
        message: "未登录"
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        status: "fail",
        message: "token 格式错误"
      });
    }

    const token = parts[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (err) {
    console.error("❌ TOKEN ERROR:", err.message);

    return res.status(401).json({
      status: "fail",
      message: "token 无效或已过期"
    });
  }
};


// =====================
// ✅ 登录 + GPS + 分行判断（终极版🔥）
// =====================
router.post("/login", async (req, res) => {
  try {
    let { employeeId, password, lat, lng, accuracy } = req.body;

    // =====================
    // ❌ 基本检查
    // =====================
    if (!employeeId || !password) {
      return res.status(400).json({
        status: "fail",
        message: "请输入账号和密码"
      });
    }

    employeeId = employeeId.trim().toUpperCase();

    // =====================
    // ❌ GPS检查
    // =====================
    if (!lat || !lng) {
      return res.status(400).json({
        status: "fail",
        message: "必须开启GPS"
      });
    }

    // （可选）GPS 精度检测
    if (accuracy && accuracy > 100) {
      return res.status(400).json({
        status: "fail",
        message: "GPS不准确，请到户外重试"
      });
    }

    // =====================
    // ✅ 查询用户
    // =====================
    const result = await pool.query(
      `SELECT u.employee_id, u.employee_name, u.password, c.company_name, u.role
       FROM public.users u
       INNER JOIN public.company c 
       ON u.company_code = c.company_code
       WHERE u.employee_id = $1`,
      [employeeId]
    );
	message: employeeId
    if (result.rows.length === 0) {
      return res.status(401).json({
        status: "fail",
        message: "用户不存在"
      });
    }

    const user = result.rows[0];

    // =====================
    // ❌ 密码验证
    // =====================
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        status: "fail",
        message: "密码错误"
      });
    }

    // =====================
    // ✅ 查询所有分行
    // =====================
    const companyResult = await pool.query("SELECT * FROM company");

    if (companyResult.rows.length === 0) {
      return res.status(500).json({
        status: "error",
        message: "未设置分行数据"
      });
    }

    // =====================
    // ✅ 距离计算函数
    // =====================
    function getDistance(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const toRad = deg => deg * Math.PI / 180;

      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    let matchedcompany = null;
    let nearest = null;
    let minDistance = Infinity;

    // =====================
    // 🔍 遍历分行
    // =====================
    for (let b of companyResult.rows) {
      const dist = getDistance(lat, lng, b.lat, b.lng);

      // 最近分行
      if (dist < minDistance) {
        minDistance = dist;
        nearest = b;
      }

      // 在范围内
      if (dist <= b.radius) {
        matchedcompany = b;
      }
    }

    // =====================
    // ❌ 不在任何分行范围
    // =====================
    if (!matchedcompany) {
      return res.status(403).json({
        status: "fail",
        message: `❌ 不在分行范围，最近：${nearest.company_name} (${Math.round(minDistance)}m)`
      });
    }

    // =====================
    // ❌ JWT 检查
    // =====================
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET 未设置");
      return res.status(500).json({
        status: "error JWT",
        message: "服务器配置错误"
      });
    }

    // =====================
    // ✅ 生成 Token
    // =====================
    const token = jwt.sign(
      {
        id: user.employee_id,
        name: user.employee_name,
        //company: user.company_name,
        role: user.role,
        company: matchedcompany.company_name
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    console.log("✅ 登录成功:", user.employee_id, "@", matchedcompany.company_name);

    // =====================
    // ✅ 返回
    // =====================
    res.json({
      status: "success",
      message: "登录成功",
      token,
      company: matchedcompany.company_name,
      distance: Math.round(minDistance),
      user: {
        employeeId: user.employee_id,
        name: user.employee_name,
        //company: user.company_name,
        role: user.role
      }
    });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({
      status: "error",
      message: "服务器错误2"
    });
  }
});


// =====================
// ✅ 获取当前用户（用 middleware🔥）
// =====================
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    status: "success",
    user: req.user
  });
});


// =====================
// ✅ 导出
// =====================
module.exports = router;