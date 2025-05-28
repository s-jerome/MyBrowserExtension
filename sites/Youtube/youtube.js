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
	 * Inject the scripts:
	 * - observing the changes in the DOM (specially the adds and changes of the #video-title elements)
	 * - changing the color of the title of the videos based on their rating
	 * - filtering videos
	 */
	function injectScripts() {
		//.. Listen the messages sent by the RatingVideo injected script asking the background the list of the rated videos.
		//.. Note: This event can't be listen to in the "onload" event of the script,
		//.. because once injected it will send this message before the "onload" event will fire.
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
		
		let ratedVideosScriptEl = createScriptElement("/sites/Youtube/youtube-is-rated-videos.js", "caogl-rated-video");
		ratedVideosScriptEl.onload = function () {
			//.. Listen the messages sent by the injected script asking the background to save the details of videos I just liked or disliked.
			window.addEventListener("caoglSetRatedVideoCS", function (customEvent) {
				if (customEvent.detail == null || customEvent.detail.action == null || customEvent.detail.action != "setRatedVideo")
					return;
				chrome.runtime.sendMessage(customEvent.detail, function (response) {
					let ce = new CustomEvent("caoglSetRatedVideoIS", { detail: response });
					window.dispatchEvent(ce);
				});
			});
			
			let filterScriptEl = createScriptElement("/sites/Youtube/youtube-is-filter.js", "caogl-filter");
			filterScriptEl.onload = function () {
				//.. Now that the 2 scripts depending of the changes in the DOM are loaded,
				//.. the body can be observed via a MutationObserver.
				let observerScriptEl = createScriptElement("/sites/Youtube/youtube-is-observer.js", "caogl-observer");
				document.body.appendChild(observerScriptEl);
			};
			document.body.appendChild(filterScriptEl);
		};
		document.body.appendChild(ratedVideosScriptEl);
	}
	
	/**
	 * 
	 * @param {String} jsFilePath 
	 * @param {String} id 
	 */
	function createScriptElement(jsFilePath, id) {
		let scriptEl = document.createElement("script");
		scriptEl.id = id;
		scriptEl.src = chrome.extension.getURL(jsFilePath);
		return scriptEl;
	}
	
	if (document.readyState == "loading")
		window.addEventListener("DOMContentLoaded", injectScripts);
	else
		injectScripts();
})();