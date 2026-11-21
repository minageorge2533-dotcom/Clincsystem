/* =========================================
   IBTESAMA DENTAL CLINIC
   Paymob Payment Links - No Backend
   ========================================= */

const $ = (id) => document.getElementById(id);

/* أسعار وروابط الخدمات */
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

/* قراءة البيانات */
const read = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
        return null;
    }
};

/* حفظ البيانات */
const save = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch {
        return false;
    }
};

/* حذف البيانات */
const remove = (key) => {
    localStorage.removeItem(key);
};

/* تنسيق السعر */
const money = (price) => `${price || 0} جنيه`;

/* عرض الرسائل */
const showMessage = (id, message, type = "error") => {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;
};

/* تاريخ اليوم */
const today = () => {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
};

/* رقم الحجز */
const createBookingCode = () => {
    return String(Math.floor(100000 + Math.random() * 900000));
};

/* عرض قيمة داخل عنصر */
const setText = (id, value) => {
    const element = $(id);

    if (element) {
        element.textContent = value || "—";
    }
};

/* التحقق من بيانات الحجز */
const isValidBooking = (booking) => {
    if (!booking || typeof booking !== "object") return false;

    const service = services[booking.specialty];

    return Boolean(
        booking.name &&
        booking.phone &&
        booking.specialty &&
        service &&
        booking.clinic &&
        booking.date &&
        booking.time &&
        Number(booking.price) === service.price &&
        booking.bookingCode
    );
};


/* =========================================
   1. APPOINTMENT PAGE
   ========================================= */

if ($("bookingForm")) {

    const form = $("bookingForm");
    const dateInput = $("date");

    if (dateInput) {
        dateInput.min = today();
    }

    /* تحديث ملخص الحجز */
    const updateSummary = () => {

        const data = {
            name: $("patientName")?.value.trim() || "",
            phone: $("phone")?.value.trim() || "",
            specialty: $("specialty")?.value || "",
            clinic: $("clinic")?.value || "",
            date: $("date")?.value || "",
            time: $("time")?.value || "",
            reason: $("reason")?.value.trim() || ""
        };

        setText("sumName", data.name);
        setText("sumSpecialty", data.specialty);
        setText("sumClinic", data.clinic);
        setText("sumDate", data.date);
        setText("sumTime", data.time);

        const price = services[data.specialty]?.price || 0;
        setText("sumPrice", money(price));

        return data;
    };

    form.addEventListener("input", updateSummary);
    form.addEventListener("change", updateSummary);

    /* إرسال الحجز */
    form.addEventListener("submit", (event) => {

        event.preventDefault();

        const data = updateSummary();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!services[data.specialty]) {
            showMessage(
                "bookingMessage",
                "من فضلك اختر الخدمة المطلوبة."
            );
            return;
        }

        if (!data.clinic) {
            showMessage(
                "bookingMessage",
                "من فضلك اختر العيادة."
            );
            return;
        }

        if (data.date < today()) {
            showMessage(
                "bookingMessage",
                "لا يمكن اختيار تاريخ سابق."
            );
            return;
        }

        /* التحقق من رقم الهاتف */
        const phoneDigits = data.phone.replace(/\D/g, "");

        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
            showMessage(
                "bookingMessage",
                "من فضلك أدخل رقم هاتف صحيح."
            );
            return;
        }

        data.price = services[data.specialty].price;
        data.bookingCode = createBookingCode();
        data.paymentStatus = "pending";
        data.createdAt = new Date().toISOString();

        if (!save("draft", data)) {
            showMessage(
                "bookingMessage",
                "تعذر حفظ الحجز. تأكد من إعدادات المتصفح."
            );
            return;
        }

        window.location.href = "payment.html";
    });

    updateSummary();
}


/* =========================================
   2. PAYMENT PAGE
   ========================================= */

