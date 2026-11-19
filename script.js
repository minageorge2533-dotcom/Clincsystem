let patient = {
    name: document.getElementById("patientName").textContent.trim(),
    email: document.getElementById("patientEmail").textContent.trim(),
    phone: document.getElementById("patientPhone").textContent.trim(),
    birth: document.getElementById("patientBirth").textContent.trim(),
    gender: document.getElementById("patientGender").textContent.trim(),
    address: document.getElementById("patientAddress").textContent.trim()
};

// تحميل البيانات المحفوظة
let savedData = localStorage.getItem("patientProfile");

if (savedData) {
    patient = JSON.parse(savedData);
}

// عرض بيانات المريض
function displayProfile() {
    document.getElementById("patientName").textContent = patient.name;
    document.getElementById("patientEmail").textContent = patient.email;
    document.getElementById("patientPhone").textContent = patient.phone;
    document.getElementById("patientBirth").textContent = patient.birth;
    document.getElementById("patientGender").textContent = patient.gender;
    document.getElementById("patientAddress").textContent = patient.address;

    document.getElementById("profileDisplayName").textContent = patient.name;
}

// تشغيل عرض البيانات
displayProfile();

// فتح كارت التعديل
function editProfile() {

    document.getElementById("editName").value = patient.name;
    document.getElementById("editEmail").value = patient.email;
    document.getElementById("editPhone").value = patient.phone;
    document.getElementById("editBirth").value = patient.birth;
    document.getElementById("editGender").value = patient.gender;
    document.getElementById("editAddress").value = patient.address;

    document.getElementById("editProfileCard").classList.remove("d-none");
}

// حفظ التعديلات
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

    patient = {
        name,
        email,
        phone,
        birth,
        gender,
        address
    };

    localStorage.setItem("patientProfile", JSON.stringify(patient));

    displayProfile();

    document.getElementById("editProfileCard").classList.add("d-none");

    alert("تم تحديث بياناتك بنجاح");
}

// إلغاء التعديل
function cancelEdit() {
    document.getElementById("editProfileCard").classList.add("d-none");
}