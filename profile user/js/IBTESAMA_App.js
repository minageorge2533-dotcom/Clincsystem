"use strict";

/* =========================================
   IBTESAMA DENTAL CLINIC
   Paymob + Fake Payment Simulation
   + Bookings array linked to the logged-in user
   ========================================= */

const STORAGE_KEY = "draft";                 // الحجز الحالي (خطوات الحجز والدفع والتأكيد)
const BOOKINGS_KEY = "bookings";             // مصفوفة كل الحجوزات (كل حجز أوبجكت، وفيه userId)
const CURRENT_USER_KEY = "currentUserId";    // نفس المفتاح اللي بيحفظه تسجيل الدخول
const SIMULATION_HISTORY_KEY = "ibtesama_simulation_history";

const services = {
  "كشف أسنان": {
    price: 200,
    paymentLink: "https://paymob.link/U9Xd0"
  },
  "تنظيف الأسنان": {
    price: 350,
    paymentLink: "https://paymob.link/KtRjl"
  },
  "تبييض الأسنان": {
    price: 1200,
    paymentLink: "https://paymob.link/GbFqX"
  },
  "تقويم الأسنان": {
    price: 1500,
    paymentLink: "https://paymob.link/Zi5vB"
  },
  "حشو الأسنان": {
    price: 500,
    paymentLink: "https://paymob.link/kSjAD"
  },
  "خلع الأسنان": {
    price: 400,
    paymentLink: "https://paymob.link/foKPE"
  },
  "زراعة الأسنان": {
    price: 5000,
    paymentLink: "https://paymob.link/nWGZt"
  }
};

// أرقام اختبار المحاكاة فقط
const TEST_CARDS = {
  success: "4242424242424242",
  failed: "4000000000000002"
};

const $ = (selector) => document.querySelector(selector);

/* =========================================
   USERS + BOOKINGS ARRAY
   ========================================= */

