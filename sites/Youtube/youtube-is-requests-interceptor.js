/**
 * This script hooks the "fetch" function to intercept 2 requests:
 * - the "player" requests containing the details of videos (title, channel, description...)
 * - the "like" requests made when I like/dislike a video.
 * 
 * It also hooks the "document.body.appendChild" function
 * because, it happened one time that Youtube created an iframe sandbox about:blank to get a fresh and native fetch function,
 * and used it to make the 2 requests I want to intercept,
 * which means that my hooked fetch function in this window scope was not used for these requests.
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-requests-interceptor] Script started.");
	
	let _originalFetch = window.fetch;
	function hookedFetch(input, init) {
		if (window.caoglVideoDetails != null) {
			let playerRequestHandler = caoglVideoDetails.handlePlayerRequest(input);
			if (playerRequestHandler != null)
				return _originalFetch(input, init).then(playerRequestHandler);
		}
		
		if (window.caoglRatingVideo != null) {
			let likeRequestHandler = caoglRatingVideo.handleLikeRequest(input);
			if (likeRequestHandler != null)
				return _originalFetch(input, init).then(likeRequestHandler);
		}
		
		return _originalFetch(input, init);
	}
	window.fetch = hookedFetch;
	
	let _originalBodyAppendChild = null;
	
	/**
	 * Hook the "document.body.appendChild" function to hook the "fetch" function of the added iframes.
	 */
	function hookBodyAppendChildFunction() {
		//.. When an iframe is created, it has a null contentWindow.
		//.. It's only after the iframe is added to the DOM that the contentWindow has a value.
		//.. That is why the function document.body.appendChild has to be hooked rather than document.body.createElement.
		
		if (_originalBodyAppendChild != null)
			return;
		
		_originalBodyAppendChild = document.body.appendChild.bind(document.body);
		document.body.appendChild = function (node) {
			if (node.nodeType == Node.ELEMENT_NODE) {
				/** @type {HTMLIFrameElement} */
				let element = node;
				let tagLowerCase = element.tagName.toLowerCase();
				let src = element.src != null ? element.src.toLowerCase() : "";
				if (tagLowerCase == "iframe" && src == "about:blank") {
					let result = _originalBodyAppendChild.apply(this, arguments);
					if (result.contentWindow != null) {
						result.contentWindow.fetch = hookedFetch;
					}
					return result;
				}
			}
			return _originalBodyAppendChild.apply(this, arguments);
		}
	}
	
	if (document.readyState == "loading") {
		//.. Observe the adding of the body to hook the "document.body.appendChild" function.
		(function observeAddingBody() {
			let mo = new MutationObserver(function (mutations) {
				for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
					let mutation = mutations[mutationIndex];
					for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
						/** @type {HTMLElement} */
						let addedNode = mutation.addedNodes[nodeIndex];
						if (addedNode.nodeType != Node.ELEMENT_NODE)
							continue;
						if (addedNode.tagName != "BODY")
							continue;
						
						hookBodyAppendChildFunction();
						
						mo.disconnect();
						break;
					}
				}
			});
			mo.observe(document.documentElement, {
				childList: true
			});
		})();
	}
	else {
		hookBodyAppendChildFunction();
	}
})();