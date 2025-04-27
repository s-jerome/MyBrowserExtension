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
});