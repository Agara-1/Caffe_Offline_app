const API_URL = "https://crm.skch.cz/ajax0/procedure.php";
const AUTH = "Basic " + btoa("coffe:kafe");

let state = {
    selectedUser: localStorage.getItem('lastUser') || getCookie('lastUser') || "",
    drinks: {}
};


async function init() {
    const status = document.getElementById('statusMsg');
    try {

        const usersRes = await fetch(`${API_URL}?cmd=getPeopleList`, { headers: { 'Authorization': AUTH } });
        const users = await usersRes.json();
        renderUsers(users);

        const typesRes = await fetch(`${API_URL}?cmd=getTypesList`, { headers: { 'Authorization': AUTH } });
        const types = await typesRes.json();
        renderDrinks(types);

        if(status) status.innerText = ""; 


        syncOfflineData();

    } catch (err) {
        console.error("Chyba v init (zřejmě offline):", err);
        if(status) status.innerText = "Nelze načíst data z API. Jste offline?";
    }
}

function renderUsers(usersData) {
    const select = document.getElementById('userSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Vyberte jméno...</option>';
    

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


document.getElementById('coffeeForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const status = document.getElementById('statusMsg');

    if (!state.selectedUser) {
        status.innerText = "Prosím, vyberte uživatele.";
        status.style.color = "red";
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

    status.innerText = "Odesílám...";
    status.style.color = "black";

    try {

        const res = await fetch(`${API_URL}?cmd=save`, { 
            method: 'POST',
            headers: { 
                'Authorization': AUTH,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Chyba ze strany serveru.");

        status.innerText = "Záznam úspěšně odeslán!";
        status.style.color = "green";
        resetForm();

    } catch (err) {
        console.error("Nepodařilo se odeslat, ukládám lokálně:", err);
        saveOfflineData(payload);
        status.innerText = "Jste offline. Data se uložila a odešlou se později.";
        status.style.color = "#d97706"; 
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

    const remainingRecords = []; 

    for (const payload of records) {
        try {
            const res = await fetch(`${API_URL}?cmd=save`, { 
                method: 'POST',
                headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error("API selhalo");
            console.log("Úspěšně dosynchronizováno offline záznam:", payload);
            
        } catch (err) {
            remainingRecords.push(payload); 
        }
    }
    if (remainingRecords.length === 0) {
        localStorage.removeItem('offlineRecords');
    } else {
        localStorage.setItem('offlineRecords', JSON.stringify(remainingRecords));
    }
}

window.addEventListener('online', () => {
    const status = document.getElementById('statusMsg');
    if(status) {
        status.innerText = "Znovu připojeno! Odesílám čekající data...";
        status.style.color = "blue";
    }
    syncOfflineData();
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

init();