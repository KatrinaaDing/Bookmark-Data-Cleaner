let testButton = document.getElementById('start');
let bookmarks = document.getElementById('bookmarks');
let visited = document.getElementById('visited');
let unVisited = document.getElementById('unVisited');

let localTime = new Date();
let oneWeekAgo = new Date(localTime.getFullYear(), localTime.getMonth(), localTime.getDate()-7);
let oneMonthAgo = new Date(localTime.getFullYear(), localTime.getMonth()-1, localTime.getDate());
let twoMonthAgo = new Date(localTime.getFullYear(), localTime.getMonth()-2, localTime.getDate());
let threeMonthAgo = new Date(localTime.getFullYear(), localTime.getMonth()-3, localTime.getDate());
let oneYearAgo = new Date(localTime.getFullYear()-1, localTime.getMonth(), localTime.getDate());
let twoYearAgo = new Date(localTime.getFullYear()-2, localTime.getMonth(), localTime.getDate());
let threeYearAgo = new Date(localTime.getFullYear()-3, localTime.getMonth(), localTime.getDate());


/* List of URLs to check against */
let urlList = [
    "https://stackoverflow.com/",
    "https://qwertyuiop.asd/fghjkl",
    "https://www.google.com/",
    "https://www.qwertyuiop.asd/fghjkl"
];

/* Callback to be executed after all URLs have been checked */
let onCheckCompleted = function(unvisitedURLs,visitedURLs) {
	let unvCon = "";
	let vCon = "";

    unvCon += "The following URLs have not been visited yet:" + "<br/>";
    unvisitedURLs.forEach(function(url) {
        unvCon += ("    " + url + "<br/>");
    });

    visitedURLs.forEach(function(url) {
    	vCon += url.visitCount
    	vCon += (' ' + url + '<br/>');
    });

    $unVisit.innerHTML = unvCon;	
    $visit.innerHTML = vCon;
};

/* Check all URLs in <urls> and call <callback> when done */
let findUnvisited = function(urls, callback) {
    let unvisitedURLs = [];
    let visitedURLs = [];
    let checkedURLs = 0;

    /* Check each URL... */
    urls.forEach(function(url) {
        chrome.history.getVisits({ "url": url }, (visitItems) => {
            /* If it has not been visited, add it to <unvisitedURLs> */
            if (!visitItems || (visitItems.length == 0)) {
                unvisitedURLs.push(url);

            } else if (visitItems) {
            	visitedURLs.push(url);
            }

            /* Increment the counter of checked URLs */
            checkedURLs++;
            /* If this was the last URL to be checked, 
               execute <callback>, passing <unvisitedURLs> */
            if (checkedURLs == urls.length) {
                callback(unvisitedURLs, visitedURLs);
            }


        });
    });

};

function wrapURL (url, text){
	let item = document.createElement('li');
	let href = document.createElement('a');
	if (/\S+/.test(text)){
		href.innerText = text;
	} else {
		href.innerText = '<unnamed>';
	}
	href.setAttribute('href', url);
	item.appendChild(href);
	return item;
}

function createFolderList(folder, folderElement){
	chrome.bookmarks.getChildren(folder.id, (folders) => {
		
		parseFolder(folders).forEach((el) => {
			folderElement.appendChild(el);
		});

	});
}

function parseFolder(folders){
	elementList = [];
	folders.forEach((e) => {
		// wrap the url into HTML list node
		const item = wrapURL(e.url, e.title);
		
		// get url visit info from chrome
		try {
			chrome.history.getVisits({ "url": e.url }, (res) => {
				if (res.length > 0) {
					let subElement = document.createElement('div');
					subElement.innerText = res.length;
					item.appendChild(subElement);	
					console.log(e.title, item);

				}
				
			})
		} catch (err) {
			// console.log(e.id, e.title);
			elementList.concat(chrome.bookmarks.getChildren(e.id, parseFolder));
			// console.log(err);
			// console.log(e.url, e.title);
		}

		elementList.push(item);
	});
	return elementList;

}

function createCategoryList(category){
	// create list header
	let list = document.createElement('ul');
	let title = document.createElement('h4');
	title.innerText = category.title;
	list.appendChild(title);

	// get bookmark item under the folder
	chrome.bookmarks.getChildren(category.id, (folder) => {
		console.log(folder);
		folder.forEach((e) => {
			// if the item is a folder (does not have url)
			if (typeof e.url === 'undefined') {
				let folderElement = document.createElement('ol');
				folderElement.id = e.title;
				let folderTitle = document.createElement('h4');
				// validate folder name
				folderTitle.innerText = (/\S+/.test(e.title)) ? e.title : '<unnamed>';

				// append the folder to folder list
				[folderTitle].map((element) => folderElement.appendChild(element));
				createFolderList(e,folderElement);
				list.appendChild(folderElement);

			// if the item is not a folder and has a url
			} else {
				
				const item = wrapURL(e.url, e.title);
				item.classList.add('item');

				list.appendChild(item);

			}
		});
	});
	return list;
}

function getBookmarks() {
	chrome.bookmarks.getTree((root) => {
		
		console.log('root:', root);
		chrome.bookmarks.getChildren(root[0].id, (nodes) => {
			console.log('nodes:', nodes);
			nodes.forEach((category) => {
				console.log(category.title, category);
				const list = createCategoryList(category);
				bookmarks.appendChild(list);
			});
			// let rootElement = document.createElement('ol');
			// const rootTitle = `<h3>${root.title}<\h3>`;
			// rootElement.innerHTML += rootTitle;
			// booksmarks.appendElement(rootElement);
			// console.log(rootTitle);
		});
	}); 
	
	
	
}

/* Bind <findUnvisited> to the browser-action */
// testButton.addEventListener('click', () => {
// 	//findUnvisited(urlList, onCheckCompleted);
// 	getBookmarks();
// })
getBookmarks();


// chrome.history.search({text: '', startTime: twoMonthAgo.getTime(), endTime: oneMonthAgo.getTime(), maxResults: 10000}, function(data) {
// 		let i = 0;
// 		let content = "";
// 	    data.forEach(function(page) {
// 	    	i++;
// 	        content += (i + '. ' + page.url + "<br/>");
// 	    });
    

// 	    if (data == ""){
// 	    	alert("No history from " + twoMonthAgo.toDateString() + " to " + oneMonthAgo.toDateString());
// 	    }

//     history.innerHTML = content;
// })
