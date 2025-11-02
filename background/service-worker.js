import { createMenus as createContextMenus } from "./context-menu.js";
import { log } from "./sw-log.js";
import { readSessionItem, saveSessionItem } from "./sw-storage.js";
import { goBackAsync, init as initFeatureGoBack } from "./features/GoBack/sw-go-back.js";
import { saveVideoDataAsync as saveNetflixVideoDataAsync } from "./sites/sw-netflix.js";
import { deleteOlderTweetsAsync } from "./sites/sw-twitter.js";
import { downloadAsync as downloadYoutubeVideoAsync, getVideoDataAsync as getYoutubeVideoDataAsync, openFileAsync as openYoutubeFileAsync } from "./sites/sw-youtube-download.js";
import { getRatedVideosAsync as getYoutubeRatedVideosAsync, setRatedVideoAsync as setYoutubeRatedVideoAsync } from "./sites/sw-youtube-rating.js";
import { init as initHeartbeat } from "./sw-heartbeat.js";

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
	if (message.feature != null) {
		if (message.feature == "GoBack") {
			goBackAsync();
		} else if (message.feature == "VideoSleep") {
			if (message.action == "getData") {
				chrome.alarms.get("VideoSleep").then(async function (alarm) {
					if (alarm != null) {
						let videoSleepData = await readSessionItem("VideoSleep", null);
						message.videoSleepData = videoSleepData;
					} else {
						message.videoSleepData = null;
						//.. Just in case...
						chrome.storage.session.remove("VideoSleep");
					}
					sendResponse(message);
				});
				return true;
			} else if (message.action == "create") {
				chrome.alarms.get("VideoSleep").then(async function (alarm) {
					let addOrUpdate = "add";
					if (alarm != null) {
						let wasCleared = await chrome.alarms.clear("VideoSleep");
						addOrUpdate = "update";
					}
					let videoSleepData = {};
					videoSleepData.scope = message.scope;
					videoSleepData.minutes = message.minutes;
					videoSleepData.tabId = sender.tab.id;
					videoSleepData.redirectUrl = message.redirectUrl;
					await chrome.alarms.create("VideoSleep", { delayInMinutes: message.minutes });
					let now = new Date();
					videoSleepData.startedAt = now.getTime();
					await saveSessionItem("VideoSleep", videoSleepData);
					await log(now.toLocaleString() + " -- [VideoSleep] " + addOrUpdate + " alarm of " + message.minutes + " min.");
					sendResponse(message);
				});
				return true;
			} else if (message.action == "stop") {
				readSessionItem("VideoSleep", null).then(async function (videoSleepData) {
					if (videoSleepData != null) {
						await log(new Date().toLocaleString() + " -- [VideoSleep] stop.");
						await chrome.alarms.clear("VideoSleep");
						await chrome.storage.session.remove("VideoSleep");
						sendResponse(message);
					}
				});
				return true;
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
				saveNetflixVideoDataAsync(message.operation, message.reason, message.videoData).then(function (result) {
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
					downloadYoutubeVideoAsync(message.videoId, message.audioUrl, message.audioContentLength, message.videoUrl, message.videoContentLength).then(function (response) {
						sendResponse(response);
					});
					return true;
				} else if (message.action == "getVideoData") {
					getYoutubeVideoDataAsync(message.videoId, message.visitorData).then(function (response) {
						sendResponse(response);
					});
					return true;
				} else if (message.action == "openFile") {
					openYoutubeFileAsync(message.videoId).then(function (response) {
						sendResponse(response);
					});
					return true;
				}
			} else if (message.domain == "rating") {
				if (message.action == "getRatedVideos") {
					getYoutubeRatedVideosAsync(message.lastSyncTime).then(function (result) {
						sendResponse(result);
					});
					return true;
				} else if (message.action == "setRatedVideo") {
					setYoutubeRatedVideoAsync(message.videoDetails, message.rating).then(function (result) {
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
	initFeatureGoBack();
})();

async function handleAlarm(alarm) {
	await log(new Date().toLocaleString() + " -- [VideoSleep] Alarm has elapsed.");
	let videoSleepData = await readSessionItem("VideoSleep", null);
	if (videoSleepData == null) {
		await log(new Date().toLocaleString() + " -- [VideoSleep] No VideoSleep data.");
		return;
	}
	await chrome.storage.session.remove("VideoSleep");
	let tab = await chrome.tabs.update(videoSleepData.tabId, { url: videoSleepData.redirectUrl });
}

chrome.runtime.onInstalled.addListener(async function ({ reason }) {
	log(new Date().toLocaleString() + " -- [onInstalled]");
	initHeartbeat().then(function (heartbeatIsEnabled) {
		if (heartbeatIsEnabled)
			log(new Date().toLocaleString() + " -- [onInstalled] Heartbeat started.");
	});
	createContextMenus();
	
	let result = await chrome.alarms.clear("VideoSleep");
	if (result)
		log(new Date().toLocaleString() + " -- [onInstalled] The alarm VideoSleep is stopped.");
	
	await deleteOlderTweetsAsync();
});

chrome.alarms.onAlarm.addListener(handleAlarm);

(function createConsoleFunctions() {
	globalThis.ConsoleFunctions = {
		log
	};
})();