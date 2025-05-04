
/**
 * This script is like AdBlock for promoted tweets.
 * It intercepts XHR requests, analyse the response of the "TweetDetail" ones,
 * and remove from the response the promoted tweets so that I have no ads.
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [Twitter-is-remove-promoted-tweets] Script started.");
	
	/**
	 * The regex used to know if a url is the "TweetDetails" one (looking like: https://twitter.com/i/api/graphql/<letters-and-numbers>/TweetDetails?variables=...).
	 */
	const REGEX_TWEETDETAIL_URL = new RegExp(/\/TweetDetail\??/);
	
	const _xpo = XMLHttpRequest.prototype.open;
	
	/**
	 * @param {String} url
	 */
	XMLHttpRequest.prototype.open = function (method, url, async, username, password) {
		let match = url.match(REGEX_TWEETDETAIL_URL);
		if (match != null) {
			this.addEventListener("readystatechange", function (progressEvent) {
				if (this.readyState === 4) {
					let json = JSON.parse(this.responseText);
					if (json.data == null || json.data.threaded_conversation_with_injections_v2 == null ||
						json.data.threaded_conversation_with_injections_v2.instructions == null ||
						Array.isArray(json.data.threaded_conversation_with_injections_v2.instructions) == false)
						return;
					/** @type {Array} */
					let instructions = json.data.threaded_conversation_with_injections_v2.instructions;
					if (instructions.length != 2)
						return;
					if (instructions[0].entries == null || Array.isArray(instructions[0].entries == false))
						return;
					let numberPromotedTweets = 0;
					/** @type {Array} */
					let entries = instructions[0].entries;
					for (let entryIndex = entries.length - 1; entryIndex >= 0; entryIndex--) {
						let entry = entries[entryIndex];
						if (entry.content == null || entry.content.items == null || Array.isArray(entry.content.items) == false)
							continue;
						/** @type {Array} */
						let items = entry.content.items;
						for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
							let item = items[itemIndex];
							if (item.item == null || item.item.itemContent == null)
								continue;
							if (item.item.itemContent.promotedMetadata != null) {
								numberPromotedTweets++;
								entries.splice(entryIndex, 1);
							}
						}
					}
					if (numberPromotedTweets > 0) {
						Object.defineProperty(this, "response", { writable: true });
						Object.defineProperty(this, "responseText", { writable: true });
						let newResponse = JSON.stringify(json);
						this.response = this.responseText = newResponse;
					}
				}
			});
		}
		
		return _xpo.apply(this, arguments);
	}
})();