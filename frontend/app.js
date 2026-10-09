// =====================
// ✅ 自动登出（下班30分钟🔥）
// =====================
function autoLogoutAfterWork() {

  const checkoutTime = localStorage.getItem("checkoutTime");
  if (!checkoutTime) return;

  const now = Date.now();
  const diff = now - parseInt(checkoutTime);

  const limit = 5 * 60 * 1000; // 30分钟

  if (diff > limit) {
    console.log("⛔ over 30 min，auto logout");

    localStorage.clear();
    location.href = "index.html";
  }
}


const links = document.querySelectorAll(".menu");
const current = window.location.pathname;

links.forEach(link => {
  if (link.getAttribute("href") === current.split("/").pop()) {
    link.classList.add("active");
  }
});

const user = JSON.parse(localStorage.getItem("user") || "{}");
const role = user.role;
const isAdmin = role === "admin";

// =====================
// ✅ API 地址
// =====================
const API =
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://mnl-attendance.onrender.com";

// =====================
// ✅ 当前页面路径 + token
// =====================
const path = window.location.pathname;
let token = localStorage.getItem("token");

// =====================
// ✅ 页面控制（你要的🔥）
// =====================

// 👉 登录页
if (path.includes("index.html")) {

  if (token) {
    if (isAdmin) {
      location.href = "admin.html";
    } else {
      location.href = "checkin.html";
    }
  }

} else {

  if (!token) {
    alert("Please Login");
    location.href = "index.html";
  }

  // ✅ 非 admin 禁止进 admin 页面
  if (path.includes("admin.html") && !isAdmin) {
    alert("Access Denined");
    location.href = "index.html";
  }

}

// =====================
// ✅ 登录
// =====================
let loginInProgress = false;

async function login() {

  // 🚫 防止重复点击 / 重复提交
  if (loginInProgress) {
    return;
  }

  const loginBtn = document.getElementById("loginBtn");

  const employeeId = document.getElementById("id").value.trim().toUpperCase();
  const password = document.getElementById("pw").value;

  // =====================
  // ✅ 先检查账号密码
  // =====================
  if (!employeeId || !password) {
    alert("User and passwrod required !");
    return;
  }

  // =====================
  // 🔒 立即锁定 Login
  // =====================
  loginInProgress = true;

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerText = "⏳ Logging in...";
    loginBtn.style.opacity = "0.6";
    loginBtn.style.cursor = "not-allowed";
  }

  // =====================
  // 🔄 恢复按钮
  // =====================
  function unlockLogin() {

    loginInProgress = false;

    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = "LOGIN";
      loginBtn.style.opacity = "1";
      loginBtn.style.cursor = "pointer";
    }
  }

  // =====================
  // 📍 获取 GPS
  // =====================
  navigator.geolocation.getCurrentPosition(

    async (pos) => {

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {

        // =====================
        // 🌐 Login API
        // =====================
        const res = await fetch(API + "/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            employeeId,
            password,
            lat,
            lng
          })
        });

        const data = await res.json();

        // =====================
        // ❌ Login 失败
        // =====================
        if (data.status !== "success") {

          alert(data.message || "Login Failed !");

          // 只有失败才允许重新 Login
          unlockLogin();

          return;
        }

        // =====================
        // ✅ Login 成功
        // =====================
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // ✅ 存分行
        localStorage.setItem("company", data.company);

        // 成功期间继续锁定
        if (loginBtn) {
          loginBtn.innerText = "✅ Login Successful";
        }

        alert("Login Successful @ " + data.company);

        // =====================
        // 🚀 跳转
        // =====================
        if (data.user.role === "admin") {
          location.href = "admin.html";
        } else {
          location.href = "checkin.html";
        }

      } catch (err) {

        console.error("Login error:", err);

        alert("Server Error! Please try again !");

        // Server error → 可以重新 Login
        unlockLogin();
      }

    },

    // =====================
    // ❌ GPS 获取失败
    // =====================
    () => {

      alert("❌ GPS required！");

      // GPS失败 → 可以重新 Login
      unlockLogin();
    },

    // =====================
    // 📍 GPS Options
    // =====================
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}


