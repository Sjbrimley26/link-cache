// https://dev.to/anobjectisa/local-database-and-chrome-extensions-indexeddb-36n
// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

chrome.runtime.onInstalled.addListener(_ => {
    let db
    var request = window.indexedDB.open("Test DB")
    request.onerror = function() {
        console.log("Shit the database didn't open")
    }
    request.onsuccess = function() {
        db = request.target.result
        db.onerror = function(event) {
            console.log("Database error:", event.target.errorCode)
        }
        db.createObjectStore("links", { keyPath: "url" })
    }
})