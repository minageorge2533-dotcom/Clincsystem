// ======================================
// 1. Get HTML Elements
// ======================================

const form = document.getElementById("signupForm");

const fullNameInput = document.getElementById("fullName");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const termsInput = document.getElementById("terms");

const formMessage = document.getElementById("formMessage");
const submitBtn = form.querySelector(".submit-btn");

const errors = {
    fullName: document.getElementById("fullNameError"),
    phone: document.getElementById("phoneError"),
    email: document.getElementById("emailError"),
    password: document.getElementById("passwordError"),
    confirmPassword: document.getElementById("confirmPasswordError"),
    terms: document.getElementById("termsError")
};


// ======================================
// 2. Constants
// ======================================

const MIN_PASSWORD_LENGTH = 8;
const PHONE_REGEX = /^01[0125][0-9]{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


// ======================================
// 3. Messages
// ======================================

function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
}

function clearMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
}


// ======================================
// 4. Field Errors
// ======================================

function setFieldError(key, text) {
    const el = errors[key];
    el.textContent = text;

    const field = el.closest(".field");
    if (field) field.classList.add("has-error");
}

function clearFieldError(key) {
    const el = errors[key];
    el.textContent = "";

    const field = el.closest(".field");
    if (field) field.classList.remove("has-error");
}


// ======================================
// 5. Helpers
// ======================================

// تحويل الأرقام العربية إلى إنجليزية
function normalizeDigits(str) {
    return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

// قراءة مصفوفة المستخدمين بشكل آمن (لو البيانات تالفة يرجع مصفوفة فاضية)
function getUsers() {
    try {
        const data = JSON.parse(localStorage.getItem("users"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}


// ======================================
// 6. Show / Hide Password
// ======================================

document.querySelectorAll(".toggle-password").forEach(btn => {

    btn.addEventListener("click", () => {

        const input = document.getElementById(btn.dataset.target);
        const isHidden = input.type === "password";

        input.type = isHidden ? "text" : "password";

        btn.classList.toggle("is-visible", isHidden);
        btn.setAttribute("aria-pressed", String(isHidden));
        btn.setAttribute(
            "aria-label",
            isHidden ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
        );

    });

});


// ======================================
// 7. Clear Errors While Typing
// ======================================

[
    ["fullName", fullNameInput],
    ["phone", phoneInput],
    ["email", emailInput],
    ["password", passwordInput],
    ["confirmPassword", confirmInput]
].forEach(([key, input]) => {

    input.addEventListener("input", () => {
        clearFieldError(key);
        clearMessage();
    });

});

termsInput.addEventListener("change", () => {
    clearFieldError("terms");
    clearMessage();
});


// ======================================
// 8. Validate Form
// ======================================

function validateForm() {

    let isValid = true;

    const fullName = fullNameInput.value.trim();
    const phone = normalizeDigits(phoneInput.value.trim());
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    // Full Name
    if (fullName.length < 3) {
        setFieldError("fullName", "يرجى إدخال الاسم بالكامل.");
        isValid = false;
    } else {
        clearFieldError("fullName");
    }

    // Phone
    if (!PHONE_REGEX.test(phone)) {
        setFieldError("phone", "رقم الموبايل غير صحيح.");
        isValid = false;
    } else {
        clearFieldError("phone");
    }

    // Email
    if (!EMAIL_REGEX.test(email)) {
        setFieldError("email", "يرجى إدخال بريد إلكتروني صحيح.");
        isValid = false;
    } else {
        clearFieldError("email");
    }

    // Password
    if (password.length < MIN_PASSWORD_LENGTH) {
        setFieldError(
            "password",
            `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف.`
        );
        isValid = false;
    } else {
        clearFieldError("password");
    }

    // Confirm Password
    if (!confirm) {
        setFieldError("confirmPassword", "يرجى تأكيد كلمة المرور.");
        isValid = false;
    } else if (confirm !== password) {
        setFieldError("confirmPassword", "كلمتا المرور غير متطابقتين.");
        isValid = false;
    } else {
        clearFieldError("confirmPassword");
    }

    // Terms
    if (!termsInput.checked) {
        setFieldError("terms", "يجب الموافقة على الشروط والأحكام.");
        isValid = false;
    } else {
        clearFieldError("terms");
    }

    return isValid;
}


// ======================================
// 9. Password Hashing
// ======================================

async function hashPassword(password, salt) {

    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const hash = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: Uint8Array.from(
                salt.match(/.{2}/g).map(byte => parseInt(byte, 16))
            ),
            iterations: 150000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}


// ======================================
// 10. Register New User
// ======================================

async function registerUser(userData) {

    try {

        // Check browser crypto support
        if (!window.crypto || !crypto.subtle) {
            return { ok: false, error: "NO_CRYPTO" };
        }

        // Get the big users array (each user is its own object)
        const users = getUsers();

        const email = userData.email.trim().toLowerCase();

        // Check duplicate email
        const emailExists = users.some(u =>
            (u.email || "").toLowerCase() === email
        );

        if (emailExists) {
            return { ok: false, error: "EMAIL_EXISTS" };
        }

        // Check duplicate phone
        const phoneExists = users.some(u => u.phone === userData.phone);

        if (phoneExists) {
            return { ok: false, error: "PHONE_EXISTS" };
        }

        // Create salt
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");

        // Hash password
        const passwordHash = await hashPassword(userData.password, salt);

        // Create the new user object
        const newUser = {
            id: crypto.randomUUID(),
            fullName: userData.fullName,
            phone: userData.phone,
            email: email,
            passwordHash: passwordHash,
            salt: salt,
            birth: "",
            gender: "",
            address: ""
        };

        // Add the user to the array and save it
        users.push(newUser);
        localStorage.setItem("users", JSON.stringify(users));

        return { ok: true, user: newUser };

    } catch (error) {

        console.error("Registration Error:", error);
        return { ok: false, error: "SAVE_ERROR" };

    }
}


// ======================================
// 11. Submit Form
// ======================================

form.addEventListener("submit", async (e) => {

    e.preventDefault();
    clearMessage();

    // Validate
    if (!validateForm()) {
        showMessage("البيانات غير مكتملة، يرجى مراجعة الحقول.", "error");
        return;
    }

    submitBtn.disabled = true;

    // Register user
    const result = await registerUser({
        fullName: fullNameInput.value.trim(),
        phone: normalizeDigits(phoneInput.value.trim()),
        email: emailInput.value.trim(),
        password: passwordInput.value
    });

    // Handle errors
    if (!result.ok) {

        submitBtn.disabled = false;

        if (result.error === "EMAIL_EXISTS") {

            setFieldError("email", "هذا البريد مسجّل بالفعل.");
            showMessage("هذا البريد الإلكتروني مستخدم من قبل.", "error");

        } else if (result.error === "PHONE_EXISTS") {

            setFieldError("phone", "رقم الموبايل مسجّل بالفعل.");
            showMessage("رقم الموبايل مستخدم من قبل.", "error");

        } else if (result.error === "NO_CRYPTO") {

            showMessage(
                "المتصفح لا يدعم التشفير. افتح الموقع عبر localhost.",
                "error"
            );

        } else {

            showMessage("تعذر حفظ الحساب، يرجى المحاولة مرة أخرى.", "error");

        }

        return;
    }

    // Save the id of the user who just signed up
    localStorage.setItem("currentUserId", result.user.id);

    showMessage(
        "تم إنشاء الحساب بنجاح! جاري فتح صفحتك الشخصية...",
        "success"
    );

    // Go to the profile page of the new user
    setTimeout(() => {
        location.replace("profil user.html");
    }, 1500);

});