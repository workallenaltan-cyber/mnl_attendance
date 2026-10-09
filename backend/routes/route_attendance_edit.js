const express = require("express");
const router = express.Router();

const pool = require("../db");
const jwt = require("jsonwebtoken");


// =====================================================
// TOKEN VERIFY
// =====================================================

function verify(req, res, next) {

  try {

    const authHeader =
      req.headers.authorization ||
      req.headers.Authorization;

    if (!authHeader) {
      return res.status(401).json({
        msg: "Please Login"
      });
    }

    const parts = authHeader.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer"
    ) {
      return res.status(401).json({
        msg: "Invalid token"
      });
    }

    const token = parts[1];

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    req.user = decoded;

    next();

  } catch (err) {

    console.error(
      "❌ TOKEN ERROR:",
      err.message
    );

    return res.status(401).json({
      msg: "token expired"
    });
  }
}


// =====================================================
// ADMIN VERIFY
// =====================================================

function verifyAdmin(req, res, next) {

  if (
    !req.user ||
    req.user.role !== "admin"
  ) {

    return res.status(403).json({
      msg: "Access denied"
    });
  }

  next();
}


// =====================================================
// MALAYSIA TIME
// =====================================================

function getMalaysiaTime() {

  return new Date(
    new Date().toLocaleString(
      "en-US",
      {
        timeZone: "Asia/Kuala_Lumpur"
      }
    )
  );
}

function combineDateTime(date, time) {

  if (!date || !time) {
    return null;
  }

  return `${date} ${time}:00`;
}


// =====================================================
// REMARK TIME FORMAT
// DD-MM-YYYY HH:mm
// =====================================================

function formatRemarkTime(date) {

  const day =
    String(date.getDate())
      .padStart(2, "0");

  const month =
    String(date.getMonth() + 1)
      .padStart(2, "0");

  const year =
    date.getFullYear();

  const hours =
    String(date.getHours())
      .padStart(2, "0");

  const minutes =
    String(date.getMinutes())
      .padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}


// =====================================================
// GET ATTENDANCE BY DATE + STAFF
//
// GET
// /api/attendance/check
//
// ?employee_id=AH001
// &date=2026-10-07
// =====================================================

