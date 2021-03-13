/* jshint esversion: 9, worker: true, asi: true */

// https://dev.to/anobjectisa/local-database-and-chrome-extensions-indexeddb-36n
// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

// DB Config - TODO - research multiple tables in IndexedDB - would this be helpful?
const DB_NAME = "Test DB"
const DB_VERSION = 1
const STORE_NAME = "links"
const PRIMARY_KEY = "url"
const INDICES = [
    { keyPath: "title", config: { unique: false } },
    { keyPath: "tags", config: { unique: false, "multiEntry": true }}
] // can optionally give each index a name separate from the keyPath

const testData = {
    url: `https://dev.to/${Math.random() * 100}`,
    title: "Blah",
    tags: ["web design"]
}

function open_db() {
    return new Promise((resolve, reject) => {
        let request = self.indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = function() {
            reject("error opening database", request.error)
        }

        request.onupgradeneeded = function(event) {
            let db = event.target.result;
            switch (event.oldVersion) {
                case 0:
                    let objectStore = db.createObjectStore(STORE_NAME, { keyPath: PRIMARY_KEY });
                    INDICES.forEach(index => {
                        let name = index.name || index.keyPath;
                        objectStore.createIndex(name, index.keyPath, index.config)
                    })
                    objectStore.transaction.oncomplete = function() {
                        console.log("object store created")
                    }
                    break;
            }
            
        }

        request.onsuccess = function(event) {
            console.log("opened connection to IndexedDB successfully")
            let db = event.target.result
            db.onerror = function() {
                console.log("database error:", db.error)
            }
            db.onversionchange = function() {
                db.close()
                alert("A new version of this page has been opened. Please close or refresh this tab!")
            }
            resolve(new IDB(db))
        }
    })
}

class IDB {
    constructor(db) {
        this.db = db
    }

    insert(data) {
        const transaction = this.db.transaction(STORE_NAME, "readwrite")
        const objectStore = transaction.objectStore(STORE_NAME)
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                // console.log(STORE_NAME.slice(0, STORE_NAME.length - 1), "added")
                resolve(this)
            }
    
            transaction.onerror = e => {
                reject(new Error("problem inserting item into DB", e.target.error))
            }
    
            objectStore.add(data)
        })
    }
    
    update(key, updates) {
        const store = this.db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
        return new Promise((resolve, reject) => {
            const req = store.get(key)
    
            req.onerror = () => {
                reject(new Error("error finding record", url))
            }
    
            req.onsuccess = e => {
                const item = { ...e.target.result, ...updates }
                const updateReq = store.put(item)
                
                updateReq.onerror = () => {
                    reject(new Error("error updating record", key))
                }
    
                updateReq.onsuccess = () => {
                    // console.log(key, "updated")
                    resolve(this)
                }
            }
        })
    }

    delete(key) {
        return new Promise((resolve, reject) => {
            const req = this.db.transaction(STORE_NAME).objectStore(STORE_NAME).delete(key)
            req.onsuccess = () => {
                resolve(this)
            }
            req.onerror = () => {
                reject(new Error("error deleting record", key))
            }
        })
    }

    get(key) {
        const transaction = this.db.transaction(STORE_NAME)
        const objectStore = transaction.objectStore(STORE_NAME)
        return new Promise((resolve, reject) => {
            const request = objectStore.get(key)
            request.onerror = function() {
                console.error("error retrieving record", key)
                resolve(undefined)
            }
            request.onsuccess = function() {
                resolve(request.result)
            }
        })
    }

    get_all() {
        const transaction = this.db.transaction(STORE_NAME)
        const objectStore = transaction.objectStore(STORE_NAME)
        return new Promise((resolve, reject) => {
            var request = objectStore.getAll()
            request.onerror = function() {
                reject(new Error("error retrieving all values"))
            }
            request.onsuccess = function() {
                resolve(request.result)
            }
        })
    }
}

function search_by_tags (db, tags) {
    console.time("bad search")
    const tx = db.transaction(STORE_NAME)
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve, reject) => {
        const cursorReq = store.openCursor()
        const found = []
        
        cursorReq.onsuccess = function(e) {
            const cursor = e.target.result
            if (cursor) {
                const item = cursor.value
                if (item.tags.some(tag => tags.includes(tag))) {
                    found.push(item)
                }
                cursor.continue()
            } else {
                console.timeEnd("bad search")
                resolve(found)
            }
        }

        cursorReq.onerror = function(e) {
            reject(new Error("error searching by tags"))
        }
    })
}

async function index_search (db, tags) {
    console.time("good search")
    const store = db.transaction(STORE_NAME).objectStore(STORE_NAME)
    const index = store.index('tags')
    const foundArrays = await Promise.all(tags.map(tag => {
        return new Promise((resolve, reject) => {
            const found = []
            const cursorReq = index.openCursor(IDBKeyRange.only(tag))
            cursorReq.onerror = _ => reject('error opening cursor')
            cursorReq.onsuccess = e => {
                const cursor = e.target.result
                if (cursor) {
                    found.push(cursor.value)
                    cursor.continue()
                } else {
                    resolve(found)
                }
            }
        })
    }))

    console.timeEnd("good search")
    return Array.from(foundArrays.reduce((set, arr) => {
        arr.forEach(x => set.add(x))
        return set
    }, new Set()))
}

/*
this is how it would init as a background script
chrome.runtime.onInstalled.addListener(async _ => {
    await open_db() // creates the DB when the extension is installed
})
*/


// init with popup
(async function() {
    const DB = await open_db()
    chrome.tabs.query({ currentWindow: true, active: true }, async function (tabs) {
        const title_input = document.getElementById('title')
        const tags_input = document.getElementById('tags')
        const url_p = document.getElementById('url')
        const save = document.getElementById('save')
        const open = document.getElementById('open_links')
        const tab = tabs[0]
        const { url } = tab
        url_p.innerHTML = url.slice(0, 42)
        const existingLink = await DB.get(tab.url)
        if (existingLink) {
            title_input.value = existingLink.title
            tags_input.value = existingLink.tags.join(",")
            save.innerText = 'Update'
            save.addEventListener('click', async _ => {
                const tags = tags_input.value.split(",")
                const title = title_input.value
                try {
                    await DB.update(url, { title, tags })
                } catch (err) {
                    alert("error adding link", err)
                }
                window.close()
            })
        }
        else {
            title_input.value = tab.title
            save.addEventListener('click', async _ => {
                const tags = tags_input.value.split(",")
                const title = title_input.value
                try {
                    await DB.insert({ url, title, tags })
                } catch (err) {
                    alert("error adding link", err)
                }
                window.close()
            })
        }
        open.addEventListener('click', _ => {
            chrome.tabs.create({ url: chrome.extension.getURL('links.html') })
        })
      });
})()