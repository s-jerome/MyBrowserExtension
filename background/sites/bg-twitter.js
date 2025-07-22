const Twitter = (function () {
	return {
		deleteOlderTweets() {
			let today = new Date();
			today.setHours(0, 0, 0, 0);
			let retentionDays = Config.getNumber("Twitter.markedTweets.retentionDays", 7);
			let expirationDate = new Date();
			expirationDate.setDate(expirationDate.getDate() - retentionDays);
			expirationDate.setHours(0, 0, 0, 0);
			let needToSave = false;
			chrome.storage.local.get({ "Twitter.MarkedTweets": [] }, function (items) {
				/** @type {Array<{tweetId: String, markedAt: String, tweetUrl: String}>} */
				let markedTweets = items["Twitter.MarkedTweets"];
				for (let i = markedTweets.length - 1; i >= 0; i--) {
					let markedTweet = markedTweets[i];
					let markedAt = new Date(markedTweet.markedAt);
					if (markedAt < expirationDate) {
						markedTweets.splice(i, 1);
						needToSave = true;
					}
				}
				if (needToSave) {
					chrome.storage.local.set({ "Twitter.MarkedTweets": markedTweets });
				}
			});
		}
	}
})();