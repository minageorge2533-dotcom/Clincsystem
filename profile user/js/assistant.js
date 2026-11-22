// ==========================================================
// نظام إدارة عيادة الأسنان - لوحة تحكم العيادة (Vanilla JS)
//
// - الحجوزات مشتركة مع موقع المرضى عن طريق مصفوفة "bookings" في LocalStorage
//   (كل حجز أوبجكت، وفيه clinic و userId)
// - كل لوحة تحكم تعرض وتتحكم في حجوزات عيادتها فقط
// - باقي بيانات كل عيادة (مرضى / جدول / إجازات / إشعارات / سجل) منفصلة بمفتاح خاص بها
// ==========================================================

// ==================================
// 1. الثوابت والبيانات
// ==================================

var SCHEDULE_ID = document.body.getAttribute("data-schedule") || "1";

// اسم العيادة لكل لوحة تحكم. لازم يطابق قيمة العيادة في صفحة الحجز (IBTESAMA_Appointment.html)
// اللوحة 1 = عيادة 6 أكتوبر  |  اللوحة 2 = عيادة ميدان المسلة
// (لو عايز تبدلهم: بدّل القيمتين هنا، وبدّل CLINIC_SCHEDULE_ID في IBTESAMA_App.js)
var CLINIC_BY_PAGE = { "1": "عيادة فرع المدينة", "2": "العيادة الرئيسية" };
var CLINIC_TITLES = {
  "عيادة فرع المدينة": "عيادة 6 أكتوبر بالفردوس",
  "العيادة الرئيسية": "عيادة ميدان المسلة برج الأطباء",
};
// تقدر تحدد العيادة صراحةً من الـ HTML: <body data-schedule="1" data-clinic="العيادة الرئيسية">
// القيم الممكنة: "العيادة الرئيسية" (ميدان المسلة) أو "عيادة فرع المدينة" (6 أكتوبر)
var CLINIC = document.body.getAttribute("data-clinic") || CLINIC_BY_PAGE[SCHEDULE_ID] || CLINIC_BY_PAGE["1"];
var CLINIC_TITLE = CLINIC_TITLES[CLINIC] || CLINIC;

var BOOKINGS_KEY = "bookings"; // نفس مفتاح موقع المرضى
var USERS_KEY = "users"; // حسابات المرضى

// مفاتيح LocalStorage
var KEYS = {
  appointments: BOOKINGS_KEY,
  patients: "dental_patients_" + SCHEDULE_ID,
  schedule: "dental_schedule_" + SCHEDULE_ID,
  holidays: "dental_holidays_" + SCHEDULE_ID,
  notifications: "dental_notifications_" + SCHEDULE_ID,
  history: "dental_history_" + SCHEDULE_ID,
  activities: "dental_activities_" + SCHEDULE_ID,
  notified: "dental_notified_" + SCHEDULE_ID,
};

// حالات الحجز
var ST_OK = "مؤكد";
var ST_WAIT = "قيد الانتظار";
var ST_DONE = "مكتمل";
var ST_CANCEL = "ملغي";

// أسماء الأيام (رقم اليوم في JavaScript: 0 = الأحد)
var DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

var PAGE_SIZE = 8; // عدد الصفوف في الصفحة الواحدة

// البيانات الحالية في الذاكرة
var appointments = []; // حجوزات هذه العيادة فقط
var baseline = {}; // نسخة من كل حجز وقت التحميل (لمعرفة اللي اتغير عند الحفظ)
var patients = [];
var schedule = {};
var holidays = [];
var notifications = [];
var historyLog = [];
var activities = [];

// متغيرات حالة الواجهة
var editingAppointmentId = null; // الحجز الجاري تعديله
var editingPatientId = null; // المريض الجاري تعديله
var editingHolidayId = null; // الإجازة الجاري تعديلها
var pendingConfirm = null; // الدالة التي تُنفذ عند الضغط على "تأكيد"
var pages = { appointments: 1, patients: 1, history: 1 }; // رقم الصفحة الحالية لكل جدول
var messageTimer = null;
var syncStamps = []; // لمنع التحديث المتكرر (حماية من اللوب)

// ==================================
// 2. دوال مساعدة عامة
// ==================================

function $(id) {
  return document.getElementById(id);
}

// منع إدخال أكواد HTML من المستخدم (حماية)
function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// إنشاء رقم تعريف فريد
function genId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

