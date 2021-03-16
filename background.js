/* jshint esversion: 9, asi: true */

// https://dev.to/anobjectisa/local-database-and-chrome-extensions-indexeddb-36n
// https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

const worker = new SharedWorker("IDBWorker.js")

worker.port.onmessageerror = e => console.error(e)

const workerRequest = func => {
    return function (args) {
        return new Promise((resolve, reject) => {
            function handleResponse (e) {
                worker.port.removeEventListener('message', handleResponse)
                //worker.port.close() apparently you cant do this for some reason
                resolve(e.data)
                
            }
            worker.port.addEventListener('message', handleResponse)
            worker.port.start() // but starting it multiple times is fine?
            const params = arguments[1] ? [args, arguments[1]] : [args]
            worker.port.postMessage({
                func,
                args: params
            }) 
        })
    }
}

const insert = workerRequest('insert');
const update = workerRequest('update');
const get = workerRequest('get');


// init with popup
(async function() {
    chrome.tabs.query({ currentWindow: true, active: true }, async function (tabs) {
        const title_input = document.getElementById('title')
        const tags_input = document.getElementById('tags')
        const url_p = document.getElementById('url')
        const save = document.getElementById('save')
        const open = document.getElementById('open_links')
        const tab = tabs[0]
        const { url } = tab
        url_p.innerHTML = url_p.innerHTML = url.length > 42 ? url.slice(0, 39) + "..." : url
        const existingLink = await get(tab.url)
        if (existingLink) {
            title_input.value = existingLink.title
            tags_input.value = existingLink.tags.join(",")
            save.innerText = 'Update'
            save.addEventListener('click', async _ => {
                const tags = tags_input.value.split(",")
                const title = title_input.value
                try {
                    await update(url, { title, tags })
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
                    await insert({ url, title, tags })
                } catch (err) {
                    alert("error adding link", err)
                }
                window.close()
            })
        }
        open.addEventListener('click', function() {
            chrome.tabs.create({ url: chrome.runtime.getURL('links.html') })
        })
      });
})()