function readUsers() {
  try {
    const data = JSON.parse(localStorage.getItem("users"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

// المستخدم المسجّل دخوله حاليًا (أو null)
function getCurrentUser() {
  const id = localStorage.getItem(CURRENT_USER_KEY);
  if (!id) return null;

  return readUsers().find((u) => String(u.id) === String(id)) || null;
}

function readBookings() {
  try {
    const data = JSON.parse(localStorage.getItem(BOOKINGS_KEY));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function writeBookings(list) {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
}

// إضافة حجز جديد للمصفوفة، أو تحديثه لو موجود (بنفس bookingCode)
function upsertBooking(booking) {
  if (!booking || !booking.bookingCode || !booking.userId) return;

  const list = readBookings();
  const index = list.findIndex((b) => b.bookingCode === booking.bookingCode);

  if (index === -1) {
    list.unshift(booking); // الأحدث أولًا
  } else {
    list[index] = booking;
  }

  writeBookings(list);
}

/* =========================================
   TIME + CLINIC SCHEDULE (من لوحات تحكم العيادات)
   ========================================= */

// لازم تطابق assistant.js:
// "عيادة فرع المدينة" = عيادة 6 أكتوبر (لوحة التحكم رقم 1)
// "العيادة الرئيسية" = عيادة ميدان المسلة (لوحة التحكم رقم 2)
const CLINIC_SCHEDULE_ID = { "عيادة فرع المدينة": "1", "العيادة الرئيسية": "2" };
const CLINIC_WORK_DAYS = { "1": [6, 0, 1], "2": [2, 3, 4] };
const CLINIC_LATE_DAY = { "1": 1, "2": 4 };

// رقم لوحة التحكم الخاصة بالعيادة (لو اللوحة سجلت نفسها في dental_clinic_map نستخدمه)
function clinicScheduleId(clinic) {
  const map = readJson("dental_clinic_map", null);

  if (map && typeof map === "object") {
    if (map[clinic]) return map[clinic];

    // العيادة اللي لسه لوحتها متفتحتش: ناخد الرقم المتبقي
    const used = Object.values(map);
    const free = ["1", "2"].find((id) => !used.includes(id));
    if (free && CLINIC_SCHEDULE_ID[clinic]) return free;
  }

  return CLINIC_SCHEDULE_ID[clinic];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timeToMin(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
}

// "02:00 مساءً" -> "14:00"
function labelTo24(label) {
  const text = String(label || "");
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  if (/مساء/.test(text) && h < 12) h += 12;
  else if (/صباح/.test(text) && h === 12) h = 0;
  return pad2(h) + ":" + m[2];
}

// "14:00" -> "02:00 مساءً"
function time24ToLabel(t) {
  if (!t) return "";
  const total = timeToMin(t);
  const h = Math.floor(total / 60);
  const period = h < 12 ? "صباحًا" : h === 12 ? "ظهرًا" : "مساءً";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return pad2(h12) + ":" + pad2(total % 60) + " " + period;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value === null || value === undefined ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

// الحجز ملغي (من المريض أو من العيادة)؟
function isBookingCancelled(b) {
  return (
    !!b &&
    (b.status === "ملغي" ||
      b.cancellationStatus === "requested" ||
      b.cancellationStatus === "cancelled_demo" ||
      b.cancellationStatus === "cancelled_by_clinic")
  );
}

// جدول عمل العيادة (نفس اللي بتعدله لوحة التحكم)
function getClinicSchedule(clinic) {
  const id = clinicScheduleId(clinic);
  if (!id) return null;

  const workDays = CLINIC_WORK_DAYS[id];
  const saved = readJson("dental_schedule_" + id, null);
  let schedule;

  if (
    saved &&
    Array.isArray(saved.days) &&
    saved.days.length === 7 &&
    Array.isArray(saved.breaks) &&
    saved.duration > 0
  ) {
    schedule = saved;
  } else {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const late = i === CLINIC_LATE_DAY[id];
      days.push({
        working: workDays.includes(i),
        start: late ? "12:00" : "10:00",
        end: late ? "20:00" : "17:00"
      });
    }
    schedule = { duration: 30, days, breaks: [] };
  }

  // الأيام اللي مش ضمن أيام عمل العيادة إجازة دائمة
  return {
    ...schedule,
    days: schedule.days.map((d, i) => (workDays.includes(i) ? d : { ...d, working: false }))
  };
}

// المواعيد المتاحة لعيادة في يوم معين (حسب جدول الدكتور + الإجازات + الحجوزات الموجودة)
function getClinicAvailability(clinic, date, exceptCode) {
  const id = clinicScheduleId(clinic);

  if (!id || !date) {
    return { slots: [], reason: "اختر العيادة والتاريخ أولًا." };
  }

  const holidays = readJson("dental_holidays_" + id, []);
  const holiday = Array.isArray(holidays) ? holidays.find((h) => h && h.date === date) : null;

  if (holiday) {
    return {
      slots: [],
      reason: "العيادة مغلقة في هذا اليوم" + (holiday.reason ? " (" + holiday.reason + ")" : "") + "."
    };
  }

  const schedule = getClinicSchedule(clinic);
  const day = schedule.days[new Date(date + "T00:00:00").getDay()];

  if (!day || !day.working) {
    return { slots: [], reason: "العيادة لا تعمل في هذا اليوم. اختر يومًا آخر." };
  }

  const all = [];
  const start = timeToMin(day.start);
  const end = timeToMin(day.end);

  for (let t = start; t + schedule.duration <= end; t += schedule.duration) {
    const inBreak = schedule.breaks.some(
      (b) => t < timeToMin(b.end) && t + schedule.duration > timeToMin(b.start)
    );
    if (!inBreak) all.push(minToTime(t));
  }

  const taken = new Set(
    readBookings()
      .filter(
        (b) =>
          b.clinic === clinic &&
          b.date === date &&
          b.bookingCode !== exceptCode &&
          !isBookingCancelled(b) &&
          b.status !== "مكتمل"
      )
      .map((b) => b.time24 || labelTo24(b.time))
  );

  const now = new Date();
  const todayText = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const free = all.filter(
    (slot) => !taken.has(slot) && !(date === todayText && timeToMin(slot) <= nowMinutes)
  );

  return {
    slots: free,
    reason: free.length ? "" : "لا توجد مواعيد متاحة في هذا اليوم. اختر يومًا آخر."
  };
}

/* =========================================
   CURRENT (DRAFT) BOOKING
   ========================================= */

// الحجز الحالي، ولا يظهر إلا لصاحبه
function readBooking() {
  try {
    const booking = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (
      booking &&
      booking.userId &&
      String(booking.userId) !== String(localStorage.getItem(CURRENT_USER_KEY))
    ) {
      return null;
    }

    // النسخة الأحدث موجودة في مصفوفة bookings (العيادة ممكن تكون غيّرت حالة الحجز)
    if (booking && booking.bookingCode) {
      const fresh = readBookings().find((b) => b.bookingCode === booking.bookingCode);
      if (fresh) return fresh;
    }

    return booking;
  } catch (error) {
    console.error("تعذر قراءة بيانات الحجز:", error);
    return null;
  }
}

// حفظ الحجز الحالي + تحديثه داخل مصفوفة bookings
function saveBooking(booking) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
  upsertBooking(booking);
}

// تحديث حجز (قد يكون قديم وليس هو الحالي) داخل المصفوفة،
// وتحديث الحجز الحالي لو هو نفسه
function updateBooking(booking) {
  upsertBooking(booking);

  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (draft && draft.bookingCode === booking.bookingCode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
    }
  } catch (error) {
    /* تجاهل */
  }
}

/* =========================================
   HELPERS
   ========================================= */

function money(amount) {
  return `${Number(amount || 0).toLocaleString("en-US")} جنيه`;
}

function showMessage(element, message, type = "error") {
  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "—";
}

function getServiceName(value) {
  const normalized = String(value || "").trim();

  if (services[normalized]) return normalized;

  const found = Object.keys(services).find((name) =>
    normalized.includes(name)
  );

  return found || "";
}

function createBookingCode() {
  const date = new Date();
  const datePart =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");

  const existing = new Set(readBookings().map((b) => b.bookingCode));
  let code;

  do {
    code = `IBT-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (existing.has(code));

  return code;
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("ar-EG");
}

function updateBookingSummary(booking) {
  if (!booking) return;

  setText("sumName", booking.patientName);
  setText("sumSpecialty", booking.specialty);
  setText("sumClinic", booking.clinic);
  setText("sumDate", formatDate(booking.date));
  setText("sumTime", booking.time);
  setText("sumPrice", money(booking.price));
}

function isValidBooking(data) {
  if (!data.patientName || !data.phone || !data.specialty ||
      !data.clinic || !data.date || !data.time) {
    return "من فضلك أكمل جميع البيانات المطلوبة.";
  }

  if (!/^01[0125][0-9]{8}$/.test(data.phone)) {
    return "من فضلك أدخل رقم هاتف مصري صحيح مكوّن من 11 رقمًا.";
  }

  const selectedDate = new Date(`${data.date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
    return "من فضلك اختر تاريخًا صحيحًا اليوم أو في المستقبل.";
  }

  if (!services[data.specialty]) {
    return "الخدمة المختارة غير موجودة. من فضلك اختر خدمة من القائمة.";
  }

  return "";
}

/* =========================================
   SIMULATION HISTORY
   ========================================= */

function readSimulationHistory() {
  try {
    return JSON.parse(
      localStorage.getItem(SIMULATION_HISTORY_KEY) || "[]"
    );
  } catch (error) {
    return [];
  }
}

function saveSimulationHistory(record) {
  const history = readSimulationHistory();

  history.unshift(record);

  // الاحتفاظ بآخر 100 عملية تجريبية
  localStorage.setItem(
    SIMULATION_HISTORY_KEY,
    JSON.stringify(history.slice(0, 100))
  );
}

function createSimulationRecord(booking, result, holderName, lastFour) {
  return {
    transactionId: `DEMO-${Date.now()}`,
    bookingCode: booking.bookingCode,
    patientName: booking.patientName,
    service: booking.specialty,
    amount: booking.price,
    currency: "EGP",
    cardHolder: holderName,
    cardLastFour: lastFour,
    result,
    paymentMethod: "Fake Payment Simulation",
    createdAt: new Date().toISOString()
  };
}

/* =========================================
   APPOINTMENT PAGE
   ========================================= */

function initAppointmentPage() {
  const form = $("#bookingForm");
  if (!form) return;

  const specialtyInput = $("#specialty");
  const message = $("#bookingMessage");

  // تعبئة الاسم والهاتف تلقائيًا من حساب المستخدم
  const currentUser = getCurrentUser();

  if (currentUser) {
    const nameField = $("#patientName");
    const phoneField = $("#phone");

    if (nameField && !nameField.value) nameField.value = currentUser.fullName || "";
    if (phoneField && !phoneField.value) phoneField.value = currentUser.phone || "";
  }

  // قائمة الأوقات بتتملي حسب العيادة والتاريخ (من جدول الدكتور في لوحة التحكم)
  const timeSelect = $("#time");
  const dateField = $("#date");

  if (dateField) {
    const now = new Date();
    dateField.min = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function fillTimeOptions() {
    if (!timeSelect) return;

    const clinic = $("#clinic")?.value || "";
    const date = dateField?.value || "";
    const previous = timeSelect.value;

    timeSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";

    if (!clinic || !date) {
      placeholder.textContent = "اختر العيادة والتاريخ أولًا";
      timeSelect.appendChild(placeholder);
      timeSelect.disabled = true;
      return;
    }

    const { slots, reason } = getClinicAvailability(clinic, date);

    if (!slots.length) {
      placeholder.textContent = reason;
      timeSelect.appendChild(placeholder);
      timeSelect.disabled = true;
      return;
    }

    placeholder.textContent = "اختر الوقت";
    timeSelect.appendChild(placeholder);

    slots.forEach((slot) => {
      const option = document.createElement("option");
      option.value = slot;
      option.textContent = time24ToLabel(slot);
      timeSelect.appendChild(option);
    });

    timeSelect.disabled = false;
    if (slots.includes(previous)) timeSelect.value = previous;
  }

  function updateLiveSummary() {
    const specialty = getServiceName(specialtyInput?.value);
    const price = services[specialty]?.price || 0;

    setText("sumName", $("#patientName")?.value || "—");
    setText("sumSpecialty", specialty || "—");
    setText("sumClinic", $("#clinic")?.value || "—");
    setText("sumDate", formatDate($("#date")?.value));
    setText("sumTime", $("#time")?.value ? time24ToLabel($("#time").value) : "—");
    setText("sumPrice", price ? money(price) : "—");
  }

  form.addEventListener("change", (event) => {
    if (event.target.id === "clinic" || event.target.id === "date") fillTimeOptions();
  });
  form.addEventListener("input", updateLiveSummary);
  form.addEventListener("change", updateLiveSummary);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    // لازم يكون المستخدم مسجّل دخوله ليتم ربط الحجز بحسابه
    const user = getCurrentUser();

    if (!user) {
      showMessage(
        message,
        "يجب تسجيل الدخول أولًا لإتمام الحجز. جاري تحويلك لصفحة تسجيل الدخول.",
        "error"
      );

      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);

      return;
    }

    const specialty = getServiceName(specialtyInput?.value);

    const booking = {
      userId: user.id,
      patientName: $("#patientName")?.value.trim() || "",
      phone: $("#phone")?.value.trim() || "",
      specialty,
      clinic: $("#clinic")?.value || "",
      date: $("#date")?.value || "",
      time: $("#time")?.value ? time24ToLabel($("#time").value) : "",
      time24: $("#time")?.value || "",
      reason: $("#reason")?.value.trim() || "",
      price: services[specialty]?.price || 0,
      paymentLink: services[specialty]?.paymentLink || "",
      bookingCode: createBookingCode(),
      paymentStatus: "pending",
      paymentMethod: "Paymob",
      status: "قيد الانتظار", // بانتظار تأكيد العيادة
      source: "website",
      createdAt: new Date().toISOString()
    };

    const error = isValidBooking(booking);

    if (error) {
      showMessage(message, error, "error");
      return;
    }

    // التأكد إن الموعد لسه متاح (ممكن حد يكون حجزه أو العيادة تكون قفلت اليوم)
    const availability = getClinicAvailability(booking.clinic, booking.date);

    if (!availability.slots.includes(booking.time24)) {
      showMessage(
        message,
        availability.reason || "هذا الموعد لم يعد متاحًا. اختر موعدًا آخر.",
        "error"
      );
      fillTimeOptions();
      return;
    }

    try {
      saveBooking(booking);
    } catch (storageError) {
      showMessage(
        message,
        "المتصفح منع حفظ بيانات الحجز. افتح الموقع من متصفح عادي وليس وضع التصفح الخاص.",
        "error"
      );
      return;
    }

    showMessage(
      message,
      "تم حفظ بيانات الحجز. جاري الانتقال إلى صفحة الدفع.",
      "success"
    );

    window.location.href = "IBTESAMA_Payment.html";
  });

  fillTimeOptions();
  updateLiveSummary();
}

/* =========================================
   PAYMENT PAGE
   ========================================= */

function initPaymentPage() {
  const paymentForm = $("#paymentForm");
  if (!paymentForm) return;

  const booking = readBooking();
  const message = $("#paymentMessage");

  if (!booking) {
    showMessage(
      message,
      "لا توجد بيانات حجز. من فضلك ارجع إلى صفحة الحجز وأنشئ حجزًا جديدًا.",
      "error"
    );

    const controls = $(".payment-actions");
    if (controls) controls.hidden = true;

    const simulationSection = $("#simulationPayBtn");
    if (simulationSection) simulationSection.disabled = true;

    return;
  }

  updateBookingSummary(booking);

  const service = services[booking.specialty];

  if (!service) {
    showMessage(message, "الخدمة المحفوظة غير صحيحة.", "error");
    return;
  }

  // رابط Paymob الحقيقي - لم يتغير
  const realPaymobButton = $("#realPaymobBtn");

  if (realPaymobButton) {
    realPaymobButton.href = service.paymentLink;
    realPaymobButton.target = "_blank";
    realPaymobButton.rel = "noopener noreferrer";
  }

  // عناصر البطاقة التجريبية
  const nameInput = $("#demoCardName");
  const numberInput = $("#demoCardNumber");
  const expiryInput = $("#demoCardExpiry");
  const cvvInput = $("#demoCardCvv");
  const payButton = $("#simulationPayBtn");
  const processing = $("#simulationProcessing");

  const previewNumber = $("#cardPreviewNumber");
  const previewName = $("#cardPreviewName");
  const previewExpiry = $("#cardPreviewExpiry");

  // تحديث شكل البطاقة أثناء الكتابة
  nameInput?.addEventListener("input", () => {
    if (previewName) {
      previewName.textContent =
        nameInput.value.trim().toUpperCase() || "TEST USER";
    }
  });

  numberInput?.addEventListener("input", () => {
    const digits = numberInput.value.replace(/\D/g, "").slice(0, 16);

    numberInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");

    if (previewNumber) {
      previewNumber.textContent = digits
        ? digits.replace(/\d(?=\d{4})/g, "•").replace(/(.{4})/g, "$1 ").trim()
        : "•••• •••• •••• ••••";
    }
  });

  expiryInput?.addEventListener("input", () => {
    let value = expiryInput.value.replace(/\D/g, "").slice(0, 4);

    if (value.length > 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }

    expiryInput.value = value;

    if (previewExpiry) {
      previewExpiry.textContent = value || "MM/YY";
    }
  });

  function validateDemoExpiry(value) {
    if (!/^\d{2}\/\d{2}$/.test(value)) return false;

    const [month, year] = value.split("/").map(Number);

    if (month < 1 || month > 12) return false;

    const fullYear = 2000 + year;
    const expiryDate = new Date(fullYear, month, 0, 23, 59, 59);
    const now = new Date();

    return expiryDate >= now;
  }

  function setPaymentBusy(isBusy) {
    if (payButton) {
      payButton.disabled = isBusy;
      payButton.textContent = isBusy
        ? "جاري معالجة الدفع..."
        : "ادفع الآن - محاكاة";
    }

    if (processing) {
      processing.hidden = !isBusy;
    }
  }

  paymentForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const currentBooking = readBooking();

    if (!currentBooking) {
      showMessage(message, "بيانات الحجز غير موجودة.", "error");
      return;
    }

    const holderName = nameInput?.value.trim() || "";
    const cardNumber = numberInput?.value.replace(/\D/g, "") || "";
    const expiry = expiryInput?.value.trim() || "";
    const cvv = cvvInput?.value.trim() || "";

    if (holderName.length < 3) {
      showMessage(message, "من فضلك أدخل اسم حامل بطاقة الاختبار.", "error");
      nameInput?.focus();
      return;
    }

    if (
      cardNumber !== TEST_CARDS.success &&
      cardNumber !== TEST_CARDS.failed
    ) {
      showMessage(
        message,
        "رقم البطاقة غير موجود في بيانات الاختبار. استخدم إحدى البطاقتين التجريبيتين المعروضتين.",
        "error"
      );
      numberInput?.focus();
      return;
    }

    if (!validateDemoExpiry(expiry)) {
      showMessage(
        message,
        "تاريخ الانتهاء غير صحيح أو منتهي. استخدم تاريخًا مستقبليًا مثل 12/30.",
        "error"
      );
      expiryInput?.focus();
      return;
    }

    if (cvv !== "123") {
      showMessage(
        message,
        "رمز الاختبار غير صحيح. استخدم 123.",
        "error"
      );
      cvvInput?.focus();
      return;
    }

    if (currentBooking.paymentStatus === "simulated_success") {
      showMessage(
        message,
        "تم تسجيل نجاح المحاكاة لهذا الحجز بالفعل.",
        "success"
      );
      return;
    }

    setPaymentBusy(true);
    showMessage(message, "", "success");

    // محاكاة وقت معالجة بوابة الدفع
    window.setTimeout(() => {
      const latestBooking = readBooking();

      if (!latestBooking) {
        setPaymentBusy(false);
        showMessage(message, "تعذر العثور على الحجز.", "error");
        return;
      }

      const isSuccess = cardNumber === TEST_CARDS.success;
      const lastFour = cardNumber.slice(-4);

      const result = isSuccess ? "success" : "failed";

      const record = createSimulationRecord(
        latestBooking,
        result,
        holderName,
        lastFour
      );

      saveSimulationHistory(record);

      latestBooking.paymentMethod = "Fake Payment Simulation";
      latestBooking.paymentResultAt = new Date().toISOString();
      latestBooking.simulationTransactionId = record.transactionId;
      latestBooking.simulationCardLastFour = lastFour;

      if (isSuccess) {
        latestBooking.paymentStatus = "simulated_success";
        saveBooking(latestBooking);

        window.location.href = "IBTESAMA_Confirmation.html";
        return;
      }

      latestBooking.paymentStatus = "simulated_failed";
      saveBooking(latestBooking);

      setPaymentBusy(false);

      showMessage(
        message,
        "تم رفض عملية الدفع التجريبية. لم يتم خصم أي مبلغ. يمكنك المحاولة مرة أخرى.",
        "error"
      );

    }, 1800);
  });

  paymentForm.addEventListener("reset", () => {
    if (previewNumber) previewNumber.textContent = "•••• •••• •••• ••••";
    if (previewName) previewName.textContent = "TEST USER";
    if (previewExpiry) previewExpiry.textContent = "MM/YY";
  });
}

/* =========================================
   CONFIRMATION PAGE
   ========================================= */

function initConfirmationPage() {
  const confirmationContainer = $("#confirmationDetails");
  if (!confirmationContainer) return;

  const booking = readBooking();

  if (!booking) {
    setText("confirmationStatus", "لا توجد بيانات حجز محفوظة.");
    const cancelButton = $("#cancelBookingBtn");
    if (cancelButton) cancelButton.hidden = true;
    return;
  }

  setText("confirmCode", booking.bookingCode);
  setText("confirmName", booking.patientName);
  setText("confirmPhone", booking.phone);
  setText("confirmSpecialty", booking.specialty);
  setText("confirmClinic", booking.clinic);
  setText("confirmDate", formatDate(booking.date));
  setText("confirmTime", booking.time);
  setText("confirmPrice", money(booking.price));

  const statusElement = $("#confirmationStatus");
  const warningElement = $("#confirmationWarning");
  const retryButton = $("#retryPaymentBtn");
  const cancelButton = $("#cancelBookingBtn");

  const cancellationBox = $("#cancellationStatusBox");
  const cancellationTitle = $("#cancellationStatusTitle");
  const cancellationText = $("#cancellationStatusText");

  const modal = $("#cancelBookingModal");
  const modalCode = $("#cancelModalBookingCode");
  const modalAmount = $("#cancelModalAmount");
  const confirmCancelButton = $("#confirmCancelBookingBtn");
  const closeModalButton = $("#closeCancelModalBtn");

  function showCancellationStatus(title, description) {
    if (cancellationBox) cancellationBox.hidden = false;
    if (cancellationTitle) cancellationTitle.textContent = title;
    if (cancellationText) cancellationText.textContent = description;
  }

  function closeCancelModal() {
    if (modal) modal.hidden = true;
  }

  function refreshBookingStatus() {
    const currentBooking = readBooking();
    if (!currentBooking) return;

    // إلغاء من العيادة
    if (currentBooking.cancellationStatus === "cancelled_by_clinic") {
      showCancellationStatus(
        "تم إلغاء الحجز من العيادة",
        (currentBooking.cancelReason || "قامت العيادة بإلغاء الحجز.") +
          (currentBooking.refundStatus === "pending_manual_review"
            ? " إذا كنت قد دفعت فعليًا فستراجع العيادة الاسترداد."
            : "")
      );

      if (cancelButton) cancelButton.hidden = true;
      if (retryButton) retryButton.hidden = true;
      return;
    }

    // طلب إلغاء موجود بالفعل
    if (currentBooking.cancellationStatus === "requested") {
      showCancellationStatus(
        "طلب الإلغاء قيد المراجعة",
        "تم تسجيل طلب إلغاء الحجز. ستراجع العيادة الطلب، وسيتم تحديث حالة الاسترداد بعد مراجعته وتنفيذه."
      );

      if (cancelButton) cancelButton.hidden = true;
      if (retryButton) retryButton.hidden = true;
      return;
    }

    // إلغاء حجز المحاكاة
    if (currentBooking.cancellationStatus === "cancelled_demo") {
      showCancellationStatus(
        "تم إلغاء الحجز التجريبي",
        "تم إلغاء الحجز التجريبي بنجاح. لم يتم تحصيل أي مبلغ حقيقي، لذلك لا توجد عملية استرداد مالية."
      );

      if (cancelButton) cancelButton.hidden = true;
      if (retryButton) retryButton.hidden = true;
      return;
    }

    // حالة الدفع
    if (currentBooking.paymentStatus === "simulated_success") {
      setText(
        "confirmationStatus",
        "نجاح تجريبي – تمت محاكاة الدفع"
      );

      if (statusElement) {
        statusElement.className = "payment-status simulated-success";
      }

      if (warningElement) {
        warningElement.textContent =
          "هذه نتيجة محاكاة فقط. لم يتم دفع أي مبلغ حقيقي ولم يتم تأكيد الدفع لدى Paymob.";
      }

      if (retryButton) retryButton.hidden = true;

    } else if (currentBooking.paymentStatus === "simulated_failed") {
      setText(
        "confirmationStatus",
        "فشل تجريبي – تمت محاكاة رفض الدفع"
      );

      if (statusElement) {
        statusElement.className = "payment-status simulated-failed";
      }

      if (warningElement) {
        warningElement.textContent =
          "هذه نتيجة محاكاة فقط. لم يتم خصم أي مبلغ.";
      }

    } else {
      setText(
        "confirmationStatus",
        "في انتظار مراجعة الدفع من العيادة"
      );

      if (statusElement) {
        statusElement.className = "payment-status pending";
      }

      if (warningElement) {
        warningElement.textContent =
          "عرض هذه الصفحة لا يثبت إتمام الدفع. يجب مراجعة عملية Paymob من لوحة التحكم.";
      }
    }
  }

  refreshBookingStatus();

  // فتح نافذة الإلغاء المصممة داخل الموقع
  cancelButton?.addEventListener("click", () => {
    const currentBooking = readBooking();
    if (!currentBooking || !modal) return;

    if (isBookingCancelled(currentBooking)) {
      return;
    }

    if (modalCode) {
      modalCode.textContent = currentBooking.bookingCode || "—";
    }

    if (modalAmount) {
      modalAmount.textContent = money(currentBooking.price);
    }

    modal.hidden = false;
  });

  // إغلاق النافذة
  closeModalButton?.addEventListener("click", closeCancelModal);

  modal?.querySelectorAll("[data-close-cancel-modal]").forEach((element) => {
    element.addEventListener("click", closeCancelModal);
  });

  // تنفيذ طلب الإلغاء
  confirmCancelButton?.addEventListener("click", () => {
    const currentBooking = readBooking();
    if (!currentBooking) {
      closeCancelModal();
      return;
    }

    if (isBookingCancelled(currentBooking)) {
      closeCancelModal();
      return;
    }

    const isSimulation =
      currentBooking.paymentStatus === "simulated_success" ||
      currentBooking.paymentStatus === "simulated_failed";

    const cancellationRecord = {
      cancellationId: `CANCEL-${Date.now()}`,
      bookingCode: currentBooking.bookingCode,
      patientName: currentBooking.patientName,
      phone: currentBooking.phone,
      service: currentBooking.specialty,
      amount: currentBooking.price,
      originalPaymentStatus: currentBooking.paymentStatus || "pending",
      cancellationStatus: isSimulation ? "cancelled_demo" : "requested",
      refundStatus: isSimulation ? "not_applicable" : "pending_manual_review",
      createdAt: new Date().toISOString()
    };

    // حفظ سجل طلب الإلغاء محليًا
    let cancellationHistory = [];

    try {
      cancellationHistory = JSON.parse(
        localStorage.getItem("ibtesama_cancellation_requests") || "[]"
      );

      if (!Array.isArray(cancellationHistory)) {
        cancellationHistory = [];
      }
    } catch (error) {
      cancellationHistory = [];
    }

    cancellationHistory.unshift(cancellationRecord);

    localStorage.setItem(
      "ibtesama_cancellation_requests",
      JSON.stringify(cancellationHistory.slice(0, 100))
    );

    if (isSimulation) {
      currentBooking.cancellationStatus = "cancelled_demo";
      currentBooking.cancelledAt = cancellationRecord.createdAt;
      currentBooking.refundStatus = "not_applicable";
    } else {
      currentBooking.cancellationStatus = "requested";
      currentBooking.cancelledAt = cancellationRecord.createdAt;
      currentBooking.refundStatus = "pending_manual_review";
    }

    currentBooking.status = "ملغي";
    currentBooking.cancelledBy = "patient";
    currentBooking.cancelReason = "تم الإلغاء من قبل المريض";

    saveBooking(currentBooking);

    closeCancelModal();
    refreshBookingStatus();
  });

  // إعادة محاولة الدفع
  retryButton?.addEventListener("click", () => {
    window.location.href = "IBTESAMA_Payment.html";
  });

  // حذف الحجز الحالي (المسودة) من هذا المتصفح.
  // سجل الحجز يفضل محفوظ في مصفوفة bookings ويظهر في الصفحة الشخصية.
  const clearButton = $("#clearBookingBtn");

  clearButton?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "IBTESAMA_Appointment.html";
  });
}


/* =========================================
   INITIALIZE
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  initAppointmentPage();
  initPaymentPage();
  initConfirmationPage();
});