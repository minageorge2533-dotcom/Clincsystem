"use strict";

// ==========================================================
// لوحة تحكم الدكتور (الأدمن)
// بتقرأ وتكتب في نفس مصفوفة "bookings" في LocalStorage
// اللي بيستخدمها: موقع المرضى (الحجز + البروفايل) + لوحتين المساعدين
// ==========================================================

// ======================================
// 1. الثوابت
// ======================================

const BOOKINGS_KEY = "bookings";
const USERS_KEY = "users";

// قيم العيادات لازم تطابق اللي في صفحة الحجز ولوحات المساعدين
const CLINICS = {
    "العيادة الرئيسية": { title: "عيادة ميدان المسلة", scheduleId: "2" },
    "عيادة فرع المدينة": { title: "عيادة 6 أكتوبر", scheduleId: "1" }
};

// أيام العمل الدائمة لكل لوحة (نفس assistant.js)
const CLINIC_WORK_DAYS = { "1": [6, 0, 1], "2": [2, 3, 4] };
const CLINIC_LATE_DAY = { "1": 1, "2": 4 };

const ST_OK = "مؤكد";
const ST_WAIT = "قيد الانتظار";
const ST_DONE = "مكتمل";
const ST_CANCEL = "ملغي";

// حالات الدفع اللي تعتبر "مدفوع"
const PAID_STATUSES = ["simulated_success", "doctor_confirmed"];

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// أسعار الخدمات (نفس موقع الحجز)
const SERVICES = {
    "كشف أسنان": 200,
    "تنظيف الأسنان": 350,
    "تبييض الأسنان": 1200,
    "تقويم الأسنان": 1500,
    "حشو الأسنان": 500,
    "خلع الأسنان": 400,
    "زراعة الأسنان": 5000
};

const $ = (id) => document.getElementById(id);


// ======================================
// 2. دوال مساعدة
// ======================================

