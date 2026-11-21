// ===============================
// Patients Data
// ===============================

let patients = [
    {
        id: 1,
        name: "Ahmed Mohamed",
        email: "ahmed@gmail.com",
        phone: "01012345678",
        birth: "2002-05-15",
        gender: "ذكر",
        address: "Giza, Egypt"
    },
    {
        id: 2,
        name: "Mohamed Ali",
        email: "mohamed@gmail.com",
        phone: "01112345678",
        birth: "2001-08-20",
        gender: "ذكر",
        address: "Cairo, Egypt"
    }
];

// ===============================
// Load Data From Local Storage
// ===============================

let savedPatients = localStorage.getItem("patients");

if (savedPatients) {
    patients = JSON.parse(savedPatients);
}

// تحديد المريض الحالي
let currentPatientId = 1;

let patient = patients.find(p => p.id === currentPatientId);

// ===============================
// Display Patient Profile
// ===============================

function displayProfile() {

    if (!patient) return;

    document.getElementById("patientName").textContent = patient.name;
    document.getElementById("patientEmail").textContent = patient.email;
    document.getElementById("patientPhone").textContent = patient.phone;
    document.getElementById("patientBirth").textContent = patient.birth;
    document.getElementById("patientGender").textContent = patient.gender;
    document.getElementById("patientAddress").textContent = patient.address;

    document.getElementById("profileDisplayName").textContent = patient.name;
}

displayProfile();

// ===============================
// Edit Patient Profile
// ===============================

function editProfile() {

    if (!patient) return;

    document.getElementById("editName").value = patient.name;
    document.getElementById("editEmail").value = patient.email;
    document.getElementById("editPhone").value = patient.phone;
    document.getElementById("editBirth").value = patient.birth;
    document.getElementById("editGender").value = patient.gender;
    document.getElementById("editAddress").value = patient.address;

    document.getElementById("editProfileCard").classList.remove("d-none");
}

// ===============================
// Save Patient Profile
// ===============================

function saveProfile() {

    let name = document.getElementById("editName").value.trim();
    let email = document.getElementById("editEmail").value.trim();
    let phone = document.getElementById("editPhone").value.trim();
    let birth = document.getElementById("editBirth").value.trim();
    let gender = document.getElementById("editGender").value;
    let address = document.getElementById("editAddress").value.trim();

    if (!name || !email || !phone || !birth || !gender || !address) {
        alert("من فضلك املأ جميع البيانات");
        return;
    }

    // تحديث بيانات المريض
    patient.name = name;
    patient.email = email;
    patient.phone = phone;
    patient.birth = birth;
    patient.gender = gender;
    patient.address = address;

    // تحديث المريض داخل Array
    let patientIndex = patients.findIndex(p => p.id === currentPatientId);

    if (patientIndex !== -1) {
        patients[patientIndex] = patient;
    }

    // حفظ البيانات
    localStorage.setItem("patients", JSON.stringify(patients));

    // عرض البيانات الجديدة
    displayProfile();

    // إخفاء نافذة التعديل
    document.getElementById("editProfileCard").classList.add("d-none");

    alert("تم تحديث بياناتك بنجاح");
}

// ===============================
// Cancel Edit
// ===============================

function cancelEdit() {

    document.getElementById("editProfileCard").classList.add("d-none");
}