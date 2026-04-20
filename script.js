const API_URL = "https://crm.skch.cz/ajax0/procedure2.php"; 
const AUTH = "Basic " + btoa("coffe:kafe");

let state = {
    selectedUser: localStorage.getItem('lastUser') || getCookie('lastUser') || "",
    drinks: {}
};

let toastTimeout;
function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

async function callApi(cmd, method = "GET", body = null) {
    const options = {
        method: method,
        headers: {
            "Authorization": AUTH,
            "Content-Type": "application/json"
        }
    };

    if (method === "POST" && body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_URL}?cmd=${cmd}`, options);
    const responseText = await res.text();
    console.log(`Debug serveru (${cmd}):`, responseText);

    if (!res.ok) throw new Error(`HTTP chyba ${res.status}`);
    
    if (responseText.toLowerCase().includes("err") || responseText.toLowerCase().includes("chyba")) {
        throw new Error(`Server hlasi chybu: ${responseText}`);
    }

    try {
        return JSON.parse(responseText);
    } catch(e) {
        return responseText;
    }
}

async function init() {
    try {
        const users = await callApi("getPeopleList");
        renderUsers(users);

        const types = await callApi("getTypesList");
        renderDrinks(types);

        syncOfflineData();

    } catch (err) {
        console.error("Chyba v init:", err);
        showToast("Nelze nacist data z API. Jste offline?", "error");
    }
}

function renderUsers(usersData) {
    const select = document.getElementById('userSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Vyberte jmeno...</option>';
    
    const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);

    usersArray.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.ID || u.id; 
        opt.textContent = u.name;
        if (opt.value == state.selectedUser) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = (e) => {
        const val = e.target.value;
        state.selectedUser = val;
        localStorage.setItem('lastUser', val);
        document.cookie = `lastUser=${val}; max-age=31536000; path=/`;
    };
}

function renderDrinks(typesData) {
    const container = document.getElementById('drinksContainer');
    if (!container) return;
    container.innerHTML = "";
    
    const typesArray = Array.isArray(typesData) ? typesData : Object.values(typesData);

    typesArray.forEach(tObj => {
        const tName = tObj.typ || tObj.name || tObj; 
        state.drinks[tName] = 0; 

        const row = document.createElement('div');
        row.className = 'drink-row';
        row.innerHTML = `
            <span class="drink-name">${tName}</span>
            <div class="controls">
                <button type="button" class="btn-round" onclick="changeVal('${tName}', -1)">-</button>
                <span class="count" id="val-${tName}">0</span>
                <button type="button" class="btn-round" onclick="changeVal('${tName}', 1)">+</button>
            </div>
        `;
        container.appendChild(row);
    });
}

window.changeVal = (name, amount) => {
    state.drinks[name] = Math.max(0, state.drinks[name] + amount);
    const el = document.getElementById(`val-${name}`);
    if (el) el.innerText = state.drinks[name];
};

// --- ODESILANI FORMULARE ---
document.getElementById('coffeeForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    if (!state.selectedUser) {
        showToast("Prosim, vyberte uzivatele.", "error");
        return;
    }

    const drinksArray = Object.keys(state.drinks).map(key => ({
        type: key,
        value: state.drinks[key]
    }));

    const payload = {
        user: state.selectedUser,
        drinks: drinksArray
    };

    const maNeco = drinksArray.some(d => d.value > 0);
    if (!maNeco) {
        showToast("Zadej alespon jeden vypity napoj.", "warning");
        return;
    }

    showToast("Odesilam...", "info");

    try {
        if (!navigator.onLine) throw new Error("Offline");

        await callApi("saveDrinks", "POST", payload);

        showToast("Zaznam uspesne odeslan!", "success");
        resetForm();

    } catch (err) {
        console.error("Chyba odesilani, ukladam lokalne:", err.message);
        saveOfflineData(payload);
        showToast("Offline rezim. Data se odeslou pozdeji.", "warning");
        resetForm();
    }
});

function resetForm() {
    for (const key in state.drinks) {
        state.drinks[key] = 0;
        const el = document.getElementById(`val-${key}`);
        if (el) el.innerText = "0";
    }
}

function saveOfflineData(payload) {
    let records = JSON.parse(localStorage.getItem('offlineRecords') || '[]');
    records.push(payload);
    localStorage.setItem('offlineRecords', JSON.stringify(records));
}

async function syncOfflineData() {
    let records = JSON.parse(localStorage.getItem('offlineRecords') || '[]');
    if (records.length === 0) return;
    
    if (!navigator.onLine) return; 

    const remainingRecords = []; 
    let successCount = 0;

    for (const payload of records) {
        try {
            await callApi("saveDrinks", "POST", payload);
            console.log("Uspesne dosynchronizovan zaznam:", payload);
            successCount++;
        } catch (err) {
            console.error("Nepovedlo se synchronizovat:", err.message);
            remainingRecords.push(payload); 
        }
    }
    
    localStorage.setItem('offlineRecords', JSON.stringify(remainingRecords));

    if(successCount > 0) {
        showToast(`Uspesne synchronizovano ${successCount} offline zaznamu!`, "success");
    }
}

window.addEventListener('online', () => {
    syncOfflineData();
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

init();