function esc(text) {
    return String(text == null ? "" : text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function readJson(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

function readBookings() {
    const data = readJson(BOOKINGS_KEY, []);
    return Array.isArray(data) ? data.filter(b => b && b.bookingCode) : [];
}

function writeBookings(list) {
    try {
        localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        showMessage("تعذر حفظ البيانات في المتصفح", "danger");
        return false;
    }
}

function readUsers() {
    const data = readJson(USERS_KEY, []);
    return Array.isArray(data) ? data : [];
}

function clinicTitle(clinic) {
    return CLINICS[clinic] ? CLINICS[clinic].title : (clinic || "—");
}

function money(n) {
    return Number(n || 0).toLocaleString("en-US");
}

function formatDate(date) {
    if (!date) return "—";
    const p = String(date).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : date;
}

function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function timeToMin(t) {
    const p = String(t).split(":").map(Number);
    return p[0] * 60 + p[1];
}

function minToTime(m) {
    return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
}

function labelTo24(label) {
    const text = String(label || "");
    const m = text.match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    let h = parseInt(m[1], 10);
    if (/مساء/.test(text) && h < 12) h += 12;
    else if (/صباح/.test(text) && h === 12) h = 0;
    return pad2(h) + ":" + m[2];
}

function time24ToLabel(t) {
    if (!t) return "";
    const total = timeToMin(t);
    const h = Math.floor(total / 60);
    const period = h < 12 ? "صباحًا" : h === 12 ? "ظهرًا" : "مساءً";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return pad2(h12) + ":" + pad2(total % 60) + " " + period;
}

function timeOf(b) {
    return b.time24 || labelTo24(b.time);
}

let messageTimer = null;
function showMessage(text, type) {
    const box = $("messageBox");
    box.className = "alert alert-" + (type || "success");
    box.textContent = text;
    box.style.display = "block";
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { box.style.display = "none"; }, 3500);
}


// ======================================
// 3. حالة الحجز والدفع (نفس منطق باقي الصفحات)
// ======================================

function isCancelled(b) {
    return b.status === ST_CANCEL ||
        b.cancellationStatus === "requested" ||
        b.cancellationStatus === "cancelled_demo" ||
        b.cancellationStatus === "cancelled_by_clinic";
}

// الحالة النهائية للحجز
function statusOf(b) {
    if (isCancelled(b)) return ST_CANCEL;
    if (b.status === ST_OK || b.status === ST_DONE) return b.status;
    return ST_WAIT;
}

function isPaid(b) {
    return PAID_STATUSES.indexOf(b.paymentStatus) !== -1;
}

function paymentLabel(b) {
    const map = {
        simulated_success: "تم الدفع (تجريبي)",
        doctor_confirmed: "تم الدفع (أكده الدكتور)",
        simulated_failed: "فشل الدفع",
        pending: "بانتظار تأكيد الدفع",
        not_required: "بدون دفع"
    };
    return map[b.paymentStatus] || "بانتظار تأكيد الدفع";
}

function paymentBadge(b) {
    const cls = isPaid(b) ? "badge-confirmed" : b.paymentStatus === "simulated_failed" ? "badge-cancelled" : "badge-pending";
    return '<span class="badge ' + cls + '">' + esc(paymentLabel(b)) + "</span>";
}

function statusBadge(s) {
    const cls = { "مؤكد": "badge-confirmed", "قيد الانتظار": "badge-pending", "مكتمل": "badge-done", "ملغي": "badge-cancelled" };
    const label = s === ST_WAIT ? "في الانتظار" : s;
    return '<span class="badge ' + (cls[s] || "bg-secondary") + '">' + esc(label) + "</span>";
}

function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '" class="empty-state">' + text + "</td></tr>";
}


// ======================================
// 4. الفلاتر
// ======================================

function selectedClinic() {
    return $("clinicFilter").value;
}

// حجوزات العيادة المختارة (قبل فلاتر البحث)
function clinicBookings() {
    const clinic = selectedClinic();
    return readBookings().filter(b => clinic === "all" || b.clinic === clinic);
}

function sortNewest(list) {
    return list.slice().sort((a, b) => {
        const x = (a.date || "") + timeOf(a);
        const y = (b.date || "") + timeOf(b);
        return x < y ? 1 : x > y ? -1 : 0;
    });
}


// ======================================
// 5. الإحصائيات
// ======================================

function calcStats(list) {
    const s = { total: list.length, pending: 0, confirmed: 0, done: 0, cancelled: 0, income: 0, expected: 0, refund: 0 };

    list.forEach(b => {
        const st = statusOf(b);
        const price = Number(b.price) || 0;

        if (st === ST_WAIT) s.pending++;
        else if (st === ST_OK) s.confirmed++;
        else if (st === ST_DONE) s.done++;
        else s.cancelled++;

        if (st === ST_CANCEL) {
            // ملغي ومدفوع = لازم يتسترد
            if (isPaid(b) && price) s.refund += price;
        } else if (isPaid(b)) {
            s.income += price;
        } else {
            s.expected += price;
        }
    });

    return s;
}

function patientKey(b) {
    return String(b.userId || b.phone || b.patientName || "");
}

function renderStats() {
    const list = clinicBookings();
    const s = calcStats(list);

    $("statTotal").textContent = s.total;
    $("statPending").textContent = s.pending;
    $("statConfirmed").textContent = s.confirmed;
    $("statDone").textContent = s.done;
    $("statCancelled").textContent = s.cancelled;
    $("statIncome").textContent = money(s.income);
    $("statExpected").textContent = money(s.expected);
    $("statRefund").textContent = money(s.refund);

    const patients = new Set(list.map(patientKey).filter(Boolean));
    $("statPatients").textContent = patients.size;
}

function renderClinicsTable() {
    const all = readBookings();
    const names = Object.keys(CLINICS);

    // عيادات غريبة موجودة في الحجوزات بس مش معرّفة
    all.forEach(b => {
        if (b.clinic && names.indexOf(b.clinic) === -1) names.push(b.clinic);
    });

    let html = "";
    names.forEach(name => {
        const s = calcStats(all.filter(b => b.clinic === name));
        html += "<tr><td><strong>" + esc(clinicTitle(name)) + "</strong></td>" +
            "<td>" + s.total + "</td>" +
            "<td>" + s.pending + "</td>" +
            "<td>" + s.confirmed + "</td>" +
            "<td>" + s.done + "</td>" +
            "<td>" + s.cancelled + "</td>" +
            "<td>" + money(s.income) + " ج.م</td>" +
            "<td>" + money(s.expected) + " ج.م</td></tr>";
    });

    const t = calcStats(all);
    html += '<tr class="table-light fw-bold"><td>الإجمالي</td><td>' + t.total + "</td><td>" + t.pending + "</td><td>" + t.confirmed +
        "</td><td>" + t.done + "</td><td>" + t.cancelled + "</td><td>" + money(t.income) + " ج.م</td><td>" + money(t.expected) + " ج.م</td></tr>";

    $("clinicsTable").innerHTML = html;
}


// ======================================
// 6. جدول الحجوزات
// ======================================

function filteredBookings() {
    const q = $("searchInput").value.trim().toLowerCase();
    const st = $("statusFilter").value;
    const d = $("dateFilter").value;

    return sortNewest(clinicBookings().filter(b => {
        const text = ((b.patientName || "") + " " + (b.phone || "") + " " + (b.bookingCode || "")).toLowerCase();
        return (!q || text.indexOf(q) !== -1) &&
            (!st || statusOf(b) === st) &&
            (!d || b.date === d);
    }));
}

function renderBookings() {
    const list = filteredBookings();
    let html = "";

    list.forEach(b => {
        const st = statusOf(b);
        const code = esc(b.bookingCode);
        let btns = '<button class="btn btn-sm btn-outline-primary" data-act="view" data-code="' + code + '">عرض</button> ';

        if (st === ST_WAIT) {
            btns += '<button class="btn btn-sm btn-success" data-act="confirm" data-code="' + code + '">تأكيد</button> ';
        }
        if (st === ST_OK) {
            btns += '<button class="btn btn-sm btn-primary" data-act="complete" data-code="' + code + '">إتمام</button> ';
        }
        if (st === ST_WAIT || st === ST_OK) {
            btns += '<button class="btn btn-sm btn-danger" data-act="cancel" data-code="' + code + '">إلغاء</button>';
        }

        const fromSite = b.source !== "clinic";
        html += "<tr><td>" + esc(b.patientName) +
            (fromSite ? ' <span class="badge bg-info text-dark">من الموقع</span>' : "") +
            '<div class="small text-secondary">' + esc(b.phone) + "</div></td>" +
            "<td>" + esc(clinicTitle(b.clinic)) + "</td>" +
            "<td>" + esc(b.specialty) + "</td>" +
            "<td>" + formatDate(b.date) + "</td>" +
            "<td>" + esc(b.time || time24ToLabel(b.time24)) + "</td>" +
            "<td>" + statusBadge(st) + "</td>" +
            "<td>" + btns + "</td></tr>";
    });

    $("bookingsTable").innerHTML = html || emptyRow(7, "لا توجد حجوزات");
}


// ======================================
// 7. جدول المدفوعات
// ======================================

function renderPayments() {
    const list = sortNewest(clinicBookings().filter(b => Number(b.price) > 0));
    let html = "";

    list.forEach(b => {
        const cancelled = isCancelled(b);
        const code = esc(b.bookingCode);
        let action = '<button class="btn btn-sm btn-outline-primary" data-act="view" data-code="' + code + '">التفاصيل</button>';

        if (!cancelled && !isPaid(b)) {
            action += ' <button class="btn btn-sm btn-success" data-act="pay" data-code="' + code + '">تأكيد الدفع</button>';
        }

        let status = paymentBadge(b);
        if (cancelled && isPaid(b)) status = '<span class="badge badge-cancelled">ملغي - يحتاج استرداد</span>';
        else if (cancelled) status = '<span class="badge badge-cancelled">ملغي</span>';

        html += "<tr><td>" + esc(b.patientName) + "</td>" +
            "<td>" + esc(clinicTitle(b.clinic)) + "</td>" +
            "<td>" + esc(b.specialty) + "</td>" +
            "<td>" + money(b.price) + " ج.م</td>" +
            "<td>" + esc(b.paymentMethod || "—") + "</td>" +
            "<td>" + status + "</td>" +
            "<td>" + action + "</td></tr>";
    });

    $("paymentsTable").innerHTML = html || emptyRow(7, "لا توجد مدفوعات");
}


// ======================================
// 8. جدول المرضى
// ======================================

function renderPatients() {
    const map = {};

    sortNewest(clinicBookings()).forEach(b => {
        const key = patientKey(b);
        if (!key) return;

        if (!map[key]) {
            map[key] = { name: b.patientName, phone: b.phone, count: 0, last: "", paid: 0 };
        }
        const p = map[key];
        p.count++;
        if (!isCancelled(b) && (b.date || "") > p.last) p.last = b.date || "";
        if (!isCancelled(b) && isPaid(b)) p.paid += Number(b.price) || 0;
    });

    const rows = Object.keys(map).map(k => map[k]);
    let html = "";

    rows.forEach(p => {
        html += "<tr><td>" + esc(p.name) + "</td><td>" + esc(p.phone) + "</td><td>" + p.count +
            "</td><td>" + formatDate(p.last) + "</td><td>" + money(p.paid) + " ج.م</td></tr>";
    });

    $("patientsTable").innerHTML = html || emptyRow(5, "لا يوجد مرضى بعد");
}


// ======================================
// 9. جداول عمل العيادات (للعرض فقط)
// ======================================

function scheduleIdOf(clinic) {
    const map = readJson("dental_clinic_map", null);
    if (map && typeof map === "object" && map[clinic]) return String(map[clinic]);
    return CLINICS[clinic] ? CLINICS[clinic].scheduleId : null;
}

function getSchedule(clinic) {
    const id = scheduleIdOf(clinic);
    if (!id || !CLINIC_WORK_DAYS[id]) return null;

    const workDays = CLINIC_WORK_DAYS[id];
    const saved = readJson("dental_schedule_" + id, null);
    let schedule;

    if (saved && Array.isArray(saved.days) && saved.days.length === 7 &&
        Array.isArray(saved.breaks) && saved.duration > 0) {
        schedule = saved;
    } else {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const late = i === CLINIC_LATE_DAY[id];
            days.push({ working: workDays.indexOf(i) !== -1, start: late ? "12:00" : "10:00", end: late ? "20:00" : "17:00" });
        }
        schedule = { duration: 30, days: days, breaks: [] };
    }

    return {
        id: id,
        duration: schedule.duration,
        breaks: schedule.breaks,
        days: schedule.days.map((d, i) => (workDays.indexOf(i) !== -1 ? d : Object.assign({}, d, { working: false })))
    };
}

