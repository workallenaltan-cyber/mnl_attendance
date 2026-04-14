const express = require("express");
const router = express.Router();
const pool = require("../db");
const verifyToken = require("../middleware/authMiddleware");

// 查看所有记录
router.get("/all", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.sendStatus(403);

  const data = await pool.query("SELECT * FROM attendance ORDER BY date DESC");

  res.json(data.rows);
});

// 删除记录
router.delete("/record/:id", verifyToken, async (req, res) => {
  await pool.query("DELETE FROM attendance WHERE id=$1", [req.params.id]);
  res.json({ msg: "Deleted" });
});

module.exports = router;