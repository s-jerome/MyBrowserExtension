(function () {
	console.log(new Date().toLocaleString() + " -- [Twitter-mark-tweet-as-seen] Script started.");
	
	/**
	 * Which element to use for the "Mark": "A" for using an anchor / "SPAN" for using a span.
	 */
	const ANCHOR_OR_SPAN = "A";
	
	/** @type {Set<String>} */
	let _markedTweetIds = new Set();
	
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
	 * The last time the marked tweets were sync with the background, in ISO format.
	 * @type {String}
	 */
	let _lastMarkedTweetsSyncISO = "";
	
	/**
	 * Get the marked tweets from the background.
	 */
	function getMarkedTweets() {
		chrome.runtime.sendMessage({ site: "Twitter", action: "getMarkedTweets", lastSyncISO: _lastMarkedTweetsSyncISO }, function (response) {
			/** @type {Array<String>} */
			let tweetIds = response;
			if (Array.isArray(tweetIds) && tweetIds.length > 0) {
				let newMarkedTweetsReceived = false;
				for (let i = 0; i < tweetIds.length; i++) {
					let tweetId = tweetIds[i];
					if (_markedTweetIds.has(tweetId) == false) {
						_markedTweetIds.add(tweetId);
						newMarkedTweetsReceived = true;
					}
				}
				
				if (newMarkedTweetsReceived)
					markTweetsOnPage();
			}
			_lastMarkedTweetsSyncISO = new Date().toISOString();
		});
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
		if (_markedTweetIds.has(tweetId)) {
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
	 * Mark the given tweet as seen (send its id to the background and change the background-color).
	 * @param {HTMLElement} anchor 
	 */
	function markTweetAsSeen(anchor) {
		if (_markedTweetIds.has(anchor.__caogl_tweetId) == false) {
			_markedTweetIds.add(anchor.__caogl_tweetId);
			//.. When a tweet is marked, its id is sent to the background where all the marked tweets on all pages are centralised;
			chrome.runtime.sendMessage({ site: "Twitter", action: "markTweet", tweetId: anchor.__caogl_tweetId, tweetUrl: anchor.href }, function (response) {
				//.. The background color changes only if a response is received from the background,
				//.. so I know it worked.
				anchor.__caogl_article.style.backgroundColor = _config.backgroundColor;
				_lastMarkedTweetsSyncISO = new Date().toISOString();
			});
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
		
		getMarkedTweets();
		
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
			if (document.hidden == false) {
				getMarkedTweets();
			}
		});
	}
	
	if (document.readyState == "loading")
		window.addEventListener("DOMContentLoaded", handlePageLoaded);
	else
		handlePageLoaded();
})();