function getHolidays(clinic) {
    const id = scheduleIdOf(clinic);
    const list = readJson("dental_holidays_" + id, []);
    return Array.isArray(list) ? list : [];
}

function renderSchedules() {
    const clinic = selectedClinic();
    const names = clinic === "all" ? Object.keys(CLINICS) : [clinic];
    let html = "";

    names.forEach(name => {
        const sc = getSchedule(name);
        let body = "";

        if (!sc) {
            body = '<div class="empty-state">لا يوجد جدول لهذه العيادة</div>';
        } else {
            // نرتب الأيام من السبت للجمعة
            [6, 0, 1, 2, 3, 4, 5].forEach(i => {
                const d = sc.days[i];
                if (!d.working) return;
                const slots = Math.max(0, Math.floor((timeToMin(d.end) - timeToMin(d.start)) / sc.duration));
                const booked = readBookings().filter(b => {
                    if (b.clinic !== name || isCancelled(b) || b.status === ST_DONE || !b.date) return false;
                    return new Date(b.date + "T00:00:00").getDay() === i && b.date >= todayStr();
                }).length;

                body += '<div class="schedule-item"><strong>' + DAY_NAMES[i] + "</strong>" +
                    '<p class="mb-1">من ' + time24ToLabel(d.start) + " إلى " + time24ToLabel(d.end) + "</p>" +
                    '<small class="text-muted">مدة الكشف: ' + sc.duration + " دقيقة | مواعيد في اليوم: " + slots +
                    " | حجوزات قادمة: " + booked + "</small></div>";
            });

            const holidays = getHolidays(name).filter(h => h && h.date >= todayStr());
            if (holidays.length) {
                body += '<div class="mt-3"><strong class="text-danger">إجازات قادمة:</strong>';
                holidays.forEach(h => {
                    body += '<div class="small">' + formatDate(h.date) + " - " + esc(h.reason) + "</div>";
                });
                body += "</div>";
            }
        }

        html += '<div class="col-md-6"><div class="content-card mt-0">' +
            '<h6 class="fw-bold mb-3"><i class="fa-solid fa-hospital text-info ms-2"></i>' + esc(clinicTitle(name)) + "</h6>" +
            body + "</div></div>";
    });

    $("schedulesRow").innerHTML = html;
}


