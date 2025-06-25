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
	
	/**
	 * Among the given tweets, keep only those marked in the most recent x days.
	 * 
	 * Note: The goal is not to keep the tweets marked in the last x days starting from today,
	 * I want to keep those marked in the most recent x days, with the starting date being the most recent date a tweet was marked.
	 * So if I want to keep only the tweets marked in the most recent 7 days, and I didn't mark any tweet since 10 days ago,
	 * the 7 days start from 10 days ago, so I keep the tweets marked between 10 and 17 days ago.
	 * @param {Map<String, Array<{tweetId: String, markedAt: String, tweetUrl: String}>>} markedTweetsByDate 
	 */
	function keepMostRecentTweets(markedTweetsByDate) {
		let mostRecentDays = Config.getNumber("Twitter.markedTweets.mostRecentDays", 7);
		let dates = Array.from(markedTweetsByDate.keys());
		let tooManyDates = dates.length > mostRecentDays;
		if (tooManyDates) {
			//.. Sort by chronological order DESC.
			dates.sort((date1, date2) => date2 - date1);
			// for (let i = dates.length - 1; i >= mostRecentDays; i--) {
			// 	let date = dates[i];
			// 	markedTweetsByDate.delete(date);
			// 	dates.splice(i, 1);
			// }
			let datesToDelete = dates.splice(mostRecentDays);
			datesToDelete.forEach(date => markedTweetsByDate.delete(date));
			
			console.log(new Date().toLocaleString() + " -- [Twitter] Deleting tweets marked on: " + datesToDelete.join(", "));
		}
		
		for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
			let date = dates[dateIndex];
			let tweetsData = markedTweetsByDate.get(date);
			if (tweetsData == null)
				continue;
			for (let tweetIndex = 0; tweetIndex < tweetsData.length; tweetIndex++) {
				let tweetData = tweetsData[tweetIndex];
				setMarkedTweet(tweetData.tweetId, tweetData.markedAt, tweetData.tweetUrl);
			}
		}
		
		if (tooManyDates)
			saveMarkedTweetsToLocalStorage();
	}
	
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
		readSavedMarkedTweets() {
			_lastMarkedTweetISO = new Date().toISOString();
			
			let itemValue = localStorage.getItem("MarkedTweets");
			if (itemValue == null || itemValue == "")
				return;
			
			//.. The marked tweets are stored by date,
			//.. to keep only those marked in the most recent x days.
			let regexDate = new RegExp(/(?<date>\d{4}-\d{2}-\d{2})/);
			/** @type {Map<String, Array<{tweetId: String, markedAt: String, tweetUrl: String}>>} */
			let markedTweetsByDate = new Map();
			
			/** @type {[string, MarkedTweet][]} */
			let savedMarkedTweets = JSON.parse(itemValue);
			for (let tweetIndex = 0; tweetIndex < savedMarkedTweets.length; tweetIndex++) {
				let [tweetId, savedMarkedTweet] = savedMarkedTweets[tweetIndex];
				let match = savedMarkedTweet.markedAt.match(regexDate);
				if (match == null)
					continue;
				let markedAtDate = match.groups["date"];
				let markedTweets = markedTweetsByDate.get(markedAtDate);
				if (markedTweets == null) {
					markedTweets = [];
					markedTweetsByDate.set(markedAtDate, markedTweets);
				}
				markedTweets.push({ tweetId: tweetId, markedAt: savedMarkedTweet.markedAt, tweetUrl: savedMarkedTweet.tweetUrl });
			}
			
			keepMostRecentTweets(markedTweetsByDate);
		},
		
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