// =====================================================
// STAFF MANAGEMENT FRONTEND
// =====================================================


// =====================================================
// API
// =====================================================

const STAFF_MANAGEMENT_API =
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://mnl-attendance.onrender.com";


// =====================================================
// STATE
// =====================================================

let staffEditMode = false;
let staffEditEmployeeId = null;

let staffList = [];
let companyList = [];


// =====================================================
// AUTH HEADER
// =====================================================

function getStaffHeaders(json = false) {

  const token =
    localStorage.getItem("token");

  const headers = {
    Authorization:
      "Bearer " + token
  };

  if (json) {

    headers["Content-Type"] =
      "application/json";
  }

  return headers;
}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeStaffHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// =====================================================
// LOAD STAFF
// =====================================================

async function loadStaffManagement() {

  const table =
    document.getElementById(
      "staffTable"
    );

  if (!table) {
    return;
  }


  table.innerHTML = `
    <tr>
      <td colspan="7">
        LOADING...
      </td>
    </tr>
  `;


  try {

    const response =
      await fetch(
        STAFF_MANAGEMENT_API +
        "/api/staff-management",
        {
          headers:
            getStaffHeaders()
        }
      );


    const result =
      await response.json();


    if (
      response.status === 401 ||
      response.status === 403
    ) {

      throw new Error(
        "Access denied or login expired"
      );
    }


    if (!response.ok) {

      throw new Error(
        result.msg ||
        "Failed to load staff"
      );
    }


    staffList =
      Array.isArray(result.data)
        ? result.data
        : [];


    renderStaffTable();


  } catch (err) {

    console.error(
      "❌ Load staff:",
      err
    );


    table.innerHTML = `
      <tr>
        <td colspan="7">
          LOAD FAILED
        </td>
      </tr>
    `;


    alert(
      err.message ||
      "Failed to load staff"
    );
  }
}


// =====================================================
// RENDER STAFF TABLE
// =====================================================

function renderStaffTable() {

  const table =
    document.getElementById(
      "staffTable"
    );

  if (!table) {
    return;
  }


  if (staffList.length === 0) {

    table.innerHTML = `
      <tr>
        <td colspan="7">
          NO STAFF
        </td>
      </tr>
    `;

    return;
  }


  table.innerHTML =
    staffList.map(user => {

      const status =
        (
          user.employee_status ||
          "active"
        ).toLowerCase();


      const statusText =
        status === "active"
          ? "ACTIVE"
          : "INACTIVE";


      return `
        <tr>

          <td>
            ${escapeStaffHtml(
              user.employee_id
            )}
          </td>

          <td>
            ${escapeStaffHtml(
              user.employee_name
            )}
          </td>

          <td>
            ${escapeStaffHtml(
              user.role
            )}
          </td>

          <td>
            ${escapeStaffHtml(
              user.company_code || "-"
            )}
          </td>

          <td>
            ${escapeStaffHtml(
              user.company_name || "-"
            )}
          </td>

          <td>
            <span class="staff-status ${status}">
              ${statusText}
            </span>
          </td>

          <td>

            <button
              type="button"
              class="btn"
              onclick="editStaffUser('${encodeURIComponent(
                user.employee_id
              )}')"
            >
              EDIT
            </button>

            <button
              type="button"
              class="btn"
              onclick="openStaffPassword('${encodeURIComponent(
                user.employee_id
              )}')"
            >
              PASSWORD
            </button>

          </td>

        </tr>
      `;

    }).join("");
}


// =====================================================
// LOAD COMPANY
// =====================================================

async function loadStaffCompanies() {

  const select =
    document.getElementById(
      "modalCompany"
    );

  if (!select) {
    return;
  }


  try {

    const response =
      await fetch(
        STAFF_MANAGEMENT_API +
        "/api/staff-management/company",
        {
          headers:
            getStaffHeaders()
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.msg ||
        "Failed to load company"
      );
    }


    companyList =
      Array.isArray(result.data)
        ? result.data
        : [];


    select.innerHTML = `
      <option value="">
        SELECT COMPANY
      </option>
    `;


    companyList.forEach(company => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        company.company_code;


      option.textContent =
        `${company.company_code} - ${company.company_name}`;


      select.appendChild(option);

    });


  } catch (err) {

    console.error(
      "❌ Load company:",
      err
    );


    alert(
      err.message ||
      "Failed to load company"
    );
  }
}