// ======================================
// 10. إجراءات الدكتور على الحجوزات
// ======================================

// نقرأ المصفوفة من جديد قبل أي تعديل (عشان المساعد ممكن يكون عدّل في نفس الوقت)
function updateBooking(code, changer) {
    const list = readBookings();
    const index = list.findIndex(b => b.bookingCode === code);
    if (index === -1) {
        showMessage("الحجز غير موجود", "danger");
        return false;
    }
    changer(list[index]);
    if (!writeBookings(list)) return false;
    renderAll();
    return true;
}

function confirmBooking(code) {
    const done = updateBooking(code, b => {
        b.status = ST_OK;
        b.confirmedBy = "doctor";
        b.confirmedAt = new Date().toISOString();
    });
    if (done) showMessage("تم تأكيد الحجز، وهيظهر للمريض في صفحته الشخصية", "success");
}

function completeBooking(code) {
    const done = updateBooking(code, b => {
        b.status = ST_DONE;
        b.completedAt = new Date().toISOString();
    });
    if (done) showMessage("تم تسجيل الحجز كمكتمل", "success");
}

function cancelBooking(code) {
    const done = updateBooking(code, b => {
        const paid = isPaid(b) && Number(b.price) > 0;
        b.status = ST_CANCEL;
        // نفس القيم اللي لوحة المساعد وموقع المريض بيفهموها
        b.cancellationStatus = "cancelled_by_clinic";
        b.cancelledBy = "clinic";
        b.cancelReason = "تم الإلغاء من الدكتور";
        b.cancelledAt = new Date().toISOString();
        b.refundStatus = paid ? "pending_manual_review" : "not_applicable";
    });
    if (done) showMessage("تم إلغاء الحجز", "success");
}

