// TODO look into a shared worker so I dont have to have multiple connections to IDB
// UPDATE: I did it!

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
const getAll = workerRequest("get_all");
const getTags = workerRequest('get_tags');

(async function() {
    const linksDiv = document.getElementById("links")
    const links = await getAll()
    const TagGraph = new Map()
    links.forEach(link => {
        const p = document.createElement('p')
        p.innerText = JSON.stringify(link, null, 2)
        linksDiv.appendChild(p)
        link.tags.forEach(tag => {
            if (TagGraph.has(tag)) {
                TagGraph.get(tag).add(link.url)
            } else {
                TagGraph.set(tag, new Set([link.url]))
            }
        })
    })
    console.log(TagGraph)
    const allTags = await getTags()
    console.log(allTags)
})()