// =====================
// ✅ 打卡
// =====================
function check() {

  const token = localStorage.getItem("token");
  const btn = document.getElementById("checkBtn"); // 👈 按钮ID

  // ✅ 按钮进入 processing 状态
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ Processing...";
  }

  navigator.geolocation.getCurrentPosition(pos => {

    fetch(API + "/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      })
    })
    .then(async res => {

	  if (res.status === 401) {
		localStorage.clear();
		location.href = "index.html";
		return;
	  }

	  const data = await res.json();

	  // ❌ 关键：处理非200
	  if (!res.ok) {
		alert(data.msg || "打卡失败");

		// ✅ 恢复按钮
		if (btn) {
		  btn.disabled = false;
		  btn.innerText = "CHECK IN";
		}

		return;
	  }

	  return data;
	})
    .then(data => {
      if (!data) return;

      alert(data.msg);

      // ✅ 跳转
      if (data.status === "checkin") {
        location.href = "checkout.html";
      }

      if (data.status === "checkout") {

		  // ✅ 记录下班时间（时间戳）
		  localStorage.setItem("checkoutTime", Date.now());


        location.href = "done.html";
      }

      if (data.status === "done") {
        location.href = "done.html";
      }

    })
    .catch(err => {
      console.error(err);
      alert("打卡失败");

      // ❌ 出错恢复按钮
      if (btn) {
        btn.disabled = false;
        btn.innerText = "CHECK IN";
      }
    });

  }, () => {
    alert("无法获取GPS");

    // ❌ GPS失败恢复按钮
    if (btn) {
      btn.disabled = false;
      btn.innerText = "CHECK IN";
    }
  });
}

function logout() {

  const confirmLogout = confirm("确定要退出登录吗？");

  if (!confirmLogout) return;

  // 清除所有本地数据
  localStorage.clear();

  // 返回登录页
  window.location.replace("/index.html");
}

// =====================
// ✅ 状态控制 + 自动跳转
// =====================
function loadStatus() {

  // ✅ admin 不执行
  if (isAdmin) return;

  const token = localStorage.getItem("token");

  fetch(API + "/api/status", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => {

    if (res.status === 401) {
      localStorage.clear();
      location.href = "index.html";
      return;
    }

    return res.json();
  })
  .then(data => {
    if (!data) return;
	
	console.log("API status:", data.status);
	console.log("Current path:", path);

    if (data.status === "not_checked_in" && !path.includes("checkin")) {
      location.href = "checkin.html";
    }

	if (data.status === "checked_in" && !path.includes("checkout")) {
	  console.log("员工已打卡，正在跳转 Checkout");
	  window.location.replace("checkout.html");
	  return;
	}

    if (data.status === "completed" && !path.includes("done")) {
      location.href = "done.html";
    }

    const inBtn = document.getElementById("checkInBtn");
    const outBtn = document.getElementById("checkOutBtn");

    if (inBtn) inBtn.style.display = data.status === "not_checked_in" ? "block" : "none";
    if (outBtn) outBtn.style.display = data.status === "checked_in" ? "block" : "none";
  });
}

// =====================
// ✅ 显示用户信息（重点🔥🔥🔥）
// =====================
function loadUserInfo() {

  const userStr = localStorage.getItem("user");
  const company = localStorage.getItem("company") || "-";
  if (!userStr) return;

  const user = JSON.parse(userStr);

  const el = document.getElementById("userInfo");
  if (!el) return;

  el.innerHTML = `
    <div style="text-align:center;">
      <h2 style="background:#5a67d8;color:white;padding:10px;border-radius:8px;">
        ${company}
      </h2>
      <p><strong>${user.employeeId} - ${user.name}</strong></p>
    </div>
  `;
}


// =====================
// ✅ 今日上班信息（新增🔥）
// =====================

