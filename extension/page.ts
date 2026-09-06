export {};
function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}
// global variable
let selectedOrigins: string[] = [];
let selectedBookmarks: string[] = [];
let selectedFolder: string[] = [];

// html elements
const deleteAllBtn = element('deleteAll');
const selectAllBtn = element('selectAll-all');
const container = element('container');
const detail = element('detail');
const bannerTitle = element('banner-title')
const lastVisit = element('last-visit');
const link = element<HTMLAnchorElement>('link');
const removeForm = element<HTMLFormElement>('remove-form');
const background = element('background');
const waitingWindow = element('waiting-window');
const waitingText =  element('waiting-window').children[0] as HTMLElement;
const doneBtn = element('waiting-window').children[1] as HTMLElement;

const removeCache = ["appcache", "cacheStorage"];
let removeBookmark = false;

/**
 * A helper function to add a list of classes to an html node
 * @param {html node} node The html node to add classes on
 * @param {array} classlist The list of classes to add
 */
function addClasses(node: HTMLElement, classlist: string[]) {
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
function wrapListItem(url: string | undefined, title: string, id: string) {
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
function wrapListFolder(title: string, id: string){
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
async function popUpDetail(id: string, url: string, title: string){
    await emptyDetail();

    bannerTitle.innerText = title;

    // get and display last visit time
    chrome.history.getVisits({ "url": url }, res => {
        if (res.length > 0) {
            let item = res.slice(-1)[0];
            let time = new Date(item.visitTime ?? 0);
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

    let originList: [string, ...string[]] = [url];
    if (url2)
        originList.push(url2);

    element('submit-btn').onclick = ((event) => {
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
            function() {
                waitingText.style.display = 'none';
                doneBtn.style.display = 'block';
                // remove bookmark if it's ticked
                if (removeBookmark) {
                    chrome.bookmarks.remove(id, () => {
                        console.log("Successfully remove bookmark <" + title + ">");
                        element(id).remove();
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
function validateTitle(text: string) {
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
function reverseFolderStatus(node: HTMLElement){


    const curState = node.getAttribute("open");
    node.setAttribute("open", String(!curState));

    return node.getAttribute("open");
}

/**
 * parse a folder and display on page
 * @param {string} id the id of the bookmark folder 
 */
async function parseFolder(id: string){
    // append all the children to this folder element
    chrome.bookmarks.getChildren(id, (children) => {
        children.forEach((child) => {
            let parent = element(id);
            if (child != undefined) {
                let childElement: HTMLElement;
                // try to wrap the item as single url. If fails, parse as folder
                try {
                    childElement = wrapListItem(child.url, child.title, child.id);
                } catch (err) {
                    childElement = wrapListFolder(child.title, child.id);
                    parseFolder(child.id);
                } finally {
                    // increment indent level, hide all children by default
                    childElement!.style.marginLeft = '30px';
                    // append child item into container
                    element(`children${id}`).appendChild(childElement!);
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
function selectAll(id: string, value: boolean) {
    let checkbox = element(id).firstElementChild!.firstElementChild as HTMLInputElement;
    checkbox.checked = value;
 
    updateOriginalList(checkbox);
    let children = element(`children${id}`).children;
    for (let i = 0; i < children.length; i++) {
        // recursively select nested folder
        if(children[i].classList.contains('folder')){
            selectAll(children[i].id, value);
        
        // add href into list
        } else {
            (children[i].firstElementChild as HTMLInputElement).checked = value;
            updateOriginalList(children[i].firstElementChild as HTMLInputElement);
        }
    };
}

/**
 * Push the url and it's bookmark id into list if checked. Remove them if unchecked.
 * @param {html node} checkbox the checkbox clicked by user
 */
function updateOriginalList(checkbox: HTMLInputElement){
    let href = checkbox.nextElementSibling!.getAttribute('href');

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
function removeFromList(value: string | undefined, list: string[]){
    let i = value === undefined ? -1 : list.indexOf(value);
    if (i >= 0)
        list.splice(i, 1);
}

/**
 * collect checked browsing data option.
 * @param {html node} parent the parent node of the checkboxes
 * @return return the checked option as object
 */
function collectChecked(parent: HTMLFormElement){
    let obj: Record<string, boolean> = {};
    for(var el of parent.elements){
        if (!(el instanceof HTMLInputElement)) continue;
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
function checkBoxHandler(event: Event){
    if (event.target instanceof HTMLInputElement) updateOriginalList(event.target);
}

/**
 * Event handler for 'delete all' button
 * @param {event} event click event
 */
function deleteAll(event: MouseEvent){
    var selectedBanner = element<HTMLFormElement>('delete-selected-banner');
    
    // collect what data to delete
    let obj = collectChecked(selectedBanner);

    if (!selectedOrigins.length) return;
    const origins: [string, ...string[]] = [selectedOrigins[0], ...selectedOrigins.slice(1)];

    // setting background
    background.classList.add('waiting-bg');
    waitingWindow.style.display = 'flex';
    
    selectedOrigins.sort((a, b) => Number(b)-Number(a));

    // remove selected item
    chrome.browsingData.remove(
        { "origins": origins }, 
        obj, 
        function() {
            // remove bookmark if it's ticked, remove bookmark and html node
            if (removeBookmark) {
                selectedBookmarks.forEach((b) => {
                    chrome.bookmarks.remove(b, () => {
                        console.log("successfully removed ", b);
                        element(b).remove();
                    });
                })
            }
            
            // remove ticked empty bookmark if "remove bookmark" is ticked
            if (removeBookmark) {
                selectedFolder.sort((a, b) => Number(b)-Number(a));
                
                // remove selected empty folders (if any)
                selectedFolder.forEach((f) => 
                    chrome.bookmarks.remove(f, () => {
                        console.log("Successfully remove empty folder " + f);
                        element(f).remove();
                    })
                );
            }

            // empty all checkbox
            for(let el of selectedBanner.elements)
                if (el instanceof HTMLInputElement) el.checked = false;
            
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
function selectAllData(e: MouseEvent) {
    const ch = element('delete-all-options').children;
    for (let i = 0; i < ch.length; i++)
        (ch[i].children[0] as HTMLInputElement).checked = true;
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

