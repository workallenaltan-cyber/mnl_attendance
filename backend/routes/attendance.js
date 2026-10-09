const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");

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
      return res.status(401).json({ msg: "Please Login" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (err) {
    console.error("❌ TOKEN ERROR:", err.message);
    return res.status(401).json({ msg: "token expired" });
  }
}


// =============================
// ✅ 马来西亚时间
// =============================
function getMalaysiaTime() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
  );
}

function getToday() {
  return getMalaysiaTime().toISOString().split("T")[0];
}


// =============================
// ✅ 获取状态
// =============================
router.get("/status", verify, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = getToday();

    const result = await pool.query(
      "SELECT * FROM attendance WHERE employee_id=$1 AND date=$2",
      [employeeId, today]
    );

    if (result.rows.length === 0) {
      return res.json({ status: "not_checked_in" });
    }

    if (!result.rows[0].check_out_time) {
      return res.json({ status: "checked_in" });
    }

    return res.json({ status: "completed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "error" });
  }
});

// =============================
// ✅ 计算距离（米）Haversine
// =============================
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// =============================
// ✅ 打卡（企业安全版🔥）
// =============================
router.post("/check", verify, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { lat, lng } = req.body;

    // ✅ IP（适配 Render）
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";

    // ❌ GPS 检查
    if (!lat || !lng || lat == 0 || lng == 0) {
      return res.status(400).json({ msg: "GPS lost" });
    }

    const now = getMalaysiaTime();
    const today = getToday();

    const result = await pool.query(
      "SELECT * FROM attendance WHERE employee_id=$1 AND date=$2",
      [employeeId, today]
    );
	
	// =============================
	// ✅ 查询所有分行
	// =============================
	const companyRes = await pool.query("SELECT * FROM company");

	if (companyRes.rows.length === 0) {
	  return res.status(400).json({ msg: "no branch" });
	}

	let matchedCompany = null;
	let nearest = null;
	let minDistance = Infinity;

	// =============================
	// ✅ 遍历所有分行
	// =============================
	for (let c of companyRes.rows) {
	  const dist = getDistance(lat, lng, c.lat, c.lng);

	  // 最近分行
	  if (dist < minDistance) {
		minDistance = dist;
		nearest = c;
	  }

	  // 在范围内
	  if (dist <= c.radius) {
		matchedCompany = c;
	  }
	}
	const nearCompany = matchedCompany.company_name;
	// =============================
	// ❌ 不在任何分行范围
	// =============================
	if (!matchedCompany) {
	  return res.status(403).json({
		msg: `❌ Out of Range，close to：${nearest.company_name} (${Math.round(minDistance)}m)`
	  });
	}
	
	

    // =============================
    // ✅ 上班
    // =============================
    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO attendance 
        (employee_id, date, check_in_time, check_in_lat, check_in_lng, check_in_ip,check_area)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [employeeId, today, now, lat, lng, ip,nearCompany]
      );

      return res.json({
        status: "checkin",
		msg: `Check in Successful @ ${matchedCompany.company_name}`
      });
    }

    const record = result.rows[0];

    // =============================
    // ✅ 下班
    // =============================
    if (!record.check_out_time) {
      await pool.query(
        `UPDATE attendance 
         SET check_out_time=$1,
             check_out_lat=$2,
             check_out_lng=$3,
             check_out_ip=$4
         WHERE id=$5`,
        [now, lat, lng, ip, record.id]
      );

      return res.json({
        status: "checkout",
        msg: `Checkout Successfull @ ${matchedCompany.company_name}`
      });
    }

    return res.json({
      status: "done",
      msg: "Today already check.",
	   
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "server error 1" });
  }
});