function loadTodayInRecord() {
  const token = localStorage.getItem("token");
  const el = document.getElementById("todayInInfo");

  if (!el) return;

  if (!token) {
    el.innerHTML = '<p style="color:red;">登录状态已失效，请重新登录</p>';
    return;
  }

  el.innerHTML = "<p>正在加载今日打卡资料...</p>";

  fetch(API + "/api/my-today", {
    headers: {
      Authorization: "Bearer " + token
    }
  })
    .then(async res => {
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.msg || "HTTP " + res.status);
      } 

      return data;
    })
    .then(data => {
      if (data.status === "empty") {
        el.innerHTML = '<p style="color:red;">今天还没有打卡记录</p>';
        return;
      }

      if (data.status !== "success") {
        el.innerHTML =
          '<p style="color:red;">加载失败：' +
          (data.message || data.msg || data.status || "未知错误") +
          "</p>";
        return;
      }

      el.innerHTML = `
        <div style="margin-top:15px;">
          <p><strong>📅 日期:</strong> ${data.adate ?? "-"}</p>
          <p><strong>🕒 上班:</strong> ${data.check_in_time ?? "-"}</p>
        </div>
      `;
    })
    .catch(err => {
      console.error("Failed to load today's attendance:", err);
      el.innerHTML =
        '<p style="color:red;">加载失败：' + err.message + "</p>";
    });
}

// =====================
// ✅ 今日打卡信息（新增🔥）
// =====================
function loadTodayRecord() {

  const token = localStorage.getItem("token");

  fetch(API + "/api/my-today", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => res.json())
  .then(data => {

    const el = document.getElementById("todayInfo");
    if (!el) return;

    // ❌ 没打卡
    if (data.status === "empty") {
      el.innerHTML = `<p style="color:red;">今天还没打卡</p>`;
      return;
    }

    // ❌ 错误
    if (data.status !== "success") {
      el.innerHTML = `<p style="color:red;">加载失败</p>`;
      return;
    }

    // ✅ 正常显示
    el.innerHTML = `
      <div style="margin-top:15px;">
        <p><strong>📅 日期:</strong> ${data.adate}</p>
        <p><strong>🕒 上班:</strong> ${data.check_in_time}</p>
		<p><strong>🕒 下班:</strong> ${data.check_out_time}</p>
      </div>
    `;
  });
}

/*======================================Admin Control=====================================*/
// =====================
// ✅ Sidebar 切换
// =====================
// =====================
// ✅ Sidebar / Main 状态
// =====================

function setSidebarState(collapsed) {

  const sidebar = document.getElementById("sidebar_box");
  const main = document.getElementById("main");

  if (!sidebar || !main) return;

  // Sidebar
  sidebar.classList.toggle("collapsed", collapsed);

  // Main 跟随 Sidebar
  main.classList.toggle("collapsed", collapsed);

  // 保存状态
  localStorage.setItem(
    "sidebarState",
    collapsed ? "collapsed" : "open"
  );

  updateToggleBtn();
}


// =====================
// ✅ Sidebar 切换
// =====================

function toggleSidebar() {

  const sidebar = document.getElementById("sidebar_box");

  if (!sidebar) return;

  const collapsed =
    !sidebar.classList.contains("collapsed");

  setSidebarState(collapsed);
}


// =====================
// ✅ Toggle Button
// =====================

function updateToggleBtn() {

  const sidebar =
    document.getElementById("sidebar_box");

  const btn =
    document.querySelector(".toggle-btn");

  if (!sidebar || !btn) return;

  if (window.innerWidth <= 768) {

    btn.style.left = "15px";

  } else {

    btn.style.left =
      sidebar.classList.contains("collapsed")
        ? "15px"
        : "190px";
  }
}


// =====================
// ✅ 初始化 Sidebar
// =====================

function initSidebarState() {

  const sidebar =
    document.getElementById("sidebar_box");

  const main =
    document.getElementById("main");

  if (!sidebar || !main) return;

  const state =
    localStorage.getItem("sidebarState");

  const collapsed =
    state === "collapsed";

  // Sidebar
  sidebar.classList.toggle(
    "collapsed",
    collapsed
  );

  // Main 必须跟随
  main.classList.toggle(
    "collapsed",
    collapsed
  );

  updateToggleBtn();
}
//window.addEventListener("resize", autoSidebar);
//window.addEventListener("load", autoSidebar);