// رقم حجز بنفس شكل رقم الحجز في الموقع (IBT-yyyymmdd-xxxx) وبدون تكرار
function genBookingCode() {
  var d = new Date();
  var datePart = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  var used = {};
  var all = loadList(BOOKINGS_KEY);
  for (var i = 0; i < all.length; i++) {
    if (all[i] && all[i].bookingCode) used[all[i].bookingCode] = true;
  }
  var code;
  do {
    code = "IBT-" + datePart + "-" + (1000 + Math.floor(Math.random() * 9000));
  } while (used[code]);
  return code;
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

// تاريخ بصيغة yyyy-mm-dd (بالتوقيت المحلي)
function toDateStr(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function todayStr() {
  return toDateStr(new Date());
}

// yyyy-mm-dd  ->  dd/mm/yyyy
function formatDate(date) {
  if (!date) return "—";
  var p = date.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

// "14:30" -> عدد الدقائق من بداية اليوم
function toMinutes(t) {
  var p = t.split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

// عدد الدقائق -> "14:30"
function toTime(m) {
  return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
}

// "14:30" -> "2:30 م"
function formatTime(t) {
  if (!t) return "";
  var m = toMinutes(t);
  var h = Math.floor(m / 60);
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ":" + pad(m % 60) + " " + (h >= 12 ? "م" : "ص");
}

// وقت الموقع ("02:00 مساءً") -> "14:00"
function labelTo24(label) {
  var text = String(label || "");
  var m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  var h = parseInt(m[1], 10);
  if (/مساء/.test(text) && h < 12) h += 12;
  else if (/صباح/.test(text) && h === 12) h = 0;
  return pad(h) + ":" + m[2];
}

// "14:00" -> وقت الموقع ("02:00 مساءً")
function time24ToLabel(t) {
  if (!t) return "";
  var m = toMinutes(t);
  var h = Math.floor(m / 60);
  var period = h < 12 ? "صباحًا" : h === 12 ? "ظهرًا" : "مساءً";
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return pad(h12) + ":" + pad(m % 60) + " " + period;
}

// تاريخ ووقت الإنشاء بشكل مقروء
function formatStamp(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return formatDate(toDateStr(d)) + " " + formatTime(pad(d.getHours()) + ":" + pad(d.getMinutes()));
}

function dayName(date) {
  return DAY_NAMES[new Date(date + "T00:00:00").getDay()];
}

function normPhone(p) {
  return String(p == null ? "" : p).replace(/[\s-]/g, "");
}

// شكل حالة الحجز
function statusBadge(s) {
  var cls = { "مؤكد": "bg-success", "قيد الانتظار": "bg-warning text-dark", "مكتمل": "bg-primary", "ملغي": "bg-danger" };
  return '<span class="badge ' + (cls[s] || "bg-secondary") + '">' + esc(s) + "</span>";
}

function paymentLabel(s) {
  var map = {
    simulated_success: "تم الدفع (تجريبي)",
    simulated_failed: "فشل الدفع (تجريبي)",
    pending: "بانتظار مراجعة الدفع",
    not_required: "لا يوجد دفع (حجز من العيادة)",
  };
  return map[s] || "";
}

function emptyBox(text) {
  return '<div class="empty-state">' + text + "</div>";
}

function emptyRow(cols, text) {
  return '<tr><td colspan="' + cols + '" class="text-center text-secondary py-4">' + text + "</td></tr>";
}

// ==================================
// 3. الرسائل ورسائل الخطأ في الفورم
// ==================================

// إظهار رسالة داخل الموقع (type: success / error / info)
function showMessage(message, type) {
  var box = $("messageBox");
  box.className = "message-box message-" + type;
  box.textContent = message;
  box.style.display = "block";
  clearTimeout(messageTimer);
  messageTimer = setTimeout(function () {
    box.style.display = "none";
  }, 4000);
}

// إظهار رسالة خطأ تحت الحقل
function setError(id, message) {
  var el = $(id);
  el.classList.add("is-invalid");
  var fb = el.parentNode.querySelector('.invalid-feedback[data-for="' + id + '"]');
  if (!fb) {
    fb = document.createElement("div");
    fb.className = "invalid-feedback";
    fb.setAttribute("data-for", id);
    el.parentNode.appendChild(fb);
  }
  fb.textContent = message;
}

// مسح كل رسائل الخطأ داخل عنصر
function clearErrors(containerId) {
  var items = $(containerId).querySelectorAll(".is-invalid");
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove("is-invalid");
  }
}

// ==================================
// 4. LocalStorage (حفظ وتحميل)
// ==================================

// قراءة آمنة: لو البيانات ناقصة أو تالفة نرجع القيمة الافتراضية
function loadData(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    var value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    showMessage("تعذر حفظ البيانات في المتصفح", "error");
  }
}

function loadList(key) {
  var data = loadData(key, []);
  return Array.isArray(data) ? data : [];
}

// الجدول الافتراضي (يُستخدم فقط لو لا يوجد جدول محفوظ)
// الصفحة 1: السبت والأحد والاثنين | الصفحة 2: الثلاثاء والأربعاء والخميس | الجمعة إجازة دائماً
function pageDays() {
  return SCHEDULE_ID === "2" ? [2, 3, 4] : [6, 0, 1];
}

function defaultSchedule() {
  var workingDays = pageDays();
  var lateDay = SCHEDULE_ID === "2" ? 4 : 1; // اليوم الذي يبدأ 12 ظهراً وينتهي 8 مساءً
  var days = [];
  for (var i = 0; i < 7; i++) {
    var late = i === lateDay;
    days.push({ working: workingDays.indexOf(i) !== -1, start: late ? "12:00" : "10:00", end: late ? "20:00" : "17:00" });
  }
  return { duration: 30, days: days, breaks: [] };
}

function loadSchedule() {
  var s = loadData(KEYS.schedule, null);
  if (s && Array.isArray(s.days) && s.days.length === 7 && Array.isArray(s.breaks) && s.duration > 0) {
    // أيام الإجازة الدائمة تبقى غير متاحة دائماً
    for (var i = 0; i < 7; i++) {
      if (pageDays().indexOf(i) === -1) s.days[i].working = false;
    }
    return s;
  }
  return defaultSchedule();
}

// ==================================
// 5. ربط الحجوزات بموقع المرضى
// ==================================

function isCancelledBooking(b) {
  return (
    b.status === ST_CANCEL ||
    b.cancellationStatus === "requested" ||
    b.cancellationStatus === "cancelled_demo" ||
    b.cancellationStatus === "cancelled_by_clinic"
  );
}

// حجز من مصفوفة bookings  ->  حجز بالشكل اللي تفهمه لوحة التحكم
function bookingToAppointment(b) {
  var a = {};
  for (var k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k];
  }
  a.id = b.bookingCode;
  a.name = b.patientName || "";
  a.treatment = b.specialty || "";
  a.timeLabel = b.time || "";
  a.time = b.time24 || labelTo24(b.time);
  a.phone = b.phone || "";
  a.notes = b.notes || "";

  if (isCancelledBooking(b)) {
    a.status = ST_CANCEL;
    if (!a.cancelReason) a.cancelReason = b.cancelledBy === "clinic" ? "تم الإلغاء من العيادة" : "تم الإلغاء من قبل المريض";
  } else if (b.status === ST_OK || b.status === ST_WAIT || b.status === ST_DONE) {
    a.status = b.status;
  } else {
    a.status = ST_WAIT; // حجز جديد من الموقع بانتظار تأكيد العيادة
  }
  return a;
}

// الرجوع للشكل المحفوظ في مصفوفة bookings
function appointmentToBooking(a) {
  var b = {};
  for (var k in a) {
    if (Object.prototype.hasOwnProperty.call(a, k)) b[k] = a[k];
  }
  b.bookingCode = a.id;
  b.patientName = a.name;
  b.specialty = a.treatment;
  b.time24 = a.time;
  b.time = a.time ? time24ToLabel(a.time) : a.timeLabel || "";
  b.clinic = CLINIC;
  delete b.id;
  delete b.name;
  delete b.treatment;
  delete b.timeLabel;
  return b;
}

// تحميل كل البيانات من LocalStorage
function loadAll() {
  var all = loadList(BOOKINGS_KEY);
  appointments = [];
  baseline = {};
  for (var i = 0; i < all.length; i++) {
    var b = all[i];
    if (!b || !b.bookingCode || b.clinic !== CLINIC) continue; // حجوزات هذه العيادة فقط
    var a = bookingToAppointment(b);
    appointments.push(a);
    baseline[a.id] = JSON.stringify(appointmentToBooking(a));
  }
  patients = loadList(KEYS.patients);
  holidays = loadList(KEYS.holidays);
  notifications = loadList(KEYS.notifications);
  historyLog = loadList(KEYS.history);
  activities = loadList(KEYS.activities);
  schedule = loadSchedule();
  syncFromBookings();
}

// حفظ الحجوزات التي تغيّرت فقط داخل المصفوفة المشتركة
// (بدون لمس حجوزات العيادة التانية أو حجوزات لم تتغير)
function saveBookings() {
  var all = loadList(BOOKINGS_KEY);
  var index = {};
  for (var i = 0; i < all.length; i++) {
    if (all[i] && all[i].bookingCode) index[all[i].bookingCode] = i;
  }

  var added = [];
  var changed = false;

  for (var k = 0; k < appointments.length; k++) {
    var b = appointmentToBooking(appointments[k]);
    var json = JSON.stringify(b);
    if (baseline[b.bookingCode] === json) continue;

    if (index[b.bookingCode] !== undefined) {
      all[index[b.bookingCode]] = b;
    } else {
      added.push(b);
    }
    baseline[b.bookingCode] = json;
    changed = true;
  }

  if (changed) saveData(BOOKINGS_KEY, added.concat(all));
}

// حفظ كل البيانات (يُستدعى بعد كل عملية)
function saveAll() {
  saveBookings();
  saveData(KEYS.patients, patients);
  saveData(KEYS.holidays, holidays);
  saveData(KEYS.notifications, notifications);
  saveData(KEYS.history, historyLog);
  saveData(KEYS.activities, activities);
  saveData(KEYS.schedule, schedule);
}

// حسابات المرضى (من موقع المرضى)
function readUsers() {
  var users = loadData(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function findUserById(id) {
  var users = readUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i] && String(users[i].id) === String(id)) return users[i];
  }
  return null;
}

function findUserByPhone(phone) {
  var p = normPhone(phone);
  if (!p) return null;
  var users = readUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i] && normPhone(users[i].phone) === p) return users[i];
  }
  return null;
}

function newPatientRecord(name, phone, user) {
  return {
    id: genId("p"),
    name: name,
    phone: phone,
    email: user ? user.email || "" : "",
    dob: user ? user.birth || "" : "",
    gender: user ? user.gender || "" : "",
    address: user ? user.address || "" : "",
    notes: "",
  };
}

// مزامنة الحجوزات القادمة من الموقع:
// 1) إنشاء ملف مريض للحجز الجديد   2) إشعار بالحجز الجديد   3) إشعار بإلغاء المريض
// (لا تكتب أي شيء إلا لو فيه جديد، فمفيش لوب)
function syncFromBookings() {
  var changed = false;
  var notified = loadList(KEYS.notified);
  var seen = {};
  for (var n = 0; n < notified.length; n++) seen[notified[n]] = true;

  var ordered = appointments.slice().sort(function (x, y) {
    return String(x.createdAt) < String(y.createdAt) ? -1 : 1;
  });

  for (var i = 0; i < ordered.length; i++) {
    var a = ordered[i];
    var fromSite = a.source === "website" || (!a.source && !!a.userId);

    // ربط الحجز بملف مريض (أو إنشاء مريض جديد من بيانات الحساب)
    if (!a.patientId) {
      var p = findPatientByPhone(a.phone, null);
      if (!p) {
        var user = a.userId ? findUserById(a.userId) : findUserByPhone(a.phone);
        p = newPatientRecord(a.name, a.phone, user);
        patients.push(p);
        addActivity("تم إضافة مريض جديد: " + a.name, a.createdAt);
      }
      a.patientId = p.id;
      changed = true;
    }

    // إشعار بحجز جديد من الموقع
    if (fromSite && !seen["new:" + a.id]) {
      seen["new:" + a.id] = true;
      notified.push("new:" + a.id);
      addNotification(
        "حجز جديد من الموقع للمريض " + a.name + " يوم " + formatDate(a.date) + " الساعة " + formatTime(a.time) + " (" + a.treatment + ") - بانتظار التأكيد",
        "success",
        a.createdAt
      );
      addActivity("وصل حجز جديد من الموقع للمريض " + a.name, a.createdAt);
      changed = true;
    }

    // إشعار بإلغاء المريض لحجزه
    if (fromSite && a.status === ST_CANCEL && a.cancelledBy !== "clinic" && !seen["cancel:" + a.id]) {
      seen["cancel:" + a.id] = true;
      notified.push("cancel:" + a.id);
      addNotification("قام المريض " + a.name + " بإلغاء حجزه يوم " + formatDate(a.date) + " الساعة " + formatTime(a.time), "danger", a.cancelledAt || a.cancellationRequestedAt);
      upsertHistory(a, "سبب الإلغاء: " + (a.cancelReason || "تم الإلغاء من قبل المريض"));
      changed = true;
    }
  }

  if (changed) {
    saveData(KEYS.notified, notified);
    saveAll();
  }
}