function confirmPayment(code) {
    const done = updateBooking(code, b => {
        b.paymentStatus = "doctor_confirmed";
        b.paymentConfirmedAt = new Date().toISOString();
    });
    if (done) showMessage("تم تأكيد الدفع", "success");
}

function viewBooking(code) {
    const b = readBookings().find(x => x.bookingCode === code);
    if (!b) return;

    const row = (label, value) => "<tr><th class='w-25'>" + label + "</th><td>" + (value ? esc(value) : "—") + "</td></tr>";
    const st = statusOf(b);

    let html = '<div class="table-responsive"><table class="table">' +
        row("كود الحجز", b.bookingCode) +
        row("المريض", b.patientName) +
        row("الهاتف", b.phone) +
        row("العيادة", clinicTitle(b.clinic)) +
        row("الخدمة", b.specialty) +
        row("التاريخ", formatDate(b.date)) +
        row("الوقت", b.time || time24ToLabel(b.time24)) +
        "<tr><th>حالة الحجز</th><td>" + statusBadge(st) + "</td></tr>" +
        row("المبلغ", b.price ? money(b.price) + " ج.م" : "") +
        "<tr><th>حالة الدفع</th><td>" + paymentBadge(b) + "</td></tr>" +
        row("مصدر الحجز", b.source === "clinic" ? "تم من العيادة" : "موقع المرضى") +
        row("سبب الزيارة", b.reason) +
        row("تم التأكيد بواسطة", b.confirmedBy === "doctor" ? "الدكتور" : (st === ST_OK || st === ST_DONE ? "المساعد" : ""));

    if (st === ST_CANCEL) {
        html += row("سبب الإلغاء", b.cancelReason);
        html += row("حالة الاسترداد", b.refundStatus === "pending_manual_review" ? "تحتاج مراجعة واسترداد" : "لا يوجد استرداد");
    }

    $("detailsBody").innerHTML = html + "</table></div>";
    bootstrap.Modal.getOrCreateInstance($("detailsModal")).show();
}

