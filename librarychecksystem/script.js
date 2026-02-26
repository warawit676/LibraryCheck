// script.js

// Data State - LOAD FROM LOCAL STORAGE IF AVAILABLE
const STORAGE_KEY = 'libraryData';
let records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// Save data to localStorage
const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

// Utilities
const getInitials = (name) => {
    return name.substring(0, 2).toUpperCase();
};

// จัดรูปแบบ วันที่ + เวลา (เช่น 26 ก.พ. 2569 เวลา 18:45 น.)
const formatDateTime = (date) => {
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' };

    const timeStr = date.toLocaleTimeString('th-TH', timeOptions);
    const dateStr = date.toLocaleDateString('th-TH', dateOptions);

    return `${dateStr} • ${timeStr} น.`;
};

// จัดรูปแบบสำหรับนาฬิกาให้ดูสวยงาม
const formatClockTime = (date) => {
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };

    const timeStr = date.toLocaleTimeString('th-TH', timeOptions);
    const dateStr = date.toLocaleDateString('th-TH', dateOptions);

    return `${dateStr}  ${timeStr}`;
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    renderTable();
    updateStats();
});

// Real-time Clock
function startClock() {
    const clockEl = document.getElementById('clockDisplay');
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = formatClockTime(now);
    }, 1000);
}

// Check In Handler
function handleCheckIn() {
    const idInput = document.getElementById('studentId');
    const nameInput = document.getElementById('fullName');

    const studentId = idInput.value.trim();
    const fullName = nameInput.value.trim();

    if (!studentId || !fullName) return;

    const now = new Date();

    const newRecord = {
        id: Date.now().toString(),
        studentId,
        fullName,
        checkInTime: formatDateTime(now),
        checkOutTime: null,
        status: 'active',
        timestamp: now.getTime() // For sorting/managing
    };

    // Add to beginning of array so newest is top
    records.unshift(newRecord);

    // Save to Local Storage
    saveData();

    renderTable();
    updateStats();
    showToast('success', 'บันทึกสำเร็จ', `${fullName} เข้าสู่ห้องสมุด`);

    // Reset Form and focus
    idInput.value = '';
    nameInput.value = '';
    idInput.focus();
}

// Check Out Handler
function handleCheckOut(recordId) {
    const recordIndex = records.findIndex(r => r.id === recordId);

    if (recordIndex !== -1 && records[recordIndex].status === 'active') {
        const now = new Date();
        records[recordIndex].checkOutTime = formatDateTime(now);
        records[recordIndex].status = 'inactive';

        // Save to Local Storage
        saveData();

        renderTable();
        updateStats();
        showToast('info', 'ลงเวลาออก', `${records[recordIndex].fullName} ออกจากห้องสมุด`);
    }
}

// Clear all data
function clearAllData() {
    if (records.length === 0) return;

    if (confirm("คุณต้องการลบประวัติการเข้าใช้งานทั้งหมดใช่หรือไม่?\n\n* ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้")) {
        records = [];
        saveData();
        renderTable();
        updateStats();
        showToast('error', 'ล้างข้อมูล', 'ลบประวัติทั้งหมดเรียบร้อยแล้ว');
    }
}

// Render Table
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="icon-wrapper">
                            <i class='bx bx-folder-open'></i>
                        </div>
                        <p>ยังไม่มีข้อมูลการเข้าใช้ห้องสมุดในขณะนี้</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    records.forEach(record => {
        const tr = document.createElement('tr');

        // Action Cell
        const actionHtml = record.status === 'active'
            ? `<button class="btn btn-action checkout" onclick="handleCheckOut('${record.id}')"><i class='bx bx-log-out'></i> ลงเวลาออก</button>`
            : `<button class="btn btn-action disabled" disabled><i class='bx bx-check'></i> เสร็จสิ้น</button>`;

        tr.innerHTML = `
            <!-- Student Info Cell with Avatar -->
            <td data-label="ผู้ใช้งาน">
                <div class="student-info">
                    <div class="student-avatar">${getInitials(record.fullName)}</div>
                    <div class="student-details">
                        <span class="student-name">${record.fullName}</span>
                        <span class="student-id">รหัส: ${record.studentId}</span>
                    </div>
                </div>
            </td>
            
            <!-- Status Cell -->
            <td data-label="สถานะ">
                ${record.status === 'active'
                ? `<span class="badge badge-active">กำลังใช้งาน</span>`
                : `<span class="badge badge-inactive">ออกแล้ว</span>`
            }
            </td>
            
            <!-- Check In Cell -->
            <td data-label="เวลาเข้า">
                <div class="time-box">
                    <i class='bx bx-time'></i>
                    <span>${record.checkInTime}</span>
                </div>
            </td>
            
            <!-- Check Out Cell -->
            <td data-label="เวลาออก">
                ${record.checkOutTime
                ? `
                    <div class="time-box">
                        <i class='bx bx-time' style="color: #64748b;"></i>
                        <span style="color: #64748b;">${record.checkOutTime}</span>
                    </div>
                    `
                : '<span style="color: #cbd5e1; font-weight: 500;">-</span>'
            }
            </td>
            
            <!-- Action Cell -->
            <td data-label="จัดการ">${actionHtml}</td>
        `;

        tbody.appendChild(tr);
    });
}

// Update Statistics
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

// Toast Notification System
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

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}
