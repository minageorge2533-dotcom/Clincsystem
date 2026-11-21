


const USERS_KEY = "smile_clinic_users";
const REMEMBERED_KEY = "smile_clinic_remembered_users"; 
const SESSION_KEY = "smile_clinic_current_user";       
const MAX_REMEMBERED = 7;

function readList(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key));
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn("تعذر الحفظ في اللوكال ستوريدج:", err);
    return false;
  }
}


function normalizeEmail(email) {
  return email.trim().toLowerCase();
}


function cryptoAvailable() {
  return !!(window.crypto && window.crypto.subtle);
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function generateSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}


async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}


async function registerUser({ fullName, phone, email, password }) {
  if (!cryptoAvailable()) return { ok: false, error: "NO_CRYPTO" };

  const users = readList(USERS_KEY);
  const cleanEmail = normalizeEmail(email);


  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, error: "EMAIL_EXISTS" };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  
  users.push({
    fullName,
    phone,
    email: cleanEmail,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  if (!writeList(USERS_KEY, users)) return { ok: false, error: "STORAGE_FAILED" };
  return { ok: true };
}


async function loginUser(email, password) {
  if (!cryptoAvailable()) return { ok: false, error: "NO_CRYPTO" };

  const user = readList(USERS_KEY).find((u) => u.email === normalizeEmail(email));
  if (!user) return { ok: false, error: "INVALID" };

  
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { ok: false, error: "INVALID" };

  return { ok: true, user: { fullName: user.fullName, email: user.email } };
}


function saveSession(user) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn("تعذر حفظ الجلسة:", err);
  }
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch (err) {
    return null;
  }
}

function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (err) {
  }
}


function getRememberedUsers() {
  return readList(REMEMBERED_KEY);
}


function addRememberedUser(email) {
  const key = normalizeEmail(email);
  const list = getRememberedUsers().filter((u) => u !== key);
  list.unshift(key);
  writeList(REMEMBERED_KEY, list.slice(0, MAX_REMEMBERED));
}

function removeRememberedUser(email) {
  const key = normalizeEmail(email);
  writeList(REMEMBERED_KEY, getRememberedUsers().filter((u) => u !== key));
}