let pendingConfirm = null;

function askConfirm(title, text, callback) {
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    pendingConfirm = callback;
    bootstrap.Modal.getOrCreateInstance($("confirmModal")).show();
}

$("confirmOkBtn").addEventListener("click", function () {
    const action = pendingConfirm;
    pendingConfirm = null;
    bootstrap.Modal.getOrCreateInstance($("confirmModal")).hide();
    if (action) action();
});

// أزرار الجداول (Event Delegation)
function handleTableClick(event) {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;

    const code = btn.getAttribute("data-code");
    const act = btn.getAttribute("data-act");
    const b = readBookings().find(x => x.bookingCode === code);
    const name = b ? b.patientName : "";

    if (act === "view") viewBooking(code);
    else if (act === "confirm") confirmBooking(code);
    else if (act === "complete") completeBooking(code);
    else if (act === "pay") confirmPayment(code);
    else if (act === "cancel") {
        askConfirm("إلغاء الحجز", "هل أنت متأكد من إلغاء حجز " + name + "؟", () => cancelBooking(code));
    }
}

$("bookingsTable").addEventListener("click", handleTableClick);
$("paymentsTable").addEventListener("click", handleTableClick);


// ======================================
// 11. إضافة حجز من الدكتور
// ======================================

// المواعيد المتاحة لعيادة في يوم معين (نفس منطق موقع الحجز)
function getAvailableSlots(clinic, date) {
    const sc = getSchedule(clinic);
    if (!sc || !date) return { slots: [], reason: "اختر العيادة والتاريخ أولاً" };

    const holiday = getHolidays(clinic).find(h => h && h.date === date);
    if (holiday) return { slots: [], reason: "العيادة مغلقة في هذا اليوم" };

    const day = sc.days[new Date(date + "T00:00:00").getDay()];
    if (!day || !day.working) return { slots: [], reason: "العيادة لا تعمل في هذا اليوم" };

    const taken = new Set(
        readBookings()
            .filter(b => b.clinic === clinic && b.date === date && !isCancelled(b) && b.status !== ST_DONE)
            .map(timeOf)
    );

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slots = [];
    const start = timeToMin(day.start);
    const end = timeToMin(day.end);

    for (let t = start; t + sc.duration <= end; t += sc.duration) {
        const inBreak = sc.breaks.some(b => t < timeToMin(b.end) && t + sc.duration > timeToMin(b.start));
        const slot = minToTime(t);
        if (inBreak || taken.has(slot)) continue;
        if (date === todayStr() && t <= nowMin) continue;
        slots.push(slot);
    }

    return { slots: slots, reason: slots.length ? "" : "لا توجد مواعيد متاحة في هذا اليوم" };
}

function fillAddTimes() {
    const sel = $("abTime");
    const clinic = $("abClinic").value;
    const date = $("abDate").value;

    if (!clinic || !date) {
        sel.innerHTML = '<option value="">اختر العيادة والتاريخ أولاً</option>';
        sel.disabled = true;
        return;
    }

    const res = getAvailableSlots(clinic, date);
    if (!res.slots.length) {
        sel.innerHTML = '<option value="">' + esc(res.reason) + "</option>";
        sel.disabled = true;
        return;
    }

    sel.innerHTML = '<option value="">اختر الوقت</option>' +
        res.slots.map(s => '<option value="' + s + '">' + time24ToLabel(s) + "</option>").join("");
    sel.disabled = false;
}

