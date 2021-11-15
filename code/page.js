// global variable
let selectedOrigins = [];
let selectedBookmarks = [];
let selectedFolder = [];

// html elements
const deleteAllBtn = document.getElementById('deleteAll');
const selectAllBtn = document.getElementById('selectAll-all');
const container = document.getElementById('container');
const detail = document.getElementById('detail');
const bannerTitle = document.getElementById('banner-title')
const lastVisit = document.getElementById('last-visit');
const link = document.getElementById('link');
const removeForm = document.getElementById('remove-form');
const background = document.getElementById('background');
const waitingWindow = document.getElementById('waiting-window');
const waitingText =  document.getElementById('waiting-window').children[0];
const doneBtn = document.getElementById('waiting-window').children[1];

const removeCache = ["appcache", "cacheStorage"];
let removeBookmark = false;

/**
 * A helper function to add a list of classes to an html node
 * @param {html node} node The html node to add classes on
 * @param {array} classlist The list of classes to add
 */
function addClasses(node, classlist) {
    if (typeof(node) !== 'object') alert("ERROR adding classes")
    classlist.forEach(e => node.classList.add(e));
}

/**
 * Wrap a url into html node.
 * @param {string} url the url wants to wrap with
 * @param {string} title the text to display
 * @param {string} id  the bookmark id 
 * @return the div node with url
 */
function wrapListItem(url, title, id) {
    if (typeof url == 'undefined')
        throw "wrapListItem: <"+title+"> is a folder";
    
    let item = document.createElement('div');
    let checkbox = document.createElement('input');
    let href = document.createElement('button');


    /* attribute */
    item.id = id;
    href.setAttribute('href', url);
    checkbox.type = 'checkbox';
    checkbox.value = id;
    href.innerText = validateTitle(title);
    href.type = 'button';
    href.setAttribute('data-bs-toggle', 'modal');
    href.setAttribute('data-bs-target', '#detail');

    /* style */
    item.style.display = 'inline-flex';
    item.style.width = '-webkit-fill-available'
    addClasses(checkbox, ["form-check-input"]);
    addClasses(href, ['link', 'btn', 'text']);

    /* Event Listener */
    checkbox.addEventListener('click', checkBoxHandler);
    href.addEventListener('click', () => popUpDetail(id, url, validateTitle(title)));
    
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
    let titleElement = document.createElement('div');   // the item of folder title
    let checkbox = document.createElement('input');
    let titleText = document.createElement('button');
    let childrenContainer = document.createElement('div');  // a container for all children item
    
    /* attribute */
    item.id = id;
    item.setAttribute("open", "false");
    checkbox.type = 'checkbox';
    checkbox.value = id;
    titleText.innerText = validateTitle(title);
    // apply bootstrap collapse
    childrenContainer.id = `children${id}`;
    titleText.setAttribute("data-bs-toggle", "collapse");
    titleText.setAttribute('data-bs-target', `#children${id}`);
    titleText.setAttribute('aria-expanded', 'false');
    titleText.type = 'button';
    titleText.setAttribute('aria-controls', `children${id}`);
    
    /* style */
    addClasses(item, ['folder']);
    addClasses(titleElement, ['title']);
    addClasses(titleText, ['btn', 'd-inline-flex', 'align-items-center', 'rounded', 'h5', 'text']);
    addClasses(checkbox, ['form-check-input']);
    addClasses(childrenContainer, ['collapse', 'children-container'])

    /* Event listener */
    checkbox.addEventListener('change', () => selectAll(id, checkbox.checked));
    checkbox.addEventListener('click', checkBoxHandler);
    titleText.addEventListener('click', () => reverseFolderStatus(item));

    [checkbox, titleText].forEach(e => {titleElement.appendChild(e)});
    [titleElement, childrenContainer].forEach(e => item.appendChild(e));
    
    return item;
}

/**
 * Display
 * @param {string} id the id of the bookmark 
 * @param {string} url the url of the bookmark 
 * @param {string} title the displayed title of the bookmark
 */