// ==================================
// 6. الإشعارات والنشاطات (إضافة فقط)
// ==================================

function addNotification(text, type, dateIso) {
  notifications.unshift({ id: genId("n"), text: text, type: type || "info", read: false, date: dateIso || new Date().toISOString() });
}

function addActivity(text, dateIso) {
  activities.unshift({ id: genId("act"), text: text, date: dateIso || new Date().toISOString() });
  if (activities.length > 50) activities.length = 50;
}

// ==================================
// 7. نوافذ التأكيد والتفاصيل (بدل confirm)
// ==================================

function showConfirm(title, text, btnText, callback) {
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  $("confirmOkBtn").textContent = btnText;
  pendingConfirm = callback;
  bootstrap.Modal.getOrCreateInstance($("confirmModal")).show();
}

function showDetails(title, html) {
  $("detailsTitle").textContent = title;
  $("detailsBody").innerHTML = html;
  bootstrap.Modal.getOrCreateInstance($("detailsModal")).show();
}

function detailRow(label, value) {
  return '<tr><th class="w-25">' + label + "</th><td>" + (value ? esc(value) : "—") + "</td></tr>";
}

// ==================================
// 8. الجدول الزمني (المواعيد المتاحة)
// ==================================

function getHoliday(date) {
  for (var i = 0; i < holidays.length; i++) {
    if (holidays[i].date === date) return holidays[i];
  }
  return null;
}

// كل المواعيد الممكنة في يوم معين حسب جدول الدكتور
function getSlots(date) {
  var slots = [];
  if (!date || getHoliday(date)) return slots;

  var day = schedule.days[new Date(date + "T00:00:00").getDay()];
  if (!day.working) return slots;

  var start = toMinutes(day.start);
  var end = toMinutes(day.end);
  var dur = schedule.duration;

  for (var t = start; t + dur <= end; t += dur) {
    var inBreak = false;
    for (var i = 0; i < schedule.breaks.length; i++) {
      var b = schedule.breaks[i];
      if (t < toMinutes(b.end) && t + dur > toMinutes(b.start)) inBreak = true;
    }
    if (!inBreak) slots.push(toTime(t));
  }
  return slots;
}

function isActive(a) {
  return a.status === ST_OK || a.status === ST_WAIT;
}

// هل الموعد محجوز؟ (الحجوزات الملغاة والمكتملة لا تمنع الحجز)
function findBooking(date, time, exceptId) {
  for (var i = 0; i < appointments.length; i++) {
    var a = appointments[i];
    if (a.date === date && a.time === time && isActive(a) && a.id !== exceptId) return a;
  }
  return null;
}

function getAppointment(id) {
  for (var i = 0; i < appointments.length; i++) {
    if (appointments[i].id === id) return appointments[i];
  }
  return null;
}

function getPatient(id) {
  for (var i = 0; i < patients.length; i++) {
    if (patients[i].id === id) return patients[i];
  }
  return null;
}

function findPatientByPhone(phone, exceptId) {
  for (var i = 0; i < patients.length; i++) {
    if (normPhone(patients[i].phone) === normPhone(phone) && patients[i].id !== exceptId) return patients[i];
  }
  return null;
}

// ==================================
// 9. التقسيم لصفحات (Pagination)
// ==================================

