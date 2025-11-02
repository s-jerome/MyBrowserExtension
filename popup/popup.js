function injectCSS(cssFilePath) {
	let cssEl = document.createElement("link");
	cssEl.setAttribute("rel", "stylesheet");
	cssEl.href = chrome.runtime.getURL(cssFilePath);
	document.head.appendChild(cssEl);
}

function injectJS(jsFilePath) {
	let scriptEl = document.createElement("script");
	scriptEl.src = chrome.runtime.getURL(jsFilePath);
	document.body.appendChild(scriptEl);
}

function injectPage(htmlFilePath, jsFilePath, cssFilePath) {
	document.body.innerHTML = "";
	let url = chrome.runtime.getURL(htmlFilePath);
	fetch(url).then(function (response) {
		response.text().then(function (text) {
			document.body.innerHTML = text;
			if (cssFilePath != null && cssFilePath != "")
				injectCSS(cssFilePath);
			if (jsFilePath != null && jsFilePath != "")
				injectJS(jsFilePath);
		});
	});
}

chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
	let selectedTab = tabs[0];
	window.selectedTab = selectedTab;
	
	if (selectedTab.url.indexOf("linkedin.com/") >= 0) {
		injectCSS("/popup/LinkedIn/popup-linkedin.css");
		injectJS("/popup/LinkedIn/popup-linkedin.js");
	} else if (selectedTab.url.indexOf("netflix.com/") >= 0) {
		injectCSS("/popup/Netflix/popup-netflix.css");
		injectJS("/popup/Netflix/popup-netflix.js");
	} else if (selectedTab.url.indexOf("tv.orange.fr/") >= 0) {
		injectPage("/popup/tv.orange.fr/tv.orange.fr.html", "/popup/tv.orange.fr/tv.orange.fr.js", "/popup/tv.orange.fr/tv.orange.fr.css");
	} else if (selectedTab.url.indexOf("youtube.com/watch?v=") >= 0) {
		injectPage("/popup/Youtube/popup-youtube.html", "/popup/Youtube/popup-youtube.js", "/popup/Youtube/popup-youtube.css");
	}
});