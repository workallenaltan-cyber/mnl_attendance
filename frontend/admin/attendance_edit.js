// =====================================================
// ATTENDANCE ADD / EDIT
// =====================================================


// =====================================================
// API
// =====================================================

const ATTENDANCE_EDIT_API =
  typeof API !== "undefined"
    ? API
    : (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
          ? "http://localhost:3000"
          : "https://mnl-attendance.onrender.com"
      );


// =====================================================
// CURRENT RECORD
// =====================================================

let attendanceEditId = null;

let attendanceMode = null;

let attendanceCheckTimer = null;


// =====================================================
// OPEN DIALOG
// =====================================================

async function openAttendanceDialog() {

  const modal =
    document.getElementById("attendanceModal");

  if (!modal) {
    console.error(
      "attendanceModal not found"
    );
    return;
  }


  // Reset

  attendanceEditId = null;
  attendanceMode = null;


  document.getElementById(
    "attendanceModalTitle"
  ).innerText =
    "ADD / EDIT ATTENDANCE";


  document.getElementById(
    "attendanceDate"
  ).value = "";


  document.getElementById(
    "attendanceEmployee"
  ).value = "";


  document.getElementById(
    "attendanceRecordStatus"
  ).innerText = "";


  document.getElementById(
    "attendanceEditFields"
  ).style.display = "none";


  document.getElementById(
    "attendanceSaveBtn"
  ).disabled = true;


  // Load staff + company

  await loadAttendanceStaff();

  await loadAttendanceCompanies();


  modal.style.display = "flex";
}


// =====================================================
// CLOSE DIALOG
// =====================================================

function closeAttendanceDialog() {

  const modal =
    document.getElementById("attendanceModal");

  if (modal) {
    modal.style.display = "none";
  }

  attendanceEditId = null;
  attendanceMode = null;
}


// =====================================================
// LOAD STAFF
// =====================================================

async function loadAttendanceStaff() {

  const select =
    document.getElementById(
      "attendanceEmployee"
    );

  if (!select) return;


  select.innerHTML = `
    <option value="">
      SELECT STAFF
    </option>
  `;


  try {

    const token =
      localStorage.getItem("token");


    const response =
      await fetch(
		ATTENDANCE_EDIT_API +
		"/api/attendance-edit/staff",
        {
          headers: {
            Authorization:
              "Bearer " + token
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        "Failed to load staff"
      );
    }


    const data =
      await response.json();


    // Support different response formats

    const staffList =
      Array.isArray(data)
        ? data
        : (
            Array.isArray(data.data)
              ? data.data
              : (
                  Array.isArray(data.rows)
                    ? data.rows
                    : []
                )
          );


    staffList.forEach(staff => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        staff.employee_id;


      option.textContent =
        `${staff.employee_id} - ${
          staff.employee_name || ""
        }`;


      select.appendChild(option);

    });


  } catch (err) {

    console.error(
      "❌ Load attendance staff:",
      err
    );

    alert(
      "Failed to load staff"
    );
  }
}


// =====================================================
// LOAD COMPANY
// =====================================================

