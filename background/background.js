chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
	if (message.feature != null) {
		if (message.feature == "GoBack") {
			GoBack.goBack();
		} else if (message.feature == "VideoSleep") {
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
		} else if (message.site == "Netflix") {
			if (message.action == "saveVideoData") {
				Netflix.saveVideoDataAsync(message.operation, message.reason, message.videoData).then(function (result) {
					sendResponse(result);
				});
				return true;
			}
		} else if (message.site == "news.google") {
			if (message.action == "getOpenTabs") {
				chrome.tabs.query({}, function (tabs) {
					sendResponse(tabs);
				});
				return true;
			}
		} else if (message.site == "Twitter") {
			if (message.action == "openTab") {
				openTab(message.url, sender.tab);
			}
		} else if (message.site == "Youtube") {
			if (message.domain == "download") {
				if (message.action == "download") {
					YoutubeDownload.downloadAsync(message.videoId, message.audioUrl, message.audioContentLength, message.videoUrl, message.videoContentLength).then(function (response) {
						sendResponse(response);
					});
					return true;
				} else if (message.action == "getVideoData") {
					YoutubeDownload.getVideoDataAsync(message.videoId, message.visitorData).then(function (response) {
						sendResponse(response);
					});
					return true;
				} else if (message.action == "openFile") {
					YoutubeDownload.openFileAsync(message.videoId).then(function (response) {
						sendResponse(response);
					});
					return true;
				}
			} else if (message.domain == "rating") {
				if (message.action == "getRatedVideos") {
					let ratedVideos = YoutubeRating.getRatedVideos(message.lastSyncTime);
					sendResponse(ratedVideos);
				} else if (message.action == "setRatedVideo") {
					YoutubeRating.setRatedVideoAsync(message.videoDetails, message.rating).then(function (result) {
						sendResponse(result);
					});
					return true;
				}
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

(async function init() {
	await Config.read();
	Twitter.deleteOlderTweets();
	YoutubeRating.getAllRatedVideosAsync();
})();