// =====================================================
// CREATE / PREPARE FORM FIELDS
// =====================================================

function createStaffExtraFields() {

  const modal =
    document.getElementById(
      "staffModal"
    );

  if (!modal) {
    return;
  }


  const content =
    modal.querySelector(
      ".modal-content"
    );

  if (!content) {
    return;
  }


  const title =
    document.getElementById(
      "modalTitle"
    );


  const company =
    document.getElementById(
      "modalCompany"
    );


  const name =
    document.getElementById(
      "modalName"
    );


  if (!company || !name) {
    return;
  }


  // ===================================================
  // STAFF ID
  // ===================================================

  let employeeId =
    document.getElementById(
      "modalEmployeeId"
    );


  if (!employeeId) {

    employeeId =
      document.createElement(
        "input"
      );

    employeeId.id =
      "modalEmployeeId";

    employeeId.placeholder =
      "STAFF ID";

    employeeId.autocomplete =
      "off";


    title.parentNode.insertBefore(
      employeeId,
      title.nextSibling
    );
  }


  // ===================================================
  // ROLE
  // ===================================================

  let role =
    document.getElementById(
      "modalRole"
    );


  if (!role) {

    role =
      document.createElement(
        "select"
      );

    role.id =
      "modalRole";


    role.innerHTML = `
      <option value="staff">
        STAFF
      </option>

      <option value="admin">
        ADMIN
      </option>
    `;


    company.parentNode.insertBefore(
      role,
      company
    );
  }


  // ===================================================
  // STATUS
  // ===================================================

  let status =
    document.getElementById(
      "modalStatus"
    );


  if (!status) {

    status =
      document.createElement(
        "select"
      );

    status.id =
      "modalStatus";


    status.innerHTML = `
      <option value="active">
        ACTIVE
      </option>

      <option value="inactive">
        INACTIVE
      </option>
    `;


    company.parentNode.insertBefore(
      status,
      company
    );
  }


  // ===================================================
  // PASSWORD
  // ===================================================

  let passwordBox =
    document.getElementById(
      "modalPasswordBox"
    );


  let password =
    document.getElementById(
      "modalPassword"
    );


  /*
   * 如果 HTML 已经有 modalPassword，
   * 就直接使用。
   *
   * 如果没有，就自动建立。
   */

  if (!passwordBox) {

    passwordBox =
      document.createElement(
        "div"
      );

    passwordBox.id =
      "modalPasswordBox";


    password =
      document.createElement(
        "input"
      );

    password.id =
      "modalPassword";

    password.type =
      "password";

    password.placeholder =
      "PASSWORD";


    passwordBox.appendChild(
      password
    );


    /*
     * 插入到 modal-actions 前面
     */

    const actions =
      content.querySelector(
        ".modal-actions"
      );


    if (actions) {

      content.insertBefore(
        passwordBox,
        actions
      );

    } else {

      content.appendChild(
        passwordBox
      );
    }

  } else {

    password =
      document.getElementById(
        "modalPassword"
      );
  }


  // ===================================================
  // 确保字段顺序
  // ===================================================

  /*
   * 现在结构最终为：
   *
   * TITLE
   * STAFF ID
   * NAME
   * ROLE
   * STATUS
   * COMPANY
   * PASSWORD
   * BUTTONS
   */


  const actions =
    content.querySelector(
      ".modal-actions"
    );


  if (actions) {

    /*
     * 将 password 放到 buttons 前面
     */

    if (passwordBox) {

      content.insertBefore(
        passwordBox,
        actions
      );
    }
  }
}


// =====================================================
// PASSWORD BOX VISIBILITY
// =====================================================

function setAddPasswordVisible(
  visible
) {

  const passwordBox =
    document.getElementById(
      "modalPasswordBox"
    );

  const password =
    document.getElementById(
      "modalPassword"
    );


  if (!passwordBox) {
    return;
  }


  if (visible) {

    passwordBox.style.display =
      "block";


    if (password) {

      password.disabled =
        false;

      password.value =
        "";

      password.placeholder =
        "PASSWORD";
    }

  } else {

    passwordBox.style.display =
      "none";


    if (password) {

      password.disabled =
        true;

      password.value =
        "";
    }
  }
}


// =====================================================
// OPEN ADD STAFF
// =====================================================

