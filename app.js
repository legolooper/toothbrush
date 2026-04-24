const dbName = "GameStorageDB";
let db, games =[], currentGame = null;

async function initDB() {
    return new Promise(r => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore("customGames", { keyPath: "id" });
        req.onsuccess = e => { db = e.target.result; r(); };
    });
}

async function loadGames() {
    await initDB();
    const tx = db.transaction("customGames", "readonly");
    const custom = await new Promise(r => {
        const req = tx.objectStore("customGames").getAll();
        req.onsuccess = () => r(req.result);
    });
    try {
        const res = await fetch('games.json?t=' + Date.now());
        const defaults = await res.json();
        games = [...defaults, ...custom];
    } catch { games = [...custom]; }
    renderGameList();
}

function renderGameList() {
    const list = document.getElementById('game-list');
    if (!list) return;
    list.innerHTML = '';
    games.forEach((game, i) => {
        const li = document.createElement('li');
        
        // Apply custom colors based on ID
        if (game.id === "tutorial") li.classList.add('tutorial-item');
        if (game.id === "ugs-stash") li.classList.add('ugs-item');
        
        const t = document.createElement('span');
        t.textContent = game.title; t.style.flex = "1";
        t.onclick = () => loadGame(game);
        li.appendChild(t);
        if (game.id.toString().startsWith('custom_')) {
            const del = document.createElement('span');
            del.innerHTML = "🗑️"; del.className = "trash-btn";
            del.onclick = (e) => { e.stopPropagation(); deleteGame(game.id, i); };
            li.appendChild(del);
        }
        list.appendChild(li);
    });
}

function loadGame(game) {
    currentGame = game;
    const frame = document.getElementById('game-frame');
    const emergencyBtn = document.getElementById('emergency-open-btn');
    
    // Force visibility in case school CSS extensions try to hide it
    frame.style.setProperty('display', 'block', 'important');
    frame.style.setProperty('visibility', 'visible', 'important');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
    
    // Show Emergency Open button
    if (emergencyBtn) emergencyBtn.style.display = 'inline-flex';

    if (game.type === 'file') {
        const base64Data = game.content.split(',')[1];
        let htmlContent;
        try { htmlContent = atob(base64Data); } catch(e) { return alert("File corrupted."); }
        
        const persistenceScript = `<script>try{window.localStorage.setItem('p','1');}catch(e){}<\/script>`;
        const finalHTML = persistenceScript + htmlContent;

        // TIER 1: Try srcdoc (Best for saves)
        try {
            frame.srcdoc = finalHTML;
        } catch (err1) {
            console.warn("srcdoc blocked by school policy. Trying Blob...");
            // TIER 2: Try Blob URL (Good for saves, sometimes blocked)
            try {
                const blob = new Blob([finalHTML], {type: 'text/html'});
                frame.removeAttribute('srcdoc');
                frame.src = URL.createObjectURL(blob);
            } catch (err2) {
                console.warn("Blobs blocked by school policy. Trying Data URI...");
                // TIER 3: Try Data URI (Bad for saves, but guarantees the game plays)
                frame.removeAttribute('srcdoc');
                frame.src = game.content; 
            }
        }
    } else {
        frame.removeAttribute('srcdoc');
        
        // THE PDF FIX: If the file is a PDF, remove the sandbox so Chrome's PDF plugin is allowed to run.
        if (game.url.endsWith('.pdf')) {
            frame.removeAttribute('sandbox');
        }
        
        frame.src = game.url;
    }
}

// Emergency Open Logic (If the iframe is completely broken by the school)
const emgBtn = document.getElementById('emergency-open-btn');
if (emgBtn) {
    emgBtn.onclick = () => {
        if (!currentGame) return;
        const win = window.open();
        if (!win) return alert("Allow popups for emergency open!");
        
        if (currentGame.type === 'file') {
            win.document.write(atob(currentGame.content.split(',')[1]));
        } else {
            win.location.href = currentGame.url;
        }
    };
}

const addGameBtn = document.getElementById('add-game-btn');
if (addGameBtn) {
    addGameBtn.onclick = () => {
        const title = document.getElementById('new-game-title').value;
        const file = document.getElementById('new-game-file').files[0];
        if (!title || !file) return alert("Missing data");
        const reader = new FileReader();
        reader.onload = async e => {
            const newG = { id: 'custom_' + Date.now(), title, type: 'file', content: e.target.result };
            const tx = db.transaction("customGames", "readwrite");
            tx.objectStore("customGames").put(newG);
            games.push(newG); renderGameList();
        };
        reader.readAsDataURL(file);
    };
}

