// global variable
var deleteAllBtn = document.getElementById('deleteAll')
var container = document.getElementById('container');
var detail = document.getElementById('detail');
var topBanner = document.getElementById('top-banner');
var bannerTitle = document.getElementById('banner-title')
var closeBtn = document.getElementById('close-btn');
var detailTable = document.getElementById('detail-table'); 
var visitTitle = document.getElementById('visit-title');
var lastVisit = document.getElementById('last-visit');
var linkTitle = document.getElementById('link-title');
var link = document.getElementById('link');
var removeForm = document.getElementById('remove-form');

var removeOptions = {
    "cache": "Clears the browser's cache (including appcaches and cache storage)", 
    "cookies": "Clears the browser's cookies and server-bound certificates modified within a particular timeframe.", 
    // "downloads": "Clears the browser's list of downloaded files (not the downloaded files themselves).", 
    "fileSystems": "Clears websites' file system data.", 
    // "formData": "Clears the browser's stored form data (autofill).", 
    // "history": "Clears the browser's history.", 
    "indexedDB": "Clears websites' IndexedDB (database) data.", 
    "localStorage": "Clears websites' local storage data.",
    // "passwords": "Clears the browser's stored passwords.",
    "pluginData": "Clears plugins' data.",
    "webSQL": "Clears websites' WebSQL data."
}
var removeCache = ["appcache", "cacheStorage"];

/**
 * Wrap a url into html node.
 * @param {string} url the url wants to wrap with
 * @param {string} title the text to display
 * @param {string} id  the bookmark id of the page 
 * @return the div node with url
 */
function wrapListItem(url, title, id) {
    if (typeof url == 'undefined')
        throw "wrapListItem: <"+title+"> is a folder";
    
    let item = document.createElement('div');
    let checkbox = document.createElement('input');
    let href = document.createElement('div');

    item.id = id;
    item.classList.add('item');
    checkbox.type = 'checkbox';
    checkbox.value = id;
    href.innerText = validateTitle(title);
    href.setAttribute('href',url);
    href.classList.add('link');
    href.addEventListener('click', () => {popUpDetail(id, url, validateTitle(title))});
    
    [checkbox, href].forEach(e => {item.appendChild(e)});
    return item;
}

/**
 * wrap folder into html node
 * @param {string} title the title of the folder
 * @param {string} id the bookmark id of the folder
 * @return the div node with folder title
 */
function wrapListFolder(title, id){
    let item = document.createElement('div');
    let titleElement = document.createElement('div');
    let checkbox = document.createElement('input');
    let titleText = document.createElement('div');
    
    item.id = id;
    item.setAttribute("open", "false");
    checkbox.type = 'checkbox';
    checkbox.value = id;
    titleText.innerText = validateTitle("> (id: " + id + ") " + title);
    item.classList.add('folder');
    titleElement.classList.add('title');
    checkbox.style.marginRight = '15px';
    titleText.classList.add('text');


    checkbox.addEventListener('change', () => selectAll(id, checkbox.checked));
    titleText.addEventListener('click', () => reverseFolderStatus(item));
    
    [checkbox, titleText].forEach(e => {titleElement.appendChild(e)});
    item.appendChild(titleElement);
    return item;
}


async function popUpDetail(id, url, title){
    await emptyDetail();

    bannerTitle.innerText = title;
    closeBtn.addEventListener('click', (e) => { detail.style.display = 'none' });

    // get and display last visit time
    chrome.history.getVisits({ "url": url }, res => {
        if (res.length > 0) {
            let item = res.slice(-1)[0];
            let time = new Date(item.visitTime);
            lastVisit.innerText = time.toString().split(' ', 5).join(' ');
        } else {
            lastVisit.innerText = '<no history found>';
        }
    });

    // display url
    link.href = url;
    link.innerText = url;

    // get https/http version of the url
    var url2;
    if (url.includes('https')){
        url2 = url.replace(/https/, 'http');
    } else if (url.includes('http')) {
        url2 = url.replace(/http/, 'https');
    }

    let originList = [url];
    if (url2)
        originList.push(url2);

    console.log(originList);
    document.getElementById('submitBtn').onclick = ((event) => {
        event.preventDefault();
        let obj = {};
        for (var el of removeForm.elements){
            if (el.checked) {
                obj[el.name] = true;
                if(el.name === 'cache'){
                    obj['appcache'] = true;
                    obj['cacheStorage'] = true;
                }
            }
        }
        chrome.browsingData.remove(
            {
                "origins": originList
            }, 
            obj, 
            function(res) {
                alert("successfully cleaned"  + originList); //TODO: custom alert
                detail.style.display = 'none';
            }
           
        );
    });
    // topBanner.addEventListener("mousedown", dragMouseDown); //TODO: drag evnet
    detail.style.display = 'flex';
}




/**
 * validate title text to be non-empty string
 * @param {string} text 
 * @return if title is valid, return text; else return '<unnamed>'
 */
function validateTitle(text) {
    if (/\S+/.test(text))
        return text;
    else
        return '<unnamed>';
}


