chrome.tabs.getSelected(function (selectedTab) {
	window.selectedTab = selectedTab;
	if (selectedTab.url.indexOf("netflix.com/") >= 0) {
		let cssEl = document.createElement("link");
		cssEl.setAttribute("rel", "stylesheet");
		cssEl.href = chrome.extension.getURL("/popup/Netflix/popup-netflix.css");
		document.head.appendChild(cssEl);
		
		let scriptEl = document.createElement("script");
		scriptEl.src = chrome.extension.getURL("/popup/Netflix/popup-netflix.js");
		document.body.appendChild(scriptEl);
	}
});