async function deleteGame(id, index) {
    if (!confirm("Delete permanently?")) return;
    const tx = db.transaction("customGames", "readwrite");
    await tx.objectStore("customGames").delete(id);
    games.splice(index, 1); renderGameList();
}

// Chromebook Universal Tab Killer
function killMainTab() {
    document.title = "New Tab";
    document.body.innerHTML = ""; 
    window.open('', '_self');
    window.close();
    setTimeout(() => { window.location.replace("https://classroom.google.com"); }, 300);
}

const cloakBtn = document.getElementById('cloak-btn');
if (cloakBtn) {
    cloakBtn.onclick = () => {
        if (!currentGame) return alert("Select game");
        const win = window.open('about:blank', '_blank');
        const gameSrc = currentGame.type === 'file' ? URL.createObjectURL(new Blob([atob(currentGame.content.split(',')[1])], {type:'text/html'})) : currentGame.url;
        win.document.title = "My Drive - Google Drive";
        const link = win.document.createElement('link'); link.rel = 'icon'; link.href = 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png';
        win.document.head.appendChild(link);
        const ifr = win.document.createElement('iframe');
        Object.assign(ifr.style, { position:'fixed', top:0, left:0, width:'100%', height:'100%', border:'none' });
        ifr.src = gameSrc; win.document.body.appendChild(ifr);
        
        killMainTab();
    };
}

const proxyBtn = document.getElementById('proxy-btn');
if (proxyBtn) {
    proxyBtn.onclick = () => {
        // Fallback robust proxy link that resists school blocks (szns.us).
        // Since many proxies block iframes, we open directly in a new tab but still use killMainTab to hide evidence on the main site.
        const win = window.open('https://szns.us/', '_blank');
        if (!win) return alert("Pop-up Blocked! Please allow pop-ups.");
        
        killMainTab();
    };
}

const exportBtn = document.getElementById('export-btn');
if (exportBtn) {
    exportBtn.onclick = async () => {
        const tx = db.transaction('customGames', 'readonly');
        const customGames = await new Promise(r => {
            const req = tx.objectStore('customGames').getAll();
            req.onsuccess = () => r(req.result);
        });

        // 1. Grab all localStorage (Drive Mad style)
        const allSaves = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            allSaves[key] = localStorage.getItem(key);
        }

        // 2. Grab all IndexedDB data (Undertale / Unity style)
        const idbData = {};
        const dbs = await window.indexedDB.databases();
        for (let dbInfo of dbs) {
            if (dbInfo.name === "GameStorageDB") continue; // Skip our app's own database
            
            const gameDB = await new Promise(res => {
                const req = indexedDB.open(dbInfo.name);
                req.onsuccess = () => res(req.result);
            });

            const dbContent = {};
            for (let storeName of gameDB.objectStoreNames) {
                const storeTx = gameDB.transaction(storeName, 'readonly');
                dbContent[storeName] = await new Promise(res => {
                    storeTx.objectStore(storeName).getAll().onsuccess = e => res(e.target.result);
                });
            }
            idbData[dbInfo.name] = dbContent;
            gameDB.close();
        }

        const backupData = { saves: allSaves, indexedData: idbData, games: customGames };
        const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'toothbrush_backup.json';
        a.click();
    };
}

const importBtn = document.getElementById('import-btn');
if (importBtn) {
    importBtn.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const data = JSON.parse(ev.target.result);
            
            // 1. Restore localStorage
            if (data.saves) {
                Object.keys(data.saves).forEach(k => localStorage.setItem(k, data.saves[k]));
            }

            // 2. Restore Custom Games
            if (data.games) {
                const tx = db.transaction('customGames', 'readwrite');
                data.games.forEach(g => tx.objectStore('customGames').put(g));
            }

            // 3. Restore IndexedDB (The "Undertale Fix")
            if (data.indexedData) {
                for (let dbName in data.indexedData) {
                    const dbRequest = indexedDB.open(dbName);
                    dbRequest.onupgradeneeded = (event) => {
                        for (let storeName in data.indexedData[dbName]) { event.target.result.createObjectStore(storeName); }
                    };
                    const openedDB = await new Promise(res => { dbRequest.onsuccess = () => res(dbRequest.result); });
                    for (let storeName in data.indexedData[dbName]) {
                        const storeTx = openedDB.transaction(storeName, 'readwrite');
                        data.indexedData[dbName][storeName].forEach(item => storeTx.objectStore(storeName).put(item));
                    }
                    openedDB.close();
                }
            }
            
            alert("Restore Complete! Reloading site...");
            location.reload();
        };
        reader.readAsText(e.target.files[0]);
    };
}

