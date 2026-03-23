const API_URL = "https://crm.skch.cz/ajax0/procedure.php";
const AUTH = "Basic " + btoa("coffe:kafe");

let state = {
    selectedUser: localStorage.getItem('lastUser') || "",
    drinks: {}
};

async function init() {
    const status = document.getElementById('statusMsg');
    try {
        // 1. Načtení lidí
        const usersRes = await fetch(`${API_URL}?cmd=getPeopleList`, { 
            headers: { 'Authorization': AUTH } 
        });
        const users = await usersRes.json();
        console.log("Lidé načteni:", users); // Pro kontrolu v F12
        renderUsers(users);

        // 2. Načtení nápojů
        const typesRes = await fetch(`${API_URL}?cmd=getTypesList`, { 
            headers: { 'Authorization': AUTH } 
        });
        const types = await typesRes.json();
        console.log("Nápoje načteny:", types); // Pro kontrolu v F12
        renderDrinks(types);

        if(status) status.innerText = ""; 
    } catch (err) {
        console.error("Chyba v init:", err);
        if(status) status.innerText = "Chyba připojení k API. Zkontroluj internet.";
    }
}

function renderUsers(users) {
    const select = document.getElementById('userSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Vyberte jméno...</option>';
    
    users.forEach(u => {
        const opt = document.createElement('option');
        // Pozor: API vrací ID (velkými písmeny)
        opt.value = u.ID || u.id; 
        opt.textContent = u.name;
        if (opt.value == state.selectedUser) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = (e) => localStorage.setItem('lastUser', e.target.value);
}

function renderDrinks(types) {
    const container = document.getElementById('drinksContainer');
    if (!container) return;
    container.innerHTML = "";
    
    types.forEach(tObj => {
        // API vrací objekt s vlastností "typ"
        const tName = tObj.typ || tObj; 
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

// Spuštění aplikace
init();