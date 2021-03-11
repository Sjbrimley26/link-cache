/* jshint esversion: 9, worker: true */

// https://dev.to/anobjectisa/local-database-and-chrome-extensions-indexeddb-36n
// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

const DB_NAME = "Test DB";
const STORE_NAME = "links";

const testData = {
    url: "https://dev.to/2",
    title: "Blah blah"
};

const worker = self;

function openDB() {
    return new Promise((resolve, reject) => {
        let request = worker.indexedDB.open(DB_NAME, 3);

        request.onerror = function(event) {
            reject("Error opening database", event.target.errorCode);
        };

        request.onupgradeneeded = function(event) {
            let db = event.target.result;
            let objectStore = db.createObjectStore(STORE_NAME, { keyPath: "url" });
            objectStore.createIndex("title", "title", { unique: false });
            objectStore.createIndex("tags", "tags", { unique: false, "multi-Entry": true });
            objectStore.transaction.oncomplete = function() {
                console.log("Object Store created");
            };
        };

        request.onsuccess = function(event) {
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

chrome.runtime.onInstalled.addListener(async _ => {
    const db = await openDB();
    const links = await get_all(db);
    console.log(links);
});
