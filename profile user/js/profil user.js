// ======================================
// 1. Load Users From Local Storage
// ======================================

// قراءة مصفوفة المستخدمين بشكل آمن (لو البيانات تالفة يرجع مصفوفة فاضية)
function getUsers() {
    try {
        const data = JSON.parse(localStorage.getItem("users"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

let users = getUsers();

const currentUserId = localStorage.getItem("currentUserId");

// البحث عن المستخدم الحالي باستخدام الـ ID
let user = users.find(u => String(u.id) === String(currentUserId));


// ======================================
// 2. Check Current User
// ======================================

if (!user) {
    alert("لم يتم العثور على حسابك، من فضلك سجل الدخول أولاً.");
    window.location.replace("login.html");
}


// ======================================
// 3. Display User Profile
// ======================================

function displayProfile() {

    if (!user) return;

    document.getElementById("patientName").textContent = user.fullName || "";
    document.getElementById("patientEmail").textContent = user.email || "";
    document.getElementById("patientPhone").textContent = user.phone || "";
    document.getElementById("patientBirth").textContent = user.birth || "غير محدد";
    document.getElementById("patientGender").textContent = user.gender || "غير محدد";
    document.getElementById("patientAddress").textContent = user.address || "غير محدد";

    document.getElementById("profileDisplayName").textContent =
        user.fullName || "";

}

// عرض البيانات عند فتح الصفحة
if (user) {
    displayProfile();
    displayBookings();
}


// ======================================
// 4. Edit User Profile
// ======================================

function editProfile() {

    if (!user) return;

    document.getElementById("editName").value = user.fullName || "";
    document.getElementById("editEmail").value = user.email || "";
    document.getElementById("editPhone").value = user.phone || "";
    document.getElementById("editBirth").value = user.birth || "";
    document.getElementById("editGender").value = user.gender || "";
    document.getElementById("editAddress").value = user.address || "";

    document.getElementById("editProfileCard").classList.remove("d-none");

}


// ======================================
// 5. Save User Profile
// ======================================

function saveProfile() {

    if (!user) return;

    const name = document.getElementById("editName").value.trim();
    const email = document.getElementById("editEmail").value.trim().toLowerCase();
    let phone = document.getElementById("editPhone").value.trim();
    const birth = document.getElementById("editBirth").value.trim();
    const gender = document.getElementById("editGender").value;
    const address = document.getElementById("editAddress").value.trim();

    // Check empty fields
    if (!name || !email || !phone || !birth || !gender || !address) {
        alert("من فضلك املأ جميع البيانات");
        return;
    }

    // Check email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!emailRegex.test(email)) {
        alert("من فضلك أدخل بريد إلكتروني صحيح");
        return;
    }

    // Check phone (convert Arabic digits first)
    phone = phone.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

    const phoneRegex = /^01[0125][0-9]{8}$/;

    if (!phoneRegex.test(phone)) {
        alert("رقم الهاتف غير صحيح");
        return;
    }

    // Reload the latest users array before checking/saving
    users = getUsers();

    const userIndex = users.findIndex(u =>
        String(u.id) === String(currentUserId)
    );

    if (userIndex === -1) {
        alert("تعذر العثور على حسابك، من فضلك سجل الدخول مرة أخرى.");
        window.location.replace("login.html");
        return;
    }

    // Check duplicate email (other users only)
    const emailExists = users.some(u =>
        String(u.id) !== String(currentUserId) &&
        (u.email || "").toLowerCase() === email
    );

    if (emailExists) {
        alert("هذا البريد الإلكتروني مستخدم بالفعل");
        return;
    }

    // Check duplicate phone (other users only)
    const phoneExists = users.some(u =>
        String(u.id) !== String(currentUserId) &&
        u.phone === phone
    );

    if (phoneExists) {
        alert("رقم الهاتف مستخدم بالفعل");
        return;
    }

    // Update only the edited fields (keeps id, passwordHash, salt, ...)
    users[userIndex] = {
        ...users[userIndex],
        fullName: name,
        email: email,
        phone: phone,
        birth: birth,
        gender: gender,
        address: address
    };

    // Save the updated users array
    try {
        localStorage.setItem("users", JSON.stringify(users));
    } catch (error) {
        console.error("Save Error:", error);
        alert("تعذر حفظ البيانات، يرجى المحاولة مرة أخرى.");
        return;
    }

    // Refresh current user + display
    user = users[userIndex];
    displayProfile();

    // Hide edit card
    document.getElementById("editProfileCard").classList.add("d-none");

    alert("تم تحديث بياناتك بنجاح");

}


// ======================================
// 6. Cancel Edit
// ======================================

function cancelEdit() {
    document.getElementById("editProfileCard").classList.add("d-none");
}


// ======================================
// 7. Logout
// ======================================

function logout() {
    localStorage.removeItem("currentUserId");
    window.location.replace("login.html");
}


// ======================================
// 8. Bookings (from the "bookings" array)
// ======================================

function readBookings() {
    try {
        const data = JSON.parse(localStorage.getItem("bookings"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

// حجوزات المستخدم الحالي فقط
function getUserBookings() {
    return readBookings().filter(b =>
        String(b.userId) === String(currentUserId)
    );
}

function isBookingCancelled(b) {
    return b.status === "ملغي" ||
           b.cancellationStatus === "requested" ||
           b.cancellationStatus === "cancelled_demo" ||
           b.cancellationStatus === "cancelled_by_clinic";
}

// تحويل وقت مثل "02:00 مساءً" إلى دقائق من بداية اليوم
function timeToMinutes(t) {
    const m = String(t || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return 0;

    let hours = Number(m[1]);
    if (/مساء/.test(t) && hours < 12) hours += 12;

    return hours * 60 + Number(m[2]);
}

function bookingTimestamp(b) {
    const d = new Date(`${b.date}T00:00:00`);
    return d.getTime() + timeToMinutes(b.time24 || b.time) * 60000;
}

function setTextById(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function displayBookings() {

    if (!user) return;

    const all = getUserBookings();
    const active = all.filter(b => !isBookingCancelled(b));
    const now = Date.now();

    const upcoming = active
        .filter(b => b.status !== "مكتمل" && bookingTimestamp(b) >= now)
        .sort((a, b) => bookingTimestamp(a) - bookingTimestamp(b));

    const past = active.filter(b => b.status === "مكتمل" || bookingTimestamp(b) < now);

    // الكروت
    setTextById("bookingsCount", all.length);
    setTextById("examinationsCount", past.length);

    setTextById(
        "upcomingBookings",
        upcoming.length ? `${upcoming.length} حجز قادم` : "لا توجد حجوزات قادمة"
    );

    // الموعد القادم
    const next = upcoming[0];
    const statusEl = document.getElementById("nextAppointmentStatus");

    if (!next) {
        setTextById("nextAppointmentDate", "لا يوجد موعد");
        setTextById("nextAppointmentTime", "--");
        setTextById("nextAppointmentStatus", "--");
        if (statusEl) statusEl.className = "badge bg-secondary align-self-start";
        return;
    }

    const dateText = new Date(`${next.date}T00:00:00`).toLocaleDateString("ar-EG");

    setTextById("nextAppointmentDate", dateText);
    setTextById("nextAppointmentTime", `${next.time || ""} - ${next.specialty || ""}`);

    let label = "بانتظار تأكيد العيادة";
    let cls = "badge bg-warning text-dark align-self-start";

    if (next.status === "مؤكد") {
        label = "تم تأكيد الحجز";
        cls = "badge bg-success align-self-start";
    } else if (next.paymentStatus === "simulated_failed") {
        label = "فشل الدفع";
        cls = "badge bg-danger align-self-start";
    } else if (next.paymentStatus === "simulated_success") {
        label = "تم الدفع - بانتظار تأكيد العيادة";
        cls = "badge bg-info text-dark align-self-start";
    }

    setTextById("nextAppointmentStatus", label);
    if (statusEl) statusEl.className = cls;
}

// تحديث البيانات لو رجع المستخدم للصفحة بزر الرجوع
window.addEventListener("pageshow", (event) => {
    if (event.persisted && user) {
        user = getUsers().find(u => String(u.id) === String(currentUserId)) || user;
        displayProfile();
        displayBookings();
    }
});


// تحديث الكروت لما العيادة تغيّر حالة الحجز (من تبويب تاني)
window.addEventListener("storage", (event) => {
    if (event.key === "bookings" && user) displayBookings();
});