function injectCSS(cssFilePath) {
	let cssEl = document.createElement("link");
	cssEl.setAttribute("rel", "stylesheet");
	cssEl.href = chrome.extension.getURL(cssFilePath);
	document.head.appendChild(cssEl);
}

function injectJS(jsFilePath) {
	let scriptEl = document.createElement("script");
	scriptEl.src = chrome.extension.getURL(jsFilePath);
	document.body.appendChild(scriptEl);
}

chrome.tabs.getSelected(function (selectedTab) {
	window.selectedTab = selectedTab;
	
	if (selectedTab.url.indexOf("linkedin.com/") >= 0) {
		injectCSS("/popup/LinkedIn/popup-linkedin.css");
		injectJS("/popup/LinkedIn/popup-linkedin.js");
	} else if (selectedTab.url.indexOf("netflix.com/") >= 0) {
		injectCSS("/popup/Netflix/popup-netflix.css");
		injectJS("/popup/Netflix/popup-netflix.js");
	} else if (selectedTab.url.indexOf("tv.orange.fr/") >= 0) {
		document.body.innerHTML = "";
		let url = chrome.extension.getURL("/popup/tv.orange.fr/tv.orange.fr.html");
		fetch(url).then(function (response) {
			response.text().then(function (text) {
				document.body.innerHTML = text;
				injectCSS("/popup/tv.orange.fr/tv.orange.fr.css");
				injectJS("/popup/tv.orange.fr/tv.orange.fr.js");
			});
		});
	}
});