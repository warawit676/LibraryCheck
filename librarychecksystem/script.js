// script.js

// 1. นำเข้า Firebase (เวอร์ชันล่าสุด)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ====== ⚠️ 1. นำค่า Configuration จาก Firebase มาวางทับด้านล่างนี้ ⚠️ ======
const firebaseConfig = {
    apiKey: "AIzaSyCF1Md0QKHhevZc2zRBsjYPeqNLMsgCqrg",
    authDomain: "library-checkin-db89e.firebaseapp.com",
    databaseURL: "https://library-checkin-db89e-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "library-checkin-db89e",
    storageBucket: "library-checkin-db89e.firebasestorage.app",
    messagingSenderId: "957883084302",
    appId: "1:957883084302:web:775140b535d0a6b68c965f"
};
// =========================================================================

// 2. เชื่อมต่อระบบ Firebase
let app, db, recordsRef;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    recordsRef = ref(db, 'checkins'); // สร้างโฟลเดอร์ชื่อ checkins ในฐานข้อมูล
} catch (error) {
    console.warn("ยังไม่ได้ใส่ค่า Firebase Config หรือใส่ผิด", error);
}

let records = [];

// Utilities
const getInitials = (name) => {
    return name.substring(0, 2).toUpperCase();
};

const formatDateTime = (date) => {
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${date.toLocaleDateString('th-TH', dateOptions)} • ${date.toLocaleTimeString('th-TH', timeOptions)} น.`;
};

const formatClockTime = (date) => {
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return `${date.toLocaleDateString('th-TH', dateOptions)}  ${date.toLocaleTimeString('th-TH', timeOptions)}`;
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    startClock();

    // ดึงข้อมูลจากฐานข้อมูลแบบ Real-time
    if (db) {
        onValue(recordsRef, (snapshot) => {
            const data = snapshot.val();
            records = [];
            if (data) {
                // แปลงข้อมูลจาก Object เป็น Array
                Object.keys(data).forEach(key => {
                    records.push({
                        id: key, // รหัสของข้อมูลใน Firebase
                        ...data[key]
                    });
                });
                // เรียงจากเวลาล่าสุดไปเก่าสุด
                records.sort((a, b) => b.timestamp - a.timestamp);
            }
            renderTable();
            updateStats();
        });
    } else {
        renderTable(); // ถ้าไม่มี db ให้แสดงตารางเปล่าไปก่อน
    }
});

function startClock() {
    const clockEl = document.getElementById('clockDisplay');
    setInterval(() => {
        clockEl.textContent = formatClockTime(new Date());
    }, 1000);
}

// ผูกฟังก์ชันเข้ากับหน้าจอ (เพราะใช้ type="module" ฟังก์ชันจะไม่เป็น Global ทันที)
window.handleCheckIn = async function () {
    if (!db || firebaseConfig.apiKey.includes("ใส่_API_KEY_ที่นี่")) {
        showToast('error', 'ข้อผิดพลาด', 'กรุณาตั้งค่า Firebase Config ในไฟล์ script.js ก่อนใช้งาน');
        return;
    }

    const idInput = document.getElementById('studentId');
    const nameInput = document.getElementById('fullName');

    const studentId = idInput.value.trim();
    const fullName = nameInput.value.trim();

    if (!studentId || !fullName) return;

    const now = new Date();

    const newRecord = {
        studentId,
        fullName,
        checkInTime: formatDateTime(now),
        checkOutTime: null,
        status: 'active',
        timestamp: Date.now()
    };

    try {
        // ดันข้อมูลขึ้นฐานข้อมูล Firebase
        await push(recordsRef, newRecord);
        showToast('success', 'บันทึกสำเร็จ', `${fullName} เข้าสู่ห้องสมุด`);

        idInput.value = '';
        nameInput.value = '';
        idInput.focus();
    } catch (error) {
        showToast('error', 'บันทึกไม่สำเร็จ', error.message);
    }
}

window.handleCheckOut = async function (recordId) {
    if (!db) return;

    const record = records.find(r => r.id === recordId);
    if (record && record.status === 'active') {
        const now = new Date();
        const recordToUpdate = ref(db, `checkins/${recordId}`);

        try {
            // อัปเดตข้อมูลใน Firebase เฉพาะจุด
            await update(recordToUpdate, {
                checkOutTime: formatDateTime(now),
                status: 'inactive'
            });
            showToast('info', 'ลงเวลาออก', `${record.fullName} ออกจากห้องสมุด`);
        } catch (error) {
            showToast('error', 'บันทึกไม่สำเร็จ', error.message);
        }
    }
}

window.clearAllData = async function () {
    if (records.length === 0) return;

    if (confirm("คุณต้องการลบประวัติการเข้าใช้งานทั้งหมดใช่หรือไม่?\n\n* ข้อมูลทั้งหมดจะถูกลบออกจากฐานข้อมูลและไม่สามารถกู้คืนได้")) {
        try {
            // ลบโฟลเดอร์ checkins ทิ้งทั้งหมด
            await remove(recordsRef);
            showToast('error', 'ล้างข้อมูล', 'ลบประวัติทั้งหมดเรียบร้อยแล้ว');
        } catch (error) {
            showToast('error', 'ลบข้อมูลไม่สำเร็จ', error.message);
        }
    }
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="icon-wrapper">
                            <i class='bx bx-data'></i>
                        </div>
                        <p>ยังไม่มีข้อมูล / กำลังรอการเชื่อมต่อฐานข้อมูล</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    records.forEach(record => {
        const tr = document.createElement('tr');

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
            <td data-label="สถานะ">
                ${record.status === 'active'
                ? '<span class="badge badge-active">กำลังใช้งาน</span>'
                : '<span class="badge badge-inactive">ออกแล้ว</span>'
            }
            </td>
            <td data-label="เวลาเข้า">
                <div class="time-box">
                    <i class='bx bx-time'></i>
                    <span>${record.checkInTime}</span>
                </div>
            </td>
            <td data-label="เวลาออก">
                ${record.checkOutTime
                ? `<div class="time-box">
                        <i class='bx bx-time' style="color: #64748b;"></i>
                        <span style="color: #64748b;">${record.checkOutTime}</span>
                       </div>`
                : '<span style="color: #cbd5e1; font-weight: 500;">-</span>'
            }
            </td>
            <td data-label="จัดการ">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStats() {
    const total = records.length;
    const active = records.filter(r => r.status === 'active').length;

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

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
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
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}