function paginate(list, key, pagerId) {
  var total = Math.ceil(list.length / PAGE_SIZE);
  if (pages[key] > total) pages[key] = total;
  if (!(pages[key] >= 1)) pages[key] = 1;

  var html = "";
  if (total > 1) {
    html = '<ul class="pagination pagination-sm justify-content-center mb-0 mt-3">';
    for (var i = 1; i <= total; i++) {
      html += '<li class="page-item' + (i === pages[key] ? " active" : "") + '"><button class="page-link" onclick="goToPage(\'' + key + "'," + i + ')">' + i + "</button></li>";
    }
    html += "</ul>";
  }
  $(pagerId).innerHTML = html;

  var start = (pages[key] - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

function goToPage(key, n) {
  pages[key] = n;
  if (key === "appointments") renderAppointments();
  if (key === "patients") renderPatients();
  if (key === "history") renderHistory();
}

// ==================================
// 10. إدارة الحجوزات
// ==================================

// الحجوزات بعد البحث والفلترة والترتيب
function getFilteredAppointments() {
  var q = $("appSearch").value.trim().toLowerCase();
  var d = $("appFilterDate").value;
  var s = $("appFilterStatus").value;
  var desc = $("appSort").value === "desc";

  var list = appointments.filter(function (a) {
    var text = (a.name + " " + a.phone + " " + a.treatment).toLowerCase();
    return (!q || text.indexOf(q) !== -1) && (!d || a.date === d) && (!s || a.status === s);
  });

  list.sort(function (a, b) {
    var x = a.date + a.time;
    var y = b.date + b.time;
    if (x === y) return 0;
    return (x < y ? -1 : 1) * (desc ? -1 : 1);
  });
  return list;
}

function renderAppointments() {
  var list = paginate(getFilteredAppointments(), "appointments", "appointmentsPager");
  var html = "";

  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    var fromSite = a.source !== "clinic";
    var btns = '<button class="btn btn-sm btn-outline-primary" onclick="viewAppointment(\'' + a.id + "')\">تفاصيل</button> ";
    if (isActive(a)) {
      if (a.status === ST_WAIT) btns += '<button class="btn btn-sm btn-info" onclick="confirmAppointment(\'' + a.id + "')\">تأكيد</button> ";
      btns += '<button class="btn btn-sm btn-warning" onclick="editAppointment(\'' + a.id + "')\">تعديل</button> ";
      btns += '<button class="btn btn-sm btn-success" onclick="completeAppointment(\'' + a.id + "')\">إتمام</button> ";
      btns += '<button class="btn btn-sm btn-danger" onclick="askCancelAppointment(\'' + a.id + "')\">إلغاء</button>";
    }
    html += "<tr><td>" + esc(a.name) + (fromSite ? ' <span class="badge bg-info text-dark">من الموقع</span>' : "") + '<div class="small text-secondary">' + esc(a.phone) + "</div></td><td>" + formatDate(a.date) + "</td><td>" + formatTime(a.time) + "</td><td>" + esc(a.treatment) + "</td><td>" + statusBadge(a.status) + '</td><td class="text-nowrap">' + btns + "</td></tr>";
  }
  $("appointmentsTable").innerHTML = html || emptyRow(6, appointments.length ? "لا توجد نتائج مطابقة" : "لا توجد حجوزات بعد");
}

// تعبئة قائمة الأوقات المتاحة حسب التاريخ المختار
function fillTimeSlots(selected) {
  var sel = $("appointmentTime");
  var date = $("appointmentDate").value;

  if (!date) {
    sel.innerHTML = '<option value="">اختر التاريخ أولاً</option>';
    sel.disabled = true;
    return;
  }
  var h = getHoliday(date);
  if (h) {
    sel.innerHTML = '<option value="">العيادة مغلقة (إجازة: ' + esc(h.reason) + ")</option>";
    sel.disabled = true;
    return;
  }
  var slots = getSlots(date);
  if (slots.length === 0) {
    sel.innerHTML = '<option value="">الدكتور لا يعمل في هذا اليوم</option>';
    sel.disabled = true;
    return;
  }

  var html = '<option value="">اختر الوقت</option>';
  for (var i = 0; i < slots.length; i++) {
    var booked = findBooking(date, slots[i], editingAppointmentId);
    html += '<option value="' + slots[i] + '"' + (booked ? " disabled" : "") + (slots[i] === selected ? " selected" : "") + ">" + formatTime(slots[i]) + (booked ? " (محجوز)" : "") + "</option>";
  }
  // وقت قديم لحجز يتم تعديله وأصبح خارج الجدول
  if (selected && slots.indexOf(selected) === -1) {
    html += '<option value="' + selected + '" selected>' + formatTime(selected) + " (خارج الجدول)</option>";
  }
  sel.innerHTML = html;
  sel.disabled = false;
}

// التحقق من فورم الحجز ثم الحفظ
function saveAppointmentForm() {
  clearErrors("appointmentForm");

  var name = $("patientName").value.trim();
  var phone = normPhone($("patientPhone").value);
  var date = $("appointmentDate").value;
  var time = $("appointmentTime").value;
  var treatment = $("treatment").value;
  var status = $("appointmentStatus").value;
  var notes = $("appointmentNotes").value.trim();
  var ok = true;

  // الحقول المطلوبة
  if (!name) { setError("patientName", "اسم المريض مطلوب"); ok = false; }
  if (!phone) { setError("patientPhone", "رقم الهاتف مطلوب"); ok = false; }
  else if (!/^\+?[0-9]{8,15}$/.test(phone)) { setError("patientPhone", "رقم الهاتف غير صحيح"); ok = false; }
  if (!date) { setError("appointmentDate", "تاريخ الحجز مطلوب"); ok = false; }
  if (!time) { setError("appointmentTime", "وقت الحجز مطلوب"); ok = false; }
  if (!treatment) { setError("treatment", "نوع العلاج مطلوب"); ok = false; }

  if (!ok) {
    showMessage("من فضلك أكمل البيانات المطلوبة بشكل صحيح", "error");
    return;
  }

  // التحقق من الموعد (لا نفحصه إذا لم يتغير الموعد أثناء التعديل)
  var old = editingAppointmentId ? getAppointment(editingAppointmentId) : null;
  var unchanged = old && old.date === date && old.time === time;

  if (!unchanged) {
    var h = getHoliday(date);
    if (date < todayStr()) {
      setError("appointmentDate", "لا يمكن الحجز في تاريخ سابق");
    } else if (h) {
      setError("appointmentDate", "العيادة مغلقة في هذا اليوم: " + h.reason);
    } else if (getSlots(date).length === 0) {
      setError("appointmentDate", "الدكتور لا يعمل في هذا اليوم");
    } else if (getSlots(date).indexOf(time) === -1) {
      setError("appointmentTime", "هذا الوقت خارج مواعيد عمل الدكتور");
    } else if (findBooking(date, time, editingAppointmentId)) {
      setError("appointmentTime", "هذا الموعد محجوز بالفعل");
    }
    if (document.querySelector("#appointmentForm .is-invalid")) {
      showMessage("لا يمكن حفظ الحجز، راجع التاريخ والوقت", "error");
      return;
    }
  }

  // لو رقم الهاتف لحساب مريض مسجل في الموقع، نربط الحجز بحسابه (فيظهر في صفحته الشخصية)
  var linkedUser = findUserByPhone(phone);

  // ربط الحجز بملف المريض (أو إنشاء مريض جديد)
  var patient = findPatientByPhone(phone, null);
  if (!patient) {
    patient = newPatientRecord(name, phone, linkedUser);
    patients.push(patient);
    addActivity("تم إضافة مريض جديد: " + name);
  }

  var when = formatDate(date) + " الساعة " + formatTime(time);

  if (old) {
    // تعديل حجز موجود
    old.patientId = patient.id;
    old.name = name;
    old.phone = phone;
    old.date = date;
    old.time = time;
    old.treatment = treatment;
    old.status = status;
    old.notes = notes;
    if (status === ST_DONE) upsertHistory(old, "تم إتمام الحجز");
    addNotification("تم تعديل حجز المريض " + name + " ليصبح يوم " + when, "info");
    addActivity("تم تعديل حجز " + name);
    showMessage("تم تعديل الحجز بنجاح", "success");
  } else {
    // حجز جديد من العيادة
    var a = {
      id: genBookingCode(),
      patientId: patient.id,
      name: name,
      phone: phone,
      date: date,
      time: time,
      treatment: treatment,
      status: status,
      notes: notes,
      cancelReason: "",
      createdAt: new Date().toISOString(),
      clinic: CLINIC,
      source: "clinic",
      userId: linkedUser ? linkedUser.id : "",
      price: 0,
      paymentStatus: "not_required",
    };
    appointments.push(a);
    if (status === ST_DONE) upsertHistory(a, "تم إتمام الحجز");
    addNotification("تم إضافة حجز جديد للمريض " + name + " يوم " + when, "success");
    addActivity("تم إضافة حجز جديد للمريض " + name);
    showMessage("تم إضافة الحجز بنجاح", "success");
  }

  saveAll();
  resetAppointmentForm();
  renderAll();
}

function resetAppointmentForm() {
  clearErrors("appointmentForm");
  editingAppointmentId = null;
  $("patientName").value = "";
  $("patientPhone").value = "";
  $("appointmentDate").value = "";
  $("treatment").value = "";
  $("appointmentStatus").value = ST_OK;
  $("appointmentNotes").value = "";
  fillTimeSlots("");
  $("addAppointmentBtn").textContent = "إضافة الحجز";
  $("appointmentFormTitle").textContent = "إضافة حجز جديد";
  $("cancelEditBtn").style.display = "none";
}

function editAppointment(id) {
  var a = getAppointment(id);
  if (!a || !isActive(a)) {
    showMessage("لا يمكن تعديل هذا الحجز", "error");
    return;
  }
  clearErrors("appointmentForm");
  editingAppointmentId = id;
  $("patientName").value = a.name;
  $("patientPhone").value = a.phone;
  $("appointmentDate").value = a.date;
  fillTimeSlots(a.time);
  $("treatment").value = a.treatment;
  $("appointmentStatus").value = a.status === ST_DONE ? ST_OK : a.status;
  $("appointmentNotes").value = a.notes || "";
  $("addAppointmentBtn").textContent = "حفظ التعديلات";
  $("appointmentFormTitle").textContent = "تعديل الحجز";
  $("cancelEditBtn").style.display = "inline-block";
  $("addAppointment").scrollIntoView();
  showMessage("عدّل البيانات ثم اضغط حفظ التعديلات", "info");
}

// إضافة / تحديث سجل الحجز في السجل (بدون تكرار)
function upsertHistory(a, info) {
  for (var i = 0; i < historyLog.length; i++) {
    if (historyLog[i].appointmentId === a.id) {
      historyLog[i].name = a.name;
      historyLog[i].date = a.date;
      historyLog[i].time = a.time;
      historyLog[i].treatment = a.treatment;
      historyLog[i].status = a.status;
      historyLog[i].info = info;
      return;
    }
  }
  historyLog.push({ id: genId("h"), appointmentId: a.id, name: a.name, date: a.date, time: a.time, treatment: a.treatment, status: a.status, info: info, createdAt: new Date().toISOString() });
}

// تأكيد حجز (غالباً حجز جاي من الموقع وبانتظار التأكيد)
function confirmAppointment(id) {
  var a = getAppointment(id);
  if (!a || a.status !== ST_WAIT) return;
  a.status = ST_OK;
  addNotification("تم تأكيد حجز المريض " + a.name + " يوم " + formatDate(a.date) + " الساعة " + formatTime(a.time), "success");
  addActivity("تم تأكيد حجز " + a.name);
  saveAll();
  renderAll();
  showMessage("تم تأكيد الحجز، وسيظهر للمريض في صفحته الشخصية", "success");
}

function askCancelAppointment(id) {
  var a = getAppointment(id);
  if (!a) return;
  showConfirm("إلغاء الحجز", "هل تريد إلغاء حجز " + a.name + " يوم " + formatDate(a.date) + "؟", "نعم، إلغاء الحجز", function () {
    cancelAppointment(id, "تم الإلغاء من قبل العيادة", false);
    saveAll();
    renderAll();
    showMessage("تم إلغاء الحجز بنجاح", "success");
  });
}

// إلغاء حجز (silent = بدون إشعار، يُستخدم عند الإجازات)
function cancelAppointment(id, reason, silent) {
  var a = getAppointment(id);
  if (!a || a.status === ST_CANCEL) return false;
  var paid = a.source !== "clinic" && String(a.paymentStatus || "").indexOf("simulated") === -1;
  a.status = ST_CANCEL;
  a.cancelReason = reason;
  a.cancelledBy = "clinic";
  a.cancellationStatus = "cancelled_by_clinic"; // موقع المرضى يفهم الحالة دي ويعرضها للمريض
  a.cancelledAt = new Date().toISOString();
  a.refundStatus = paid ? "pending_manual_review" : "not_applicable";
  upsertHistory(a, "سبب الإلغاء: " + reason);
  if (!silent) {
    addNotification("تم إلغاء حجز المريض " + a.name + " يوم " + formatDate(a.date) + " الساعة " + formatTime(a.time), "danger");
    addActivity("تم إلغاء حجز " + a.name);
  }
  if (editingAppointmentId === id) resetAppointmentForm();
  return true;
}

function completeAppointment(id) {
  var a = getAppointment(id);
  if (!a || !isActive(a)) return;
  a.status = ST_DONE;
  upsertHistory(a, "تم إتمام الحجز");
  addActivity("تم إتمام حجز " + a.name);
  saveAll();
  renderAll();
  showMessage("تم تسجيل الحجز كمكتمل", "success");
}

function viewAppointment(id) {
  var a = getAppointment(id);
  if (!a) return;
  var fromClinic = a.source === "clinic";
  var html = '<table class="table">' + detailRow("المريض", a.name) + detailRow("الهاتف", a.phone) + detailRow("التاريخ", formatDate(a.date) + " (" + dayName(a.date) + ")") + detailRow("الوقت", formatTime(a.time)) + detailRow("العلاج", a.treatment) + "<tr><th>الحالة</th><td>" + statusBadge(a.status) + "</td></tr>" + detailRow("رقم الحجز", a.id) + detailRow("مصدر الحجز", fromClinic ? "تم من العيادة" : "حجز من موقع المرضى");
  if (!fromClinic) {
    html += detailRow("سبب الزيارة", a.reason) + detailRow("المبلغ", a.price ? a.price + " جنيه" : "") + detailRow("حالة الدفع", paymentLabel(a.paymentStatus));
  }
  html += detailRow("ملاحظات", a.notes);
  if (a.status === ST_CANCEL) html += detailRow("سبب الإلغاء", a.cancelReason);
  showDetails("تفاصيل الحجز", html + "</table>");
}

// ==================================
// 11. إدارة المرضى
// ==================================

function lastVisit(id) {
  var last = "";
  for (var i = 0; i < appointments.length; i++) {
    var a = appointments[i];
    if (a.patientId === id && a.status !== ST_CANCEL && a.date <= todayStr() && a.date > last) last = a.date;
  }
  return last ? formatDate(last) : "—";
}

function patientAppointments(id) {
  return appointments
    .filter(function (a) { return a.patientId === id; })
    .sort(function (a, b) { return a.date + a.time < b.date + b.time ? 1 : -1; });
}

function renderPatients() {
  var q = $("patientSearch").value.trim().toLowerCase();
  var list = patients.filter(function (p) {
    return !q || p.name.toLowerCase().indexOf(q) !== -1 || p.phone.indexOf(q) !== -1;
  });
  list = paginate(list, "patients", "patientsPager");

  var html = "";
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    html += "<tr><td>" + esc(p.name) + "</td><td>" + esc(p.phone) + "</td><td>" + lastVisit(p.id) + "</td><td>" + patientAppointments(p.id).length + '</td><td class="text-nowrap">' +
      '<button class="btn btn-sm btn-outline-primary" onclick="viewPatient(\'' + p.id + "')\">تفاصيل</button> " +
      '<button class="btn btn-sm btn-warning" onclick="openPatientModal(\'' + p.id + "')\">تعديل</button> " +
      '<button class="btn btn-sm btn-danger" onclick="askDeletePatient(\'' + p.id + "')\">حذف</button></td></tr>";
  }
  $("patientsTable").innerHTML = html || emptyRow(5, patients.length ? "لا توجد نتائج" : "لا يوجد مرضى بعد");
}

