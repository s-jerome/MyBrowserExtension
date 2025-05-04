const Twitter = (function () {
	/** @type {Map<String, Date>} */
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
			/** @type {Array<String>} */
			let markedTweets = JSON.parse(itemValue);
			for (let tweetIndex = 0; tweetIndex < markedTweets.length; tweetIndex++) {
				let [tweetId, date] = markedTweets[tweetIndex];
				if (date < fiveDaysAgo) {
					//.. The tweets marked at least 5 days ago are removed.
					needToSave = true;
					continue;
				}
				let contains = _markedTweets.has(tweetId);
				if (contains)
					continue;
				_markedTweets.set(tweetId, date);
			}
		}
		
		if (needToSave)
			saveMarkedTweetsToLocalStorage();
		
		_lastMarkedTweetISO = now.toISOString();
	})();
	
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
		 * 
		 * @param {String} markedTweetId 
		 */
		addMarkedTweet: function (markedTweetId) {
			let contains = _markedTweets.has(markedTweetId);
			if (contains)
				return;
			_lastMarkedTweetISO = new Date().toISOString();
			_markedTweets.set(markedTweetId, _lastMarkedTweetISO);
			createSaveTimeout();
		},
		
		/**
		 * 
		 * @param {String} lastSyncISO 
		 * @returns 
		 */
		getMarkedTweets: function (lastSyncISO) {
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
					let [tweetId, date] = entries[i];
					if (date < lastSyncISO)
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