const dbName = "UnblockedGamesDB";
let db;
let games =[];
let currentBlobUrl = null;

// 1. Initialize the Heavy-Duty Database (IndexedDB)
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            // Create a storage space specifically for our massive game files
            if (!database.objectStoreNames.contains('customGames')) {
                database.createObjectStore('customGames', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

// 2. Helper Functions to Save and Get Games from IndexedDB
function saveCustomGameToDB(game) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('customGames', 'readwrite');
        const store = transaction.objectStore('customGames');
        store.put(game);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

function getCustomGamesFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('customGames', 'readonly');
        const store = transaction.objectStore('customGames');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 3. Load Games (JSON + IndexedDB)
async function loadGames() {
    await initDB(); // Boot up the database first
    const customGames = await getCustomGamesFromDB();
    
    try {
        const response = await fetch('games.json');
        const defaultGames = await response.json();
        games =[...defaultGames, ...customGames];
    } catch (e) {
        games = [...customGames];
    }
    
    renderGameList();
}

// 4. Render Sidebar List
function renderGameList() {
    const list = document.getElementById('game-list');
    list.innerHTML = '';
    
    games.forEach((game) => {
        const li = document.createElement('li');
        li.textContent = game.title;
        li.onclick = () => loadGameToIframe(game);
        list.appendChild(li);
    });
}

// 5. Load Game into Iframe
async function loadGameToIframe(game) {
	currentGame = game;
    const iframe = document.getElementById('game-frame');
    
    // Prevent memory leaks if loading multiple heavy games in one session
    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }
    
    if (game.type === 'file') {
        try {
            // Converts the stored file into a shared Blob URL for automatic saving
            const response = await fetch(game.content);
            const blob = await response.blob();
            currentBlobUrl = URL.createObjectURL(blob);
            iframe.src = currentBlobUrl;
        } catch (err) {
            console.error("Could not load local game:", err);
            iframe.src = 'about:blank';
        }
    } else {
        iframe.src = game.url;
    }
}

// 6. Add Custom HTML Game (Now Saves to IndexedDB)
document.getElementById('add-game-btn').onclick = () => {
    const title = document.getElementById('new-game-title').value;
    const fileInput = document.getElementById('new-game-file');
    
    if (!title || !fileInput.files.length) return alert("Enter a title and select a file.");
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const newGame = {
            id: 'custom_' + Date.now(),
            title: title,
            type: 'file',
            content: e.target.result
        };
        
        // Save to unlimited IndexedDB instead of 5MB localStorage
        await saveCustomGameToDB(newGame);
        
        games.push(newGame);
        renderGameList();
        
        document.getElementById('new-game-title').value = '';
        fileInput.value = '';
    };
    
    reader.readAsDataURL(file);
};

// 7. NEW BACKUP MECHANISM: Combines Saves + Giant Game Files
document.getElementById('export-btn').onclick = async () => {
    const customGames = await getCustomGamesFromDB();
    
    // Package everything together
    const backupData = {
        saves: { ...localStorage }, // Grab all game progress
        games: customGames          // Grab all heavy game files
    };
    
    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unblocked_games_ultimate_backup.json';
    a.click();
    
    URL.revokeObjectURL(url);
};

// 8. NEW RESTORE MECHANISM
document.getElementById('import-btn').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // 1. Restore the tiny game progress saves
            if (importedData.saves) {
                for (let key in importedData.saves) {
                    localStorage.setItem(key, importedData.saves[key]);
                }
            } else {
                // Fallback for your old backup files
                for (let key in importedData) {
                    localStorage.setItem(key, importedData[key]);
                }
            }
            
            // 2. Restore the giant game files to IndexedDB
            if (importedData.games) {
                for (let game of importedData.games) {
                    await saveCustomGameToDB(game);
                }
            }
            
            alert("Games and save progress restored successfully!");
            loadGames(); // Refresh the UI
        } catch (err) {
            alert("Invalid backup file.");
            console.error(err);
        }
    };
    
    reader.readAsText(file);
    e.target.value = '';
};

// Start the App
loadGames();

async function openCloaked() {
    if (!currentGame) return alert("Select a game first!");

    // 1. Create the new about:blank window
    const win = window.open('about:blank', '_blank');
    if (!win) return alert("Pop-up blocked! Please allow pop-ups.");

    // 2. Prepare the content
    let gameSrc = "";
    if (currentGame.type === 'file') {
        const response = await fetch(currentGame.content);
        const blob = await response.blob();
        gameSrc = URL.createObjectURL(blob);
    } else {
        gameSrc = currentGame.url;
    }

    // 3. Write the stealth HTML to the new window
    win.document.write(`
        <html>
            <head>
                <title>My Drive - Google Drive</title>
                <link rel="icon" type="image/x-icon" href="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png">
                <style>
                    body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #000; }
                    iframe { width: 100%; height: 100%; border: none; }
                </style>
            </head>
            <body>
                <iframe src="${gameSrc}"></iframe>
            </body>
        </html>
    `);

    // 4. Redirect the original tab to look like you're working
    window.location.replace("https://classroom.google.com");
	
	document.getElementById('cloak-btn').onclick = openCloaked;
}