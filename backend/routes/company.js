const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");


// =============================
// ✅ Token 验证（最终版🔥）
// =============================
function verify(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // ✅ 支持 URL token（给 Excel 用）
    let token = null;

    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    // 👉 fallback（export 用）
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ msg: "未登录" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (err) {
    console.error("❌ TOKEN ERROR:", err.message);
    return res.status(401).json({ msg: "token 无效或已过期" });
  }
}

router.get("/company",verify, async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT company_code, company_name FROM company ORDER BY company_name"
    );
	
    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      status: "error",
      message: "Server Error"
    });
  }
});

module.exports = router;