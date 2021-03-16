/* jshint esversion: 9, worker: true, asi: true */

const DB_NAME = "LinkDB"
const DB_VERSION = 2
const STORE_NAME = "links"
const TAG_STORE = 'tags'
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
                case 1: // PROJECT SPECIFIC
                    const tagStore = db.createObjectStore(TAG_STORE, { keyPath: 'name' })
                    tagStore.transaction.oncomplete = function() {
                        console.log('tag store created');
                    }
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
        const transaction = this.db.transaction([STORE_NAME, TAG_STORE], "readwrite")
        const objectStore = transaction.objectStore(STORE_NAME)
        const tStore = transaction.objectStore(TAG_STORE)
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                // console.log(STORE_NAME.slice(0, STORE_NAME.length - 1), "added")
                resolve(true)
            }
    
            transaction.onerror = e => {
                console.error("problem inserting item into DB", e.target.error)
                resolve(false)
            }
    
            objectStore.add(data)
            data.tags.forEach(name => tStore.add({ name }))
        })
    }
    
    update(key, updates) {
        const tx = this.db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)
        const tStore = tx.objectStore(TAG_STORE)
        return new Promise((resolve, reject) => {
            const req = store.get(key)
    
            req.onerror = () => {
                console.error("error finding record", url)
                resolve(false)
            }
    
            req.onsuccess = e => {
                const oldItem = e.target.result
                update.tags.filter(t => !oldItem.tags.includes(t)).forEach(t => tStore.add(t))
                // 1 issue - new tags are added but old ones aren't removed
                const item = { ...oldItem, ...updates }
                store.put(item) // const updateReq = store.put(item)
                
                // if I change this from the updateReq to the tx it should work I think
                tx.onerror = () => {
                    console.error("error updating record", key)
                    resolve(false)
                }
    
                tx.onsuccess = () => {
                    // console.log(key, "updated")
                    resolve(true)
                }
            }
        })
    }

    delete(key) {
        return new Promise((resolve, reject) => {
            const req = this.db.transaction(STORE_NAME).objectStore(STORE_NAME).delete(key)
            req.onsuccess = () => {
                resolve(true)
            }
            req.onerror = () => {
                console.error("error deleting record", key)
                resolve(false)
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
                console.error("error retrieving all values")
                resolve([])
            }
            request.onsuccess = function() {
                resolve(request.result)
            }
        })
    }

    get_tags() { // PROJECT SPECIFIC
        return new Promise((resolve, reject) => {
            const req = this.db.transaction(TAG_STORE).objectStore(TAG_STORE).getAll()
            req.onerror = function() {
                console.error('error getting tags')
                resolve([])
            }
            req.onsuccess = function() {
                resolve(req.result) //.map(t => t.name)
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
    console.log('port connected')

    port.addEventListener("message", async ({ data }) => {
        const { func, args } = data
        try {
            const result = await DB[func](...args)
            port.postMessage(result)
        } catch (err) {
            console.error("error posting back to port", err)
            port.postMessage(undefined)
        }
    })

    port.start()
})

/**
 * worker.postMessage({
 *   func: "get",
 *   args: ["www.dev.to/1"]
 * })
 */


