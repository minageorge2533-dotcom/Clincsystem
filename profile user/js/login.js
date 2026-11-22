// ======================================
// 1. Get HTML Elements
// ======================================

const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");
const togglePasswordBtn = document.getElementById("togglePassword");
const forgotLink = document.getElementById("forgotPassword");
const formMessage = document.getElementById("formMessage");
const submitBtn = form.querySelector(".submit-btn");
const usersList = document.getElementById("rememberedUsers");

const usernameError = document.getElementById("usernameError");
const passwordError = document.getElementById("passwordError");


// ======================================
// 2. Constants
// ======================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// اسم صفحة البروفايل (لازم يطابق اسم الملف عندك بالظبط)
const PROFILE_PATH = "profil user.html";

const REMEMBERED_KEY = "rememberedEmails";


// ======================================
// 3. Messages & Field Errors
// ======================================

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function setFieldError(errorEl, text) {
  errorEl.textContent = text;
  const field = errorEl.closest(".field");
  if (field) field.classList.add("has-error");
}

function clearFieldError(errorEl) {
  errorEl.textContent = "";
  const field = errorEl.closest(".field");
  if (field) field.classList.remove("has-error");
}


// ======================================
// 4. Storage Helpers
// ======================================

// قراءة مصفوفة المستخدمين بشكل آمن
function getUsers() {
  try {
    const data = JSON.parse(localStorage.getItem("users"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// الإيميلات المحفوظة (تذكرني)
function getRememberedUsers() {
  try {
    const data = JSON.parse(localStorage.getItem(REMEMBERED_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function addRememberedUser(email) {
  const list = getRememberedUsers();
  if (!list.includes(email)) {
    list.push(email);
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(list));
  }
}

function removeRememberedUser(email) {
  const list = getRememberedUsers().filter((e) => e !== email);
  localStorage.setItem(REMEMBERED_KEY, JSON.stringify(list));
}

function renderSuggestions() {
  if (!usersList) return;
  usersList.innerHTML = "";
  getRememberedUsers().forEach((email) => {
    const option = document.createElement("option");
    option.value = email;
    usersList.appendChild(option);
  });
}

// حفظ المستخدم الحالي ليقرأه صفحة البروفايل
function saveSession(user) {
  localStorage.setItem("currentUserId", user.id);
}

renderSuggestions();


// ======================================
// 5. Password Hashing (نفس طريقة التسجيل بالظبط)
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
        salt.match(/.{2}/g).map((byte) => parseInt(byte, 16))
      ),
      iterations: 150000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}


// ======================================
// 6. Login User (Check Against Users Array)
// ======================================

async function loginUser(emailValue, password) {
  try {
    if (!window.crypto || !crypto.subtle) {
      return { ok: false, error: "NO_CRYPTO" };
    }

    const email = emailValue.trim().toLowerCase();
    const users = getUsers();

    // البحث عن المستخدم بالإيميل
    const user = users.find(
      (u) => (u.email || "").toLowerCase() === email
    );

    if (!user || !user.salt || !user.passwordHash) {
      return { ok: false, error: "INVALID" };
    }

    // عمل hash للباسورد المدخل بنفس الـ salt ومقارنته
    const hash = await hashPassword(password, user.salt);

    if (hash !== user.passwordHash) {
      return { ok: false, error: "INVALID" };
    }

    return { ok: true, user: user };

  } catch (error) {
    console.error("Login Error:", error);
    return { ok: false, error: "LOGIN_ERROR" };
  }
}


// ======================================
// 7. Page Events
// ======================================

window.addEventListener("pageshow", () => {
  form.reset();
});

if (new URLSearchParams(location.search).get("registered") === "1") {
  showMessage("تم إنشاء حسابك بنجاح، يمكنك الآن تسجيل الدخول.", "success");
}

togglePasswordBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.classList.toggle("is-visible", isHidden);
  togglePasswordBtn.setAttribute("aria-pressed", String(isHidden));
  togglePasswordBtn.setAttribute(
    "aria-label",
    isHidden ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
  );
});

forgotLink.addEventListener("click", (e) => {
  e.preventDefault();
  showMessage(
    "استعادة كلمة المرور غير متاحة في النسخة التجريبية، وتحتاج إلى Backend.",
    "info"
  );
});

usernameInput.addEventListener("input", () => {
  clearFieldError(usernameError);
  clearMessage();
});

passwordInput.addEventListener("input", () => {
  clearFieldError(passwordError);
  clearMessage();
});


// ======================================
// 8. Validate Form
// ======================================

function validateForm() {
  let isValid = true;

  const email = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!email) {
    setFieldError(usernameError, "يرجى إدخال البريد الإلكتروني.");
    isValid = false;
  } else if (!EMAIL_REGEX.test(email)) {
    setFieldError(usernameError, "يرجى إدخال بريد إلكتروني صحيح.");
    isValid = false;
  } else {
    clearFieldError(usernameError);
  }

  if (!password) {
    setFieldError(passwordError, "يرجى إدخال كلمة المرور.");
    isValid = false;
  } else {
    clearFieldError(passwordError);
  }

  return isValid;
}


// ======================================
// 9. Submit Form
// ======================================

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!validateForm()) {
    showMessage("البيانات غير مكتملة، يرجى مراجعة الحقول المطلوبة.", "error");
    return;
  }

  submitBtn.disabled = true;

  const result = await loginUser(usernameInput.value, passwordInput.value);

  if (!result.ok) {
    submitBtn.disabled = false;

    if (result.error === "NO_CRYPTO") {
      showMessage(
        "المتصفح لا يدعم التشفير هنا. افتح الصفحة عبر https أو localhost.",
        "error"
      );
    } else if (result.error === "LOGIN_ERROR") {
      showMessage("حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.", "error");
    } else {
      showMessage("البريد الإلكتروني أو كلمة المرور غير صحيحة.", "error");
    }
    return;
  }

  // حفظ المستخدم الحالي
  saveSession(result.user);

  // تذكرني
  if (rememberMe && rememberMe.checked) {
    addRememberedUser(result.user.email);
  } else {
    removeRememberedUser(result.user.email);
  }
  renderSuggestions();

  showMessage(
    `أهلاً ${result.user.fullName}، تم تسجيل الدخول بنجاح.`,
    "success"
  );

  // الانتقال لصفحة البروفايل الخاصة بالمستخدم
  setTimeout(() => {
    location.replace(PROFILE_PATH);
  }, 1000);
});