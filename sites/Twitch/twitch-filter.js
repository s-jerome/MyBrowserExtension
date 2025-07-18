/**
 * This script filters the thumbnail of streams from certain categories, mainly to avoid spoilers.
 */
const TwitchFilter = (function () {
	console.log(new Date().toLocaleString() + " -- [Twitch-filter] Script started.");
	
	/** @type {Array<String>} */
	let _filteredCategories = [];
	
	function readFilteredCategories() {
		let itemValue = localStorage.getItem("caoglFilteredCategories");
		if (itemValue == null || itemValue == "")
			return;
		/** @type {Array<String>} */
		let filteredCategories = JSON.parse(itemValue);
		_filteredCategories = filteredCategories.map(c => c.toLowerCase());
	}
	readFilteredCategories();
	
	function saveFilteredCategories() {
		localStorage.setItem("caoglFilteredCategories", JSON.stringify(_filteredCategories));
	}
	
	/**
	 * Add a CSS rule to blur the thumbnails.
	 */
	(function addCSS() {
		let cssEl = document.createElement("style");
		cssEl.id = "caogl-filter-css";
		cssEl.innerText = "[caogl-filter=\"blur-thumbnail\"] { filter: blur(30px); } ";
		document.head.appendChild(cssEl);
	})();
	
	/** @type {Array<HTMLElement>} */
	let _observedArticles = [];
	
	let mo = new MutationObserver(function (mutations) {
		let elementsAreRemoved = false;
		for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
			let mutation = mutations[mutationIndex];
			
			if (mutation.addedNodes.length > 0) {
				for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
					/** @type {HTMLElement} */
					let addedNode = mutation.addedNodes[nodeIndex];
					if (addedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					if (addedNode.tagName == "ARTICLE") {
						processArticle(addedNode);
						continue;
					}
					let articles = addedNode.getElementsByTagName("article");
					if (articles.length == 0)
						continue;
					for (let i = 0; i < articles.length; i++) {
						processArticle(articles[i]);
					}
				}
			}
			
			if (elementsAreRemoved == false && mutation.removedNodes.length > 0) {
				for (let nodeIndex = 0; nodeIndex < mutation.removedNodes.length; nodeIndex++) {
					let removedNode = mutation.removedNodes[nodeIndex];
					if (removedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					elementsAreRemoved = true;
					break;
				}
			}
		}
		
		if (elementsAreRemoved)
			stopObservingRemovedArticles();
	});
	mo.observe(document.body, {
		childList: true,
		subtree: true
	});
	
	/**
	 * 
	 * @param {HTMLElement} articleEl 
	 */
	function processArticle(articleEl) {
		if (articleEl.__caogl_mo != null)
			return;
		let mo = new MutationObserver(function () {
			filterThumbnail(articleEl);
		});
		mo.observe(articleEl, { childList: true, subtree: true });
		articleEl.__caogl_mo = mo;
		_observedArticles.push(articleEl);
		
		filterThumbnail(articleEl);
	}
	
	/**
	 * 
	 * @param {HTMLElement} articleEl 
	 * @returns 
	 */
	function filterThumbnail(articleEl) {
		let categoryEl = articleEl.querySelector("a[data-test-selector='GameLink']");
		if (categoryEl == null)
			return;
		let categoryLowerCase = categoryEl.textContent.toLowerCase();
		let needToFilter = _filteredCategories.find(c => categoryLowerCase.indexOf(c) >= 0) != null;
		let thumbnailIsFiltered = articleEl.__caogl_filter != null;
		if ((needToFilter == false && thumbnailIsFiltered == false)) {
			//.. This check has to be simple, and not too "closed" like this:
			//.. if ((needToFilter == true && thumbnailIsFiltered == true) || (needToFilter == false && thumbnailIsFiltered == false))
			//.. Because of the co-streams, their thumbnail are reset.
			//.. So we can get here, with a new img not filtered, and the article still having the __caogl_filter property.
			//.. That means that needToFilter = true and thumbnailIsFiltered = true. But the new thumbnail has to be filtered.
			return;
		}
		let imgs = articleEl.getElementsByTagName("img");
		if (imgs.length == 0)
			return;
		let imgsToProcess = [];
		//.. There should be 2 img and the one I want is the last one.
		for (let i = imgs.length - 1; i >= 0; i--) {
			let img = imgs[i];
			if (img.classList.length == 1 && img.classList[0] == "tw-image") {
				imgsToProcess.push(img);
				break;
			}
		}
		if (imgsToProcess.length == 0) {
			//.. If I can't find the thumbnail, all the img are filtered.
			imgsToProcess = imgs;
		}
		for (let i = 0; i < imgsToProcess.length; i++) {
			let img = imgsToProcess[i];
			if (needToFilter)
				img.setAttribute("caogl-filter", "blur-thumbnail");
			else
				img.removeAttribute("caogl-filter");
		}
		
		if (needToFilter && thumbnailIsFiltered == false)
			articleEl.__caogl_filter = true;
		else if (needToFilter == false && thumbnailIsFiltered)
			articleEl.__caogl_filter = null;
	}
	
	/**
	 * Loop through the observed articles and disconnect their MutationObserver if they were removed from the DOM.
	 */
	function stopObservingRemovedArticles() {
		for (let i = _observedArticles.length - 1; i >= 0; i--) {
			let article = _observedArticles[i];
			if (article.isConnected)
				continue;
			if (article.__caogl_mo != null) {
				article.__caogl_mo.disconnect();
				article.__caogl_mo = null;
			}
			_observedArticles.splice(i, 1);
		}
	}
	
	/**
	 * Loop through the observed articles and filter or not their thumbnail based on their category.
	 */
	function refresh() {
		for (let i = 0; i < _observedArticles.length; i++) {
			let article = _observedArticles[i];
			filterThumbnail(article);
		}
	}
	
	(function createConsoleFunctions() {
		window.caoglFilterConsole = {
			/**
			 * @param {String} category 
			 */
			addCategory(category) {
				let categoryLowerCase = category.toLowerCase();
				let index = _filteredCategories.indexOf(categoryLowerCase);
				if (index >= 0) {
					console.log("This category is already in the list.");
					return;
				}
				_filteredCategories.push(categoryLowerCase);
				saveFilteredCategories();
				refresh();
				return _filteredCategories;
			},
			
			clearCategories() {
				_filteredCategories = [];
				saveFilteredCategories();
				refresh();
				return _filteredCategories;
			},
			
			getFilteredCategories() {
				return _filteredCategories;
			},
			
			readFilteredCategories() {
				readFilteredCategories();
				refresh();
			},
			
			/**
			 * @param {Number} index 
			 */
			removeCategoryAt(index) {
				_filteredCategories.splice(index, 1);
				saveFilteredCategories();
				refresh();
				return _filteredCategories;
			},
			
			/**
			 * @param {String} category 
			 */
			removeCategory(category) {
				let categoryLowerCase = category.toLowerCase();
				let index = _filteredCategories.indexOf(categoryLowerCase);
				if (index < 0) {
					console.log("Can't find this category in the list.");
					return;
				}
				_filteredCategories.splice(index, 1);
				saveFilteredCategories();
				refresh();
				return _filteredCategories;
			}
		};
	})();
})();