const splashes =[
    "\"Assisted by Jayden!\"", "\"No, please don't close my ta-\"", "\"Wait, wait, I was about to finish the level!\"",
    "\"Prompted to perfection.\"", "\"ALT+F4: The ultimate speedrun tactic.\"", "\"My AI solved the math, I solved the level.\"",
    "\"High scores > GPA.\"", "\"Is it lag, or just the school WiFi?\"", "\"The teacher is coming, hit the Pink button!\"",
    "\"Database authorized.\"", "\"Saving your progress... hopefully.\"", "\"Not a bug, it's a feature.\"",
    "\"Llama-3 made me do it.\"", "\"Powered by pure procrastination.\"", "\"100% human-ish.\"",
    "\"Linewize can't see this.\"", "\"The ultimate study break.\"", "\"Just one more level before the bell.\"",
    "\"0% AI hallucinations, 100% gaming.\"", "\"Your high score is in the database.\"", "\"Strictly for educational purposes...\"",
    "\"Does this count as computer science?\"", "\"Bypassing the boredom.\"", "\"Infinite storage, finite time.\"",
    "\"Don't forget to backup!\"", "\"Restoring sanity, one game at a time.\"", "\"Calculated risks and heavy prompts.\"",
    "\"The AI knows the way.\"", "\"More tabs, more problems.\"", "\"Stealth mode engaged.\"",
    "\"Drive Mad? More like Drive Focused.\"", "\"Everything is unblocked if you try hard enough.\"", "\"Learning to code by playing games.\"",
    "\"Browser-based bliss.\"", "\"The stash is never empty.\"", "\"Level 99 Procrastinator.\"",
    "\"Prompt: 'Make me better at this game'.\"", "\"Error 404: Homework not found.\"", "\"Check your permissions.\"",
    "\"IndexedDB is my best friend.\"", "\"About:blank? Nothing to see here.\"", "\"The code is clean, the high score is not.\"",
    "\"Speedrunning through the semester.\"", "\"Logic applied, levels cleared.\"", "\"The AI said I should take a break.\"",
    "\"One file to rule them all.\"", "\"It's basically a digital library.\"", "\"A student's best kept secret.\"",
    "\"Don't close the lid yet!\"", "\"Frames per second > words per minute.\"", "\"GPT-4o approved.\"",
    "\"Your progress is persistent.\"", "\"Toothbrush Tutorial is mandatory reading.\"", "\"The sidebar of secrets.\"",
    "\"Cloak active. Icons changed.\"", "\"Memory leak? Never heard of her.\"", "\"HTML5: The future of study hall.\"",
    "\"Wait, did I save?\"", "\"The AI is my co-pilot.\"", "\"Simulating success.\"",
    "\"Pixel-perfect procrastination.\"", "\"Unblocked and unbothered.\"", "\"School computers are just gaming rigs in disguise.\"",
    "\"Loading a better reality.\"", "\"The Cloak button is your shield.\"", "\"Database synced.\"",
    "\"One prompt away from victory.\"", "\"Gaming is a soft skill.\"", "\"The math adds up.\"",
    "\"Why study when you can speedrun?\"", "\"Securely can't see about:blank.\"", "\"A collection of digital treasures.\"",
    "\"AI: 'I suggest playing 2048'.\"", "\"Minimalist interface, maximalist fun.\"", "\"The stash is legendary.\"",
    "\"Your secret is safe with the browser.\"", "\"Click to continue.\"", "\"The bell doesn't dismiss you, I do.\"",
    "\"Context window: Infinite.\"", "\"The PDF is the manual.\"", "\"Optimized for low-end Chromebooks.\"",
    "\"Your saves are in the cloud-ish.\"", "\"Toothbrush: The home of the bored.\"", "\"Synthesizing high scores.\"",
    "\"The AI isn't cheating, it's 'assisting'.\"", "\"Save states are a human right.\"", "\"Don't let the tab timeout!\"",
    "\"The perfect distraction.\"", "\"Bypassing the mundane.\"", "\"Strictly local storage.\"",
    "\"The UI is polished, the games are not.\"", "\"A masterclass in distraction.\"", "\"Wait, I actually need to solve this.\"",
    "\"The AI wrote the code, you play the game.\"", "\"Everything is fine.\"", "\"The final boss of the school year.\"",
    "\"Your progress is our priority.\"", "\"Hardcoded for fun.\"", "\"The stash is ultimate for a reason.\"",
    "\"READ the TUTORIAL!\"", 
    "\"Dead.\"", 
    "\"Wow. Just... wow.\"", 
    "\"Honorable mention: Ctrl+W.\""
]; 

function setSplash() {
    const el = document.getElementById('splash-text');
    if (el) el.textContent = splashes[Math.floor(Math.random() * splashes.length)];
}

loadGames();
window.addEventListener('DOMContentLoaded', setSplash);