function openPatientModal(id) {
  clearErrors("patientForm");
  editingPatientId = id || null;
  var p = id ? getPatient(id) : null;
  $("patientModalTitle").textContent = p ? "تعديل بيانات المريض" : "إضافة مريض";
  $("pName").value = p ? p.name : "";
  $("pPhone").value = p ? p.phone : "";
  $("pEmail").value = p ? p.email : "";
  $("pDob").value = p ? p.dob : "";
  $("pGender").value = p ? p.gender : "";
  $("pAddress").value = p ? p.address : "";
  $("pNotes").value = p ? p.notes : "";
  bootstrap.Modal.getOrCreateInstance($("patientModal")).show();
}

function savePatient() {
  clearErrors("patientForm");
  var name = $("pName").value.trim();
  var phone = normPhone($("pPhone").value);
  var email = $("pEmail").value.trim();
  var dob = $("pDob").value;
  var ok = true;

  if (!name) { setError("pName", "الاسم مطلوب"); ok = false; }
  if (!phone) { setError("pPhone", "رقم الهاتف مطلوب"); ok = false; }
  else if (!/^\+?[0-9]{8,15}$/.test(phone)) { setError("pPhone", "رقم الهاتف غير صحيح"); ok = false; }
  else if (findPatientByPhone(phone, editingPatientId)) { setError("pPhone", "رقم الهاتف مسجل لمريض آخر"); ok = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("pEmail", "البريد الإلكتروني غير صحيح"); ok = false; }
  if (dob && dob > todayStr()) { setError("pDob", "تاريخ الميلاد لا يمكن أن يكون في المستقبل"); ok = false; }
  if (!ok) return;

  var data = { name: name, phone: phone, email: email, dob: dob, gender: $("pGender").value, address: $("pAddress").value.trim(), notes: $("pNotes").value.trim() };

  if (editingPatientId) {
    var p = getPatient(editingPatientId);
    for (var k in data) p[k] = data[k];
    // تحديث الاسم والهاتف في حجوزات المريض وسجله
    for (var i = 0; i < appointments.length; i++) {
      if (appointments[i].patientId === p.id) {
        appointments[i].name = name;
        appointments[i].phone = phone;
        for (var j = 0; j < historyLog.length; j++) {
          if (historyLog[j].appointmentId === appointments[i].id) historyLog[j].name = name;
        }
      }
    }
    addActivity("تم تعديل بيانات المريض " + name);
    showMessage("تم تعديل بيانات المريض", "success");
  } else {
    data.id = genId("p");
    patients.push(data);
    addActivity("تم إضافة مريض جديد: " + name);
    showMessage("تم إضافة المريض بنجاح", "success");
  }

  saveAll();
  bootstrap.Modal.getOrCreateInstance($("patientModal")).hide();
  renderAll();
}

function askDeletePatient(id) {
  var p = getPatient(id);
  if (!p) return;
  var activeCount = patientAppointments(id).filter(isActive).length;
  if (activeCount > 0) {
    showMessage("لا يمكن حذف المريض لأن لديه " + activeCount + " حجز نشط. ألغِ الحجوزات أولاً", "error");
    return;
  }
  showConfirm("حذف المريض", "هل تريد حذف المريض " + p.name + "؟ سيبقى سجله في السجل التاريخي.", "نعم، احذف", function () {
    patients = patients.filter(function (x) { return x.id !== id; });
    addActivity("تم حذف المريض " + p.name);
    saveAll();
    renderAll();
    showMessage("تم حذف المريض", "success");
  });
}

function viewPatient(id) {
  var p = getPatient(id);
  if (!p) return;
  var html = '<table class="table">' + detailRow("الاسم", p.name) + detailRow("الهاتف", p.phone) + detailRow("البريد", p.email) + detailRow("تاريخ الميلاد", p.dob ? formatDate(p.dob) : "") + detailRow("النوع", p.gender) + detailRow("العنوان", p.address) + detailRow("ملاحظات طبية", p.notes) + "</table>";
  html += '<h6 class="mt-3">سجل حجوزات المريض</h6>';
  var list = patientAppointments(id);
  if (list.length === 0) {
    html += emptyBox("لا توجد حجوزات لهذا المريض");
  } else {
    html += '<div class="table-responsive"><table class="table table-sm"><thead class="table-primary"><tr><th>التاريخ</th><th>الوقت</th><th>العلاج</th><th>الحالة</th></tr></thead><tbody>';
    for (var i = 0; i < list.length; i++) {
      html += "<tr><td>" + formatDate(list[i].date) + "</td><td>" + formatTime(list[i].time) + "</td><td>" + esc(list[i].treatment) + "</td><td>" + statusBadge(list[i].status) + "</td></tr>";
    }
    html += "</tbody></table></div>";
  }
  showDetails("بيانات المريض: " + p.name, html);
}