async function openStaffAddDialog() {

  staffEditMode =
    false;

  staffEditEmployeeId =
    null;


  createStaffExtraFields();


  const modal =
    document.getElementById(
      "staffModal"
    );

  if (!modal) {
    return;
  }


  const title =
    document.getElementById(
      "modalTitle"
    );


  const employeeId =
    document.getElementById(
      "modalEmployeeId"
    );


  const name =
    document.getElementById(
      "modalName"
    );


  const role =
    document.getElementById(
      "modalRole"
    );


  const status =
    document.getElementById(
      "modalStatus"
    );


  const password =
    document.getElementById(
      "modalPassword"
    );


  // ===================================================
  // TITLE
  // ===================================================

  title.innerText =
    "ADD STAFF";


  // ===================================================
  // STAFF ID
  // ===================================================

  employeeId.value =
    "";

  employeeId.disabled =
    false;


  // ===================================================
  // NAME
  // ===================================================

  name.value =
    "";


  // ===================================================
  // ROLE
  // ===================================================

  role.value =
    "staff";


  // ===================================================
  // STATUS
  // ===================================================

  status.value =
    "active";


  // ===================================================
  // PASSWORD
  // ===================================================

  if (password) {

    password.value =
      "";

    password.disabled =
      false;
  }


  setAddPasswordVisible(
    true
  );


  // ===================================================
  // LOAD COMPANY
  // ===================================================

  await loadStaffCompanies();


  const company =
    document.getElementById(
      "modalCompany"
    );


  if (company) {

    company.value =
      "";
  }


  // ===================================================
  // SHOW
  // ===================================================

  modal.style.display =
    "flex";
}


// =====================================================
// OPEN EDIT STAFF
// =====================================================

async function editStaffUser(
  encodedEmployeeId
) {

  const employeeId =
    decodeURIComponent(
      encodedEmployeeId
    );


  const user =
    staffList.find(
      item =>
        item.employee_id ===
        employeeId
    );


  if (!user) {

    alert(
      "Staff record not found"
    );

    return;
  }


  staffEditMode =
    true;

  staffEditEmployeeId =
    employeeId;


  createStaffExtraFields();


  const modal =
    document.getElementById(
      "staffModal"
    );


  if (!modal) {
    return;
  }


  // ===================================================
  // TITLE
  // ===================================================

  document.getElementById(
    "modalTitle"
  ).innerText =
    "EDIT STAFF";


  // ===================================================
  // STAFF ID
  // ===================================================

  const employeeInput =
    document.getElementById(
      "modalEmployeeId"
    );


  employeeInput.value =
    user.employee_id;


  employeeInput.disabled =
    true;


  // ===================================================
  // NAME
  // ===================================================

  document.getElementById(
    "modalName"
  ).value =
    user.employee_name || "";


  // ===================================================
  // ROLE
  // ===================================================

  document.getElementById(
    "modalRole"
  ).value =
    user.role || "staff";


  // ===================================================
  // STATUS
  // ===================================================

  document.getElementById(
    "modalStatus"
  ).value =
    (
      user.employee_status ||
      "active"
    ).toLowerCase();


  // ===================================================
  // PASSWORD
  // ===================================================

  /*
   * EDIT 不允许修改密码
   * 密码必须通过 PASSWORD 按钮修改
   */

  setAddPasswordVisible(
    false
  );


  // ===================================================
  // COMPANY
  // ===================================================

  await loadStaffCompanies();


  document.getElementById(
    "modalCompany"
  ).value =
    user.company_code || "";


  // ===================================================
  // SHOW
  // ===================================================

  modal.style.display =
    "flex";
}


// =====================================================
// CLOSE STAFF MODAL
// =====================================================

function closeStaffModal() {

  const modal =
    document.getElementById(
      "staffModal"
    );


  if (!modal) {
    return;
  }


  modal.style.display =
    "none";


  staffEditMode =
    false;

  staffEditEmployeeId =
    null;


  /*
   * Reset Password
   */

  const password =
    document.getElementById(
      "modalPassword"
    );


  if (password) {

    password.value =
      "";

    password.disabled =
      false;
  }


  setAddPasswordVisible(
    false
  );
}


// =====================================================
// SAVE STAFF
// =====================================================

