// global variable
let container = document.getElementById('container');


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
    let href = document.createElement('a');

    href.innerText = validateTitle(title);
    href.setAttribute('href',url);
    item.appendChild(href);
    item.id = id;
    item.classList.add('item');
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

    item.id = id;
    titleElement.innerText = validateTitle("> (id: " + id + ") " + title);
    
    titleElement.classList.add('folder');
    item.appendChild(titleElement);
    item.setAttribute("open", "false");
    titleElement.addEventListener('click', () => { parseFolder(id) });
    return item;
}

/**
 * validate title
 * @param {string} text 
 * @return if title is valid, return text; else return '<unnamed>'
 */
function validateTitle(text) {
    // validate title text
    if (/\S+/.test(text))
        return text;
    else
        return '<unnamed>';
}

/**
 * 
 * @param {html element} remove all the children of an html element
 * @return Promise resolve
 */
function removeChildren(parent){
    while(parent.children.length > 1){
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
    return `${parseInt(num) + 20}${unit}`;
}

/**
 * parse a folder and display on page
 * @param {string} id the id of the bookmark folder 
 */
async function parseFolder(id){
    let parent = document.getElementById(id);
    let title = parent.firstChild.innerText;
    await removeChildren(parent);
    // close and open folder list
    if (parent.getAttribute("open") == "true"){
        console.log(typeof title);
        parent.firstChild.innerText = title.replace('v','>');
        parent.setAttribute("open",  "false");
        return;
    } else {
        console.log(title);
        parent.firstChild.innerText = title.replace('>', 'v');
        parent.setAttribute("open", "true");
    }
    chrome.bookmarks.getChildren(id, (children) => {
        children.forEach((child) => {
            if (child != undefined) {
                let element = undefined;
                try {
                    element = wrapListItem(child.url, child.title, child.id);
                } catch (err) {
                    element = wrapListFolder(child.title, child.id);
                    // console.log(err);
                } finally {
                    element.style.marginLeft = incrementCSSValue(parent, 'margin-left');
                    parent.appendChild(element);
                }

            }
        });
    });
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
            });
        });
    });
}


getRoot();