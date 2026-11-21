
const $ = id => document.getElementById(id);

const prices = {
    "كشف أسنان": 200,
    "تنظيف الأسنان": 350,
    "تبييض الأسنان": 1200,
    "تقويم الأسنان": 1500,
    "حشو الأسنان": 500,
    "خلع الأسنان": 400,
    "زراعة الأسنان": 5000
};

const read = key => {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
        return null;
    }
};

const save = (key, data) =>
    localStorage.setItem(key, JSON.stringify(data));

const money = price => `${price || 0} جنيه`;

const showMessage = (id, message, type = "error") => {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.className = `message ${type}`;
};

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const bookingCode = () =>
    String(Math.floor(100000 + Math.random() * 900000));

// صفحة حجز الموعد
if ($("bookingForm")) {
    const form = $("bookingForm");
    const date = $("date");

    if (date) date.min = today();

    const updateSummary = () => {
        const data = {
            name: $("patientName")?.value.trim() || "",
            phone: $("phone")?.value.trim() || "",
            specialty: $("specialty")?.value || "",
            clinic: $("clinic")?.value || "",
            date: date?.value || "",
            time: $("time")?.value || "",
            reason: $("reason")?.value.trim() || ""
        };

        $("sumName").textContent = data.name || "—";
        $("sumSpecialty").textContent = data.specialty || "—";
        $("sumClinic").textContent = data.clinic || "—";
        $("sumDate").textContent = data.date || "—";
        $("sumTime").textContent = data.time || "—";
        $("sumPrice").textContent = money(prices[data.specialty]);

        return data;
    };

    form.addEventListener("input", updateSummary);
    form.addEventListener("change", updateSummary);

    form.addEventListener("submit", e => {
        e.preventDefault();

        const data = updateSummary();

        if (!prices[data.specialty]) {
            return showMessage("bookingMessage", "اختار التخصص أو الخدمة المطلوبة.");
        }

        if (data.date < today()) {
            return showMessage("bookingMessage", "اختار تاريخ صحيح.");
        }

        data.price = prices[data.specialty];
        save("draft", data);
        location.href = "payment.html";
    });

    updateSummary();
}

