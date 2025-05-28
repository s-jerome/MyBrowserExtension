/**
 * This script observes the body to get notice when videos are displayed on the page,
 * and process them in different scripts.
 */
const caoglObserver = (function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-observer] Script started.");
	
	/**
	 * The video title elements attached to a MutationObserver to observe the changes of their text.
	 * @type {Array<HTMLElement>}
	 */
	let _observedVideoTitleEls = [];
	
	/**
	 * Observe the adding of #video-title elements in the body.
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
						processVideoTitleElement(addedNode); //.. Should never happen...
					else {
						processVideoTitleElements(addedNode);
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
	function processVideoTitleElements(parent) {
		//.. It's easy: every videos (in the homepage or in a playlist
		//.. or on the right as suggested videos, or whatever...) have their title in a #video-title element.
		let videoTitleEls = parent.querySelectorAll("#video-title");
		for (let i = 0; i < videoTitleEls.length; i++) {
			let videoTitleEl = videoTitleEls[i];
			processVideoTitleElement(videoTitleEl);
		}
	}
	
	/**
	 * Process the given video title in different scripts, and observe its text changes.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function processVideoTitleElement(videoTitleEl) {
		let videoId = getVideoIdFromTitleElement(videoTitleEl);
		if (videoId == "")
			return;
		let color = caoglRatingVideo.changeVideoTitleColor(videoTitleEl, videoId);
		if (color == "") {
			//.. No color, meaning the video is not rated.
			//.. So let see if it needs to be filtered (because no need to filter a video I have already rated).
			caoglFilter.filter(videoTitleEl, videoId);
		}
		observeVideoTitleElement(videoTitleEl);
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getVideoIdFromTitleElement(videoTitleEl) {
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
			let videoId = getVideoIdFromTitleElement(videoTitleEl);
			if (videoId == "")
				return;
			let color = caoglRatingVideo.changeVideoTitleColor(videoTitleEl, videoId);
			if (color == "") {
				//.. No color, meaning the video is not rated.
				//.. So let see if it needs to be filtered (because no need to filter a video I have already rated).
				caoglFilter.filter(videoTitleEl, videoId);
			} else {
				//.. The title changed, and now it's a video I have rated,
				//.. but maybe the previous video was filtered, so the filter has to be removed.
				caoglFilter.removeFilter(videoTitleEl);
			}
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
	 * Loop through the observed elements and disconnect their MutationObserve if they were removed from the DOM.
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
		/**
		 * Find all the #video-title present in the body and process them.
		 */
		processVideoTitleElements() {
			processVideoTitleElements(document.body);
		},
		
		__debug_getObservedVideoTitleEls() {
			return _observedVideoTitleEls;
		}
	}
})();
window.caoglObserver = caoglObserver;