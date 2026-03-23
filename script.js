const API_URL = "https://crm.skch.cz/ajax0/procedure.php";
const AUTH = "Basic " + btoa("coffe:kafe");

// Objekt pro sledování stavu aplikace
let state = {
    selectedUser: localStorage.getItem('lastUser') || "",
    drinks: {}
};

// 1. NAČTENÍ DAT PŘI STARTU
async function init() {
    const status = document.getElementById('statusMsg');
    
    try {
        // Načtení lidí
        const usersRes = await fetch(`${API_URL}?cmd=getPeopleList`, { 
            headers: { 'Authorization': AUTH } 
        });
        if (!usersRes.ok) throw new Error("Nelze načíst lidi");
        const users = await usersRes.json();
        renderUsers(users);

        // Načtení drinků
        const typesRes = await fetch(`${API_URL}?cmd=getTypesList`, { 
            headers: { 'Authorization': AUTH } 
        });
        if (!typesRes.ok) throw new Error("Nelze načíst nápoje");
        const types = await typesRes.json();
        renderDrinks(types);

        status.innerText = ""; // Vše ok, smažeme chybu
    } catch (err) {
        console.error(err);
        status.innerText = "Chyba připojení k API. Zkontroluj internet.";
    }
}

// 2. VYKRESLENÍ SEZNAMU UŽIVATELŮ
function renderUsers(users) {
    const select = document.getElementById('userSelect');
    select.innerHTML = '<option value="" disabled selected>Vyberte jméno...</option>';
    
    users.forEach(u => {
        const opt = document.createElement('option');
        // API může vracet ID nebo id, pojistíme se:
        opt.value = u.ID || u.id; 
        opt.textContent = u.name;
        
        // Pokud je to ten poslední uložený, vybereme ho
        if (opt.value == state.selectedUser) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    // Uložíme uživatele při každé změně
    select.onchange = (e) => {
        localStorage.setItem('lastUser', e.target.value);
    };
}

// 3. VYKRESLENÍ NÁPOJŮ (+ a -)
function renderDrinks(types) {
    const container = document.getElementById('drinksContainer');
    container.innerHTML = "";
    
    types.forEach(tObj => {
        const tName = tObj.typ || tObj; // API vrací objekt nebo jen string
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

// Globální funkce pro tlačítka (musí být pod window, aby fungovala z HTML)
window.changeVal = (name, amount) => {
    state.drinks[name] = Math.max(0, state.drinks[name] + amount);
    document.getElementById(`val-${name}`).innerText = state.drinks[name];
};

// 4. ODESLÁNÍ DAT
document.getElementById('coffeeForm').onsubmit = async (e) => {
    e.preventDefault();
    const status = document.getElementById('statusMsg');
    const user = document.getElementById('userSelect').value;

    if (!user) {
        status.innerText = "⚠️ Vyber uživatele!";
        return;
    }

    const payload = {
        user: user,
        drinks: Object.keys(state.drinks).map(name => ({
            type: name,
            value: state.drinks[name]
        }))
    };

    try {
        status.innerText = "Odesílám...";
        const res = await fetch(`${API_URL}?cmd=saveDrinks`, {
            method: 'POST',
            headers: { 
                'Authorization': AUTH,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            status.innerText = "✅ Úspěšně odesláno!";
            resetCounts();
        } else {
            throw new Error("Chyba serveru");
        }
    } catch (err) {
        // Tady je ten slíbený offline režim - uložíme do sessionStorage
        const timestamp = Date.now();
        sessionStorage.setItem(`pending_${timestamp}`, JSON.stringify(payload));
        status.innerText = "☁️ Offline: Uloženo do paměti prohlížeče.";
    }
};

function resetCounts() {
    for (let key in state.drinks) {
        state.drinks[key] = 0;
        const el = document.getElementById(`val-${key}`);
        if (el) el.innerText = 0;
    }
}

init();