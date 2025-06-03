/**
 * This script changes the background color of news that have already been displayed in previous visits
 * so that I can focus more on the new news, the ones I haven't seen yet.
 * It also changes some CSS rules to present the news by line.
 */
const caoglNews = (function () {
	console.log(new Date().toLocaleString() + " -- [news.google] Script started.");
	
	class PageData {
		/**
		 * The date the news was displayed the first time. 
		 * @type {Date}
		 */
		date;
		/**
		 * Determine if the page is currently open. 
		 * @type {Boolean}
		 */
		isOpen;
		/** @type {string} */
		href;
		/** @type {string} */
		title;
		
		/**
		 * @param {String} href 
		 * @param {String} title 
		 */
		constructor(href, title) {
			this.date = new Date();
			this.isOpen = false;
			this.href = href;
			this.title = title;
		}
	}
	
	/**
	 * Some websites add a text like " - $website" at the end of their title.
	 * These texts have to be removed so that the titles of the open tabs fit with the titles on the news page.
	 */
	class TitleCorrection {
		/** @type {String} */
		hostname;
		/** @type {String} */
		searchValue;
		/** @type {String} */
		comment;
	}
	
	/**
	 * The background color for the news that have already been displayed.
	 */
	const ALREADY_SEEN_BACKGROUND_COLOR = "black";
	/**
	 * The background color for the news that I have already opened (but are not open right now).
	 */
	const ALREADY_OPEN_BACKGROUND_COLOR = "steelblue";
	/**
	 * The background color for the news that are currently open in a tab.
	 */
	const ALREADY_OPEN_TAB_BACKGROUND_COLOR = "blue";
	
	/**
	 * Determine if the CSS of the containers of the articles is already changed so that the news are displayed by line.
	 */
	let _newsContainerCSSIsChanged = false;
	
	/** @type {Array<PageData>} */
	let _newsData = [];
	
	/** @type {Array<PageData>} */
	let _openTabs = [];
	
	/**
	 * The HTML elements attached to a MutationObserver.
	 * @type {Array<HTMLElement>}
	 */
	let _observedElements = [];
	
	/**
	 * The timeout before actually saving in the localStorage.
	 */
	let _saveTimeout = null;
	
	/** @type {Array<TitleCorrection>} */
	let _titleCorrections = [];
	
	/**
	 * Read of the previous displayed news that have been saved in the localStorage.
	 */
	function readSavedNewsData() {
		let itemValue = localStorage.getItem("caoglNews");
		if (itemValue == null || itemValue == "")
			return;
		_newsData = [];
		/** @type {Array<PageData>} */
		let newsData = JSON.parse(itemValue);
		if (newsData.length > 0) {
			let today = new Date();
			let fewDaysAgo = new Date(today.setDate(today.getDate() - 7));
			for (let i = 0; i < newsData.length; i++) {
				let nd = newsData[i];
				//.. The date is saved in ISO string, so it needs to be converted.
				nd.date = new Date(nd.date);
				if (nd.date <= fewDaysAgo) {
					//.. Remove of old news.
					continue;
				}
				_newsData.push(nd);
			}
		}
	}
	
	/**
	 * Read of the title corrections saved in the localStorage.
	 */
	function readTitleCorrections() {
		let itemValue = localStorage.getItem("caoglTitleCorrections");
		if (itemValue == null || itemValue == "")
			return;
		_titleCorrections = JSON.parse(itemValue);
	}
	
	/**
	 * Observe the given "c-wiz" element which contains the news for a category ("Local", "Business"...).
	 * @param {HTMLElement} cwizEl 
	 */
	function observeCWiz(cwizEl) {
		//.. Get the articles already present.
		let articles = cwizEl.querySelectorAll("article");
		for (let i = 0; i < articles.length; i++) {
			let article = articles[i];
			handleArticle(article);
		}
		
		//.. Observe the adding of articles when scrolling down.
		if (cwizEl.__caogl_mo == null) {
			cwizEl.__caogl_mo = new MutationObserver(function (mutations) {
				for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
					let mutation = mutations[mutationIndex];
					for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
						/** @type {HTMLElement} */
						let addedNode = mutation.addedNodes[nodeIndex];
						if (addedNode.nodeType != Node.ELEMENT_NODE)
							continue;
						if (addedNode.tagName != "ARTICLE")
							continue;
						handleArticle(addedNode);
					}
					
					//.. Note: no need to check if elements are removed here.
					//.. We would want to know when the articles of the current "c-wiz" are removed in order to disconnect their MutationObserver,
					//.. but in fact they are not removed, only the "c-wiz" elements are removed from the body,
					//.. and when they are, the articles they contain are removed too.
				}
			});
			cwizEl.__caogl_mo.observe(cwizEl, {
				attributes: false,
				childList: true,
				characterData: false,
				subtree: true
			});
			_observedElements.push(cwizEl);
		}
	}
	
	/**
	 * Process the given article element to get its title and href.
	 * @param {HTMLElement} articleEl 
	 */
	async function handleArticle(articleEl) {
		for (let attempt = 0; attempt < 5; attempt++) {
			//.. There should be 2 anchors. Both have the same href, but only the second one has a text value (the title of the news).
			/** @type {NodeListOf<HTMLAnchorElement>} */
			let anchors = articleEl.querySelectorAll("a[target='_blank']");
			let href = "";
			let title = "";
			for (let i = 0; i < anchors.length; i++) {
				let anchor = anchors[i];
				if (href != anchor.href)
					href = anchor.href;
				if (title != anchor.textContent && anchor.textContent != "")
					title = anchor.textContent;
			}
			if (href != "" && title != "") {
				articleEl.style.backgroundColor = "";
				let newsData = new PageData(href, title);
				handleNews(articleEl, newsData);
				return;
			}
			
			//.. Rarely, the href and the title of a news can't be find straight away.
			//.. Hence the fact that I put this code in a for loop for multiple attempts.
			articleEl.style.backgroundColor = "orange";
			await sleepAsync(500);
		}
		articleEl.style.backgroundColor = "red";
	}
	
	/**
	 * 
	 * @param {HTMLElement} articleEl 
	 * @param {PageData} news 
	 */
	function handleNews(articleEl, news) {
		displayNewsByLine(articleEl);
		
		//.. Maybe the news is already open in a tab. To check that, we can't rely on its url,
		//.. because a url in the news.google page looks like: https://news.google.com/articles/<id>?<some-params>
		//.. but the url in the tab will have the real url of the website.
		let newsIsAlreadyOpen = false;
		articleEl.__caogl_news = _openTabs.find(t => t.title == news.title);
		if (articleEl.__caogl_news != null) {
			newsIsAlreadyOpen = true;
			//.. The news is added twice, with the real url, and the redirect url.
			//.. In case of I close the tab of the news, the news has to be found by its redirect url among the previously displayed news.
			_newsData.push(articleEl.__caogl_news);
			_newsData.push(news);
		} else {
			articleEl.__caogl_news = _newsData.find(nd => nd.href == news.href && nd.title == news.title);
		}
		if (articleEl.__caogl_news != null) {
			save();
			articleEl.__caogl_bgc = newsIsAlreadyOpen == false ?
				articleEl.__caogl_news.isOpen ? ALREADY_OPEN_BACKGROUND_COLOR : ALREADY_SEEN_BACKGROUND_COLOR :
				ALREADY_OPEN_TAB_BACKGROUND_COLOR;
			articleEl.style.backgroundColor = articleEl.__caogl_bgc;
		} else if (document.location.href.startsWith("https://news.google.com/home") == false) {
			//.. I don't want to process the news displayed on the homepage.
			//.. I don't want them to be marked when I go to the different categories ("Local", "Business"...).
			articleEl.__caogl_news = news;
			_newsData.push(news);
			save();
		}
		
		if (document.location.href.startsWith("https://news.google.com/home") == false) {
			//.. The articles have to be observed, because when scrolling down,
			//.. the articles on top lose the background color I set to them.
			if (articleEl.__caogl_mo == null) {
				articleEl.__caogl_mo = new MutationObserver(function (mutations) {
					for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
						let mutation = mutations[mutationIndex];
						/** @type {HTMLElement} */
						let target = mutation.target;
						if (target.style.backgroundColor == "")
							target.style.backgroundColor = target.__caogl_bgc;
					}
				});
				articleEl.__caogl_mo.observe(articleEl, {
					attributes: true,
					attributeFilter: ["style"],
					childList: false,
					subtree: false,
					attributeOldValue: true,
					characterData: true,
					characterDataOldValue: true
				});
				_observedElements.push(articleEl);
			}
		}
		
		//.. If I open a news on a new tab, the background color of the articles changes.
		if (articleEl.__caogl_click == null) {
			articleEl.__caogl_click = function (mouseEvent) {
				if (articleEl.__caogl_news != null && articleEl.__caogl_news.isOpen == false) {
					articleEl.__caogl_news.isOpen = true;
					articleEl.style.backgroundColor = ALREADY_OPEN_BACKGROUND_COLOR;
					save();
				}
			}
			articleEl.addEventListener("mouseup", articleEl.__caogl_click);
		}
	}
	
	/**
	 * Change the CSS so that the news are displayed by line and take 100% of the width of the parent.
	 * @param {HTMLElement} articleEl 
	 */
	function displayNewsByLine(articleEl) {
		//.. The news are dislayed in 2 columns, and want them to be displayed by line.
		
		if (_newsContainerCSSIsChanged)
			return;
		
		let parent = articleEl.parentElement;
		if (parent.tagName == "C-WIZ") {
			//.. If the parent of the given article is a c-wiz element rather than a div,
			//.. that means that this article is the only one in this container, and it takes already 100% width.
			return;
		}
		
		if (articleEl.classList.length == 1 && parent.classList.length == 1) {
			let cssEl = document.createElement("style");
			cssEl.id = "caogl-css-news";
			cssEl.innerHTML = "." + articleEl.classList[0] + " { width: 100%; } ." + parent.classList[0] + " { display: block; }";
			document.head.appendChild(cssEl);
			_newsContainerCSSIsChanged = true;
		}
	}
	
	/**
	 * Loop through the observed elements and disconnect their MutationObserve if they were removed from the DOM.
	 */
	function stopObservingRemovedElements() {
		for (let i = _observedElements.length - 1; i >= 0; i--) {
			let element = _observedElements[i];
			if (element.isConnected)
				continue;
			if (element.__caogl_mo != null) {
				element.__caogl_mo.disconnect();
				element.__caogl_mo = null;
			}
			_observedElements.splice(i, 1);
		}
	}
	
	function save() {
		if (_saveTimeout == null) {
			_saveTimeout = setTimeout(saveNow, 5000);
		}
	}
	
	function saveNow() {
		if (_saveTimeout != null) {
			clearTimeout(_saveTimeout);
			_saveTimeout = null;
		}
		
		let dataToSave = JSON.stringify(_newsData);
		localStorage.setItem("caoglNews", dataToSave);
	}
	
	/**
	 * @param {Number} msToWait 
	 */
	async function sleepAsync(msToWait) {
		return new Promise(function (resolve, reject) {
			setTimeout(resolve, msToWait);
		});
	}
	
	/**
	 * Send a message to the background to get the open tabs.
	 */
	async function queryOpenTabsAsync() {
		_openTabs = [];
		return new Promise(function (resolve, reject) {
			chrome.runtime.sendMessage({ site: "news.google", action: "getOpenTabs" }, function (response) {
				if (Array.isArray(response)) {
					let regexSpace160 = new RegExp(String.fromCharCode(160), "g");
					for (let tabIndex = 0; tabIndex < response.length; tabIndex++) {
						let tab = response[tabIndex];
						
						//.. Check if a page is open multiple times among the open tabs (duplicates).
						let duplicateTab = _openTabs.find(t => t.href == tab.url && t.title == tab.title);
						if (duplicateTab != null)
							continue;
						
						let tabData = new PageData(tab.url, tab.title);
						tabData.isOpen = true;
						//.. The space char code 160 must be replaced by the space char code 32.
						tabData.title = tabData.title.replace(regexSpace160, " ");
						
						let titleCorrection = _titleCorrections.find(tc => tabData.href.indexOf(tc.hostname) >= 0);
						if (titleCorrection != null) {
							tabData.title = tabData.title.replace(titleCorrection.searchValue, "");
						}
						_openTabs.push(tabData);
					}
				}
				
				resolve();
			});
		});
	}
	
	async function init() {
		readTitleCorrections();
		await queryOpenTabsAsync();
		
		readSavedNewsData();
		
		//.. Observe the "c-wiz" elements already present on page.
		let elements = document.querySelectorAll("body > c-wiz");
		for (let i = 0; i < elements.length; i++) {
			let element = elements[i];
			observeCWiz(element);
		}
		
		if (document.body.__caogl_mo == null) {
			//.. Observe the adding of "c-wiz" elements.
			let mo = new MutationObserver((mutations) => {
				let elementsAreRemoved = false;
				for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
					let mutation = mutations[mutationIndex];
					for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
						/** @type {HTMLElement} */
						let addedNode = mutation.addedNodes[nodeIndex];
						if (addedNode.nodeType != Node.ELEMENT_NODE)
							continue;
						if (addedNode.tagName != "C-WIZ")
							continue;
						observeCWiz(addedNode);
					}
					
					if (mutation.removedNodes.length > 0)
						elementsAreRemoved = true;
				}
				if (elementsAreRemoved)
					stopObservingRemovedElements();
			});
			mo.observe(document.body, {
				attributes: false,
				childList: true,
				characterData: false,
				subtree: false
			});
			document.body.__caogl_mo = mo;
		}
		
		//.. Change some CSS rules to better center the news horizontally when the browser window is not maximized.
		let mainEls = document.body.querySelectorAll("main");
		if (mainEls.length == 1) {
			let mainEl = mainEls[0];
			if (mainEl.classList.length != 1)
				return;
			let cssEl = document.createElement("style");
			cssEl.id = "caogl-css-width";
			cssEl.innerHTML = "@media screen and (max-width: 1080px) { ." + mainEl.className + " { margin-left: auto; margin-right: auto; } }";
			document.head.appendChild(cssEl);
		}
	}
	
	init();
	
	return {
		/**
		 * Delete the news saved in the last hour.
		 */
		__debug_removeSavedNewsFromLastHour() {
			if (_newsData.length == 0) {
				console.log("There is no saved news.");
				return;
			}
			
			let now = new Date();
			let oneHourAgo = new Date(now.setHours(now.getHours() - 1));
			let deletedNews = [];
			for (let i = _newsData.length - 1; i >= 0; i--) {
				let news = _newsData[i];
				if (news.date >= oneHourAgo) {
					_newsData.splice(i, 1);
					deletedNews.push(news);
				}
			}
			
			if (deletedNews.length > 0) {
				saveNow();
				console.log(deletedNews.length + " news deleted from the last hour (" + oneHourAgo.toLocaleString() + "):\n", deletedNews);
			} else {
				console.log("No news deleted from the last hour (" + oneHourAgo.toLocaleString() + ").");
			}
		},
		
		__debug_getAllNews() {
			console.log(_newsData);
		},
		
		/**
		 * @param {String} title 
		 */
		__debug_getNewsByTitle(title) {
			if (_newsData.length == 0) {
				console.log("There is no saved news.");
				return;
			}
			
			let newsFound = _newsData.filter(n => n.title.indexOf(title) >= 0);
			if (newsFound.length > 0)
				console.log(newsFound.length + " news found with the given title:\n", newsFound);
			else
				console.log("No news found with the given title.");
		},
		
		/**
		 * @param {String} hostname 
		 * @param {String} searchValue 
		 * @param {String} comment 
		 */
		__debug_addTitleCorrection(hostname, searchValue, comment) {
			let titleCorrection = _titleCorrections.find(tc => tc.hostname == hostname);
			if (titleCorrection != null) {
				console.log("A title correction for this hostname already exists.");
				return;
			}
			
			let tc = new TitleCorrection();
			tc.hostname = hostname;
			tc.searchValue = searchValue;
			tc.comment = comment;
			_titleCorrections.push(tc);
			localStorage.setItem("caoglTitleCorrections", JSON.stringify(_titleCorrections));
			
			//.. Refresh the background color of the articles.
			queryOpenTabsAsync().then(function () {
				let articles = document.body.getElementsByTagName("article");
				for (let i = 0; i < articles.length; i++) {
					let article = articles[i];
					handleArticle(article);
				}
			});
		},
		
		__debug_reloadTitleCorrections() {
			readTitleCorrections();
		}
	}
})();