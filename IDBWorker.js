const DB_NAME = "LinkDB"
const DB_VERSION = 1
const STORE_NAME = "links"
const PRIMARY_KEY = "url"
const INDICES = [
    { keyPath: "title", config: { unique: false } },
    { keyPath: "tags", config: { unique: false, "multiEntry": true }}
] // can optionally give each index a name separate from the keyPath

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

// https://www.sitepoint.com/javascript-shared-web-workers-html5/
// https://riptutorial.com/javascript/example/15535/dedicated-workers-and-shared-workers

let connections = 0

self.addEventListener("connect", async e => {
    const DB = await open_db()
    const port = e.ports[0]
    connections++

    port.addEventListener("message", ({ data }) => {
        const { func, args } = data
        try {
            const result = await DB[func](...args)
            port.postMessage(result)
        } catch (err) {
            console.error("error posting back to port", err)
            port.postMessage(undefined)
        }
    }, false)

    port.start()
}, false)

/**
 * worker.postMessage({
 *   func: "get",
 *   args: ["www.dev.to/1"]
 * })
 */


