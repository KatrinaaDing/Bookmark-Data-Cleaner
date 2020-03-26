// global variable
let selectedOrigins = [];
let selectedBookmarks = [];

//html element
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
var background = document.getElementById('background');
var waitingWindow = document.getElementById('waiting-window');
var waitingText =  document.getElementById('waiting-window').children[0];
var doneBtn = document.getElementById('waiting-window').children[1];
var helpWindow = document.getElementById('help-window');

var removeCache = ["appcache", "cacheStorage"];
let removeBookmark = false;

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
    let href = document.createElement('div');

    item.id = id;
    item.classList.add('item');
    checkbox.type = 'checkbox';
    checkbox.value = id;
    checkbox.addEventListener('click', checkBoxHandler);
    href.innerText = "<"+id+"> "+ validateTitle(title);
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
    titleText.innerText = validateTitle("> " + title);
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

    document.getElementById('submit-btn').onclick = ((event) => {
        event.preventDefault();

        // collect what data to delete
        let obj = collectChecked(removeForm);

        // show waiting status
        background.classList.add('waiting-bg');
        waitingWindow.style.display = 'flex';
        detail.style.display = 'none';
        chrome.browsingData.remove(
            {
                "origins": originList
            }, 
            obj, 
            function(res) {
                waitingText.style.display = 'none';
                doneBtn.style.display = 'block';
                // remove bookmark if it's ticked
                if (removeBookmark)
                    console.log('rmove ', id);//TODO: remove bookmark
            }
           
        );
    });
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
function toggleFolder(parent, value){
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
            if(children[i].classList.contains('item')){
                children[i].firstChild.checked = value;
                updateOriginalList(children[i].firstChild);
            }
               
            else
                // children[i].firstChild.firstChild.checked = value;
                selectAll(children[i].id, value);
        };
}

/**
 * Push the url and it's bookmark id into list if checked. Remove them if unchecked.
 * @param {html node} checkbox the checkbox clicked by user
 */
function updateOriginalList(checkbox){
    let href = checkbox.nextSibling.getAttribute('href');

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
    
    console.log(selectedOrigins); 
    console.log(selectedBookmarks);
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
            if (el.checked)
                removeBookmark = true; 
            else 
                removeBookmark = false;
        
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


/* event handler */
function checkBoxHandler(event){
    updateOriginalList(event.target);
}

function deleteAll(event){
    event.preventDefault();
    var selectedBanner = document.getElementById('delete-selected-banner');
    
    // collect what data to delete
    let obj = collectChecked(selectedBanner);
    
    background.classList.add('waiting-bg');
    waitingWindow.style.display = 'flex';
    chrome.browsingData.remove(
        {
            "origins": selectedOrigins
        }, 
        obj, 
        function(res) {
            waitingText.style.display = 'none';
            doneBtn.style.display = 'block';
            // remove bookmark if it's ticked
            if (removeBookmark)
                console.log('remove ' + selectedBookmarks);//TODO: remove bookmark

            // empty all checkbox
            for(var el of selectedBanner.elements)
                el.checked = false;
        }
       
    );
}



getRoot();
deleteAllBtn.addEventListener('click', deleteAll);
doneBtn.onclick = (e) => {
    waitingWindow.style.display = 'none';
    waitingText.style.display = 'block';
    doneBtn.style.display = 'none';
    background.classList.remove('waiting-bg');
}

document.getElementById('helpBtn').onmouseover = (e) => {helpWindow.style.display = 'block'};
document.getElementById('helpBtn').onmouseleave = (e) => {helpWindow.style.display = 'none'}