// ==================================
// 12. جدول عمل الدكتور
// ==================================

function renderSchedule() {
  var order = pageDays(); // أيام عمل هذه الصفحة فقط
  var html = "";
  for (var k = 0; k < order.length; k++) {
    var i = order[k];
    var d = schedule.days[i];
    html += "<tr><td>" + DAY_NAMES[i] + '</td><td><input type="time" class="form-control" id="schStart' + i + '" value="' + d.start + '"></td><td><input type="time" class="form-control" id="schEnd' + i + '" value="' + d.end + '"></td></tr>';
  }
  $("scheduleBody").innerHTML = html;
  $("scheduleDuration").value = String(schedule.duration);
  renderBreaks();
}

function saveSchedule() {
  clearErrors("scheduleForm");
  var dur = parseInt($("scheduleDuration").value, 10);
  var days = [];
  var ok = true;

  for (var i = 0; i < 7; i++) {
    // الأيام غير الظاهرة إجازة دائمة
    if (pageDays().indexOf(i) === -1) {
      days.push({ working: false, start: "10:00", end: "17:00" });
      continue;
    }
    var s = $("schStart" + i).value;
    var e = $("schEnd" + i).value;
    if (!s) { setError("schStart" + i, "مطلوب"); ok = false; }
    if (!e) { setError("schEnd" + i, "مطلوب"); ok = false; }
    if (s && e && toMinutes(s) + dur > toMinutes(e)) { setError("schEnd" + i, "يجب أن تكون النهاية بعد البداية بمدة كشف على الأقل"); ok = false; }
    days.push({ working: true, start: s || "10:00", end: e || "17:00" });
  }
  if (!ok) {
    showMessage("راجع أوقات العمل", "error");
    return;
  }

  schedule.days = days;
  schedule.duration = dur;
  addActivity("تم تحديث جدول عمل الدكتور");
  saveAll();
  renderAll();

  // تنبيه لو فيه حجوزات قادمة أصبحت خارج الجدول
  var outside = appointments.filter(function (a) {
    return isActive(a) && a.date >= todayStr() && getSlots(a.date).indexOf(a.time) === -1 && !getHoliday(a.date);
  }).length;
  showMessage(outside ? "تم حفظ الجدول. تنبيه: يوجد " + outside + " حجز قادم خارج الجدول الجديد" : "تم حفظ جدول العمل بنجاح", outside ? "info" : "success");
}

function renderBreaks() {
  var html = "";
  for (var i = 0; i < schedule.breaks.length; i++) {
    var b = schedule.breaks[i];
    html += '<div class="list-item d-flex justify-content-between align-items-center"><span>' + formatTime(b.start) + " - " + formatTime(b.end) + '</span><button class="btn btn-sm btn-danger" onclick="deleteBreak(\'' + b.id + "')\">حذف</button></div>";
  }
  $("breaksList").innerHTML = html || emptyBox("لا توجد فترات استراحة");
}

function addBreak() {
  clearErrors("breakForm");
  var s = $("breakStart").value;
  var e = $("breakEnd").value;
  var ok = true;
  if (!s) { setError("breakStart", "مطلوب"); ok = false; }
  if (!e) { setError("breakEnd", "مطلوب"); ok = false; }
  if (s && e && toMinutes(s) >= toMinutes(e)) { setError("breakEnd", "يجب أن تكون النهاية بعد البداية"); ok = false; }
  if (ok) {
    for (var i = 0; i < schedule.breaks.length; i++) {
      var b = schedule.breaks[i];
      if (toMinutes(s) < toMinutes(b.end) && toMinutes(e) > toMinutes(b.start)) { setError("breakEnd", "تتداخل مع استراحة أخرى"); ok = false; }
    }
  }
  if (!ok) return;

  schedule.breaks.push({ id: genId("b"), start: s, end: e });
  addActivity("تم إضافة استراحة " + formatTime(s) + " - " + formatTime(e));
  saveAll();
  $("breakStart").value = "";
  $("breakEnd").value = "";
  renderAll();
  showMessage("تمت إضافة الاستراحة", "success");
}

function deleteBreak(id) {
  schedule.breaks = schedule.breaks.filter(function (b) { return b.id !== id; });
  saveAll();
  renderAll();
  showMessage("تم حذف الاستراحة", "success");
}

// ==================================
// 13. جدول مواعيد اليوم
// ==================================

function renderDaily() {
  var date = $("dailyDate").value || todayStr();
  var box = $("dailyScheduleList");
  var h = getHoliday(date);

  if (h) {
    box.innerHTML = emptyBox("العيادة مغلقة في هذا اليوم: " + esc(h.reason));
    return;
  }
  var slots = getSlots(date);
  if (slots.length === 0) {
    box.innerHTML = emptyBox("الدكتور لا يعمل في هذا اليوم (" + dayName(date) + ")");
    return;
  }
  var html = "";
  for (var i = 0; i < slots.length; i++) {
    var a = findBooking(date, slots[i], null);
    if (a) {
      html += '<div class="list-item d-flex justify-content-between align-items-center flex-wrap gap-2"><span><strong>' + formatTime(slots[i]) + "</strong> - " + esc(a.name) + " (" + esc(a.treatment) + ")</span>" + statusBadge(a.status) + "</div>";
    } else {
      html += '<div class="list-item d-flex justify-content-between align-items-center flex-wrap gap-2"><span><strong>' + formatTime(slots[i]) + '</strong> - <span class="text-success">متاح</span></span><button class="btn btn-sm btn-outline-primary" onclick="bookSlot(\'' + date + "','" + slots[i] + "')\">احجز</button></div>";
    }
  }
  box.innerHTML = html;
}

// حجز موعد متاح من جدول اليوم
function bookSlot(date, time) {
  resetAppointmentForm();
  $("appointmentDate").value = date;
  fillTimeSlots(time);
  $("addAppointment").scrollIntoView();
  $("patientName").focus();
}

// ==================================
// 14. إدارة الإجازات
// ==================================

function renderHolidays() {
  var list = holidays.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var html = "";
  for (var i = 0; i < list.length; i++) {
    var h = list[i];
    html += "<tr><td>" + formatDate(h.date) + "</td><td>" + dayName(h.date) + "</td><td>" + esc(h.reason) + '</td><td class="text-nowrap"><button class="btn btn-sm btn-warning" onclick="editHoliday(\'' + h.id + "')\">تعديل</button> " + '<button class="btn btn-sm btn-danger" onclick="askDeleteHoliday(\'' + h.id + "')\">حذف</button></td></tr>";
  }
  $("holidaysTable").innerHTML = html || emptyRow(4, "لا توجد إجازات مسجلة");
}

// إلغاء كل الحجوزات النشطة في يوم الإجازة وإبلاغ المرضى
function cancelForHoliday(date, reason, message) {
  var count = 0;
  for (var i = 0; i < appointments.length; i++) {
    var a = appointments[i];
    if (a.date === date && isActive(a)) {
      cancelAppointment(a.id, "إجازة العيادة: " + reason, true);
      addNotification("تم إلغاء حجز " + a.name + " يوم " + formatDate(date) + " الساعة " + formatTime(a.time) + " بسبب إجازة العيادة (" + reason + ")." + (message ? " " + message : ""), "danger");
      count++;
    }
  }
  return count;
}

function saveHoliday() {
  clearErrors("holidayForm");
  var date = $("dayOffDate").value;
  var reason = $("dayOffReason").value.trim();
  var message = $("patientMessage").value.trim();
  var ok = true;
  var old = null;
  for (var i = 0; i < holidays.length; i++) {
    if (holidays[i].id === editingHolidayId) old = holidays[i];
  }

  if (!date) { setError("dayOffDate", "اختر تاريخ الإجازة"); ok = false; }
  else if (getHoliday(date) && (!old || old.date !== date)) { setError("dayOffDate", "هذا اليوم مسجل بالفعل كإجازة"); ok = false; }
  else if (date < todayStr() && (!old || old.date !== date)) { setError("dayOffDate", "لا يمكن تسجيل إجازة في تاريخ سابق"); ok = false; }
  if (!reason) { setError("dayOffReason", "سبب الإجازة مطلوب"); ok = false; }
  if (!ok) {
    showMessage("من فضلك أكمل بيانات الإجازة", "error");
    return;
  }

  var cancelled = 0;
  if (old) {
    var dateChanged = old.date !== date;
    old.date = date;
    old.reason = reason;
    old.message = message;
    if (dateChanged) cancelled = cancelForHoliday(date, reason, message);
    addActivity("تم تعديل إجازة يوم " + formatDate(date));
  } else {
    holidays.push({ id: genId("hd"), date: date, reason: reason, message: message });
    cancelled = cancelForHoliday(date, reason, message);
    addActivity("تم تسجيل إجازة يوم " + formatDate(date));
  }
  addNotification("تم إغلاق العيادة يوم " + formatDate(date) + " بسبب: " + reason, "danger");

  saveAll();
  resetHolidayForm();
  renderAll();
  showMessage("تم تسجيل الإجازة وإلغاء " + cancelled + " حجز", "success");
}

