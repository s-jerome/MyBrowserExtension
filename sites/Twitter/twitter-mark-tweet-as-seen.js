(function () {
	console.log(new Date().toLocaleString() + " -- [Twitter-mark-tweet-as-seen] Script started.");
	
	/**
	 * Which element to use for the "Mark": "A" for using an anchor / "SPAN" for using a span.
	 */
	const ANCHOR_OR_SPAN = "A";
	
	/** @type {Map<String, {tweetId: String, markedAt: String, tweetUrl: String}>} */
	let _markedTweets = new Map();
	
	let _config = {
		markText: "Mark",
		/**
		 * The background color of a tweet when marked as seen.
		 */
		backgroundColor: "#d06060"
	};
	
	(function readConfig() {
		let itemValue = localStorage.getItem("caoglMarkTweet");
		if (itemValue != null && itemValue != "")
			_config = JSON.parse(itemValue);
	})();
	
	/**
	 * Regex used to get the id of a tweet, placed at the end of the url (https://x.com/<account>/status/<tweetId>).
	 * 
	 * Note: it's important to add "/status/" in the regex to ignore urls looking like: "https://x.com/i/communities/<tweetId>"
	 */
	const REGEX_TWEET_ID = new RegExp(/\/status\/(?<tweetId>\d{10,})$/);
	
	/**
	 * The timeout used to save the marked tweets in the storage.
	 * I don't want to save them each time I mark a tweet,
	 * because I might mark multiple of them in a laps of a few seconds,
	 * so I setup a timeout.
	 */
	let _saveTimeout = null;
	
	/**
	 * Determine if the storage changed, e.g. I marked tweets while being on another Twitter page.
	 */
	let _storageChanged = false;
	
	function handleStorageChanged(changes, /** @type {String} */ areaName) {
		if (areaName != "local")
			return;
		if (changes["Twitter.MarkedTweets"] == null || changes["Twitter.MarkedTweets"].newValue == null)
			return;
		let newTweetsAreAdded = addNewMarkedTweets(changes["Twitter.MarkedTweets"].newValue);
		if (newTweetsAreAdded) {
			if (document.hidden) {
				//.. I marked tweets on another Twitter tab, and they are saved in the storage, firing this event.
				//.. The current page is actually hidden, so no need to loop through the DOM.
				//.. It will be done when "visibilitychange" event will be fired.
				_storageChanged = true;
			}
			else {
				//.. I marked tweets on another Twitter tab, and I get on this tab before the end of the timeout in charge of the save in the storage.
				//.. This is what happens:
				//.. 1. the "visibilitychange" event of the other tab is fired, provoking the save in the storage
				//.. 2. the "visibilitychange" event of this tab is fired, but the save in the storage is not done yet
				//.. 3. the save in the storage is done, so this event is fired.
				markTweetsOnPage();
			}
		}
	}
	
	chrome.storage.onChanged.addListener(handleStorageChanged);
	
	/**
	 * @param {Array<{tweetId: String, markedAt: String, tweetUrl: String}>} markedTweets 
	 * @returns true if new marked tweets are added to list; false otherwise.
	 */
	function addNewMarkedTweets(markedTweets) {
		let added = false;
		for (let i = 0; i < markedTweets.length; i++) {
			let markedTweet = markedTweets[i];
			if (_markedTweets.has(markedTweet.tweetId) == false) {
				_markedTweets.set(markedTweet.tweetId, markedTweet);
				added = true;
			}
		}
		return added;
	}
	
	/**
	 * Mark the given article if necessary.
	 * @param {HTMLElement} article
	 */
	function markArticle(article) {
		let tweetId = "";
		let tweetUrl = "";
		let anchors = article.querySelectorAll("a");
		if (anchors.length == 0)
			return;
		for (let i = 0; i < anchors.length; i++) {
			let anchor = anchors[i];
			let match = anchor.href.match(REGEX_TWEET_ID);
			if (match != null && match.groups != null && match.groups["tweetId"] != null) {
				tweetId = match.groups["tweetId"];
				tweetUrl = anchor.href;
				break;
			}
		}
		if (tweetId == "")
			return;
		if (_markedTweets.has(tweetId)) {
			if (article.style.backgroundColor != _config.backgroundColor) {
				article.style.setProperty("background-color", _config.backgroundColor);
			}
		}
		
		if (article.hasAttribute("caogl-marked"))
			return;
		
		//.. The article has a "aria-labelledby" attribute, containing a list of ids.
		//.. The last one should be the id of the div containing the elements allowing to respond, retweet, like etc.
		let arialabelledby = article.getAttribute("aria-labelledby");
		if (arialabelledby == null || arialabelledby == "")
			return;
		let ids = arialabelledby.split(" ");
		if (ids.length == 0)
			return;
		let lastId = ids[ids.length - 1];
		let footer = article.querySelector("#" + lastId);
		if (footer == null) {
			//.. It can happen that the last id in the "aria-labelledby" is related to no element.
			//.. In that case, I search for a div with an id and a "aria-label" attribute.
			let elements = article.querySelectorAll("div[id][aria-label]");
			if (elements.length != 1)
				return;
			footer = elements[0];
		}
		
		article.setAttribute("caogl-marked", "1");
		
		let div = document.createElement("div");
		div.className = "caogl-mark-tweet-container";
		//.. Depending on if I use an anchor or a span, the events to listen to are different.
		let markEl = document.createElement(ANCHOR_OR_SPAN);
		markEl.href = tweetUrl;
		markEl.innerText = _config.markText;
		markEl.className = "caogl-mark-tweet";
		markEl.setAttribute("caogl-tweet-id", tweetId);
		markEl.setAttribute("caogl-tweet-url", tweetUrl);
		if (ANCHOR_OR_SPAN == "A") {
			markEl.addEventListener("mouseup", handleMarkAnchorMouseUp);
		} else {
			markEl.addEventListener("mousedown", handleMarkSpanMouseDown);
			markEl.addEventListener("mouseup", handleMarkSpanMouseUp);
		}
		markEl.__caogl_article = article;
		markEl.__caogl_tweetUrl = tweetUrl;
		markEl.__caogl_tweetId = tweetId;
		div.appendChild(markEl);
		footer.appendChild(div);
	}
	
	/**
	 * 
	 * @param {MouseEvent} mouseEvent
	 */
	function handleMarkAnchorMouseUp(mouseEvent) {
		//.. Note: button 0 is left click, button 1 is middle click.
		if (mouseEvent.button == 0 || mouseEvent.button == 1) {
			markTweetAsSeen(mouseEvent.target);
		}
	}
	
	/**
	 * Prevent the wheel to appear if a middle mouse click is made.
	 * @param {MouseEvent} mouseEvent
	 */
	function handleMarkSpanMouseDown(mouseEvent) {
		//.. Note: button 0 is left click, button 1 is middle click.
		if (mouseEvent.button == 1)
			mouseEvent.preventDefault();
	}
	
	/**
	 * 
	 * @param {MouseEvent} mouseEvent
	 */
	function handleMarkSpanMouseUp(mouseEvent) {
		//.. Note: button 0 is left click, button 1 is middle click.
		if (mouseEvent.button == 0 || mouseEvent.button == 1) {
			markTweetAsSeen(mouseEvent.target);
			
			if (mouseEvent.button == 1) {
				/*
				There are multiple situations when cliking on my "Mask" span:
				- I left click of a reply tweet: the tweet is open and becomes the main tweet.
				- I middle click of a reply tweet: the tweet is open on a new tab automatically (I don't know why).
				- I left click of the current tweet: no need to open it in this tab or in a new one.
				- I middle click of the current tweet: I need to manually create a tab to open the tweet.
				*/
				let match = document.location.href.match(REGEX_TWEET_ID);
				if (match != null && match.groups["tweetId"] != null) {
					let currentTweetId = match.groups["tweetId"];
					if (mouseEvent.target.__caogl_tweetId == currentTweetId) {
						chrome.runtime.sendMessage({ site: "Twitter", action: "openTab", url: mouseEvent.target.__caogl_tweetUrl });
					}
				}
			}
		}
	}
	
	/**
	 * Mark the given tweet as seen by changing its background color and saving it in the storage.
	 * @param {HTMLElement} anchor 
	 */
	function markTweetAsSeen(anchor) {
		if (_markedTweets.has(anchor.__caogl_tweetId) == false) {
			//.. Note: the date has to be in ISO to be converted by the Date constructor.
			_markedTweets.set(anchor.__caogl_tweetId, { tweetId: anchor.__caogl_tweetId, markedAt: new Date().toISOString(), tweetUrl: anchor.href });
			save();
			anchor.__caogl_article.style.backgroundColor = _config.backgroundColor;
		}
	}
	
	/**
	 * Mark all the tweets on the page that need to be marked.
	 */
	function markTweetsOnPage() {
		let articles = document.getElementsByTagName("article");
		for (let i = 0; i < articles.length; i++) {
			let article = articles[i];
			markArticle(article);
		}
	}
	
	/**
	 * Add in the header a stylesheet for my "Mark" span.
	 */
	function injectCSS() {
		let cssEl = document.createElement("style");
		cssEl.id = "caogl-css";
		cssEl.innerHTML = ".caogl-mark-tweet-container { display: flex; align-items: center; } .caogl-mark-tweet { color: lightyellow; font-family: \"Segoe UI\"; text-decoration: none; cursor: pointer; } .caogl-mark-tweet:hover { color: rgb(29, 155, 240); }";
		document.head.appendChild(cssEl);
	}
	
	function handlePageLoaded() {
		injectCSS();
		
		//.. Twitter is listening the "click" event on the document.
		//.. The name of the function should be "_handleFocusChange".
		//.. So I have to listen to this event to prevent the opening of a tweet
		//.. when clicking on my "Mark" span.
		document.addEventListener("click", function (pointerEvent) {
			if (pointerEvent.target != null && pointerEvent.target.className == "caogl-mark-tweet") {
				pointerEvent.preventDefault();
			}
		}, true);
		
		chrome.storage.local.get({ "Twitter.MarkedTweets": [] }, function (items) {
			/** @type {Array<String>} */
			let markedTweets = items["Twitter.MarkedTweets"];
			addNewMarkedTweets(markedTweets);
			markTweetsOnPage();
		});
		
		//.. Observe the adding of tweets to mark them as seen if necessary.
		let mutationObserver = new MutationObserver(function (mutations) {
			for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
				let mutation = mutations[mutationIndex];
				for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
					/**
					 * @type {HTMLElement}
					 */
					let addedNode = mutation.addedNodes[nodeIndex];
					if (addedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					
					if (addedNode.tagName == "DIV" && addedNode.hasAttribute("data-testid") &&
						addedNode.firstElementChild != null && addedNode.firstElementChild.tagName == "DIV") {
						/** @type {HTMLElement} */
						let child1 = addedNode.firstElementChild;
						if (child1.firstElementChild == null || child1.firstElementChild.tagName != "DIV")
							continue;
						let child2 = child1.firstElementChild;
						if (child2.firstElementChild == null || child2.firstElementChild.tagName != "ARTICLE")
							continue;
						markArticle(child2.firstElementChild);
					}
				}
			}
		});
		mutationObserver.observe(document.body, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true
		});
		
		document.addEventListener("visibilitychange", function (event) {
			//.. The visibility changes when going on another tab, or when Chrome is minimised.
			//.. Each time the visibility changes, all the marked tweets are get, in case I was on a Twitter1 page, then moved on Twitter2 page, marked some tweets,
			//.. and then come back to Twitter1 page.
			if (document.hidden) {
				if (_saveTimeout != null)
					saveNow();
			} else if (_storageChanged) {
				//.. Tweets were marked on another Twitter tab and saved in the storage.
				_storageChanged = false;
				markTweetsOnPage();
			}
		});
	}
	
	function save() {
		if (_saveTimeout == null) {
			_saveTimeout = setTimeout(function () {
				saveNow();
			}, 15000);
		}
	}
	
	function saveNow() {
		if (_saveTimeout != null) {
			clearTimeout(_saveTimeout);
			_saveTimeout = null;
		}
		
		let markedTweets = Array.from(_markedTweets.values());
		chrome.storage.onChanged.removeListener(handleStorageChanged);
		chrome.storage.local.set({ "Twitter.MarkedTweets": markedTweets }, function () {
			chrome.storage.onChanged.addListener(handleStorageChanged);
		});
	}
	
	if (document.readyState == "loading")
		window.addEventListener("DOMContentLoaded", handlePageLoaded);
	else
		handlePageLoaded();
})();