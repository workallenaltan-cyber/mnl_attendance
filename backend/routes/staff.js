const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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



// =============================
// ✅ GET staff
// =============================
router.get("/staffload", verify, verifyAdmin, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT u.employee_id,u.employee_name,u.role,c.company_code,c.company_name
	   FROM users u
	   JOIN company c ON u.company_code = c.company_code
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});



// =============================
// ✅ ADD
// =============================
router.post("/", verify, verifyAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const adminId = req.user.id;

    const userRes = await pool.query(
      "SELECT company_code FROM users WHERE id=$1",
      [adminId]
    );

    const companyCode = userRes.rows[0].company_code;

    const countRes = await pool.query(
      "SELECT COUNT(*) FROM users WHERE company_code=$1",
      [companyCode]
    );

    const count = parseInt(countRes.rows[0].count) + 1;

    const employeeId =
      companyCode + String(count).padStart(4, "0");

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO users (employee_id, name, email, password, role, company_code)
      VALUES ($1,$2,$3,$4,'staff',$5)
    `, [employeeId, name, email, hashed, companyCode]);

    res.json({ msg: "Staff added" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// =============================
// ✅ Admin check
// =============================
function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ msg: "无权限" });
  }
  next();
}

module.exports = router;