const dbName = "GameStorageDB";
let db, games = [], currentGame = null;

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
        if (game.id === "tutorial") li.classList.add('tutorial-item');
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
    if (game.type === 'file') {
        const htmlContent = atob(game.content.split(',')[1]);
        frame.srcdoc = `<script>try{window.localStorage.setItem('p','1');}catch(e){}<\/script>` + htmlContent;
    } else {
        frame.removeAttribute('srcdoc');
        frame.src = game.url;
    }
}

document.getElementById('add-game-btn').onclick = () => {
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

async function deleteGame(id, index) {
    if (!confirm("Delete permanently?")) return;
    const tx = db.transaction("customGames", "readwrite");
    await tx.objectStore("customGames").delete(id);
    games.splice(index, 1); renderGameList();
}

document.getElementById('cloak-btn').onclick = () => {
    if (!currentGame) return alert("Select game");
    const win = window.open('about:blank', '_blank');
    const gameSrc = currentGame.type === 'file' ? URL.createObjectURL(new Blob([atob(currentGame.content.split(',')[1])], {type:'text/html'})) : currentGame.url;
    win.document.title = "My Drive - Google Drive";
    const link = win.document.createElement('link'); link.rel = 'icon'; link.href = 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png';
    win.document.head.appendChild(link);
    const ifr = win.document.createElement('iframe');
    Object.assign(ifr.style, { position:'fixed', top:0, left:0, width:'100%', height:'100%', border:'none' });
    ifr.src = gameSrc; win.document.body.appendChild(ifr);
    window.open('about:blank', '_self'); window.close();
};

document.getElementById('export-btn').onclick = async () => {
    const tx = db.transaction("customGames", "readonly");
    const custom = await new Promise(r => { const req = tx.objectStore("customGames").getAll(); req.onsuccess = () => r(req.result); });
    const saves = {}; for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); saves[k] = localStorage.getItem(k); }
    const blob = new Blob([JSON.stringify({ saves, games: custom })], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'toothbrush_backup.json'; a.click();
};

document.getElementById('import-btn').onchange = e => {
    const reader = new FileReader();
    reader.onload = async ev => {
        const data = JSON.parse(ev.target.result);
        if (data.saves) Object.keys(data.saves).forEach(k => localStorage.setItem(k, data.saves[k]));
        if (data.games) { const tx = db.transaction("customGames", "readwrite"); data.games.forEach(g => tx.objectStore("customGames").put(g)); }
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
};

const splashes = [
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
    "\"READ the TUTORIAL!\"", "\"Dead.\"", "\"Wow. Just... wow.\"", "\"Honorable mention: Ctrl+W.\""
]; // ... (Add the rest of the 100 splashes here)

function setSplash() {
    const el = document.getElementById('splash-text');
    if (el) el.textContent = splashes[Math.floor(Math.random() * splashes.length)];
}

loadGames();
window.addEventListener('DOMContentLoaded', setSplash);