function initPage() {

  fetch("/components/admin_sidebar.html")
    .then(res => res.text())
    .then(html => {

      const sidebar =
        document.getElementById("sidebar_box");

      sidebar.innerHTML = html;

      // =====================
      // Sidebar 状态
      // =====================

      initSidebarState();


      // =====================
      // Active Menu
      // =====================

      const currentPage =
        window.location.pathname
          .split("/")
          .pop();

      const links =
        sidebar.querySelectorAll(".menu");

      links.forEach(link => {

        link.classList.remove("active");

        const href =
          link.getAttribute("href");

        if (!href) return;

        const fileName =
          href.split("/").pop();

        if (fileName === currentPage) {
          link.classList.add("active");
        }

      });

    });
}

function loadCompanies() {

  const token = localStorage.getItem("token");

  console.log("TOKEN:", token);

  fetch(API + "/api/company", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(async res => {

    console.log("STATUS:", res.status);

    const text = await res.text();

    console.log("RAW RESPONSE:", text);

    if (!res.ok) {
      throw new Error(text);
    }

    return JSON.parse(text);
  })
  .then(data => {

    console.log("COMPANY DATA:", data);

    const select =
      document.getElementById("modalCompany");

    // reset
    let html =
      `<option value="">SELECT COMPANY</option>`;

    data.forEach(company => {

      html += `
        <option value="${company.company_code}">
          ${company.company_code} - ${company.company_name}
        </option>
      `;
    });

    select.innerHTML = html;

  })
  .catch(err => {

    console.error("❌ LOAD COMPANY ERROR:", err);
  });
}

function openAddDialog() {

  document.getElementById("staffModal")
    .style.display = "flex";

  document.getElementById("modalTitle")
    .innerText = "ADD STAFF";

  // 清空
  document.getElementById("modalName").value = "";
  document.getElementById("modalPassword").value = "";

  // 🔥 加载 company dropdown
  loadCompanies();
}


function closeModal() {

  const modal =
    document.getElementById("staffModal");

  modal.style.display = "none";

  // 清空所有 input
  modal.querySelectorAll("input").forEach(input => {
    input.value = "";
  });

  // 清空所有 select
  modal.querySelectorAll("select").forEach(select => {
    select.selectedIndex = 0;
  });
}

function loadStaff() {

  const token = localStorage.getItem("token");
  console.log("TOKEN:", token);

  fetch(API + "/api/staffload", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(async res => {

    console.log("STATUS:", res.status);

    const text = await res.text();
    console.log("RAW RESPONSE:", text);

    if (!res.ok) {
      throw new Error(text);
    }

    return JSON.parse(text);
  })
  .then(data => {

    console.log("DATA:", data);

    const table = document.getElementById("staffTable");
    table.innerHTML = "";

    data.forEach(user => {
		
		let html = "";

		data.forEach(user => {
		  html += `
			<tr>
			  <td>${user.employee_id}</td>
			  <td>${user.employee_name}</td>
			  <td>${user.role}</td>
			  <td>${user.company_code}</td>
			  <td>${user.company_name}</td>
			    <td>
				  <button onclick="editStaff(${user.id}, '${user.employee_name}', '${user.role}')">✏️</button>
				  <button onclick="deleteStaff(${user.id})">🗑</button>
				</td>
			</tr>
		  `;
		});

		table.innerHTML = html;

    });

  })
  .catch(err => {
    console.error("❌ ERROR:", err);
  });
}


function loadAll() {

  const token = localStorage.getItem("token");
  if (!token) return;

  // ✅ 获取月份（Flatpickr）
  const month = document.getElementById("monthFilter")?.value;

  let url = API + "/api/all";

  if (month) {
    url += "?month=" + month;
  }

  fetch(url, {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => {

    if (res.status === 401) {
      localStorage.clear();
      location.href = "index.html";
      return;
    }

    return res.json();
  })
  .then(data => {

    const table = document.getElementById("tableBody");
    if (!table) return;

    table.innerHTML = "";

    data.forEach(row => {

      let status = "Normal";
      let className = "status-ok";

      // ✅ 判断迟到
      if (row.check_in_time) {
        const [hour, min] = row.check_in_time.split(":").map(Number);
        const totalMin = hour * 60 + min;

        if (totalMin > (8 * 60 + 30)) {
          status = "Late";
          className = "status-late";
        }
      }

      // ✅ 未下班优先
      if (!row.check_out_time) {
        status = "Working...";
        className = "status-pending";
      }

      table.innerHTML += `
        <tr>
          <td>${row.employee_id}</td>
          <td>${row.employee_name}</td>
          <td>${row.company_name}</td>
          <td>${row.adate}</td>
          <td>${row.check_in_time}</td>
          <td>${row.check_out_time || "-"}</td>
          <td>${row.check_in_lat}, ${row.check_in_lng}</td>
          <td>${row.check_out_lat || "-"}, ${row.check_out_lng || "-"}</td>
          <td>${row.check_in_ip}</td>
          <td>${row.check_out_ip || "-"}</td>
          <td><span class="badge ${className}">${status}</span></td>
        </tr>
      `;
    });

    if (data.length === 0) {
      table.innerHTML = `<tr><td colspan="11">No Data</td></tr>`;
    }

  })
  .catch(err => {
    console.error(err);
    document.getElementById("tableBody").innerHTML =
      `<tr><td colspan="11">Load Failed</td></tr>`;
  });
}

/* =========================
   ✅ 导出 Excel（带 token）
========================= */
/*function exportExcel() {
  fetch(API + "/api/export", {
    headers: { "Authorization": "Bearer " + token }
  })
  .then(res => {
    if (res.status === 401 || res.status === 403) {
      alert("登录已过期");
      localStorage.clear();
      location.href = "index.html";
      return;
    }
    return res.blob();
  })
  .then(blob => {
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance.xlsx";
    a.click();
  });
}*/

function exportExcel() {

  const token = localStorage.getItem("token");
  if (!token) return;

  // ✅ 获取月份
  const month = document.getElementById("monthFilter")?.value;

  let url = API + "/api/export";

  if (month) {
    url += "?month=" + month;
  }

  fetch(url, {
    headers: { 
      "Authorization": "Bearer " + token 
    }
  })
  .then(res => {

    if (res.status === 401 || res.status === 403) {
      alert("Login Expired");
      localStorage.clear();
      location.href = "index.html";
      return;
    }

    return res.blob();
  })
  .then(blob => {

    if (!blob) return;

    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = downloadUrl;

    // ✅ 文件名带月份（高级🔥）
    a.download = month 
      ? `attendance_${month}.xlsx`
      : "attendance_all.xlsx";

    document.body.appendChild(a);
    a.click();
    a.remove();

    // ✅ 释放内存（专业写法🔥）
    window.URL.revokeObjectURL(downloadUrl);

  })
  .catch(err => {
    console.error(err);
    alert("Export Failed");
  });
}


document.addEventListener("DOMContentLoaded", () => {
	autoLogoutAfterWork();

  if (path.includes("index.html")) return;

  loadUserInfo();

  
  // 自动检查今日打卡状态
	if (!isAdmin) {
	  loadStatus();
	}
	
	
	// 加载今日上班日期与时间
	if (document.getElementById("todayInInfo")) {
	  loadTodayInRecord();
	}
	
  // 只有管理员考勤列表页面才加载全部记录
	if (isAdmin && document.getElementById("tableBody")) {
	  loadAll();
	}
 

	if (isAdmin) {

	  // =====================================================
	  // ATTENDANCE ADMIN PAGE
	  // =====================================================

	  if (!path.includes("mgt_staff.html")) {

		loadStaff();

		const monthFilter =
		  document.getElementById("monthFilter");

		// 只有 Attendance 页面才使用 Flatpickr
		if (
		  monthFilter &&
		  typeof flatpickr !== "undefined" &&
		  typeof monthSelectPlugin !== "undefined"
		) {

		  flatpickr("#monthFilter", {
			dateFormat: "Y-m",

			plugins: [
			  new monthSelectPlugin({
				shorthand: true,
				dateFormat: "Y-m",
				altFormat: "F Y"
			  })
			],

			defaultDate:
			  new Date(
				new Date().setMonth(
				  new Date().getMonth() - 1
				)
			  ),

			onChange: function() {
			  loadAll();
			}
		  });

		}

	  }

	}

 
});

// =====================
// ✅ 用户操作监听（🔥放这里）
// =====================
["click", "keydown", "touchstart"].forEach(evt => {
  document.addEventListener(evt, autoLogoutAfterWork);
});