if ($("paymentForm")) {

    const form = $("paymentForm");
    const booking = read("draft");
    const payButton = $("payButton");

    if (!isValidBooking(booking)) {

        showMessage(
            "paymentMessage",
            "بيانات الحجز غير موجودة أو غير مكتملة. من فضلك ابدأ بحجز موعد جديد."
        );

        if (payButton) {
            payButton.disabled = true;
        }

    } else {

        /* عرض ملخص الحجز */
        setText("paymentName", booking.name);
        setText("paymentSpecialty", booking.specialty);
        setText("paymentClinic", booking.clinic);
        setText("paymentDate", booking.date);
        setText("paymentTime", booking.time);
        setText("paymentTotal", money(booking.price));

        /* فتح رابط Paymob */
        form.addEventListener("submit", (event) => {

            event.preventDefault();

            const service = services[booking.specialty];

            if (!service || !service.paymentLink) {
                showMessage(
                    "paymentMessage",
                    "رابط الدفع غير متاح لهذه الخدمة."
                );
                return;
            }

            /*
              لا يتم جمع بيانات البطاقة في الموقع.
              يتم فتح صفحة Paymob الآمنة في تبويب جديد.
            */

            const paymentWindow = window.open(
                service.paymentLink,
                "_blank",
                "noopener,noreferrer"
            );

            if (!paymentWindow) {
                showMessage(
                    "paymentMessage",
                    "المتصفح منع فتح صفحة الدفع. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى."
                );
                return;
            }

            booking.paymentStatus = "pending_verification";
            save("draft", booking);

            showMessage(
                "paymentMessage",
                "تم فتح صفحة Paymob في تبويب جديد. أكمل الدفع هناك، ثم ارجع لهذه الصفحة لعرض تفاصيل الحجز.",
                "success"
            );
        });
    }
}


/* =========================================
   3. CONFIRMATION PAGE
   ========================================= */

if ($("confirmationCard")) {

    const booking = read("draft");

    if (!isValidBooking(booking)) {

        setText("confirmationTitle", "لا توجد بيانات حجز");
        setText(
            "confirmationSubtitle",
            "لم يتم العثور على حجز محفوظ. يمكنك إنشاء حجز جديد."
        );

        setText("bookingCode", "—");
        setText("confirmStatus", "لا يوجد حجز");

        if ($("cancelBookingBtn")) {
            $("cancelBookingBtn").disabled = true;
        }

    } else {

        /* عرض بيانات الحجز */
        setText("confirmName", booking.name);
        setText("confirmPhone", booking.phone);
        setText("confirmSpecialty", booking.specialty);
        setText("confirmClinic", booking.clinic);
        setText("confirmDate", booking.date);
        setText("confirmTime", booking.time);
        setText("confirmPrice", money(booking.price));
        setText("bookingCode", booking.bookingCode);

        /*
          لا يمكن إثبات نجاح الدفع من رابط ثابت.
          يجب مراجعة العملية من لوحة Paymob.
        */

        setText(
            "confirmationTitle",
            "تم تسجيل بيانات الحجز"
        );

        setText(
            "confirmationSubtitle",
            "احتفظ برقم الحجز، وسيتم مراجعة حالة الدفع قبل اعتماد الموعد."
        );

        setText(
            "confirmStatus",
            "في انتظار مراجعة الدفع من العيادة"
        );
    }

    /* إلغاء الحجز */
    const cancelButton = $("cancelBookingBtn");

    if (cancelButton && isValidBooking(booking)) {

        cancelButton.addEventListener("click", () => {

            const confirmed = window.confirm(
                "هل أنت متأكد من حذف بيانات هذا الحجز من المتصفح؟"
            );

            if (!confirmed) return;

            remove("draft");

            setText("confirmationTitle", "تم حذف بيانات الحجز");
            setText(
                "confirmationSubtitle",
                "تم حذف بيانات الحجز المحفوظة في هذا المتصفح فقط."
            );

            setText("confirmStatus", "تم حذف البيانات");

            cancelButton.disabled = true;

            showMessage(
                "cancelMessage",
                "تم حذف بيانات الحجز من هذا المتصفح.",
                "success"
            );
        });
    }
}