function resetHolidayForm() {
  clearErrors("holidayForm");
  editingHolidayId = null;
  $("dayOffDate").value = "";
  $("dayOffReason").value = "";
  $("patientMessage").value = "";
  $("closeDayBtn").textContent = "إغلاق اليوم وإبلاغ المرضى";
  $("holidayFormTitle").textContent = "إدارة الإجازات";
  $("cancelHolidayEditBtn").style.display = "none";
}

function editHoliday(id) {
  for (var i = 0; i < holidays.length; i++) {
    if (holidays[i].id === id) {
      clearErrors("holidayForm");
      editingHolidayId = id;
      $("dayOffDate").value = holidays[i].date;
      $("dayOffReason").value = holidays[i].reason;
      $("patientMessage").value = holidays[i].message || "";
      $("closeDayBtn").textContent = "حفظ تعديل الإجازة";
      $("holidayFormTitle").textContent = "تعديل الإجازة";
      $("cancelHolidayEditBtn").style.display = "inline-block";
      $("dayOff").scrollIntoView();
    }
  }
}

function askDeleteHoliday(id) {
  var h = null;
  for (var i = 0; i < holidays.length; i++) {
    if (holidays[i].id === id) h = holidays[i];
  }
  if (!h) return;
  showConfirm("حذف الإجازة", "هل تريد حذف إجازة يوم " + formatDate(h.date) + "؟ الحجوزات التي أُلغيت سابقاً ستبقى ملغاة.", "نعم، احذف", function () {
    holidays = holidays.filter(function (x) { return x.id !== id; });
    if (editingHolidayId === id) resetHolidayForm();
    addActivity("تم حذف إجازة يوم " + formatDate(h.date));
    saveAll();
    renderAll();
    showMessage("تم حذف الإجازة، يمكن الحجز في هذا اليوم الآن", "success");
  });
}

// ==================================
// 15. سجل الحجوزات
// ==================================

function renderHistory() {
  var q = $("hSearch").value.trim().toLowerCase();
  var d = $("hDate").value;
  var s = $("hStatus").value;

  var list = historyLog
    .filter(function (h) {
      return (!q || (h.name + " " + h.treatment).toLowerCase().indexOf(q) !== -1) && (!d || h.date === d) && (!s || h.status === s);
    })
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  list = paginate(list, "history", "historyPager");

  var html = "";
  for (var i = 0; i < list.length; i++) {
    var h = list[i];
    html += "<tr><td>" + esc(h.name) + "</td><td>" + formatDate(h.date) + "</td><td>" + formatTime(h.time) + "</td><td>" + esc(h.treatment) + "</td><td>" + statusBadge(h.status) + '</td><td class="small">' + esc(h.info) + "</td></tr>";
  }
  $("historyTable").innerHTML = html || emptyRow(6, historyLog.length ? "لا توجد نتائج" : "السجل فارغ");
}

// ==================================
// 16. الإشعارات
// ==================================

function renderNotifications() {
  var unread = notifications.filter(function (n) { return !n.read; }).length;
  $("unreadCount").textContent = unread;
  $("headerUnread").textContent = unread;
  $("unreadBadge").textContent = unread;
  $("unreadBadge").style.display = unread ? "inline-block" : "none";

  var html = "";
  for (var i = 0; i < notifications.length; i++) {
    var n = notifications[i];
    html += '<div class="notification' + (n.read ? "" : " unread") + '"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><div>' + esc(n.text) + '</div><small class="text-secondary">' + formatStamp(n.date) + '</small></div><div class="text-nowrap">' +
      (n.read ? "" : '<button class="btn btn-sm btn-outline-primary" onclick="markRead(\'' + n.id + "')\">مقروء</button> ") +
      '<button class="btn btn-sm btn-danger" onclick="deleteNotification(\'' + n.id + "')\">حذف</button></div></div></div>";
  }
  $("notificationsList").innerHTML = html || emptyBox("لا توجد إشعارات حالياً");
}

function markRead(id) {
  for (var i = 0; i < notifications.length; i++) {
    if (notifications[i].id === id) notifications[i].read = true;
  }
  saveAll();
  renderAll();
}

function markAllRead() {
  if (notifications.length === 0) {
    showMessage("لا توجد إشعارات", "info");
    return;
  }
  for (var i = 0; i < notifications.length; i++) notifications[i].read = true;
  saveAll();
  renderAll();
  showMessage("تم تحديد كل الإشعارات كمقروءة", "success");
}

function deleteNotification(id) {
  notifications = notifications.filter(function (n) { return n.id !== id; });
  saveAll();
  renderAll();
}

// ==================================
// 17. الصفحة الرئيسية (Dashboard)
// ==================================

function renderDashboard() {
  var today = todayStr();
  var now = new Date();
  var todayList = [];
  var upcoming = [];
  var confirmed = 0;
  var cancelled = 0;

  for (var i = 0; i < appointments.length; i++) {
    var a = appointments[i];
    if (a.status === ST_OK) confirmed++;
    if (a.status === ST_CANCEL) cancelled++;
    if (a.date === today && a.status !== ST_CANCEL) todayList.push(a);
    if (isActive(a) && new Date(a.date + "T" + a.time) > now) upcoming.push(a);
  }
  var byTime = function (x, y) { return x.date + x.time < y.date + y.time ? -1 : 1; };
  todayList.sort(byTime);
  upcoming.sort(byTime);

  $("statTotal").textContent = appointments.length;
  $("statPatients").textContent = patients.length;
  $("statToday").textContent = todayList.length;
  $("statConfirmed").textContent = confirmed;
  $("statCancelled").textContent = cancelled;
  $("statUpcoming").textContent = upcoming.length;

  var html = "";
  for (var u = 0; u < Math.min(5, upcoming.length); u++) {
    html += '<div class="list-item">' + esc(upcoming[u].name) + " - " + formatDate(upcoming[u].date) + " " + formatTime(upcoming[u].time) + "</div>";
  }
  $("upcomingList").innerHTML = html || emptyBox("لا توجد حجوزات قادمة");

  html = "";
  for (var t = 0; t < todayList.length; t++) {
    html += '<div class="list-item d-flex justify-content-between"><span>' + formatTime(todayList[t].time) + " - " + esc(todayList[t].name) + "</span>" + statusBadge(todayList[t].status) + "</div>";
  }
  $("todayList").innerHTML = html || emptyBox("لا توجد حجوزات اليوم");

  html = "";
  for (var x = 0; x < Math.min(6, activities.length); x++) {
    html += '<div class="list-item">' + esc(activities[x].text) + '<div class="small text-secondary">' + formatStamp(activities[x].date) + "</div></div>";
  }
  $("activitiesList").innerHTML = html || emptyBox("لا توجد نشاطات بعد");

  html = "";
  for (var n = 0; n < Math.min(5, notifications.length); n++) {
    html += '<div class="list-item' + (notifications[n].read ? "" : " fw-bold") + '">' + esc(notifications[n].text) + '<div class="small text-secondary">' + formatStamp(notifications[n].date) + "</div></div>";
  }
  $("dashNotifList").innerHTML = html || emptyBox("لا توجد إشعارات");
}

// ==================================
// 18. تحديث كل أجزاء الموقع
// ==================================

function renderAll() {
  renderLinkStatus();
  renderDashboard();
  renderAppointments();
  fillTimeSlots($("appointmentTime").value);
  renderBreaks();
  renderDaily();
  renderHolidays();
  renderPatients();
  renderHistory();
  renderNotifications();
}

// ==================================
// 19. ربط الأزرار والأحداث
// ==================================

// هل المفتاح ده من بيانات هذه اللوحة؟
function isMyKey(key) {
  for (var name in KEYS) {
    if (KEYS[name] === key) return true;
  }
  return false;
}

