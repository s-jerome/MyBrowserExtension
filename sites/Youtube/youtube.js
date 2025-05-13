(function () {
	console.log(new Date().toLocaleString() + " -- [Youtube] Script started.");
	
	/**
	 * Inject the script that hooks the function "fetch" to intercept requests.
	 */
	(function injectRequestsInterceptorScript() {
		let scriptEl = document.createElement("script");
		scriptEl.id = "caogl-requests-interceptor";
		scriptEl.src = chrome.extension.getURL("/sites/Youtube/youtube-is-requests-interceptor.js");
		let e = document.body || document.documentElement;
		e.appendChild(scriptEl);
	})();
	
	/**
	 * Inject the script collecting the details of the videos.
	 */
	(function injectVideoDetailsScript() {
		let scriptEl = document.createElement("script");
		scriptEl.id = "caogl-video-details";
		scriptEl.src = chrome.extension.getURL("/sites/Youtube/youtube-is-video-details.js");
		let e = document.body || document.documentElement;
		e.appendChild(scriptEl);
	})();
	
	/**
	 * Inject the script showing the videos I liked by changing the color of their title.
	 */
	function injectRatingScript() {
		//.. Listen the messages sent by the injected script asking the background the list of the rated videos.
		//.. Note: This event can't be listen to in the "onload" event of the script,
		//.. because the injected script will send this message before the "onload" event will fire.
		window.addEventListener("caoglGetRatedVideosCS", function (customEvent) {
			if (customEvent.detail == null || customEvent.detail.action == null || customEvent.detail.action != "getRatedVideos")
				return;
			chrome.runtime.sendMessage(customEvent.detail, function (response) {
				//.. The response should be an array of objects videoId->rating.
				//.. Just passing the rated videos to the injected script.
				if (response == null)
					return;
				/** @type {Array} */
				let ratedVideos = response;
				if (ratedVideos.length == 0)
					return;
				let ce = new CustomEvent("caoglGetRatedVideosIS", { detail: ratedVideos });
				window.dispatchEvent(ce);
			});
		});
		
		let scriptEl = document.createElement("script");
		scriptEl.id = "caogl-rated-video";
		scriptEl.src = chrome.extension.getURL("/sites/Youtube/youtube-is-rated-videos.js");
		scriptEl.onload = function () {
			//.. Listen the messages sent by the injected script asking the background to save the details of videos I just liked or disliked.
			window.addEventListener("caoglSetRatedVideoCS", function (customEvent) {
				if (customEvent.detail == null || customEvent.detail.action == null || customEvent.detail.action != "setRatedVideo")
					return;
				chrome.runtime.sendMessage(customEvent.detail, function (response) {
					let ce = new CustomEvent("caoglSetRatedVideoIS", { detail: response });
					window.dispatchEvent(ce);
				});
			});
		}
		document.body.appendChild(scriptEl);
	}
	
	if (document.readyState == "loading")
		window.addEventListener("DOMContentLoaded", injectRatingScript);
	else
		injectRatingScript();
})();