// =============================
// ✅ 所有记录
// =============================
router.get("/all", verify, verifyAdmin, async (req, res) => { 
  try {

    let month = req.query.month; // ✅ 用 let

    // ✅ 没传 → 默认上个月
    if (!month) {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);

      const year = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");

      month = `${year}-${m}`;
    }

    let sql = `
      SELECT 
        attendance.employee_id,
        users.employee_name,
        attendance.check_area as company_name,
        TO_CHAR(attendance.date, 'DD/MM/YYYY') AS adate,
        TO_CHAR(attendance.check_in_time, 'HH24:MI:SS') AS check_in_time,
        TO_CHAR(attendance.check_out_time, 'HH24:MI:SS') AS check_out_time,
        attendance.check_in_lat,
        attendance.check_in_lng,
        attendance.check_out_lat,
        attendance.check_out_lng,
        attendance.check_in_ip,
        attendance.check_out_ip,
		attendance.remark
      FROM attendance
      INNER JOIN users ON attendance.employee_id = users.employee_id
      LEFT JOIN company ON users.company_code = company.company_code
      WHERE TO_CHAR(attendance.date, 'YYYY-MM') = $1
      ORDER BY attendance.date DESC
    `;

    const result = await pool.query(sql, [month]);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ /api/all error:", err);
    res.status(500).json({ msg: "server error" });
  }
});



// =============================
// ✅ 导出 Excel（支持 token🔥）
// =============================
/*router.get("/export", verify, verifyAdmin, async (req, res) => { 
  try {
    const result = await pool.query(
      `SELECT 
        attendance.employee_id,
        users.employee_name,
        company.company_name,
        TO_CHAR(attendance.date, 'DD/MM/YYYY') AS adate,
        TO_CHAR(attendance.check_in_time, 'HH24:MI:SS') AS check_in_time,
        TO_CHAR(attendance.check_out_time, 'HH24:MI:SS') AS check_out_time,
        attendance.check_in_lat,
        attendance.check_in_lng,
        attendance.check_out_lat,
        attendance.check_out_lng,
        attendance.check_in_ip,
        attendance.check_out_ip
      FROM attendance
      INNER JOIN users ON attendance.employee_id = users.employee_id
      LEFT JOIN company ON users.company_code = company.company_code
      ORDER BY attendance.date DESC`
    );
	
	
    // ✅ 加月份过滤
    if (month) {
      sql += ` WHERE DATE_FORMAT(a.date, '%Y-%m') = ?`;
    }
	
	const [rows] = await db.query(sql, month ? [month] : []);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.columns = [
      { header: "员工ID", key: "employee_id" },
      { header: "姓名", key: "employee_name" },
      { header: "公司", key: "company_name" },
      { header: "日期", key: "adate" },
      { header: "上班时间", key: "check_in_time" },
      { header: "下班时间", key: "check_out_time" },
      { header: "上班纬度", key: "check_in_lat" },
      { header: "上班经度", key: "check_in_lng" },
      { header: "下班纬度", key: "check_out_lat" },
      { header: "下班经度", key: "check_out_lng" },
      { header: "上班IP", key: "check_in_ip" },
      { header: "下班IP", key: "check_out_ip" }
    ];

    result.rows.forEach(row => sheet.addRow(row));

	sheet.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value ? cell.value.toString() : "";
        maxLength = Math.max(maxLength, val.length);
      });
      column.width = maxLength + 2;
    });


    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=attendance.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("导出失败");
  }
});*/

