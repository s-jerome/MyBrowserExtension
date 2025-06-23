const Twitter = (function () {
	class MarkedTweet {
		/** @type {String} */
		markedAt;
		/** @type {String} */
		tweetUrl;
		
		/**
		 * @param {String} markedAt 
		 * @param {String} tweetUrl 
		 */
		constructor(markedAt, tweetUrl) {
			this.markedAt = markedAt;
			this.tweetUrl = tweetUrl;
		}
	}
	
	/** @type {Map<String, MarkedTweet>} */
	let _markedTweets = new Map();
	
	/**
	 * The last time a tweet was marked, in ISO format.
	 * @type {String}
	 */
	let _lastMarkedTweetISO = null;
	
	/**
	 * The timeout used to save the marked tweets in the localStorage.
	 * I don't want to save them each time I mark a tweet,
	 * because I might mark multiple of them in a laps of a few seconds,
	 * so I setup a timeout.
	 */
	let _saveTimeout = null;
	
	(function getMarkedTweetsFromLocalStorage() {
		let now = new Date();
		let today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
		let fiveDaysAgo = new Date(today.setDate(today.getDate() - 5)).toISOString();
		let needToSave = false;
		let itemValue = localStorage.getItem("MarkedTweets");
		if (itemValue != null && itemValue != "") {
			/** @type {[string, MarkedTweet][]} */
			let savedMarkedTweets = JSON.parse(itemValue);
			for (let tweetIndex = 0; tweetIndex < savedMarkedTweets.length; tweetIndex++) {
				let [tweetId, savedMarkedTweet] = savedMarkedTweets[tweetIndex];
				if (savedMarkedTweet.markedAt < fiveDaysAgo) {
					//.. The tweets marked at least 5 days ago are removed.
					needToSave = true;
					continue;
				}
				let contains = _markedTweets.has(tweetId);
				if (contains)
					continue;
				setMarkedTweet(tweetId, savedMarkedTweet.markedAt, savedMarkedTweet.tweetUrl);
			}
		}
		
		if (needToSave)
			saveMarkedTweetsToLocalStorage();
		
		_lastMarkedTweetISO = now.toISOString();
	})();
	
	/**
	 * @param {String} tweetId 
	 * @param {String} markedAt 
	 * @param {String} tweetUrl 
	 */
	function setMarkedTweet(tweetId, markedAt, tweetUrl) {
		let markedTweet = new MarkedTweet(markedAt, tweetUrl);
		_markedTweets.set(tweetId, markedTweet);
	}
	
	function saveMarkedTweetsToLocalStorage() {
		let array = Array.from(_markedTweets.entries());
		let itemValue = JSON.stringify(array);
		localStorage.setItem("MarkedTweets", itemValue);
	}
	
	function createSaveTimeout() {
		if (_saveTimeout != null)
			clearTimeout(_saveTimeout);
		_saveTimeout = setTimeout(function () {
			saveMarkedTweetsToLocalStorage();
			clearTimeout(_saveTimeout);
			_saveTimeout = null;
		}, 10000);
	}
	
	return {
		/**
		 * @param {String} tweetId 
		 * @param {String} tweetUrl 
		 */
		addMarkedTweet(tweetId, tweetUrl) {
			let contains = _markedTweets.has(tweetId);
			if (contains)
				return;
			_lastMarkedTweetISO = new Date().toISOString();
			setMarkedTweet(tweetId, _lastMarkedTweetISO, tweetUrl);
			createSaveTimeout();
		},
		
		/**
		 * 
		 * @param {String} lastSyncISO 
		 * @returns 
		 */
		getMarkedTweets(lastSyncISO) {
			let markedTweets = [];
			
			if (lastSyncISO != null && lastSyncISO != "" && lastSyncISO >= _lastMarkedTweetISO) {
				//.. No new marked tweets since the last sync.
				return markedTweets;
			}
			
			if (lastSyncISO == null || lastSyncISO == "") {
				//.. This is the first sync so all the marked tweets are returned.
				markedTweets = Array.from(_markedTweets.keys());
			} else {
				//.. Only the new marked tweets since the last sync are returned.
				let entries = Array.from(_markedTweets.entries());
				for (let i = entries.length - 1; i >= 0; i--) {
					let [tweetId, markedTweet] = entries[i];
					if (markedTweet.markedAt < lastSyncISO)
						break;
					markedTweets.push(tweetId);
				}
			}
			
			return markedTweets;
		},
		
		/**
		 * For debug purpose.
		 */
		clearMarkedTweets() {
			_markedTweets.clear();
			saveMarkedTweetsToLocalStorage();
			//.. TODO: send a message to all the Twitter tabs so that the marked tweets don't appear as marked anymore?
		},
		
		/**
		 * For debug purpose.
		 */
		save() {
			saveMarkedTweetsToLocalStorage();
		}
	}
})();