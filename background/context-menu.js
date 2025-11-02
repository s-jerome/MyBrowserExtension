export function createMenus() {
	chrome.contextMenus.create({
		id: "VideoSleep",
		type: "normal",
		title: "Sleep",
		contexts: ["all"],
		documentUrlPatterns: ["https://www.netflix.com/*", "https://tv.orange.fr/*", "https://www.twitch.tv/*", "https://www.youtube.com/*"]
	});
}

chrome.contextMenus.onClicked.addListener(function (onClickData, tab) {
	if (onClickData.menuItemId == "VideoSleep") {
		//.. The script will be loaded in the content script scope.
		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ["/features/VideoSleep/video-sleep-modal.js"]
		});
	}
});