router.get(
  "/attendance-edit/check",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const {
        employee_id,
        date
      } = req.query;


      if (!employee_id || !date) {

        return res.status(400).json({
          msg: "Employee ID and date are required"
        });
      }


      const result =
        await pool.query(
          `
          SELECT
            id,
            employee_id,
            date,
            check_in_time,
            check_out_time,
            check_in_lat,
            check_in_lng,
            check_out_lat,
            check_out_lng,
            check_in_ip,
            check_out_ip,
            check_area,
            remark
          FROM attendance
          WHERE employee_id = $1
            AND date = $2
          LIMIT 1
          `,
          [
            employee_id,
            date
          ]
        );


      if (result.rows.length === 0) {

        return res.json({
          success: true,
          exists: false,
          data: null
        });
      }


      return res.json({
        success: true,
        exists: true,
        data: result.rows[0]
      });


    } catch (err) {

      console.error(
        "❌ Attendance check error:",
        err
      );

      return res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


// =====================================================
// ADD ATTENDANCE
//
// POST
// /api/attendance
// =====================================================

router.post(
  "/attendance-edit",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const {
        employee_id,
        date,
        check_area,
        check_in_time,
        check_out_time
      } = req.body;


      if (
        !employee_id ||
        !date
      ) {

        return res.status(400).json({
          msg: "Employee and date are required"
        });
      }
		
		
		const dbCheckInTime =
		  combineDateTime(date, check_in_time);

		const dbCheckOutTime =
		  combineDateTime(date, check_out_time);

      // =================================================
      // CHECK DUPLICATE
      // =================================================

      const existing =
        await pool.query(
          `
          SELECT id
          FROM attendance
          WHERE employee_id = $1
            AND date = $2
          LIMIT 1
          `,
          [
            employee_id,
            date
          ]
        );


      if (existing.rows.length > 0) {

        return res.status(409).json({
          msg: "Attendance already exists"
        });
      }


      // =================================================
      // LOGIN ID
      // =================================================

      const loginId =
        req.user.id;


      // =================================================
      // REMARK
      // =================================================

      const remark =
        `${loginId} added attendance at ${formatRemarkTime(
          getMalaysiaTime()
        )}`;


      // =================================================
      // INSERT
      //
      // GPS / IP = NULL
      // =================================================

      const result =
        await pool.query(
          `
          INSERT INTO attendance
          (
            employee_id,
            date,
            check_area,
            check_in_time,
            check_out_time,
            check_in_lat,
            check_in_lng,
            check_out_lat,
            check_out_lng,
            check_in_ip,
            check_out_ip,
            remark
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            $6
          )
          RETURNING *
          `,
          [
			  employee_id,
			  date,
			  check_area || null,
			  dbCheckInTime,
			  dbCheckOutTime,
			  remark
			]
        );


      return res.json({
        success: true,
        message: "Attendance added",
        data: result.rows[0]
      });


    } catch (err) {

      console.error(
        "❌ Attendance ADD error:",
        err
      );

      return res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


// =====================================================
// EDIT ATTENDANCE
//
// PUT
// /api/attendance/:id
// =====================================================

router.put(
  "/attendance-edit/:id",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const attendanceId =
        req.params.id;


      const {
        employee_id,
        date,
        check_area,
        check_in_time,
        check_out_time
      } = req.body;


      if (
        !employee_id ||
        !date
      ) {

        return res.status(400).json({
          msg: "Employee and date are required"
        });
      }


      // =================================================
      // CHECK RECORD
      // =================================================

      const existing =
        await pool.query(
          `
          SELECT *
          FROM attendance
          WHERE id = $1
          LIMIT 1
          `,
          [
            attendanceId
          ]
        );


      if (existing.rows.length === 0) {

        return res.status(404).json({
          msg: "Attendance not found"
        });
      }


      // =================================================
      // CHECK DUPLICATE
      //
      // 不可以把记录改成另一个已经存在的
      // employee + date
      // =================================================

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM attendance
          WHERE employee_id = $1
            AND date = $2
            AND id <> $3
          LIMIT 1
          `,
          [
            employee_id,
            date,
            attendanceId
          ]
        );


      if (duplicate.rows.length > 0) {

        return res.status(409).json({
          msg: "Another attendance record already exists"
        });
      }
	  
		const dbCheckInTime =
		  combineDateTime(date, check_in_time);

		const dbCheckOutTime =
		  combineDateTime(date, check_out_time);


      // =================================================
      // LOGIN ID
      // =================================================

      const loginId =
        req.user.id;


      // =================================================
      // REMARK
      // =================================================

      const remark =
        `${loginId} edited attendance at ${formatRemarkTime(
          getMalaysiaTime()
        )}`;


      // =================================================
      // UPDATE
      //
      // IMPORTANT:
      // GPS / IP 不修改
      // =================================================

      const result =
        await pool.query(
          `
          UPDATE attendance
          SET
            employee_id = $1,
            date = $2,
            check_area = $3,
            check_in_time = $4,
            check_out_time = $5,
            remark = $6
          WHERE id = $7
          RETURNING *
          `,
			[
			  employee_id,
			  date,
			  check_area || null,
			  dbCheckInTime,
			  dbCheckOutTime,
			  remark,
			  attendanceId
			]
        );


      return res.json({
        success: true,
        message: "Attendance updated",
        data: result.rows[0]
      });


    } catch (err) {

      console.error(
        "❌ Attendance EDIT error:",
        err
      );

      return res.status(500).json({
        msg: "Server error"
      });
    }
  }
);

// =====================================================
// GET ACTIVE STAFF
//
// GET /api/attendance-edit/staff
//
// role = staff
// employee_status = active
// =====================================================

router.get(
  "/attendance-edit/staff",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT
          employee_id,
          employee_name
        FROM users
        WHERE role = 'staff'
          AND employee_status = 'active'
        ORDER BY employee_id ASC
      `);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (err) {

      console.error(
        "❌ Load active staff error:",
        err
      );

      res.status(500).json({
        msg: "Server error"
      });
    }
  }
);

// =====================================================
// GET COMPANY
//
// GET /api/attendance-edit/company
// =====================================================

router.get(
  "/attendance-edit/company",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT
          company_code,
          company_name
        FROM company
        ORDER BY company_code ASC
      `);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (err) {

      console.error(
        "❌ Load company error:",
        err
      );

      res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


module.exports = router;