function emptyDetail(){
    bannerTitle.innerText = '';
    lastVisit.innerText = '';
    link.innerText = '';
    // removeForm.reset();
    return Promise.resolve();
}

/**
 * increase the value of a css property
 * @param {HTML Element} value The element
 * @param {String} property The property that wants to increment 
 * @return the new string value with original unit
 */
function incrementCSSValue(element, property){
    // get the current value of that property
    const style = window.getComputedStyle(element).getPropertyValue(property);
    const num = style.match(/\d+/);
    const unit = style.match(/[a-zA-Z]+/);
    return `${parseInt(num) + 15}${unit}`;
}

/**
 * Reverse the value of attribute to indicate if a folder is opened
 * @param {html element} node the folder node to be reverse status 
 * @return A boolean value indicating the folder is now set to open (true) or close (false)
 */
function reverseFolderStatus(node){
    let titleNode = node.firstChild.firstChild.nextSibling;
    let title = titleNode.innerText;

    if (node.getAttribute("open") == "true") {
        titleNode.innerText = title.replace('v', '>');
        node.setAttribute("open", "false");
        toggleFolder(node, false);
        return false;
    } else {
        titleNode.innerText = title.replace('>', 'v');
        node.setAttribute("open", "true");
        toggleFolder(node, true);
        return true;
    }
}

/**
 * display and hide elements in folder
 * @param {html element} parent the folder element
 * @param {booelan} value true means "display" and false means "hide"
 */
function toggleFolder(parent,value){
    let children = parent.children;
    for (let i = 1; i < children.length; i++) {
        children[i].style.display = (value)? 'flex' : 'none';
    };
}

/**
 * parse a folder and display on page
 * @param {string} id the id of the bookmark folder 
 */
async function parseFolder(id){
    // append all the children to this folder element
    chrome.bookmarks.getChildren(id, (children) => {
        children.forEach((child) => {
            if (child != undefined) {
                let element = undefined;
                try {
                    element = wrapListItem(child.url, child.title, child.id);
                } catch (err) {
                    element = wrapListFolder(child.title, child.id);
                    parseFolder(child.id);
                    console.log(err);
                } finally {
                    // increment indent level, hide all children by default
                    element.style.marginLeft = incrementCSSValue(document.getElementById(id), 'margin-left');
                    element.style.maxWidth = 50; //TODO: change the length of shadow box
                    element.style.display = 'none';
                    document.getElementById(id).appendChild(element);
                }

            } 
        });
    });
}

/**
 * select or deselect all the elements in a folder.
 * @param {string} id the id of the folder element
 * @param {boolean} value the value that wants to set in the checkbox
 */
function selectAll(id, value) {
    document.getElementById(id).firstChild.firstChild.checked = value;
    let children = document.getElementById(id).children;
    for (let i = 1; i < children.length; i++) {
            if(children[i].classList.contains('item'))
                children[i].firstChild.checked = value;
            else
                // children[i].firstChild.firstChild.checked = value;
                selectAll(children[i].id, value);
        };
}

/**
 * An event handler for dragging detail window
 * @param {event} e the mouse down event
 */
function dragMouseDown(e){
    e = e || window.event;
    e.preventDefault();
    // get the mouse position
    mousePosX = e.clientX - detail.offsetLeft;
    mousePosY= e.clientY - detail.offsetHeight;
    topBanner.addEventListener("mousemove", dragElement(e, mousePosX, mousePosY));

    topBanner.addEventListener("mouseup", (e) => {
        topBanner.removeEventListener("mousemove", dragElement(e, mousePosX, mousePosY));
    });
}

function dragElement(e, offsetX, offsetY) { //TODO: not working
    e = e || window.event;
    e.preventDefault();
    console.log(offsetX, offsetY)
    // calculate element position
    // offsetX = mousePosX - e.clientX;
    // offsetY = mousePosY - e.clientY;
    // mousePosX = e.clientX;
    // mousePosY = e.clientY;
    console.log("left to", (detail.offsetLeft - offsetX), "right to", (detail.offsetTop - offsetY));
    // detail.style.left =  (e.clientX - offsetX) + "px";
    // detail.style.top = (e.clientY - offsetY) + "px";
    
    console.log("mouse Y:", e.clientY, "mouse X:", e.clientX);
    console.log("Y:", detail.offsetHeight,", X:", detail.offsetLeft);
}

/**
 * browse and display bookamrk
 */
function getRoot() {
    chrome.bookmarks.getTree((root) => {
        // get top level node from bookmark tree
        chrome.bookmarks.getChildren(root[0].id, (nodes) => {
            nodes.forEach((node) => {
                container.appendChild(wrapListFolder(node.title, node.id));
                parseFolder(node.id);
            });
        });
    });
}


getRoot();
deleteAllBtn.onclick = ((event) => {
    event.preventDefault();
    var selectedBanner = document.getElementById('delete-selected-banner');
    console.log(selectedBanner);
    for(var el of selectedBanner.elements){
        console.log(el.id);
    }
});

