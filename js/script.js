// ======================================
// 1- تحديد عناصر الصفحة
// ======================================

const clinicFilter = document.querySelector(".clinic-select");

const bookingsTable = document.querySelector("#bookings tbody");
const paymentsTable = document.querySelector("#payments tbody");


// ======================================
// 2- تحديث الإحصائيات
// ======================================

function updateStatistics() {

    const bookings = [...bookingsTable.querySelectorAll("tr")];
    const payments = [...paymentsTable.querySelectorAll("tr")];

    const total = bookings.length;

    const pending = bookings.filter(row =>
        row.querySelector(".badge-pending")
    ).length;

    const totalPatients = new Set(
        bookings.map(row => row.cells[0].textContent.trim())
    ).size;

    let totalPayments = 0;

    payments.forEach(row => {
        if (row.querySelector(".badge-confirmed")) {
            const amount = row.cells[2].textContent.replace(/[^\d.]/g, "");
            totalPayments += Number(amount);
        }
    });

    const stats = document.querySelectorAll(".stat-card h3");

    stats[0].textContent = total;
    stats[1].textContent = pending;
    stats[2].textContent = totalPayments.toLocaleString("ar-EG");
    stats[3].textContent = totalPatients;
}


// ======================================
// 3- تأكيد وإلغاء الحجوزات
// ======================================

bookingsTable.addEventListener("click", function(event) {

    const button = event.target.closest("button");

    if (!button) return;

    const row = button.closest("tr");
    const status = row.querySelector(".badge");

    if (button.textContent.trim() === "تأكيد") {

        status.textContent = "مؤكد";
        status.className = "badge badge-confirmed";

        button.parentElement.innerHTML = `
            <button class="btn btn-sm btn-outline-primary">عرض</button>
        `;

        alert("تم تأكيد الحجز بنجاح");

    }

    else if (button.textContent.trim() === "إلغاء") {

        const confirmCancel = confirm("هل أنت متأكد من إلغاء الحجز؟");

        if (confirmCancel) {
            status.textContent = "ملغي";
            status.className = "badge badge-cancelled";

            button.parentElement.innerHTML = `
                <button class="btn btn-sm btn-outline-primary">عرض</button>
            `;

            alert("تم إلغاء الحجز");
        }
    }

    else if (button.textContent.trim() === "عرض") {

        alert(
            "اسم المريض: " + row.cells[0].textContent +
            "\nالعيادة: " + row.cells[1].textContent +
            "\nالتاريخ: " + row.cells[2].textContent +
            "\nالوقت: " + row.cells[3].textContent +
            "\nحالة الحجز: " + status.textContent
        );

    }

    updateStatistics();

});


// ======================================
// 4- تأكيد المدفوعات
// ======================================

paymentsTable.addEventListener("click", function(event) {

    const button = event.target.closest("button");

    if (!button) return;

    const row = button.closest("tr");

    const status = row.querySelector(".badge");

    if (button.textContent.trim() === "تأكيد الدفع") {

        status.textContent = "تم الدفع";
        status.className = "badge badge-confirmed";

        button.textContent = "تم التأكيد";
        button.disabled = true;

        alert("تم تأكيد الدفع بنجاح");

        updateStatistics();
    }

    else if (button.textContent.trim() === "التفاصيل") {

        alert(
            "اسم المريض: " + row.cells[0].textContent +
            "\nالخدمة: " + row.cells[1].textContent +
            "\nالمبلغ: " + row.cells[2].textContent +
            "\nطريقة الدفع: " + row.cells[3].textContent +
            "\nحالة الدفع: " + status.textContent
        );

    }

});


// ======================================
// 5- فلترة الحجوزات حسب العيادة
// ======================================

clinicFilter.addEventListener("change", function() {

    const selectedClinic = this.value;

    const bookings = bookingsTable.querySelectorAll("tr");
    const payments = paymentsTable.querySelectorAll("tr");

    bookings.forEach(row => {

        const clinic = row.cells[1].textContent.trim();

        if (
            selectedClinic === "all" ||
            (selectedClinic === "masala" && clinic === "المسالة") ||
            (selectedClinic === "october" && clinic === "6 أكتوبر")
        ) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }

    });

    // تحديث عرض المدفوعات حسب العيادة
    // ملاحظة: جدول المدفوعات الحالي لا يحتوي على عمود العيادة.

});


// ======================================
// 6- إضافة حجز جديد
// ======================================

document.querySelectorAll(".content-card button").forEach(button => {

    if (button.textContent.includes("إضافة حجز")) {

        button.addEventListener("click", function() {

            const name = prompt("اكتب اسم المريض:");

            if (!name) return;

            const clinic = prompt(
                "اكتب اسم العيادة:\nالمسالة أو 6 أكتوبر"
            );

            if (clinic !== "المسالة" && clinic !== "6 أكتوبر") {
                alert("اسم العيادة غير صحيح");
                return;
            }

            const date = prompt("اكتب تاريخ الحجز:");

            if (!date) return;

            const time = prompt("اكتب موعد الحجز:");

            if (!time) return;

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(name)}</td>
                <td>${clinic}</td>
                <td>${escapeHTML(date)}</td>
                <td>${escapeHTML(time)}</td>
                <td>
                    <span class="badge badge-pending">في الانتظار</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-success">تأكيد</button>
                    <button class="btn btn-sm btn-danger">إلغاء</button>
                </td>
            `;

            bookingsTable.appendChild(row);

            updateStatistics();

            alert("تمت إضافة الحجز بنجاح");

        });

    }

});


// ======================================
// 7- حماية النصوص المدخلة
// ======================================

function escapeHTML(value) {

    const element = document.createElement("div");

    element.textContent = value;

    return element.innerHTML;
}


// ======================================
// 8- تشغيل الإحصائيات عند فتح الصفحة
// ======================================

updateStatistics();

// إضافة موعد من النموذج الموجود في HTML

const appointmentForm = document.getElementById("appointmentForm");

appointmentForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const clinic = document.getElementById("appointmentClinic").value;
    const day = document.getElementById("appointmentDay").value;
    const start = document.getElementById("appointmentStart").value;
    const end = document.getElementById("appointmentEnd").value;
    const count = Number(document.getElementById("appointmentCount").value);

    // التأكد من صحة البيانات
    if (!clinic || !day || !start || !end || count <= 0) {
        alert("من فضلك أكمل جميع البيانات");
        return;
    }

    if (start >= end) {
        alert("وقت النهاية لازم يكون بعد وقت البداية");
        return;
    }

    // البحث عن العيادة المطلوبة
    const clinicCards = document.querySelectorAll(
        "#appointments .row > div"
    );

    let targetClinic = null;

    clinicCards.forEach(card => {
        const title = card.querySelector("h6");

        if (title && title.textContent.includes(clinic)) {
            targetClinic = card.querySelector(".content-card");
        }
    });

    if (!targetClinic) {
        alert("لم يتم العثور على العيادة");
        return;
    }

    // إنشاء الموعد
    const schedule = document.createElement("div");
    schedule.className = "schedule-item";

    const title = document.createElement("strong");
    title.textContent = day;

    const time = document.createElement("p");
    time.className = "mb-1";
    time.textContent = `من ${start} إلى ${end}`;

    const appointments = document.createElement("small");
    appointments.className = "text-muted";
    appointments.textContent = `عدد المواعيد: ${count}`;

    schedule.append(title, time, appointments);

    // إضافته إلى جدول العيادة
    targetClinic.appendChild(schedule);

    // إعادة ضبط النموذذ
    appointmentForm.reset();

    alert("تم إضافة الموعد بنجاح");

});