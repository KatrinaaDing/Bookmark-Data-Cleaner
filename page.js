// global variable
var container = document.getElementById('container');
var detail = document.getElementById('detail');



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
    titleText.classList.add('text');

    checkbox.addEventListener('change', () => {selectAll(id, checkbox.checked)});
    titleText.addEventListener('click', () => { reverseFolderStatus(item) });
    
    [checkbox, titleText].forEach(e => {titleElement.appendChild(e)});
    item.appendChild(titleElement);
    return item;
}


async function popUpDetail(id, url, title){
    await removeChildren(detail, 0);

    let topBanner = document.createElement('div'); 
    let bannerTitle = document.createElement('div');
    bannerTitle.innerText = title;
    bannerTitle.classList.add('title')
    let closeBtn = document.createElement('div');
    closeBtn.innerText = 'X';
    closeBtn.classList.add('close-btn');
    
    topBanner.classList.add('top-banner');
    [bannerTitle, closeBtn].forEach(e => {topBanner.appendChild(e)});
    detail.appendChild(topBanner);

    let detailTable = document.createElement('table');

    // get visit and display last visit time
    let visit = document.createElement('tr');
    let visitTitle = document.createElement('td');
    visitTitle.innerText = 'last visit: ';
    visit.appendChild(visitTitle);
    chrome.history.getVisits({ "url": url }, res => {
        let data = document.createElement('td');
        if (res.length > 0) {
            let item = res.slice(-1)[0];
            let time = new Date(item.visitTime);
            data.innerText = time.toString().split(' ', 5).join(' ');
        } else {
            data.innerText = '<no history found>';
        }
        visit.appendChild(data);
    });
    detailTable.appendChild(visit);

    
    detail.appendChild(detailTable);
    detail.style.display = 'flex';
}

function getCookies(urlObj){
    chrome.cookies.getAll(urlObj, res => {
        console.log(res);
        return Promise.resolve(res);
    });
}

async function getVisits(urlObj) {
    chrome.history.getVisits({"url":url}, res => {
        return Promes.resolve(res);
    })
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
 * remove all the children nodes of a parent except the first child (title node)
 * @param {html element} parent the parent node that to be removed
 * @param {int} index the index of html to remove from
 * @return Promise resolve
 */
function removeChildren(parent, index){
    while(parent.children.length > index){
        parent.removeChild(parent.lastChild);
    }
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
                    element.style.display = 'none';
                    document.getElementById(id).appendChild(element);
                }

            }  else {
                console.log(child);
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

function details(id){

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