function createBookingCode() {
    const d = new Date();
    const datePart = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    const used = new Set(readBookings().map(b => b.bookingCode));
    let code;
    do {
        code = "IBT-" + datePart + "-" + Math.floor(1000 + Math.random() * 9000);
    } while (used.has(code));
    return code;
}

function openAddBooking() {
    $("addBookingForm").reset();
    $("abError").textContent = "";
    $("abDate").min = todayStr();

    $("abService").innerHTML = '<option value="">اختر الخدمة</option>' +
        Object.keys(SERVICES).map(n => '<option value="' + esc(n) + '">' + esc(n) + " - " + money(SERVICES[n]) + " ج.م</option>").join("");

    const clinic = selectedClinic();
    if (clinic !== "all") $("abClinic").value = clinic;

    fillAddTimes();
    bootstrap.Modal.getOrCreateInstance($("addBookingModal")).show();
}

function saveNewBooking() {
    const name = $("abName").value.trim();
    const phone = $("abPhone").value.trim().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const clinic = $("abClinic").value;
    const service = $("abService").value;
    const date = $("abDate").value;
    const time = $("abTime").value;
    const err = $("abError");

    if (!name || !phone || !clinic || !service || !date || !time) {
        err.textContent = "من فضلك أكمل كل البيانات";
        return;
    }
    if (!/^01[0125][0-9]{8}$/.test(phone)) {
        err.textContent = "رقم الهاتف غير صحيح (11 رقم يبدأ بـ 01)";
        return;
    }
    // نتأكد إن الموعد لسه متاح
    if (getAvailableSlots(clinic, date).slots.indexOf(time) === -1) {
        err.textContent = "هذا الموعد لم يعد متاحاً";
        fillAddTimes();
        return;
    }

    // لو الرقم لحساب مريض مسجل نربط الحجز بحسابه (فيظهر في بروفايله)
    const user = readUsers().find(u => u && String(u.phone) === phone);

    const booking = {
        userId: user ? user.id : "",
        patientName: name,
        phone: phone,
        specialty: service,
        clinic: clinic,
        date: date,
        time: time24ToLabel(time),
        time24: time,
        reason: "",
        price: SERVICES[service] || 0,
        bookingCode: createBookingCode(),
        paymentStatus: "pending",
        paymentMethod: "كاش في العيادة",
        status: ST_OK,
        source: "clinic",
        confirmedBy: "doctor",
        createdAt: new Date().toISOString()
    };

    const list = readBookings();
    list.unshift(booking);
    if (!writeBookings(list)) return;

    bootstrap.Modal.getOrCreateInstance($("addBookingModal")).hide();
    renderAll();
    showMessage("تمت إضافة الحجز بنجاح", "success");
}

$("addBookingBtn").addEventListener("click", openAddBooking);
$("abSaveBtn").addEventListener("click", saveNewBooking);
$("abClinic").addEventListener("change", fillAddTimes);
$("abDate").addEventListener("change", fillAddTimes);


// ======================================
// 12. تشغيل الصفحة وربط الأحداث
// ======================================

function renderAll() {
    renderStats();
    renderClinicsTable();
    renderBookings();
    renderPayments();
    renderPatients();
    renderSchedules();
}

$("clinicFilter").addEventListener("change", renderAll);
["searchInput", "statusFilter", "dateFilter"].forEach(id => {
    $(id).addEventListener("input", renderBookings);
});
$("resetFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("dateFilter").value = "";
    renderBookings();
});

// لما المساعد أو المريض يغيّر حاجة من تبويب تاني، الصفحة تتحدث لوحدها
window.addEventListener("storage", (event) => {
    if (!event.key || event.key === BOOKINGS_KEY || event.key === USERS_KEY ||
        event.key.indexOf("dental_") === 0) {
        renderAll();
    }
});

// تفعيل لينك السايدبار عند الضغط
document.querySelectorAll(".sidebar nav a[href^='#']").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".sidebar nav a").forEach(a => a.classList.remove("active"));
        link.classList.add("active");
    });
});

renderAll();