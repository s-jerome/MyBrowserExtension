import * as Config from "../sw-config.js";

export async function deleteOlderTweetsAsync() {
	let sessionStorageKey = "Twitter.olderTweetsDeletedAt";
	let { [sessionStorageKey]: olderTweetsDeletedAt } = await chrome.storage.session.get(sessionStorageKey);
	if (olderTweetsDeletedAt != null) {
		//.. The older tweets have already been deleted in this session.
		return;
	}
	
	let today = new Date();
	let todayTime = today.setHours(0, 0, 0, 0);
	if (todayTime == olderTweetsDeletedAt) {
		//.. The older tweets have already been deleted today.
		return;
	}
	let retentionDays = await Config.getNumberAsync("Twitter.markedTweets.retentionDays", 7);
	let expirationDate = new Date();
	expirationDate.setDate(expirationDate.getDate() - retentionDays);
	expirationDate.setHours(0, 0, 0, 0);
	
	let needToSave = false;
	let localStorageKey = "Twitter.MarkedTweets";
	let item = await chrome.storage.local.get({ [localStorageKey]: [] });
	/** @type {Array<{tweetId: String, markedAt: String, tweetUrl: String}>} */
	let markedTweets = item[localStorageKey];
	for (let i = markedTweets.length - 1; i >= 0; i--) {
		let markedTweet = markedTweets[i];
		let markedAt = new Date(markedTweet.markedAt);
		if (markedAt < expirationDate) {
			markedTweets.splice(i, 1);
			needToSave = true;
		}
	}
	if (needToSave) {
		await chrome.storage.local.set({ [localStorageKey]: markedTweets });
	}
	
	await chrome.storage.session.set({ [sessionStorageKey]: todayTime });
}