async function popUpDetail(id, url, title){
    await emptyDetail();

    bannerTitle.innerText = title;

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

    document.getElementById('submit-btn').onclick = ((event) => {
        event.preventDefault();

        // collect what data to delete
        let obj = collectChecked(removeForm);

        // show waiting status
        background.classList.add('waiting-bg');
        waitingWindow.style.display = 'flex';
        chrome.browsingData.remove(
            {
                "origins": originList
            }, 
            obj, 
            function(res) {
                waitingText.style.display = 'none';
                doneBtn.style.display = 'block';
                // remove bookmark if it's ticked
                if (removeBookmark) {
                    chrome.bookmarks.remove(id, () => {
                        console.log("Successfully remove bookmark <" + title + ">");
                        document.getElementById(id).parentNode.removeChild(document.getElementById(id));
                    })
                }
            }
           
        );
    });
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

/**
 * Empty the bookmark detail window
 */
function emptyDetail(){
    bannerTitle.innerText = '';
    lastVisit.innerText = '';
    link.innerText = '';
    return Promise.resolve();
}

/**
 * Reverse the value of attribute to indicate if a folder is opened
 * @param {html element} node the folder node to be reverse status 
 * @return A boolean value indicating the folder is now set to open (true) or close (false)
 */
function reverseFolderStatus(node){
    let titleNode = node.firstChild.firstChild.nextSibling;
    let title = titleNode.innerText;

    const curState = node.getAttribute("open");
    node.setAttribute("open", !curState);

    return node.getAttribute("open");
}

/**
 * parse a folder and display on page
 * @param {string} id the id of the bookmark folder 
 */
async function parseFolder(id){
    // append all the children to this folder element
    chrome.bookmarks.getChildren(id, (children) => {
        children.forEach((child) => {
            let parent = document.getElementById(id);
            if (child != undefined) {
                let element = undefined;
                // try to wrap the item as single url. If fails, parse as folder
                try {
                    element = wrapListItem(child.url, child.title, child.id);
                } catch (err) {
                    element = wrapListFolder(child.title, child.id);
                    parseFolder(child.id);
                } finally {
                    // increment indent level, hide all children by default
                    element.style.marginLeft = '30px';
                    // append child item into container
                    document.getElementById(`children${id}`).appendChild(element);
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
    let checkbox = document.getElementById(id).firstChild.firstChild;
    checkbox.checked = value;
 
    updateOriginalList(checkbox);
    let children = document.getElementById(`children${id}`).children;
    for (let i = 0; i < children.length; i++) {
        // recursively select nested folder
        if(children[i].classList.contains('folder')){
            selectAll(children[i].id, value);
        
        // add href into list
        } else {
            children[i].firstChild.checked = value;
            updateOriginalList(children[i].firstChild);
        }
    };
}

/**
 * Push the url and it's bookmark id into list if checked. Remove them if unchecked.
 * @param {html node} checkbox the checkbox clicked by user
 */
function updateOriginalList(checkbox){
    let href = checkbox.nextSibling.getAttribute('href');

    // if it's an item
    if (href){
        // get https/http version of the url
        var href2;
        if (href.includes('https')){
            href2 = href.replace(/https/, 'http');
        } else if (href.includes('http')) {
            href2 = href.replace(/http/, 'https');
        }

        // push the href (both http and https ver) into the list
        if(checkbox.checked){
            if (selectedOrigins.indexOf(href) < 0){
                selectedOrigins.push(href);
                if (href2)
                    selectedOrigins.push(href2);
            }    
            if (selectedBookmarks.indexOf(checkbox.value) < 0)
                selectedBookmarks.push(checkbox.value);

        // remove the href (both http and https ver) from list
        } else {
            removeFromList(href, selectedOrigins);
            removeFromList(href2, selectedOrigins);
            removeFromList(checkbox.value, selectedBookmarks);
        }

    // if it's a folder    
    } else {
        let folderId = checkbox.value;
        if (checkbox.checked && selectedFolder.indexOf(folderId) < 0) {
            selectedFolder.push(folderId);
        } else if (!checkbox.checked && selectedFolder.indexOf(folderId) >= 0){
            removeFromList(folderId, selectedFolder);
        }
    }
}

/**
 * Remove a value from a list
 * @param {string} value 
 * @param {array} list 
 */
function removeFromList(value, list){
    let i = list.indexOf(value);
    if (i >= 0)
        list.splice(i, 1);
}

/**
 * collect checked browsing data option.
 * @param {html node} parent the parent node of the checkboxes
 * @return return the checked option as object
 */
function collectChecked(parent){
    let obj = {};
    for(var el of parent.elements){
        if (el.name == 'remove-bookmark'){
            removeBookmark = el.checked;
          
        } else if (el.name && el.checked) {
            obj[el.name] = true;
                if(el.name === 'cache'){
                    obj['appcache'] = true;
                    obj['cacheStorage'] = true;
                }
        }
    }
    return obj;
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


/* =============================================== event handler =============================================== */

/**
 * Event handler for checkBox
 * @param {event} event checkbox event
 */
function checkBoxHandler(event){
    updateOriginalList(event.target);
}

/**
 * Event handler for 'delete all' button
 * @param {event} event click event
 */
function deleteAll(event){
    var selectedBanner = document.getElementById('delete-selected-banner');
    
    // collect what data to delete
    let obj = collectChecked(selectedBanner);

    // setting background
    background.classList.add('waiting-bg');
    waitingWindow.style.display = 'flex';
    
    selectedOrigins.sort((a, b) => b-a);

    // remove selected item
    chrome.browsingData.remove(
        { "origins": selectedOrigins }, 
        obj, 
        function(res) {
            // remove bookmark if it's ticked, remove bookmark and html node
            if (removeBookmark) {
                selectedBookmarks.forEach((b) => {
                    chrome.bookmarks.remove(b, () => {
                        console.log("successfully removed ", b);
                        document.getElementById(b).parentNode.removeChild(document.getElementById(b));
                    });
                })
            }
            
            // remove ticked empty bookmark if "remove bookmark" is ticked
            if (removeBookmark) {
                selectedFolder.sort((a, b) => b-a);
                
                // remove selected empty folders (if any)
                selectedFolder.forEach((f) => 
                    chrome.bookmarks.remove(f, () => {
                        console.log("Successfully remove empty folder " + f);
                        document.getElementById(f).parentNode.removeChild(document.getElementById(f));
                    })
                );
            }

            // empty all checkbox
            for(let el of selectedBanner.elements)
                el.checked = false;
            
            // empty all lists 
            if (removeBookmark) {
                selectedFolder = [];
                selectedOrigins = [];
                selectedBookmarks = [];

            }

            waitingText.style.display = 'none';
            doneBtn.style.display = 'block';
        }
    );
}

/**
 * Event handler for 'select all' button for "delete all" function
 * @param {event} event click event
 */
function selectAllData(e) {
    const ch = document.getElementById('delete-all-options').children;
    for (let i = 0; i < ch.length; i++)
        ch[i].children[0].checked = true;
}


getRoot();
deleteAllBtn.onclick = deleteAll;
selectAllBtn.onclick = selectAllData;

doneBtn.onclick = (e) => {
    waitingWindow.style.display = 'none';
    waitingText.style.display = 'block';
    doneBtn.style.display = 'none';
    background.classList.remove('waiting-bg');
}