async function saveStaffUser() {

  // ===================================================
  // GET FORM VALUES
  // ===================================================

  const employeeIdElement =
    document.getElementById(
      "modalEmployeeId"
    );

  const nameElement =
    document.getElementById(
      "modalName"
    );

  const companyElement =
    document.getElementById(
      "modalCompany"
    );

  const roleElement =
    document.getElementById(
      "modalRole"
    );

  const statusElement =
    document.getElementById(
      "modalStatus"
    );


  // ===================================================
  // CHECK ELEMENTS
  // ===================================================

  if (
    !employeeIdElement ||
    !nameElement ||
    !companyElement ||
    !roleElement ||
    !statusElement
  ) {

    console.error(
      "❌ Staff form elements missing"
    );

    alert(
      "Staff form is not ready"
    );

    return;
  }


  // ===================================================
  // VALUES
  // ===================================================

  const employeeId =
    employeeIdElement.value
      .trim()
      .toUpperCase();


  const employeeName =
    nameElement.value
      .trim();


  const companyCode =
    companyElement.value;


  const role =
    roleElement.value;


  const employeeStatus =
    statusElement.value;


  // ===================================================
  // VALIDATION
  // ===================================================

  if (!employeeId) {

    alert(
      "Please enter Staff ID"
    );

    return;
  }


  if (!employeeName) {

    alert(
      "Please enter Staff Name"
    );

    return;
  }


  if (!companyCode) {

    alert(
      "Please select Company"
    );

    return;
  }


  if (!role) {

    alert(
      "Please select Role"
    );

    return;
  }


  if (!employeeStatus) {

    alert(
      "Please select Status"
    );

    return;
  }


  // ===================================================
  // SAVE BUTTON
  // ===================================================

  const saveButtons =
    document.querySelectorAll(
      "#staffModal .modal-actions button"
    );


  saveButtons.forEach(
    button => {
      button.disabled =
        true;
    }
  );


  try {

    let url =
      STAFF_MANAGEMENT_API +
      "/api/staff-management";


    let method =
      "POST";


    let body;


    // =================================================
    // ADD
    // =================================================

    if (!staffEditMode) {

      const passwordElement =
        document.getElementById(
          "modalPassword"
        );


      const password =
        passwordElement
          ? passwordElement.value.trim()
          : "";


      if (!password) {

        alert(
          "Please enter Password"
        );

        return;
      }


      body = {

        employee_id:
          employeeId,

        employee_name:
          employeeName,

        company_code:
          companyCode,

        role:
          role,

        employee_status:
          employeeStatus,

        password:
          password
      };


      method =
        "POST";
    }


    // =================================================
    // EDIT
    // =================================================

    else {

      url =
        STAFF_MANAGEMENT_API +
        "/api/staff-management/" +
        encodeURIComponent(
          staffEditEmployeeId
        );


      method =
        "PUT";


      /*
       * IMPORTANT:
       *
       * EDIT 不发送 password
       */

      body = {

        employee_name:
          employeeName,

        company_code:
          companyCode,

        role:
          role,

        employee_status:
          employeeStatus
      };
    }


    // =================================================
    // API REQUEST
    // =================================================

    const response =
      await fetch(
        url,
        {

          method:
            method,

          headers:
            getStaffHeaders(true),

          body:
            JSON.stringify(body)
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.msg ||
        "Save failed"
      );
    }


    // =================================================
    // SUCCESS
    // =================================================

    alert(
      staffEditMode
        ? "Staff updated successfully"
        : "Staff added successfully"
    );


    closeStaffModal();


    await loadStaffManagement();


  } catch (err) {

    console.error(
      "❌ Save staff:",
      err
    );


    alert(
      err.message ||
      "Save failed"
    );


  } finally {

    saveButtons.forEach(
      button => {
        button.disabled =
          false;
      }
    );
  }
}


// =====================================================
// OPEN CHANGE PASSWORD
// =====================================================

