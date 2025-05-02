/**
 * This script intercepts fetch requests in order to block those made by the site on "chrome-extension://".
 * 
 * The site makes hundreds of those requests, resulting in hundreds of errors in the console of the devtools,
 * making it slow, and difficult to debug.
 * The errors in the console look like: GET chrome-extension://invalid/ net::ERR_FAILED
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [LinkedIn-is-request-blocking] Script started.");
	
	function isRequestBlockingEnabled() {
		let value = localStorage.getItem("caoglRequestBlocking");
		return value != null && value == "true";
	}
	
	function isChromeExtensionUrl(input) {
		if (input == null)
			return false;
		let url = "";
		let inputType = typeof input;
		if (inputType === "string") {
			//.. Mostly it's a string.
			url = input;
		} else if (input.url != null) {
			//.. Sometimes it's a Request.
			url = input.url;
		} else {
			return false;
		}
		let success = url.indexOf("chrome-extension://") == 0;
		return success;
	}
	
	let _originalFetch = fetch;
	fetch = function (input, init) {
		let requestBlockingIsEnabled = isRequestBlockingEnabled();
		if (requestBlockingIsEnabled) {
			let urlIsChromeExtension = isChromeExtensionUrl(input);
			if (urlIsChromeExtension) {
				return;
			}
		}
		return _originalFetch(input, init);
	};
})();