function bindEvents() {
  $("addAppointmentBtn").addEventListener("click", saveAppointmentForm);
  $("cancelEditBtn").addEventListener("click", function () {
    resetAppointmentForm();
    showMessage("تم إلغاء التعديل", "info");
  });

  // تغيير التاريخ يحدّث الأوقات المتاحة
  $("appointmentDate").addEventListener("change", function () {
    $("appointmentDate").classList.remove("is-invalid");
    fillTimeSlots("");
  });

  // لو رقم الهاتف لمريض موجود نكمل الاسم تلقائياً
  $("patientPhone").addEventListener("input", function () {
    var p = findPatientByPhone($("patientPhone").value, null);
    if (p && !$("patientName").value.trim()) $("patientName").value = p.name;
  });

  // البحث والفلاتر (نرجع للصفحة الأولى عند أي تغيير)
  var appFilters = ["appSearch", "appFilterDate", "appFilterStatus", "appSort"];
  for (var i = 0; i < appFilters.length; i++) {
    $(appFilters[i]).addEventListener("input", function () { pages.appointments = 1; renderAppointments(); });
  }
  $("appResetBtn").addEventListener("click", function () {
    $("appSearch").value = "";
    $("appFilterDate").value = "";
    $("appFilterStatus").value = "";
    $("appSort").value = "asc";
    pages.appointments = 1;
    renderAppointments();
  });

  var hFilters = ["hSearch", "hDate", "hStatus"];
  for (var j = 0; j < hFilters.length; j++) {
    $(hFilters[j]).addEventListener("input", function () { pages.history = 1; renderHistory(); });
  }
  $("hResetBtn").addEventListener("click", function () {
    $("hSearch").value = "";
    $("hDate").value = "";
    $("hStatus").value = "";
    pages.history = 1;
    renderHistory();
  });

  $("patientSearch").addEventListener("input", function () { pages.patients = 1; renderPatients(); });
  $("addPatientBtn").addEventListener("click", function () { openPatientModal(null); });
  $("savePatientBtn").addEventListener("click", savePatient);

  $("saveScheduleBtn").addEventListener("click", saveSchedule);
  $("addBreakBtn").addEventListener("click", addBreak);
  $("dailyDate").addEventListener("input", renderDaily);

  $("closeDayBtn").addEventListener("click", saveHoliday);
  $("cancelHolidayEditBtn").addEventListener("click", function () {
    resetHolidayForm();
    showMessage("تم إلغاء تعديل الإجازة", "info");
  });

  $("markAllReadBtn").addEventListener("click", markAllRead);

  // زر التأكيد في نافذة التأكيد
  $("confirmOkBtn").addEventListener("click", function () {
    var action = pendingConfirm;
    pendingConfirm = null;
    bootstrap.Modal.getOrCreateInstance($("confirmModal")).hide();
    if (action) action();
  });

  // لو الحجوزات (أو بيانات هذه اللوحة) اتغيرت من صفحة/تبويب تاني نحدّث هذه الصفحة.
  // التحديث ده بيقرأ ويعرض بس، ومفيهوش أي إعادة تحميل للصفحة (reload).
  window.addEventListener("storage", function (e) {
    if (e.key && !isMyKey(e.key)) return;

    // حماية: لو حصلت تحديثات كتير جداً في وقت قصير نوقف مؤقتاً
    var now = Date.now();
    syncStamps = syncStamps.filter(function (t) { return now - t < 3000; });
    syncStamps.push(now);
    if (syncStamps.length > 12) {
      console.warn("تم إيقاف التحديث التلقائي مؤقتاً لمنع التكرار");
      return;
    }

    loadAll();
    renderSchedule();
    renderAll();
  });
}

// ==================================
// 20. القائمة الجانبية على الموبايل
// ==================================

// عند الضغط على أي رابط: نقفل القائمة ثم ننتقل للقسم
function bindSidebarLinks() {
  var links = document.querySelectorAll(".sidebar a");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function (e) {
      var menu = $("sidebarMenu");
      if (window.innerWidth >= 992 || !menu.classList.contains("show")) return;
      e.preventDefault();
      var target = document.querySelector(this.getAttribute("href"));
      menu.addEventListener("hidden.bs.offcanvas", function () { if (target) target.scrollIntoView(); }, { once: true });
      bootstrap.Offcanvas.getOrCreateInstance(menu).hide();
    });
  }
}

// ==================================
// 21. تشغيل الموقع عند فتح الصفحة
// ==================================

// تسجيل أي عيادة تخص أي لوحة (موقع الحجز بيقرا ده عشان يستخدم نفس جدول الدكتور)
function registerClinic() {
  var map = loadData("dental_clinic_map", {});
  if (!map || typeof map !== "object" || Array.isArray(map)) map = {};
  for (var name in map) {
    if (map[name] === SCHEDULE_ID && name !== CLINIC) delete map[name];
  }
  map[CLINIC] = SCHEDULE_ID;
  saveData("dental_clinic_map", map);
}

// شريط تشخيص في أعلى الصفحة: بيقولك اللوحة دي ماسكة أنهي عيادة وكام حجز وصلها
function renderLinkStatus() {
  var box = $("linkStatus");
  if (!box) {
    $("dashboard").insertAdjacentHTML("afterbegin", '<div id="linkStatus" class="alert alert-info py-2 small"></div>');
    box = $("linkStatus");
  }
  var all = loadList(BOOKINGS_KEY);
  var other = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i] && all[i].bookingCode && all[i].clinic !== CLINIC) other++;
  }
  var host = (window.location && window.location.host) || "";
  var text = "هذه اللوحة خاصة بـ (" + CLINIC_TITLE + ") — حجوزاتها: " + appointments.length;
  var cls = "alert alert-info py-2 small";

  if (other > 0) text += " | حجوزات عيادة أخرى: " + other;

  if (all.length === 0) {
    cls = "alert alert-warning py-2 small";
    text += " | لا توجد أي حجوزات محفوظة على هذا العنوان" + (host ? " (" + host + ")" : "") + ". لازم موقع الحجز ولوحة التحكم يتفتحوا من نفس العنوان بالظبط (مثلاً دايماً 127.0.0.1:5501، مش مرة localhost ومرة 127.0.0.1).";
  } else if (appointments.length === 0 && other > 0) {
    cls = "alert alert-warning py-2 small";
    text += " | الحجوزات الموجودة متسجلة للعيادة التانية، افتح لوحتها أو غيّر data-clinic في هذه الصفحة.";
  }

  box.className = cls;
  box.textContent = text;
}

// اسم العيادة في عنوان الصفحة والقائمة الجانبية
function applyClinicHeader() {
  document.title = "لوحة تحكم " + CLINIC_TITLE;
  var heading = document.querySelector("h3");
  if (heading) heading.textContent = "لوحة التحكم - " + CLINIC_TITLE;
  var sideTitle = document.querySelector("#sidebarMenu h4");
  if (sideTitle) sideTitle.textContent = CLINIC_TITLE;
  var offTitle = $("sidebarTitle");
  if (offTitle) offTitle.textContent = CLINIC_TITLE;
}

// عرض أي خطأ غير متوقع في أعلى الصفحة بدل ما الصفحة تفضل "بتحمّل"
function showFatal(err) {
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div style="background:#f8d7da;color:#842029;padding:14px;text-align:center;font-weight:bold">حصل خطأ في تشغيل الصفحة: ' + esc(err && err.message ? err.message : err) + " (افتح Console بزر F12 لمزيد من التفاصيل)</div>"
  );
}

function init() {
  try {
    // تأكد أن ملف HTML هو النسخة الجديدة (يطابق هذا الملف)
    if (!$("appointmentStatus") || !$("loader") || !$("dailyDate")) {
      document.body.insertAdjacentHTML("afterbegin", '<div style="background:#f8d7da;color:#842029;padding:14px;text-align:center;font-weight:bold">ملف HTML قديم: استبدل index1M.html و index2M.html بالنسخة الجديدة ثم اعمل تحديث للصفحة (Ctrl + F5)</div>');
      return;
    }
    applyClinicHeader();
    registerClinic();
    loadAll(); // تحميل البيانات المحفوظة (بدون الكتابة فوقها)
    $("dailyDate").value = todayStr();
    renderSchedule();
    renderAll();
    bindEvents();
    bindSidebarLinks();
  } catch (err) {
    console.error(err);
    showFatal(err);
  } finally {
    // مهما حصل، نخفي مؤشر التحميل
    var loader = $("loader");
    if (loader) loader.style.display = "none";
  }
}

init();