
/**
 * This script is like AdBlock for promoted tweets.
 * It intercepts XHR requests, analyse the response of some of them,
 * and remove from the response the promoted tweets so that I have no ads.
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [Twitter-is-remove-promoted-tweets] Script started.");
	
	/**
	 * The regex used to know if a url is the "TweetDetail" one (looking like: https://x.com/i/api/graphql/<letters-and-numbers>/TweetDetail?variables=...).
	 * This request is made on a tweet page to get its responses.
	 */
	const REGEX_TWEETDETAIL_URL = new RegExp(/\/TweetDetail\??/);
	
	/**
	 * The regex used to know if a url is the "HomeLatestTimeline" one (looking like: https://x.com/i/api/graphql/<letters-and-numbers>/HomeLatestTimeline).
	 * This request is made on the homepage.
	 */
	const REGEX_HOMELATESTTIMELINE_URL = new RegExp(/\/HomeLatestTimeline\??/);
	
	const _xpo = XMLHttpRequest.prototype.open;
	
	/**
	 * @param {String} url
	 */
	XMLHttpRequest.prototype.open = function (method, url, async, username, password) {
		let match = url.match(REGEX_TWEETDETAIL_URL);
		if (match != null) {
			processTweetDetailRequest(this);
			return _xpo.apply(this, arguments);
		}
		
		match = url.match(REGEX_HOMELATESTTIMELINE_URL);
		if (match != null) {
			processHomeRequest(this);
			return _xpo.apply(this, arguments);
		}
		
		return _xpo.apply(this, arguments);
	}
	
	/**
	 * Remove ads from the given request made on a tweet page.
	 * @param {XMLHttpRequest} request 
	 */
	function processTweetDetailRequest(request) {
		request.addEventListener("readystatechange", function (progressEvent) {
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
					changeResponse(this, json);
				}
			}
		});
	}
	
	/**
	 * Remove ads from the given request made on the homepage.
	 * @param {XMLHttpRequest} request 
	 */
	function processHomeRequest(request) {
		request.addEventListener("readystatechange", function (progressEvent) {
			if (this.readyState === 4) {
				let json = JSON.parse(this.responseText);
				if (json.data == null || json.data.home == null ||
					json.data.home.home_timeline_urt == null ||
					json.data.home.home_timeline_urt.instructions == null ||
					Array.isArray(json.data.home.home_timeline_urt.instructions) == false)
					return;
				/** @type {Array} */
				let instructions = json.data.home.home_timeline_urt.instructions;
				if (instructions.length == 0)
					return;
				let numberPromotedTweets = 0;
				let numberWhoToFollow = 0;
				for (let instructionIndex = 0; instructionIndex < instructions.length; instructionIndex++) {
					if (instructions[instructionIndex].entries == null || Array.isArray(instructions[instructionIndex].entries == false))
						continue;
					/** @type {Array} */
					let entries = instructions[instructionIndex].entries;
					for (let entryIndex = entries.length - 1; entryIndex >= 0; entryIndex--) {
						let entry = entries[entryIndex];
						if (entry.entryId == null)
							continue;
						if (entry.entryId.startsWith("promoted-tweet-")) {
							numberPromotedTweets++;
							entries.splice(entryIndex, 1);
						} else if (entry.entryId.startsWith("who-to-follow-")) {
							numberWhoToFollow++;
							entries.splice(entryIndex, 1);
						}
					}
				}
				if (numberPromotedTweets > 0 || numberWhoToFollow > 0) {
					changeResponse(this, json);
				}
			}
		});
	}
	
	/**
	 * Change the response of the given request by the given data.
	 * @param {XMLHttpRequest} request 
	 * @param {any} json 
	 */
	function changeResponse(request, json) {
		Object.defineProperty(request, "response", { writable: true });
		Object.defineProperty(request, "responseText", { writable: true });
		let newResponse = JSON.stringify(json);
		request.response = request.responseText = newResponse;
	}
})();