router.get("/export", verify, verifyAdmin, async (req, res) => {
  try {

    const month = req.query.month;

    // =====================================================
    // GET ATTENDANCE DATA
    // =====================================================

    let sql = `
      SELECT
        attendance.employee_id,
        users.employee_name,

        attendance.check_area,

        company.company_code,
        company.company_name,
        company.work_start,
        company.work_end,
        company.radius,

        TO_CHAR(
          attendance.date,
          'DD/MM/YYYY'
        ) AS adate,

        TO_CHAR(
          attendance.check_in_time,
          'HH24:MI:SS'
        ) AS check_in_time,

        TO_CHAR(
          attendance.check_out_time,
          'HH24:MI:SS'
        ) AS check_out_time,

        attendance.check_in_lat,
        attendance.check_in_lng,
        attendance.check_out_lat,
        attendance.check_out_lng,
        attendance.check_in_ip,
        attendance.check_out_ip

      FROM attendance

      INNER JOIN users
        ON attendance.employee_id = users.employee_id

      LEFT JOIN company
        ON attendance.check_area = company.company_name
    `;

    // =====================================================
    // MONTH FILTER
    // =====================================================

    if (month) {
      sql += `
        WHERE TO_CHAR(
          attendance.date,
          'YYYY-MM'
        ) = $1
      `;
    }

    // =====================================================
    // ORDER
    // =====================================================

    sql += `
      ORDER BY
        company.company_code ASC,
        attendance.date DESC,
        attendance.employee_id ASC
    `;

    const result = await pool.query(
      sql,
      month ? [month] : []
    );

    // =====================================================
    // SETTINGS
    // =====================================================

    // Normal break = 1 hour
    const BREAK_MINUTES = 60;

    // Check-in after 14:00 = no break
    const BREAK_CUTOFF_MINUTES = 14 * 60;

    // OT minimum threshold = 30 minutes
    const OT_GRACE_MINUTES = 30;

    // =====================================================
    // TIME → MINUTES
    //
    // IMPORTANT:
    // Seconds are completely ignored.
    //
    // 08:30:59 → 08:30
    // 18:02:44 → 18:02
    // =====================================================

    function timeToMinutes(time) {

      if (!time) {
        return null;
      }

      const parts = time
        .toString()
        .split(":");

      const hours =
        parseInt(parts[0], 10) || 0;

      const minutes =
        parseInt(parts[1], 10) || 0;

      // DO NOT calculate seconds
      return (
        hours * 60 +
        minutes
      );
    }

    // =====================================================
    // MINUTES → HH:MM
    // =====================================================

    function formatMinutes(minutes) {

      if (
        minutes === null ||
        minutes === undefined ||
        isNaN(minutes)
      ) {
        return "";
      }

      minutes = Math.max(
        0,
        Math.round(minutes)
      );

      const hours =
        Math.floor(minutes / 60);

      const mins =
        minutes % 60;

      return (
        String(hours).padStart(2, "0") +
        ":" +
        String(mins).padStart(2, "0")
      );
    }

    // =====================================================
    // GROUP DATA BY COMPANY
    // =====================================================

    const companies = {};

    result.rows.forEach(row => {

      const companyCode =
        row.company_code || "UNKNOWN";

      if (!companies[companyCode]) {

        companies[companyCode] = {
          company_name:
            row.company_name ||
            "UNKNOWN COMPANY",

          rows: []
        };
      }

      companies[companyCode].rows.push(row);
    });

    // =====================================================
    // CREATE WORKBOOK
    // =====================================================

    const workbook =
      new ExcelJS.Workbook();

    // =====================================================
    // CREATE ONE SHEET PER COMPANY
    // =====================================================

    Object.keys(companies)
      .sort()
      .forEach(companyCode => {

        const company =
          companies[companyCode];

        // Excel worksheet name max = 31 characters
        const sheetName =
          companyCode
            .toString()
            .substring(0, 31);

        const sheet =
          workbook.addWorksheet(sheetName);

        // =================================================
        // COMPANY NAME - ROW 1
        // =================================================

        sheet.mergeCells("A1:Q1");

        const companyTitle =
          sheet.getCell("A1");

        companyTitle.value =
          company.company_name;

        companyTitle.font = {
          bold: true,
          size: 14
        };

        companyTitle.alignment = {
          horizontal: "left",
          vertical: "middle"
        };

        sheet.getRow(1).height = 24;

        // =================================================
        // ROW 2 - BLANK
        // =================================================

        sheet.getRow(2).height = 8;

        // =================================================
        // HEADER - ROW 3
        // =================================================

        const headers = [

          "Date",
          "ID",
          "Name",

          "In",
          "Out",
          "Calculated Out",

          "Total Hours",
          "Break",
          "Working Hours",
          "Normal Hours",
          "Overtime",

          "In_Lat",
          "In_Lng",
          "Out_Lat",
          "Out_Lng",
          "In_IP",
          "Out_IP"
        ];

        headers.forEach(
          (header, index) => {

            const cell =
              sheet.getCell(
                3,
                index + 1
              );

            cell.value = header;

            cell.font = {
              bold: true
            };

            cell.alignment = {
              vertical: "middle"
            };
          }
        );

        // =================================================
        // DATA ROWS
        // =================================================

        company.rows.forEach(row => {

          let totalMinutes = null;

          let workingMinutes = null;

          let normalMinutes = null;

          let overtimeMinutes = null;

          let breakMinutes = 0;

          let calculatedOut = "";

          // =================================================
          // COMPANY WORK END
          // =================================================

          const workEnd =
            row.work_end
              ? row.work_end
                  .toString()
                  .substring(0, 8)
              : "";

          // =================================================
          // CHECK-IN EXISTS
          // =================================================

          if (row.check_in_time) {

            // Seconds are ignored here
            const inMinutes =
              timeToMinutes(
                row.check_in_time
              );

            let outMinutes = null;

            // =================================================
            // ACTUAL CHECK-OUT EXISTS
            // =================================================

            if (row.check_out_time) {

              calculatedOut =
                row.check_out_time;

              outMinutes =
                timeToMinutes(
                  row.check_out_time
                );
            }

            // =================================================
            // NO CHECK-OUT
            //
            // Use company normal work end
            // ONLY FOR CALCULATION
            // =================================================

            else if (workEnd) {

              calculatedOut =
                workEnd;

              outMinutes =
                timeToMinutes(
                  workEnd
                );
            }

            // =================================================
            // CALCULATE TIME
            // =================================================

            if (
              inMinutes !== null &&
              outMinutes !== null
            ) {

              let adjustedOut =
                outMinutes;

              // =================================================
              // OVERNIGHT SHIFT
              // =================================================

              if (
                adjustedOut <
                inMinutes
              ) {

                adjustedOut +=
                  24 * 60;
              }

              // =================================================
              // TOTAL HOURS
              // =================================================

              totalMinutes =
                adjustedOut -
                inMinutes;

              // =================================================
              // BREAK RULE
              //
              // In <= 14:00
              //     → deduct 1 hour
              //
              // In > 14:00
              //     → no break
              // =================================================

              if (
                inMinutes <=
                BREAK_CUTOFF_MINUTES
              ) {

                breakMinutes =
                  BREAK_MINUTES;

              } else {

                breakMinutes = 0;
              }

              // =================================================
              // WORKING HOURS
              // =================================================

              workingMinutes =
                Math.max(
                  0,
                  totalMinutes -
                  breakMinutes
                );

              // =================================================
              // NORMAL HOURS
              //
              // From actual Check-In
              // to company Work End
              // minus applicable break
              // =================================================

              if (workEnd) {

                let workEndMinutes =
                  timeToMinutes(
                    workEnd
                  );

                // Overnight work end
                if (
                  workEndMinutes <
                  inMinutes
                ) {

                  workEndMinutes +=
                    24 * 60;
                }

                normalMinutes =
                  Math.max(
                    0,
                    workEndMinutes -
                    inMinutes -
                    breakMinutes
                  );

              } else {

                normalMinutes = 0;
              }

              // =================================================
              // OVERTIME
              //
              // IMPORTANT:
              //
              // First 30 minutes after Work End
              // is only a threshold.
              //
              // Once employee reaches 30 minutes,
              // the FULL overtime period is counted.
              //
              // Example Work End = 17:30
              //
              // 17:59 → 00:00 OT
              // 18:00 → 00:30 OT
              // 18:30 → 01:00 OT
              // 19:00 → 01:30 OT
              // 19:30 → 02:00 OT
              // =================================================

              if (
                workEnd &&
                row.check_out_time
              ) {

                let workEndMinutes =
                  timeToMinutes(
                    workEnd
                  );

                // Overnight work end
                if (
                  workEndMinutes <
                  inMinutes
                ) {

                  workEndMinutes +=
                    24 * 60;
                }

                const overtimeDifference =
                  adjustedOut -
                  workEndMinutes;

                // Must reach 30 minutes
                if (
                  overtimeDifference >=
                  OT_GRACE_MINUTES
                ) {

                  // Count FULL OT from Work End
                  overtimeMinutes =
                    overtimeDifference;

                } else {

                  overtimeMinutes = 0;
                }

              } else {

                // No actual Check-Out
                // → No OT
                overtimeMinutes = 0;
              }
            }
          }

          // =================================================
          // ADD EXCEL ROW
          // =================================================

          const excelRow =
            sheet.addRow([

              // A - Date
              row.adate,

              // B - ID
              row.employee_id,

              // C - Name
              row.employee_name,

              // D - In
              row.check_in_time || "",

              // E - Original Out
              row.check_out_time || "",

              // F - Calculated Out
              calculatedOut,

              // G - Total Hours
              formatMinutes(
                totalMinutes
              ),

              // H - Break
              totalMinutes !== null
                ? formatMinutes(
                    breakMinutes
                  )
                : "",

              // I - Working Hours
              workingMinutes !== null
                ? formatMinutes(
                    workingMinutes
                  )
                : "",

              // J - Normal Hours
              normalMinutes !== null
                ? formatMinutes(
                    normalMinutes
                  )
                : "",

              // K - Overtime
              overtimeMinutes !== null
                ? formatMinutes(
                    overtimeMinutes
                  )
                : "",

              // L - In Lat
              row.check_in_lat || "",

              // M - In Lng
              row.check_in_lng || "",

              // N - Out Lat
              row.check_out_lat || "",

              // O - Out Lng
              row.check_out_lng || "",

              // P - In IP
              row.check_in_ip || "",

              // Q - Out IP
              row.check_out_ip || ""
            ]);

          // =================================================
          // NO ORIGINAL CHECK-OUT
          //
          // Original Out cell = RED
          // =================================================

          if (!row.check_out_time) {

            const outCell =
              excelRow.getCell(5);

            outCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "FFFF0000"
              }
            };

            outCell.font = {
              color: {
                argb: "FFFFFFFF"
              },
              bold: true
            };
          }
        });

        // =================================================
        // HEADER STYLE
        // =================================================

        const headerRow =
          sheet.getRow(3);

        headerRow.font = {
          bold: true
        };

        headerRow.alignment = {
          vertical: "middle"
        };

		// =====================================================
		// AUTO FIT COLUMN WIDTH
		// =====================================================

		sheet.columns.forEach(column => {

		  let maxLength = 0;

		  column.eachCell(
			{
			  includeEmpty: true
			},
			cell => {

			  let value = "";

			  if (
				cell.value !== null &&
				cell.value !== undefined
			  ) {

				if (
				  typeof cell.value === "object" &&
				  cell.value.richText
				) {

				  value =
					cell.value.richText
					  .map(item => item.text)
					  .join("");

				} else {

				  value =
					cell.value.toString();
				}
			  }

			  maxLength =
				Math.max(
				  maxLength,
				  value.length
				);
			}
		  );

		  // Add small padding
		  column.width =
			Math.min(
			  Math.max(maxLength + 2, 10),
			  40
			);
		});

        // =================================================
        // FREEZE TOP 3 ROWS
        // =================================================

        sheet.views = [
          {
            state: "frozen",
            ySplit: 3
          }
        ];
      });

    // =====================================================
    // DOWNLOAD EXCEL
    // =====================================================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${month || "all"}.xlsx`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (err) {

    console.error(
      "Export attendance error:",
      err
    );

    res.status(500).send("导出失败");
  }
});


