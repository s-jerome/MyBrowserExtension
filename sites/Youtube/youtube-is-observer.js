/**
 * This script observes the body to get notice when videos are displayed on the page,
 * and process them in different scripts.
 */
const caoglObserver = (function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-observer] Script started.");
	
	/**
	 * The regex used to get the video id from an anchor href.
	 */
	const REGEX_VIDEOID_FROM_URL = new RegExp(/(?:\?|&)v=(?<videoId>.*?)(?:&|$)/);
	
	/**
	 * The video title elements attached to a MutationObserver to observe the changes of their text.
	 * @type {Array<HTMLElement>}
	 */
	let _observedVideoTitleEls = [];
	
	/**
	 * Observe the adding of video titles in the body.
	 */
	(function observeBody() {
		let mo = new MutationObserver(function (mutations) {
			let elementsAreRemoved = false;
			for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
				let mutation = mutations[mutationIndex];
				for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
					/** @type {HTMLElement} */
					let addedNode = mutation.addedNodes[nodeIndex];
					if (addedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					if (addedNode.id == "caogl-title")
						continue; //.. It's an element I add in caoglFilter to replace the actual title when the video is filtered.
					if (addedNode.id == "video-title")
						processVideoTitleElement(addedNode, true); //.. Should never happen...
					else if (addedNode.tagName == "YT-LOCKUP-VIEW-MODEL" && addedNode.parentElement.id == "contents") {
						//.. A suggested video on the right.
						processSuggestedVideo(addedNode);
					} else {
						findAndProcessVideoTitleElementsById(addedNode);
					}
				}
				
				if (elementsAreRemoved == false && mutation.removedNodes.length > 0) {
					for (let nodeIndex = 0; nodeIndex < mutation.removedNodes.length; nodeIndex++) {
						let removedNode = mutation.removedNodes[nodeIndex];
						if (removedNode.nodeType != Node.ELEMENT_NODE)
							continue;
						if (removedNode.id == "caogl-title")
							continue; //.. It's an element I remove in caoglFilter to replace it by a new one.
						elementsAreRemoved = true;
						break;
					}
				}
			}
			if (elementsAreRemoved)
				stopObservingRemovedElements();
		});
		mo.observe(document.body, {
			attributes: false,
			childList: true,
			characterData: false,
			subtree: true
		});
	})();
	
	/**
	 * Find all the #video-title present in the given element and process them.
	 * @param {HTMLElement} parent 
	 */
	function findAndProcessVideoTitleElementsById(parent) {
		//.. Every videos (in the homepage, in a channel page, in a playlist),
		//.. except the suggested ones on the right,
		//.. have their title in a #video-title element.
		let videoTitleEls = parent.querySelectorAll("#video-title");
		for (let i = 0; i < videoTitleEls.length; i++) {
			let videoTitleEl = videoTitleEls[i];
			processVideoTitleElement(videoTitleEl, true);
		}
	}
	
	/**
	 * Process the given video title in different scripts, and observe its text changes.
	 * @param {HTMLElement} videoTitleEl Can be an anchor or a yt-formatted-string
	 * @param {Boolean} needToObserve Determine if a MutationObserver needs to be attached to the given element.
	 */
	function processVideoTitleElement(videoTitleEl, needToObserve) {
		if (needToObserve == null)
			needToObserve = true;
		
		let videoId = getVideoIdFromTitleElement(videoTitleEl);
		if (videoId == "")
			return;
		let color = caoglRatingVideo.changeVideoTitleColor(videoTitleEl, videoId);
		if (color == "") {
			//.. No color, meaning the video is not rated.
			//.. So let see if it needs to be filtered (because no need to filter a video I have already rated).
			caoglFilter.filter(videoTitleEl, videoId);
		} else if (needToObserve == false) {
			//.. The title changed, and now it's a video I have rated,
			//.. but maybe the previous video was filtered, so the filter has to be removed.
			caoglFilter.removeFilter(videoTitleEl);
		}
		if (needToObserve)
			observeVideoTitleElement(videoTitleEl);
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getVideoIdFromTitleElement(videoTitleEl) {
		if (videoTitleEl.tagName == "A") {
			//.. It's either a suggested video on the right, or a video on a playlist,
			//.. or a video on the "Home" page of a channel.
			/** @type {HTMLAnchorElement} */
			let anchor = videoTitleEl;
			//.. Note: using a regex is at least twice as fast as using the searchParams of a URL instance.
			let match = anchor.href.match(REGEX_VIDEOID_FROM_URL);
			if (match != null) {
				let videoId = match.groups["videoId"];
				return videoId;
			}
		}
		
		//.. It should be a yt-formatted-string element,
		//.. on the homepage, or on the "Videos" page of a channel, or in the search result.
		if (document.location.href.indexOf("/playlist?list=") < 0) {
			if (videoTitleEl.__dataHost == null)
				return "";
			if (videoTitleEl.__dataHost.__data == null || videoTitleEl.__dataHost.__data.data == null || videoTitleEl.__dataHost.__data.data.videoId == null)
				return "";
			return videoTitleEl.__dataHost.__data.data.videoId;
		} else {
			if (videoTitleEl.data == null || videoTitleEl.data.watchEndpoint == null || videoTitleEl.data.watchEndpoint.videoId == null)
				return "";
			return videoTitleEl.data.watchEndpoint.videoId;
		}
	}
	
	/**
	 * Observe the changes of the text of the given video title element.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function observeVideoTitleElement(videoTitleEl) {
		if (videoTitleEl.__caogl_mo != null)
			return;
		
		let mo = new MutationObserver(function (mutations) {
			processVideoTitleElement(videoTitleEl, false);
		});
		mo.observe(videoTitleEl, {
			attributes: false,
			childList: true,
			characterData: true,
			characterDataOldValue: true,
			subtree: true,
		});
		videoTitleEl.__caogl_mo = mo;
		_observedVideoTitleEls.push(videoTitleEl);
	}
	
	/**
	 * Find the title of the video in the given element and process it.
	 * @param {HTMLElement} lockupViewModelEl A yt-lockup-view-model element, representing a suggested video on the right.
	 */
	function processSuggestedVideo(lockupViewModelEl) {
		//.. The suggested videos have no longer a #video-title element since 2025-07.
		//.. @@Doc: documentation/Youtube/RatedVideos/suggested-videos.html
		//.. There is multiple children span, but there is only 1 h3.
		//.. I don't select it because changing its color doesn't work.
		let spans = lockupViewModelEl.querySelectorAll("h3 > a > span");
		if (spans.length != 1)
			return;
		let anchor = spans[0].parentElement;
		processVideoTitleElement(anchor, true);
	}
	
	/**
	 * Loop through the observed elements and disconnect their MutationObserver if they were removed from the DOM.
	 */
	function stopObservingRemovedElements() {
		for (let i = _observedVideoTitleEls.length - 1; i >= 0; i--) {
			let videoTitleEl = _observedVideoTitleEls[i];
			if (videoTitleEl.isConnected)
				continue;
			if (videoTitleEl.__caogl_mo != null) {
				videoTitleEl.__caogl_mo.disconnect();
				videoTitleEl.__caogl_mo = null;
			}
			caoglFilter.handleRemovedVideoTitleEl(videoTitleEl);
			_observedVideoTitleEls.splice(i, 1);
		}
	}
	
	return {
		getObservedVideoTitleElements() {
			return _observedVideoTitleEls;
		},
		
		/**
		 * Loop through the observed video titles and update their state (filtered or rated).
		 */
		processVideoTitleElements() {
			//.. We get here because a video has been rated on a new tab,
			//.. or because I changed the filter conditions.
			//.. There is no need to query the body to find the video title elements,
			//.. I just have to update the ones I already observe.
			for (let i = 0; i < _observedVideoTitleEls.length; i++) {
				let el = _observedVideoTitleEls[i];
				processVideoTitleElement(el);
			}
		}
	}
})();
window.caoglObserver = caoglObserver;