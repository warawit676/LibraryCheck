// script.js
window.formatClockTime = (date) => {
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return `${date.toLocaleDateString('th-TH', dateOptions)} <span style="display:inline-block; width: 62px; text-align:center;">${date.toLocaleTimeString('th-TH', timeOptions)}</span>`;
};
// 1. นำเข้า Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCF1Md0QKHhevZc2zRBsjYPeqNLMsgCqrg",
    authDomain: "library-checkin-db89e.firebaseapp.com",
    databaseURL: "https://library-checkin-db89e-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "library-checkin-db89e",
    storageBucket: "library-checkin-db89e.firebasestorage.app",
    messagingSenderId: "957883084302",
    appId: "1:957883084302:web:775140b535d0a6b68c965f"
};

let app, db, auth, recordsRef, profilesRef;
let records = [];
let profiles = {}; // รหัสผู้ใช้ -> ข้อมูลโปรไฟล์

// ผู้ใช้ปัจจุบัน
let currentUser = null; // { role: 'student'|'staff', id: '...', name: '...', email: '...' }

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    recordsRef = ref(db, 'checkins');
    profilesRef = ref(db, 'profiles');
} catch (error) {
    console.warn("Firebase Setup Error", error);
}

// Utilities
const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : '--';

const formatDateTime = (date) => {
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${date.toLocaleDateString('th-TH', dateOptions)} • ${date.toLocaleTimeString('th-TH', timeOptions)} น.`;
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // ต้องแน่ใจว่าโหลดหน้าเสร็จแล้วค่อยเริ่มทำงาน
    window.startClock();
    window.checkLocalSession();

    if (db) {
        // อัปเดตข้อมูลผู้เข้าใช้งานแบบ Real-time
        onValue(recordsRef, (snapshot) => {
            const data = snapshot.val();
            records = [];
            if (data) {
                Object.keys(data).forEach(key => records.push({ id: key, ...data[key] }));
                records.sort((a, b) => b.timestamp - a.timestamp);
            }
            renderTable();
            updateStats();
            if (currentUser && currentUser.role === 'student') renderProfileHistory();
            if (currentUser && currentUser.role === 'staff') renderDashboard();
        });

        // ดึงข้อมูลโปรไฟล์นักเรียนเก็บไว้สำหรับ Smart Check-in
        onValue(profilesRef, (snapshot) => {
            profiles = snapshot.val() || {};
        });
    }

    // Monitor Firebase Auth (Staff)
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // Staff กำลังล็อกอินอยู่
                loginAsStaff(user.email);
            } else if (currentUser && currentUser.role === 'staff') {
                // ถูกบังคับออก
                handleLogout();
            }
        });
    }
});

window.startClock = function () {
    const clockEl = document.getElementById('clockDisplay');
    // ให้มันรันครั้งแรกก่อน 1 รอบ จะได้ไม่รอดิเลย์ 1 วินาทีแรก
    if (clockEl) clockEl.innerHTML = formatClockTime(new Date());

    setInterval(() => {
        if (clockEl) clockEl.innerHTML = formatClockTime(new Date());
    }, 1000);
}

// ==========================================
// VIEW & AUTHENTICATION LOGIC
// ==========================================

window.switchView = function (viewId) {
    document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');

    const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
    navBtns.forEach(btn => btn.classList.remove('active-nav'));

    // อัปเดต Navbar ให้สีตรงกับหน้าที่เปิด
    let activeBtn = null;
    if (viewId === 'checkInView') activeBtn = navBtns[0];
    if (viewId === 'dashboardView') activeBtn = document.getElementById('navDashboardBtn');
    if (viewId === 'profileView') activeBtn = document.getElementById('navProfileBtn');

    if (activeBtn) {
        activeBtn.classList.add('active-nav');

        // Animate slider dynamically based on precise button dimensions
        // Delay slightly for initial layout calculation if elements were hidden
        setTimeout(() => {
            const slider = document.querySelector('.nav-slider');
            if (slider && activeBtn.offsetWidth > 0) {
                slider.style.width = `${activeBtn.offsetWidth}px`;
                // Subtract 4px for the parent container's padding
                slider.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;
            }
        });
    }

    if (viewId === 'dashboardView') renderDashboard();
    if (viewId === 'profileView') renderProfileHistory();
}

window.switchAuthTab = function (type) {
    const tabs = Array.from(document.querySelectorAll('.auth-tab'));
    tabs.forEach(t => t.classList.remove('active'));

    const activeTab = document.getElementById(type === 'student' ? 'tabStudent' : 'tabStaff');
    activeTab.classList.add('active');

    // Animate auth slider using precise dimensions
    setTimeout(() => {
        const slider = document.querySelector('.auth-slider');
        if (slider && activeTab.offsetWidth > 0) {
            slider.style.width = `${activeTab.offsetWidth}px`;
            slider.style.transform = `translateX(${activeTab.offsetLeft - 4}px)`;
        }
    }, 10);

    if (type === 'student') {
        document.getElementById('studentAuthForm').classList.remove('hidden');
        document.getElementById('staffAuthForm').classList.add('hidden');
    } else {
        document.getElementById('studentAuthForm').classList.add('hidden');
        document.getElementById('staffAuthForm').classList.remove('hidden');
    }
}

window.checkLocalSession = function () {
    const saved = localStorage.getItem('libraryCurrentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        updateUIAfterLogin();
    } else {
        window.switchView('checkInView'); // ค่าเริ่มต้น
    }

    // Force recalculate sliders after full render (e.g. web fonts)
    setTimeout(() => {
        const activeNav = document.querySelector('.nav-btn.active-nav');
        if (activeNav) window.switchView(activeNav.getAttribute('onclick').match(/'([^']+)'/)[1]);

        const activeTab = document.querySelector('.auth-tab.active');
        if (activeTab) window.switchAuthTab(activeTab.id === 'tabStudent' ? 'student' : 'staff');
    }, 100);
}

// ล็อกอินส่วนของนักเรียน (รหัสอย่างเดียว)
window.handleStudentAuth = async function () {
    const idObj = document.getElementById('authStudentId');
    const stId = idObj.value.trim();
    if (!stId) return;

    let profileName = "นักเรียน";
    // ลองหาชื่อจากฐานข้อมูล
    if (profiles[stId]) {
        profileName = profiles[stId].fullName;
        window.showToast('success', 'เข้าสู่ระบบ', `ยินดีต้อนรับกลับมา ${profileName}`);
    } else {
        window.showToast('info', 'สร้างโปรไฟล์ใหม่', 'กรุณาลงเวลาเข้าก่อนเพื่อให้ระบบบันทึกชื่อคุณในประวัติ');
    }

    currentUser = { role: 'student', id: stId, name: profileName };
    localStorage.setItem('libraryCurrentUser', JSON.stringify(currentUser));

    idObj.value = '';
    updateUIAfterLogin();
    window.switchView('profileView');
}

// ล็อกอินส่วนของบุคลากร (Firebase Auth)
window.handleStaffLogin = async function () {
    const email = document.getElementById('staffEmail').value.trim();
    const pass = document.getElementById('staffPassword').value.trim();
    if (!email || !pass) return;

    if (!auth) {
        window.showToast('error', 'ระบบยังไม่พร้อม', 'ระบบ Firebase Auth ยังไม่พร้อมใช้งาน');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // เมื่อสำเร็จ onAuthStateChanged จะทำงานต่อเอง (loginAsStaff)
        document.getElementById('staffEmail').value = '';
        document.getElementById('staffPassword').value = '';
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/invalid-credential') {
            window.showToast('error', 'เข้าสู่ระบบล้มเหลว', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        } else {
            window.showToast('error', 'ข้อผิดพลาด', error.message);
        }
    }
}

function loginAsStaff(email) {
    currentUser = { role: 'staff', email: email, name: 'แอดมิน' };
    localStorage.setItem('libraryCurrentUser', JSON.stringify(currentUser));
    window.showToast('success', 'เข้าสู่ระบบบุคลากร', `ยินดีต้อนรับ ${email}`);
    updateUIAfterLogin();
    window.switchView('dashboardView');
}

window.handleLogout = async function () {
    if (currentUser?.role === 'staff' && auth) {
        await signOut(auth); // บังคับออกจากระบบผ่าน Firebase
    }
    currentUser = null;
    localStorage.removeItem('libraryCurrentUser');

    // ซ่อนเมนูทั้งหมด
    document.getElementById('mainNav').classList.add('hidden');
    document.getElementById('userMenu').classList.add('hidden');
    document.getElementById('authButtons').classList.remove('hidden');
    document.getElementById('clearDataBtn').classList.add('hidden');
    document.getElementById('navDashboardBtn').classList.add('hidden');
    document.getElementById('navProfileBtn').classList.add('hidden');

    window.showToast('info', 'ออกจากระบบ', 'คุณได้ออกจากระบบเรียบร้อยแล้ว');
    window.switchView('checkInView');
}

function updateUIAfterLogin() {
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('userMenu').classList.remove('hidden');
    document.getElementById('authButtons').classList.add('hidden');

    const nameDisplay = currentUser.role === 'staff' ? "ผู้ดูแลระบบ: " + currentUser.email : "นักเรียน: " + currentUser.id;
    document.getElementById('userNameDisplay').textContent = nameDisplay;

    if (currentUser.role === 'staff') {
        document.getElementById('navDashboardBtn').classList.remove('hidden');
        document.getElementById('navProfileBtn').classList.add('hidden');
        // แสดงปุ่มลบข้อมูลให้คนเขียนโปรแกรม (สมมติว่าเป็น admin@library.com)
        if (currentUser.email === 'admin@library.com' || currentUser.email === 'dev@website.com' || currentUser.email.includes('admin')) {
            document.getElementById('clearDataBtn').classList.remove('hidden');
        }
    } else {
        document.getElementById('navDashboardBtn').classList.add('hidden');
        document.getElementById('navProfileBtn').classList.remove('hidden');
        document.getElementById('clearDataBtn').classList.add('hidden');
    }
}

// ==========================================
// SMART CHECK-IN LOGIC
// ==========================================

window.handleSmartCheckIn = async function () {
    if (!db) return window.showToast('error', 'ข้อผิดพลาด', 'ยังไม่ได้เชื่อมต่อระบบฐานข้อมูล');

    const idInput = document.getElementById('studentId');
    const nameInput = document.getElementById('fullName');

    let stId = idInput.value.trim();
    let stName = nameInput.value.trim();

    // เช็คว่ามีกรอกครบสองช่องไหม หรือมีช่องไหนว่าง
    if (!stId && !stName) {
        return window.showToast('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสนักเรียนหรือชื่อ-นามสกุลของคุณ');
    }

    // กรณี 1: พิมพ์แค่รหัสนักเรียน (ไม่มีชื่อ)
    if (stId && !stName) {
        if (profiles[stId]) {
            stName = profiles[stId].fullName; // ดึงชื่อจากฐานข้อมูล
        } else {
            return window.showToast('warning', 'ไม่พบบัญชีในระบบ', 'คุณใช้งานครั้งแรก ให้กรอก "รหัสนักเรียน" และ "ชื่อ-นามสกุล" คู่กัน ระบบจะสมัครบัญชีให้อัตโนมัติ');
        }
    }

    // กรณี 2: พิมพ์แค่ชื่อ (ไม่มีรหัส)
    if (stName && !stId) {
        let foundId = null;
        Object.keys(profiles).forEach(key => {
            if (profiles[key].fullName === stName) foundId = key;
        });

        if (foundId) {
            stId = foundId; // ดึงรหัสจากฐานข้อมูล
        } else {
            return window.showToast('warning', 'ไม่พบบัญชีในระบบ', 'คุณใช้งานครั้งแรก ให้กรอก "รหัสนักเรียน" และ "ชื่อ-นามสกุล" คู่กัน ระบบจะสมัครบัญชีให้อัตโนมัติ');
        }
    }

    // กรณี 3: กรอกครบ 2 ช่อง (สร้างบัญชีใหม่ตั้งแต่นี้ หรือ อัปเดตชื่อในกรณีเปลี่ยนชื่อ)
    // ถ้ารหัสซ้ำแต่อยากเปลี่ยนชื่อ โค้ดด้านล่างจะทำการ Overwrite ชื่อใหม่ให้

    // หากมีแค่ชื่อ/รหัส ตอนนี้เราสามารถมั่นใจได้ว่าตัวแปร stId และ stName มีข้อมูลทั้งคู่แล้ว

    const now = new Date();
    const newRecord = {
        studentId: stId,
        fullName: stName,
        checkInTime: formatDateTime(now),
        checkOutTime: null,
        status: 'active',
        timestamp: Date.now()
    };

    try {
        // ลงเวลาเข้า
        await push(recordsRef, newRecord);

        // อัปเดต/สร้างโปรไฟล์
        const userProfileRef = ref(db, `profiles/${stId}`);
        await update(userProfileRef, {
            fullName: stName,
            lastVisit: formatDateTime(now),
            lastActive: Date.now()
        });

        // หากผู้ใช้ Student ใช้อยู่ ปรับชื่อให้ตรงล่าสุด
        if (currentUser && currentUser.role === 'student' && currentUser.id === stId) {
            currentUser.name = stName;
            localStorage.setItem('libraryCurrentUser', JSON.stringify(currentUser));
        }

        window.showToast('success', 'บันทึกสำเร็จ', `${stName} เข้าสู่ห้องสมุด`);
        idInput.value = '';
        nameInput.value = '';
        if (document.activeElement === idInput || document.activeElement === nameInput) {
            idInput.focus();
        }

    } catch (error) {
        window.showToast('error', 'บันทึกไม่สำเร็จ', error.message);
    }
}

window.handleCheckOut = async function (recordId) {
    if (!db) return;

    const record = records.find(r => r.id === recordId);
    if (record && record.status === 'active') {
        const now = new Date();
        const recordToUpdate = ref(db, `checkins/${recordId}`);
        try {
            await update(recordToUpdate, {
                checkOutTime: formatDateTime(now),
                status: 'inactive'
            });
            window.showToast('info', 'ลงเวลาออก', `${record.fullName} ออกจากห้องสมุด`);
        } catch (error) {
            window.showToast('error', 'บันทึกไม่สำเร็จ', error.message);
        }
    }
}

window.clearAllData = async function () {
    if (records.length === 0) return;

    if (confirm("ล้างข้อมูลทั้งหมดใช่หรือไม่?\n\n* ข้อมูลทั้งหมดจะถูกลบ ไม่สามารถกู้คืนได้")) {
        try {
            await remove(recordsRef);
            // อนุญาตให้เก็บ profiles ไว้ จะได้ไม่ต้องพิมพ์ชื่อใหม่
            window.showToast('error', 'ล้างประวัติ', 'ลบประวัติการเข้าใช้งานทั้งหมดเรียบร้อยแล้ว');
        } catch (error) {
            window.showToast('error', 'ลบไม่สำเร็จ', error.message);
        }
    }
}

// ==========================================
// NOTIFICATION & UI UTILS
// ==========================================

window.showToast = function (type, title, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'bx-info-circle';
    if (type === 'success') iconClass = 'bx-check-circle';
    if (type === 'warning') iconClass = 'bx-error';
    if (type === 'error') iconClass = 'bx-trash';

    toast.innerHTML = `
        <i class='bx ${iconClass} toast-icon'></i>
        <div class="toast-content">
            <p>${title}</p>
            <span>${message}</span>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
// ==========================================

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon-wrapper"><i class='bx bx-data'></i></div><p>ยังไม่มีผู้ใช้งานวันนี้</p></div></td></tr>`;
        return;
    }

    records.slice(0, 50).forEach((record, index) => { // โชว์ 50 ล่าสุด
        const tr = document.createElement('tr');
        tr.className = 'animate-row';
        tr.style.animationDelay = `${index * 0.05}s`;
        const actionHtml = record.status === 'active'
            ? `<button class="btn btn-action checkout" onclick="handleCheckOut('${record.id}')"><i class='bx bx-log-out'></i> ลงเวลาออก</button>`
            : `<button class="btn btn-action disabled" disabled><i class='bx bx-check'></i> เสร็จสิ้น</button>`;

        tr.innerHTML = `
            <td data-label="ผู้ใช้งาน">
                <div class="student-info">
                    <div class="student-avatar">${getInitials(record.fullName)}</div>
                    <div class="student-details">
                        <span class="student-name">${record.fullName}</span>
                        <span class="student-id">รหัส: ${record.studentId}</span>
                    </div>
                </div>
            </td>
            <td data-label="สถานะ">${record.status === 'active' ? '<span class="badge badge-active">กำลังใช้งาน</span>' : '<span class="badge badge-inactive">ออกแล้ว</span>'}</td>
            <td data-label="เวลาเข้า"><div class="time-box"><i class='bx bx-time'></i><span>${record.checkInTime}</span></div></td>
            <td data-label="เวลาออก">${record.checkOutTime ? `<div class="time-box"><i class='bx bx-time' style="color: #64748b;"></i><span style="color: #64748b;">${record.checkOutTime}</span></div>` : '<span style="color: #cbd5e1; font-weight: 500;">-</span>'}</td>
            <td data-label="จัดการ">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStats() {
    const active = records.filter(r => r.status === 'active').length;
    // หาผู้ใช้งานแบบไม่ซ้ำกันสำหรับ "ผู้ใช้งานวันนี้" ในความเป็นจริงอาจต้องเช็ควันที่
    // สร้าง Array ของ ID ที่เข้าวันนี้
    const uniqueUsersSet = new Set();
    records.forEach(r => uniqueUsersSet.add(r.studentId));
    const total = uniqueUsersSet.size;

    const totalEl = document.getElementById('totalUsersStat');
    const activeEl = document.getElementById('activeUsersStat');

    if (totalEl.textContent !== total.toString()) {
        totalEl.textContent = total;
        totalEl.style.transform = 'scale(1.1)';
        totalEl.style.color = 'var(--primary)';
        setTimeout(() => {
            totalEl.style.transform = 'scale(1)';
            totalEl.style.color = 'var(--text-main)';
        }, 200);
    }
    activeEl.textContent = active;
}

// Student Profile History
function renderProfileHistory() {
    if (!currentUser || currentUser.role !== 'student') return;

    // ตั้งค่า Header
    document.getElementById('profileAvatar').textContent = getInitials(currentUser.name);
    document.getElementById('profileName').textContent = currentUser.name !== 'นักเรียน' ? currentUser.name : (profiles[currentUser.id]?.fullName || "นักเรียนไร้ชื่อ");
    document.getElementById('profileId').textContent = "รหัส: " + currentUser.id;

    // หาประวัติ
    const myHistory = records.filter(r => r.studentId === currentUser.id);
    document.getElementById('profileVisitCount').textContent = `${myHistory.length} ครั้ง`;

    const tbody = document.getElementById('profileHistoryTableBody');
    tbody.innerHTML = '';

    if (myHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 2rem;">ไม่พบประวัติการเข้าใช้งาน</td></tr>`;
        return;
    }

    myHistory.forEach((record, index) => {
        const tr = document.createElement('tr');
        tr.className = 'animate-row';
        tr.style.animationDelay = `${index * 0.05}s`;
        tr.innerHTML = `
            <td data-label="เวลาเข้า">${record.checkInTime}</td>
            <td data-label="เวลาออก">${record.checkOutTime || '- กำลังใช้งาน -'}</td>
            <td data-label="สถานะ">${record.status === 'active' ? '<span class="badge badge-active">ใช้งานอยู่</span>' : '<span class="badge badge-inactive">สำเร็จ</span>'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Staff Dashboard List
function renderDashboard() {
    if (!currentUser || currentUser.role !== 'staff') return;

    const tbody = document.getElementById('staffUsersTableBody');
    tbody.innerHTML = '';

    const userIds = Object.keys(profiles);
    if (userIds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">ไม่พบข้อมูลบัญชีนักเรียนในระบบ</td></tr>`;
        return;
    }

    // จัดเรียงโปรไฟล์ตามลำดับเวลาเข้าล่าสุด (ถ้ามี)
    const profileArray = userIds.map(stId => {
        const myRecs = records.filter(r => r.studentId === stId);
        return {
            studentId: stId,
            fullName: profiles[stId].fullName || 'ไม่ระบุ',
            lastVisit: profiles[stId].lastVisit || '-',
            lastActive: profiles[stId].lastActive || 0,
            visitCount: myRecs.length
        }
    }).sort((a, b) => b.lastActive - a.lastActive);

    profileArray.forEach((p, index) => {
        const tr = document.createElement('tr');
        tr.className = 'animate-row';
        tr.style.animationDelay = `${index * 0.05}s`;
        tr.innerHTML = `
            <td data-label="นักเรียน">
                <div class="student-info"><div class="student-avatar" style="width:2rem;height:2rem;font-size:0.75rem;">${getInitials(p.fullName)}</div> <span style="font-weight:600;">${p.fullName}</span></div>
            </td>
            <td data-label="รหัสนักเรียน">${p.studentId}</td>
            <td data-label="จำนวนเข้าใช้"><span class="badge badge-inactive">${p.visitCount} ครั้ง</span></td>
            <td data-label="ใช้งานล่าสุด"><div class="time-box"><i class='bx bx-time'></i> ${p.lastVisit}</div></td>
            <td data-label="จัดการ">
                <button class="btn btn-action" onclick="viewUserAsStaff('${p.studentId}')"><i class='bx bx-search'></i> ดูประวัติ</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.viewUserAsStaff = function (stId) {
    if (!profiles[stId]) return;

    // ยืมหน้า profileView ของนักเรียนมาใช้ชั่วคราว แต่แก้ข้อมูล
    const originalUser = currentUser; // สำรองตัวแอดมินไว้

    currentUser = { role: 'student', id: stId, name: profiles[stId].fullName };
    window.switchView('profileView');

    // คืนค่ากลับให้แอดมิน
    currentUser = originalUser;

    // อัปเดต Nav กลับให้แอดมิน เพื่อให้มีทางกลับหน้า Dashboard (ตอนกดหน้า dashboard มันจะปิดหน้า profile)
    document.getElementById('navDashboardBtn').classList.remove('hidden');
    document.getElementById('navProfileBtn').classList.add('hidden');
}
