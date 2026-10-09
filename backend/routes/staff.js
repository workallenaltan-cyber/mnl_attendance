const express = require("express");
const router = express.Router();

const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");


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

    const parts =
      authHeader.split(" ");

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
      msg: "Token invalid or expired"
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
// GET STAFF LIST
//
// GET
// /api/staff-management
// =====================================================

router.get(
  "/staff-management",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            u.id,
            u.employee_id,
            u.employee_name,
            u.role,
            u.employee_status,
            u.created_at,
            u.company_code,
            c.company_name
          FROM users u
          LEFT JOIN company c
            ON u.company_code = c.company_code
          ORDER BY u.employee_id ASC
        `);

      res.json({
        success: true,
        data: result.rows
      });

    } catch (err) {

      console.error(
        "❌ Load staff error:",
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
// GET
// /api/staff-management/company
// =====================================================

router.get(
  "/staff-management/company",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(`
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

// =====================================================
// GET NEXT STAFF ID
//
// GET
// /api/staff-management/next-id/:company_code
// =====================================================

router.get(
  "/staff-management/next-id/:company_code",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const companyCode =
        req.params.company_code
          .trim()
          .toUpperCase();

      if (!companyCode) {
        return res.status(400).json({
          msg: "Company code is required"
        });
      }

      // ===============================
      // 检查 Company
      // ===============================

      const company =
        await pool.query(
          `
          SELECT company_code
          FROM company
          WHERE company_code = $1
          LIMIT 1
          `,
          [companyCode]
        );

      if (company.rows.length === 0) {
        return res.status(404).json({
          msg: "Company not found"
        });
      }

      // ===============================
      // 找该 Company 最大 Staff ID
      // ===============================

      const result =
        await pool.query(
          `
          SELECT employee_id
          FROM users
          WHERE company_code = $1
            AND employee_id ~ ('^' || $1 || '[0-9]+$')
          ORDER BY
            CAST(
              SUBSTRING(
                employee_id
                FROM LENGTH($1) + 1
              )
              AS INTEGER
            ) DESC
          LIMIT 1
          `,
          [companyCode]
        );

      let nextNumber = 1;

      if (result.rows.length > 0) {

        const lastId =
          result.rows[0].employee_id;

        const numberPart =
          lastId.substring(
            companyCode.length
          );

        const lastNumber =
          parseInt(
            numberPart,
            10
          );

        if (!isNaN(lastNumber)) {
          nextNumber =
            lastNumber + 1;
        }
      }

      // ===============================
      // 产生 Staff ID
      // ===============================

      const nextEmployeeId =
        companyCode +
        String(nextNumber).padStart(
          3,
          "0"
        );

      return res.json({
        success: true,
        employee_id:
          nextEmployeeId
      });

    } catch (err) {

      console.error(
        "❌ Generate next Staff ID error:",
        err
      );

      return res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


// =====================================================
// ADD USER
//
// POST
// /api/staff-management
// =====================================================

router.post(
  "/staff-management",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const {
        employee_id,
        employee_name,
        password,
        company_code,
        role,
        employee_status
      } = req.body;


      // =================================================
      // VALIDATION
      // =================================================

      if (
        !employee_id ||
        !employee_name ||
        !password ||
        !role
      ) {

        return res.status(400).json({
          msg: "Staff ID, name, password and role are required"
        });
      }


      const finalStatus =
        employee_status || "active";


      if (
        !["staff", "admin"].includes(role)
      ) {

        return res.status(400).json({
          msg: "Invalid role"
        });
      }


      if (
        !["active", "inactive"].includes(finalStatus)
      ) {

        return res.status(400).json({
          msg: "Invalid employee status"
        });
      }


      // =================================================
      // CHECK DUPLICATE STAFF ID
      // =================================================

      const existing =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE employee_id = $1
          LIMIT 1
          `,
          [employee_id.trim().toUpperCase()]
        );


      if (existing.rows.length > 0) {

        return res.status(409).json({
          msg: "Staff ID already exists"
        });
      }


      // =================================================
      // CHECK COMPANY
      // =================================================

      if (company_code) {

        const company =
          await pool.query(
            `
            SELECT company_code
            FROM company
            WHERE company_code = $1
            LIMIT 1
            `,
            [company_code]
          );


        if (company.rows.length === 0) {

          return res.status(400).json({
            msg: "Company not found"
          });
        }
      }


      // =================================================
      // PASSWORD HASH
      // =================================================

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );


      // =================================================
      // INSERT
      // =================================================

      const result =
        await pool.query(
          `
          INSERT INTO users
          (
            employee_id,
            employee_name,
            role,
            employee_status,
            company_code,
            password
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING
            id,
            employee_id,
            employee_name,
            role,
            employee_status,
            company_code,
            created_at
          `,
          [
            employee_id
              .trim()
              .toUpperCase(),

            employee_name.trim(),

            role,

            finalStatus,

            company_code || null,

            hashedPassword
          ]
        );


      res.json({
        success: true,
        message: "Staff added successfully",
        data: result.rows[0]
      });


    } catch (err) {

      console.error(
        "❌ Add staff error:",
        err
      );

      res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


// =====================================================
// EDIT USER
//
// PUT
// /api/staff-management/:employee_id
// =====================================================

router.put(
  "/staff-management/:employee_id",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const employeeId =
        req.params.employee_id;


      const {
        employee_name,
        company_code,
        role,
        employee_status
      } = req.body;


      // =================================================
      // VALIDATION
      // =================================================

      if (
        !employee_name ||
        !role ||
        !employee_status
      ) {

        return res.status(400).json({
          msg: "Name, role and status are required"
        });
      }


      if (
        !["staff", "admin"].includes(role)
      ) {

        return res.status(400).json({
          msg: "Invalid role"
        });
      }


      if (
        !["active", "inactive"].includes(
          employee_status
        )
      ) {

        return res.status(400).json({
          msg: "Invalid employee status"
        });
      }


      // =================================================
      // CHECK USER
      // =================================================

      const existing =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE employee_id = $1
          LIMIT 1
          `,
          [employeeId]
        );


      if (existing.rows.length === 0) {

        return res.status(404).json({
          msg: "Staff not found"
        });
      }


      // =================================================
      // CHECK COMPANY
      // =================================================

      if (company_code) {

        const company =
          await pool.query(
            `
            SELECT company_code
            FROM company
            WHERE company_code = $1
            LIMIT 1
            `,
            [company_code]
          );


        if (company.rows.length === 0) {

          return res.status(400).json({
            msg: "Company not found"
          });
        }
      }


      // =================================================
      // UPDATE
      // =================================================

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            employee_name = $1,
            company_code = $2,
            role = $3,
            employee_status = $4
          WHERE employee_id = $5
          RETURNING
            id,
            employee_id,
            employee_name,
            role,
            employee_status,
            company_code,
            created_at
          `,
          [
            employee_name.trim(),
            company_code || null,
            role,
            employee_status,
            employeeId
          ]
        );


      res.json({
        success: true,
        message: "Staff updated successfully",
        data: result.rows[0]
      });


    } catch (err) {

      console.error(
        "❌ Edit staff error:",
        err
      );

      res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


// =====================================================
// CHANGE PASSWORD
//
// PUT
// /api/staff-management/:employee_id/password
// =====================================================

router.put(
  "/staff-management/:employee_id/password",
  verify,
  verifyAdmin,
  async (req, res) => {

    try {

      const employeeId =
        req.params.employee_id;

      const {
        password
      } = req.body;


      if (!password) {

        return res.status(400).json({
          msg: "New password is required"
        });
      }


      // =================================================
      // CHECK USER
      // =================================================

      const existing =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE employee_id = $1
          LIMIT 1
          `,
          [employeeId]
        );


      if (existing.rows.length === 0) {

        return res.status(404).json({
          msg: "Staff not found"
        });
      }


      // =================================================
      // HASH PASSWORD
      // =================================================

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );


      // =================================================
      // UPDATE PASSWORD
      // =================================================

      await pool.query(
        `
        UPDATE users
        SET password = $1
        WHERE employee_id = $2
        `,
        [
          hashedPassword,
          employeeId
        ]
      );


      res.json({
        success: true,
        message: "Password updated successfully"
      });


    } catch (err) {

      console.error(
        "❌ Change password error:",
        err
      );

      res.status(500).json({
        msg: "Server error"
      });
    }
  }
);


module.exports = router;