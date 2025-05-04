(function () {
	console.log(new Date().toLocaleString() + " -- [Twitter] Script started.");
	
	(function injectRemovePromotedTweetsScript() {
		let scriptEl = document.createElement("script");
		scriptEl.src = chrome.extension.getURL("/sites/Twitter/twitter-is-remove-promoted-tweets.js");
		let e = document.body || document.documentElement;
		e.appendChild(scriptEl);
	})();
})();