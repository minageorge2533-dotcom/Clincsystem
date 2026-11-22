// <!-- بعد التعديل -->




"use strict";

/* =========================================
   IBTESAMA DENTAL CLINIC
   Paymob + Fake Payment Simulation
   ========================================= */

const STORAGE_KEY = "draft";
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

function readBooking() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.error("تعذر قراءة بيانات الحجز:", error);
    return null;
  }
}

function saveBooking(booking) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
}

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

  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `IBT-${datePart}-${randomPart}`;
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

  function updateLiveSummary() {
    const specialty = getServiceName(specialtyInput?.value);
    const price = services[specialty]?.price || 0;

    setText("sumName", $("#patientName")?.value || "—");
    setText("sumSpecialty", specialty || "—");
    setText("sumClinic", $("#clinic")?.value || "—");
    setText("sumDate", formatDate($("#date")?.value));
    setText("sumTime", $("#time")?.value || "—");
    setText("sumPrice", price ? money(price) : "—");
  }

  form.addEventListener("input", updateLiveSummary);
  form.addEventListener("change", updateLiveSummary);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const specialty = getServiceName(specialtyInput?.value);

    const booking = {
      patientName: $("#patientName")?.value.trim() || "",
      phone: $("#phone")?.value.trim() || "",
      specialty,
      clinic: $("#clinic")?.value || "",
      date: $("#date")?.value || "",
      time: $("#time")?.value || "",
      reason: $("#reason")?.value.trim() || "",
      price: services[specialty]?.price || 0,
      paymentLink: services[specialty]?.paymentLink || "",
      bookingCode: createBookingCode(),
      paymentStatus: "pending",
      paymentMethod: "Paymob",
      createdAt: new Date().toISOString()
    };

    const error = isValidBooking(booking);
    const message = $("#bookingMessage");

    if (error) {
      showMessage(message, error, "error");
      return;
    }

    saveBooking(booking);

    if (message) {
      showMessage(
        message,
        "تم حفظ بيانات الحجز. جاري الانتقال إلى صفحة الدفع.",
        "success"
      );
    }

    window.location.href = "IBTESAMA_Payment.html";
  });

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

    if (
      currentBooking.cancellationStatus === "requested" ||
      currentBooking.cancellationStatus === "cancelled_demo"
    ) {
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

    if (
      currentBooking.cancellationStatus === "requested" ||
      currentBooking.cancellationStatus === "cancelled_demo"
    ) {
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

    saveBooking(currentBooking);

    closeCancelModal();
    refreshBookingStatus();
  });

  // إعادة محاولة الدفع
  retryButton?.addEventListener("click", () => {
    window.location.href = "IBTESAMA_Payment.html";
  });

  // حذف بيانات الحجز من هذا المتصفح
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