async function loadAttendanceCompanies() {

  const select =
    document.getElementById(
      "attendanceArea"
    );

  if (!select) return;


  select.innerHTML = `
    <option value="">
      SELECT COMPANY
    </option>
  `;


  try {

    const token =
      localStorage.getItem("token");


    const response =
      await fetch(
	ATTENDANCE_EDIT_API +
	"/api/attendance-edit/company",
        {
          headers: {
            Authorization:
              "Bearer " + token
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        "Failed to load company"
      );
    }


    const data =
      await response.json();


    const companyList =
      Array.isArray(data)
        ? data
        : (
            Array.isArray(data.data)
              ? data.data
              : (
                  Array.isArray(data.rows)
                    ? data.rows
                    : []
                )
          );


    companyList.forEach(company => {

      const option =
        document.createElement(
          "option"
        );


	option.value =
	  company.company_name;

	option.textContent =
	  `${company.company_code} - ${company.company_name}`;


      select.appendChild(option);

    });


  } catch (err) {

    console.error(
      "❌ Load attendance company:",
      err
    );

    alert(
      "Failed to load company"
    );
  }
}


// =====================================================
// DATE / STAFF CHANGE
// =====================================================

function attendanceSelectionChanged() {

  clearTimeout(
    attendanceCheckTimer
  );


  attendanceCheckTimer =
    setTimeout(
      checkAttendanceRecord,
      150
    );
}


// =====================================================
// CHECK EXISTING RECORD
// =====================================================

async function checkAttendanceRecord() {

  const date =
    document.getElementById(
      "attendanceDate"
    ).value;


  const employeeId =
    document.getElementById(
      "attendanceEmployee"
    ).value;


  const status =
    document.getElementById(
      "attendanceRecordStatus"
    );


  const fields =
    document.getElementById(
      "attendanceEditFields"
    );


  const saveBtn =
    document.getElementById(
      "attendanceSaveBtn"
    );


  // Not enough information

  if (!date || !employeeId) {

    status.innerText = "";

    fields.style.display =
      "none";

    saveBtn.disabled = true;

    return;
  }


  status.innerText =
    "Checking attendance...";


  saveBtn.disabled = true;


  try {

    const token =
      localStorage.getItem("token");


    const url =
      ATTENDANCE_EDIT_API +
      "/api/attendance-edit/check" +
      "?employee_id=" +
      encodeURIComponent(employeeId) +
      "&date=" +
      encodeURIComponent(date);


    const response =
      await fetch(
        url,
        {
          headers: {
            Authorization:
              "Bearer " + token
          }
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.msg ||
        "Failed to check attendance"
      );
    }


    // =================================================
    // EXISTING
    // =================================================

    if (
      data.exists &&
      data.data
    ) {

      attendanceMode =
        "EDIT";


      attendanceEditId =
        data.data.id;


      document.getElementById(
        "attendanceModalTitle"
      ).innerText =
        "EDIT ATTENDANCE";


      status.innerText =
        "✓ Attendance record found";


      status.className =
        "attendance-record-status exists";


      fields.style.display =
        "block";

	console.log("🔎 ATTENDANCE DATA:", data.data);
	console.log("🔎 CHECK IN:", data.data.check_in_time);
	console.log("🔎 CHECK OUT:", data.data.check_out_time);

      loadAttendanceData(
        data.data
      );


      saveBtn.disabled = false;

      return;
    }


    // =================================================
    // NEW
    // =================================================

    attendanceMode =
      "ADD";


    attendanceEditId =
      null;


    document.getElementById(
      "attendanceModalTitle"
    ).innerText =
      "ADD ATTENDANCE";


    status.innerText =
      "✓ No attendance record - New record";


    status.className =
      "attendance-record-status new";


    fields.style.display =
      "block";


    clearAttendanceFields();


    saveBtn.disabled = false;


  } catch (err) {

    console.error(
      "❌ Check attendance:",
      err
    );


    status.innerText =
      "❌ " + err.message;


    status.className =
      "attendance-record-status error";


    fields.style.display =
      "none";


    saveBtn.disabled = true;
  }
}


// =====================================================
// LOAD EXISTING DATA
// =====================================================

function loadAttendanceData(
  data
) {

  document.getElementById(
    "attendanceArea"
  ).value =
    data.check_area || "";


  document.getElementById(
    "attendanceCheckIn"
  ).value =
    convertTimeToInput(
      data.check_in_time
    );


  document.getElementById(
    "attendanceCheckOut"
  ).value =
    convertTimeToInput(
      data.check_out_time
    );
}


// =====================================================
// CLEAR FIELDS
// =====================================================

function clearAttendanceFields() {

  document.getElementById(
    "attendanceArea"
  ).value = "";


  document.getElementById(
    "attendanceCheckIn"
  ).value = "";


  document.getElementById(
    "attendanceCheckOut"
  ).value = "";
}


// =====================================================
// TIME FORMAT
// PostgreSQL HH:mm:ss
// → HTML time HH:mm
// =====================================================

function convertTimeToInput(time) {

  if (!time) {
    return "";
  }

  const value = time.toString().trim();

  // PostgreSQL / API ISO timestamp
  // Example:
  // 2026-10-07T06:29:13.000Z
  if (value.includes("T")) {

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  // HH:mm:ss
  if (/^\d{2}:\d{2}:\d{2}/.test(value)) {
    return value.substring(0, 5);
  }

  // HH:mm
  if (/^\d{2}:\d{2}/.test(value)) {
    return value.substring(0, 5);
  }

  return "";
}


// =====================================================
// SAVE
// =====================================================

async function saveAttendance() {

  if (
    !attendanceMode
  ) {

    alert(
      "Please select date and staff first"
    );

    return;
  }


  const date =
    document.getElementById(
      "attendanceDate"
    ).value;


  const employeeId =
    document.getElementById(
      "attendanceEmployee"
    ).value;


  const checkArea =
    document.getElementById(
      "attendanceArea"
    ).value;


  const checkIn =
    document.getElementById(
      "attendanceCheckIn"
    ).value;


  const checkOut =
    document.getElementById(
      "attendanceCheckOut"
    ).value;


  if (!date || !employeeId) {

    alert(
      "Please select date and staff"
    );

    return;
  }


  const saveBtn =
    document.getElementById(
      "attendanceSaveBtn"
    );


  saveBtn.disabled = true;

  saveBtn.innerText =
    "SAVING...";


  try {

    const token =
      localStorage.getItem("token");


    const body = {

      employee_id:
        employeeId,

      date:
        date,

      check_area:
        checkArea || null,

      check_in_time:
        checkIn || null,

      check_out_time:
        checkOut || null

    };


    let url =
      ATTENDANCE_EDIT_API +
      "/api/attendance-edit";


    let method =
      "POST";


    // =================================================
    // EDIT
    // =================================================

    if (
      attendanceMode ===
      "EDIT"
    ) {

      url =
        ATTENDANCE_EDIT_API +
         "/api/attendance-edit/" +
        attendanceEditId;

      method =
        "PUT";
    }


    const response =
      await fetch(
        url,
        {
          method: method,

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              "Bearer " + token
          },

          body:
            JSON.stringify(body)
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.msg ||
        "Save failed"
      );
    }


    alert(
      attendanceMode === "ADD"
        ? "Attendance added successfully"
        : "Attendance updated successfully"
    );


    closeAttendanceDialog();


    // Reload table

    if (
      typeof loadAll ===
      "function"
    ) {

      await loadAll();

    }


  } catch (err) {

    console.error(
      "❌ Save attendance:",
      err
    );


    alert(
      err.message ||
      "Save failed"
    );


  } finally {

    saveBtn.disabled =
      false;

    saveBtn.innerText =
      "SAVE";
  }
}


// =====================================================
// INIT EVENTS
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  function () {

    const date =
      document.getElementById(
        "attendanceDate"
      );

    const employee =
      document.getElementById(
        "attendanceEmployee"
      );


    if (date) {

      date.addEventListener(
        "change",
        attendanceSelectionChanged
      );

    }


    if (employee) {

      employee.addEventListener(
        "change",
        attendanceSelectionChanged
      );

    }

  }
);


