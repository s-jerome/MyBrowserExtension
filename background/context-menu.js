chrome.contextMenus.create({
	id: "VideoSleep",
	type: "normal",
	title: "Sleep",
	contexts: ["all"],
	documentUrlPatterns: ["https://www.netflix.com/*", "https://tv.orange.fr/*", "https://www.twitch.tv/*", "https://www.youtube.com/*"]
});

chrome.contextMenus.onClicked.addListener(function (onClickData, tab) {
	if (onClickData.menuItemId == "VideoSleep") {
		//.. The script will be loaded in the content script scope.
		chrome.tabs.executeScript(tab.id, { file: "/features/VideoSleep/video-sleep-modal.js" });
	}
});