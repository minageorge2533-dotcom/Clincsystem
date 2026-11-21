


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
  terms: document.getElementById("termsError"),
};

const MIN_PASSWORD_LENGTH = 8;
const PHONE_REGEX = /^01[0125][0-9]{8}$/;         
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

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

function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

document.querySelectorAll(".toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const isHidden = input.type === "password";

    input.type = isHidden ? "text" : "password";
    btn.classList.toggle("is-visible", isHidden);
    btn.setAttribute("aria-pressed", String(isHidden));
    btn.setAttribute("aria-label", isHidden ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  });
});

[
  ["fullName", fullNameInput],
  ["phone", phoneInput],
  ["email", emailInput],
  ["password", passwordInput],
  ["confirmPassword", confirmInput],
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

function validateForm() {
  let isValid = true;

  const fullName = fullNameInput.value.trim();
  const phone = normalizeDigits(phoneInput.value.trim());
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  if (fullName.length < 3) {
    setFieldError("fullName", "يرجى إدخال الاسم بالكامل.");
    isValid = false;
  } else clearFieldError("fullName");

  if (!PHONE_REGEX.test(phone)) {
    setFieldError("phone", "رقم الموبايل غير صحيح (مثال: 01012345678).");
    isValid = false;
  } else clearFieldError("phone");

  if (!EMAIL_REGEX.test(email)) {
    setFieldError("email", "يرجى إدخال بريد إلكتروني صحيح.");
    isValid = false;
  } else clearFieldError("email");

  if (password.length < MIN_PASSWORD_LENGTH) {
    setFieldError("password", `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف.`);
    isValid = false;
  } else clearFieldError("password");

  if (!confirm) {
    setFieldError("confirmPassword", "يرجى تأكيد كلمة المرور.");
    isValid = false;
  } else if (confirm !== password) {
    setFieldError("confirmPassword", "كلمتا المرور غير متطابقتين.");
    isValid = false;
  } else clearFieldError("confirmPassword");

  // 6) الشروط
  if (!termsInput.checked) {
    setFieldError("terms", "يجب الموافقة على الشروط والأحكام للمتابعة.");
    isValid = false;
  } else clearFieldError("terms");

  return isValid;
}

 form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!validateForm()) {
    showMessage("البيانات غير مكتملة، يرجى مراجعة الحقول المطلوبة.", "error");
    return;
  }

  submitBtn.disabled = true; 

   const result = await registerUser({
    fullName: fullNameInput.value.trim(),
    phone: normalizeDigits(phoneInput.value.trim()),
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  if (!result.ok) {
    submitBtn.disabled = false;

    if (result.error === "EMAIL_EXISTS") {
      setFieldError("email", "هذا البريد مسجّل بالفعل، يمكنك تسجيل الدخول به.");
      showMessage("لا يمكن إنشاء الحساب، البريد مستخدم من قبل.", "error");
    } else if (result.error === "NO_CRYPTO") {
      showMessage("المتصفح لا يدعم التشفير هنا. افتح الصفحة عبر https أو localhost.", "error");
    } else {
      showMessage("تعذر حفظ الحساب، يرجى المحاولة مرة أخرى.", "error");
    }
    return;
  }

  addRememberedUser(emailInput.value);

  showMessage("تم إنشاء الحساب بنجاح! جارٍ تحويلك لتسجيل الدخول...", "success");

  setTimeout(() => {
    location.href = "index.html?registered=1";
  }, 1500);
});
