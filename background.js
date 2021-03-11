/* jshint esversion: 9, worker: true */

// https://dev.to/anobjectisa/local-database-and-chrome-extensions-indexeddb-36n
// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

// DB Config - TODO - research multiple tables in IndexedDB - would this be helpful?
const DB_NAME = "Test DB";
const DB_VERSION = 5;
const STORE_NAME = "links";
const PRIMARY_KEY = "url";
const INDICES = [
    { keyPath: "title", config: { unique: false } },
    { keyPath: "tags", config: { unique: false, "multi-Entry": true }}
]; // can optionally give each index a name separate from the keyPath

const testData = {
    url: "https://dev.to/3",
    title: "Blah blah",
    tags: ["web design"]
};

const worker = self;

function openDB() {
    return new Promise((resolve, reject) => {
        let request = worker.indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = function(event) {
            reject("Error opening database", event.target.errorCode);
        };

        request.onupgradeneeded = function(event) {
            let db = event.target.result;
            let objectStore = db.createObjectStore(STORE_NAME, { keyPath: PRIMARY_KEY });
            INDICES.forEach(index => {
                let name = index.name || index.keyPath;
                objectStore.createIndex(name, index.keyPath, index.config)
            })
            objectStore.transaction.oncomplete = function() {
                console.log("Object Store created");
            };
        };

        request.onsuccess = function(event) {
            console.log("opened connection to IndexedDB successfully");
            let db = event.target.result;
            db.onerror = function(e) {
                console.log("Database error:", e.target.errorCode);
            };
            resolve(db);
        };
    });
}

function insert (db, data) {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = function() {
            console.log(STORE_NAME.slice(0, STORE_NAME.length - 1), "added");
            resolve(db);
        };

        transaction.onerror = function(e) {
            reject(new Error("problem inserting item into DB", e.target.error));
        };

        objectStore.add(data);
    });
}

function get_all (db) {
    const transaction = db.transaction(STORE_NAME);
    const objectStore = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        var request = objectStore.getAll();
        request.onerror = function() {
            reject(new Error("error retrieving all values"));
        };
        request.onsuccess = function() {
            resolve(request.result);
        };
    });
}

function get (db, url) {
    const transaction = db.transaction(STORE_NAME);
    const objectStore = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = objectStore.get(url);
        request.onerror = function() {
            reject(new Error("error retrieving item"));
        };
        request.onsuccess = function() {
            resolve(request.result);
        };
    });
}

function search_by_tags (db, tags) {
    const tx = db.transaction(STORE_NAME);
    const store = tx.objectStore(STORE_NAME);
    const found = new Set();
    return new Promise((resolve, reject) => {
        const index = store.index("tags");
        tx.onerror = function() {
            reject(new Error("error searching by tags"));
        };
        tx.onsuccess = function() {
            resolve(Array.from(found));
        };
        tags.forEach(tag => {
            const range = IDBKeyRange.only(tag);
            const cursorReq = index.openCursor(range);
            cursorReq.onsuccess = function (e) {
                const cursor = e.target.result;
                if (!cursor || found.has(cursor.value)) return;
                found.add(cursor.value);
                cursor.continue();
            };
        });
    });
}

chrome.runtime.onInstalled.addListener(async _ => {
    const db = await openDB();
    await insert(db, testData);
    const links = await get_all(db);
    console.log(links);
});
