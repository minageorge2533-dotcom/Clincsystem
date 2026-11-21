
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DASHBOARD_PATH = "dashboard.html";


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

function renderSuggestions() {
  if (!usersList) return;
  usersList.innerHTML = "";
  getRememberedUsers().forEach((email) => {
    const option = document.createElement("option");
    option.value = email;
    usersList.appendChild(option);
  });
}

renderSuggestions();


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
      showMessage("المتصفح لا يدعم التشفير هنا. افتح الصفحة عبر https أو localhost.", "error");
    } else {
      showMessage("البريد الإلكتروني أو كلمة المرور غير صحيحة.", "error");
    }
    return;
  }

  saveSession(result.user);

  if (rememberMe.checked) {
    addRememberedUser(result.user.email);
  } else {
    removeRememberedUser(result.user.email);
  }
  renderSuggestions();

  showMessage(`أهلاً ${result.user.fullName}، تم تسجيل الدخول بنجاح.`, "success");

 
  setTimeout(() => {
    submitBtn.disabled = false;
  }, 1500);
});