function openStaffPassword(
  encodedEmployeeId
) {

  const employeeId =
    decodeURIComponent(
      encodedEmployeeId
    );


  const user =
    staffList.find(
      item =>
        item.employee_id ===
        employeeId
    );


  if (!user) {

    alert(
      "Staff record not found"
    );

    return;
  }


  const modal =
    document.getElementById(
      "passwordModal"
    );


  if (!modal) {

    alert(
      "Password modal not found"
    );

    return;
  }


  modal.dataset.employeeId =
    employeeId;


  // ===================================================
  // NEW PASSWORD
  // ===================================================

  const newPassword =
    document.getElementById(
      "newPassword"
    );


  if (newPassword) {

    newPassword.value =
      "";
  }


  // ===================================================
  // CONFIRM PASSWORD
  // ===================================================

  let confirmInput =
    document.getElementById(
      "confirmPassword"
    );


  if (!confirmInput) {

    confirmInput =
      document.createElement(
        "input"
      );


    confirmInput.id =
      "confirmPassword";


    confirmInput.type =
      "password";


    confirmInput.placeholder =
      "CONFIRM PASSWORD";


    const passwordActions =
      modal.querySelector(
        ".modal-actions"
      );


    if (passwordActions) {

      passwordActions.parentNode.insertBefore(
        confirmInput,
        passwordActions
      );

    } else {

      modal
        .querySelector(
          ".modal-content"
        )
        .appendChild(
          confirmInput
        );
    }
  }


  confirmInput.value =
    "";


  // ===================================================
  // SHOW
  // ===================================================

  modal.style.display =
    "flex";
}


// =====================================================
// CLOSE PASSWORD MODAL
// =====================================================

function closeStaffPasswordModal() {

  const modal =
    document.getElementById(
      "passwordModal"
    );


  if (!modal) {
    return;
  }


  modal.style.display =
    "none";


  modal.dataset.employeeId =
    "";


  const password =
    document.getElementById(
      "newPassword"
    );


  const confirm =
    document.getElementById(
      "confirmPassword"
    );


  if (password) {

    password.value =
      "";
  }


  if (confirm) {

    confirm.value =
      "";
  }
}


// =====================================================
// SUBMIT PASSWORD
// =====================================================

async function submitStaffPassword() {

  const modal =
    document.getElementById(
      "passwordModal"
    );


  if (!modal) {

    alert(
      "Password modal not found"
    );

    return;
  }


  const employeeId =
    modal.dataset.employeeId;


  const passwordElement =
    document.getElementById(
      "newPassword"
    );


  const confirmElement =
    document.getElementById(
      "confirmPassword"
    );


  const password =
    passwordElement
      ? passwordElement.value.trim()
      : "";


  const confirmPassword =
    confirmElement
      ? confirmElement.value.trim()
      : "";


  // ===================================================
  // VALIDATION
  // ===================================================

  if (!employeeId) {

    alert(
      "Staff not selected"
    );

    return;
  }


  if (!password) {

    alert(
      "Please enter new password"
    );

    return;
  }


  if (!confirmPassword) {

    alert(
      "Please confirm new password"
    );

    return;
  }


  if (
    password !==
    confirmPassword
  ) {

    alert(
      "Password confirmation does not match"
    );

    return;
  }


  // ===================================================
  // UPDATE
  // ===================================================

  try {

    const response =
      await fetch(
        STAFF_MANAGEMENT_API +
        "/api/staff-management/" +
        encodeURIComponent(
          employeeId
        ) +
        "/password",
        {

          method:
            "PUT",

          headers:
            getStaffHeaders(true),

          body:
            JSON.stringify({
              password:
                password
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.msg ||
        "Password update failed"
      );
    }


    alert(
      "Password updated successfully"
    );


    closeStaffPasswordModal();


  } catch (err) {

    console.error(
      "❌ Change password:",
      err
    );


    alert(
      err.message ||
      "Password update failed"
    );
  }
}


// =====================================================
// COMPATIBILITY FUNCTIONS
// =====================================================

/*
 * mgt_staff.html 目前使用：
 *
 * openAddDialog()
 * closeModal()
 * saveStaff()
 * submitPassword()
 * closePasswordModal()
 *
 * 所以保留这些函数。
 */


function openAddDialog() {

  openStaffAddDialog();
}


function closeModal() {

  closeStaffModal();
}


function saveStaff() {

  saveStaffUser();
}


function submitPassword() {

  submitStaffPassword();
}


function closePasswordModal() {

  closeStaffPasswordModal();
}


// =====================================================
// INIT
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    /*
     * 只在 Staff Management 页面执行
     */

    const staffTable =
      document.getElementById(
        "staffTable"
      );


    if (!staffTable) {
      return;
    }


    /*
     * 建立额外字段
     */

    createStaffExtraFields();


    /*
     * 加载 Staff
     */

    await loadStaffManagement();

  }
);