// =============================
// ✅ 获取今天个人记录（最终稳定版🔥）
// =============================
router.get("/my-today", verify, async (req, res) => {
  try {
    const employeeId = req.user.id;

    // =============================
    // ✅ 马来西亚时间（关键🔥）
    // =============================
    const now = new Date();

    const malaysiaDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
    );

    const today = malaysiaDate.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log("📅 TODAY:", today);
    console.log("👤 USER:", employeeId);

    // =============================
    // ✅ 查询
    // =============================
    const result = await pool.query(
      `SELECT 
        TO_CHAR(check_in_time, 'HH24:MI:SS') AS check_in_time,
        TO_CHAR(check_out_time, 'HH24:MI:SS') AS check_out_time,
        TO_CHAR(date, 'DD/MM/YYYY') AS adate
       FROM attendance
       WHERE employee_id=$1 AND date=$2`,
      [employeeId, today]
    );

    // =============================
    // ✅ 没记录
    // =============================
    if (result.rows.length === 0) {
      return res.json({
        status: "empty",
        message: "No record"
      });
    }

    const row = result.rows[0];

    // =============================
    // ✅ 返回数据（统一格式🔥）
    // =============================
    res.json({
      status: "success",
      adate: row.adate,
      check_in_time: row.check_in_time,
      check_out_time: row.check_out_time || null
    });

  } catch (err) {
    console.error("❌ MY-TODAY ERROR:", err);

    res.status(500).json({
      status: "error",
      message: "server error"
    });
  }
});

// =============================
// ✅ Admin 权限验证
// =============================
function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ msg: "access denined" });
  }
  next();
}

// =============================
module.exports = router;