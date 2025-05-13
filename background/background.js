chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
	if (message.feature != null) {
		if (message.feature == "VideoSleep") {
			if (message.action == "getData") {
				message.videoSleepData = window.videoSleepData;
				sendResponse(message);
			} else if (message.action == "create") {
				let addOrUpdate = "add";
				if (window.videoSleepData != null) {
					clearTimeout(window.videoSleepData.timeout);
					addOrUpdate = "update";
				}
				window.videoSleepData = {};
				window.videoSleepData.scope = message.scope;
				window.videoSleepData.minutes = message.minutes;
				window.videoSleepData.timeout = setTimeout(function () {
					console.log(new Date().toLocaleString() + " -- [VideoSleep] timeout over.");
					window.videoSleepData = null;
					chrome.tabs.update(sender.tab.id, { url: message.redirectUrl });
				}, message.minutes * 60 * 1000);
				let now = new Date();
				window.videoSleepData.startedAt = now;
				console.log(now.toLocaleString() + " -- [VideoSleep] " + addOrUpdate + " sleep of " + message.minutes + " min.");
				sendResponse(message);
			} else if (message.action == "stop") {
				if (window.videoSleepData != null) {
					console.log(new Date().toLocaleString() + " -- [VideoSleep] stop.");
					clearTimeout(window.videoSleepData.timeout);
					window.videoSleepData = null;
					sendResponse(message);
				}
			}
		}
		return;
	}
	
	if (message.site != null) {
		if (message.site == "LinkedIn") {
			if (message.action == "openTab") {
				openTab(message.url, sender.tab);
			}
		} else if (message.site == "Twitter") {
			if (message.action == "getMarkedTweets") {
				let markedTweets = Twitter.getMarkedTweets(message.lastSyncISO);
				sendResponse(markedTweets);
			} else if (message.action == "markTweet") {
				Twitter.addMarkedTweet(message.tweetId);
				//.. Send a response so that the content script knows it worked.
				sendResponse(message);
			} else if (message.action == "openTab") {
				openTab(message.url, sender.tab);
			}
		} else if (message.site == "Youtube") {
			if (message.action == "getRatedVideos") {
				let ratedVideos = Youtube.getRatedVideos(message.lastSyncTime);
				sendResponse(ratedVideos);
			} else if (message.action == "setRatedVideo") {
				Youtube.setRatedVideoAsync(message.videoDetails, message.rating).then(function (result) {
					sendResponse(result);
				});
				return true;
			}
		}
		return;
	}
});

/**
 * 
 * @param {String} url 
 * @param {any} fromTab The tab from which the new tab is open.
 */
function openTab(url, fromTab) {
	chrome.tabs.query({ windowId: fromTab.windowId }, function (tabs) {
		let index = fromTab.index + 1;
		while (index < tabs.length) {
			let tab = tabs[index];
			if (tab.openerTabId == null || tab.openerTabId != fromTab.id)
				break;
			index++;
		}
		//.. Note: If I'm debugging with the background page open and a breakpoint,
		//.. to make this code working, the windowId must be set.
		chrome.tabs.create({ active: false, url: url, index: index, openerTabId: fromTab.id, windowId: fromTab.windowId });
	});
}