/**
 * This script allows to see the native controls of a video (play/pause button, volume, progressbar).
 * Instagram puts an overlay on top of the video, with just a button to mute/unmute the video.
 * 
 * Note: to unmute a video, we need to interact with the page.
 * 
 * Note: clicking on the overlay to play/pause a video is handle by Instagram scripts.
 * If we pause a video by using the overlay, then change tabs, then come back, the video will remain in pause.
 * If we pause a video by using the controls rather than the overlay, then change tabs, the come back, the video will play automatically.
 * 
 * The idea is not to get rid of the overlay, but just to reduce its height to be able to see the native controls in the bottom
 * (by placing the cursor in the bottom of the video) and to hide the mute/unmute button once the video is unmuted.
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [Instagram] Script started.");
	
	/**
	 * Get the video, if it exists, among the children of the given element.
	 * @param {HTMLElement} element
	 * @returns {HTMLVideoElement}
	 */
	function getVideoElement(element) {
		if (element.tagName != null && element.tagName.toLowerCase() == "video")
			return element;
		return element.querySelector("video");
	}
	
	/**
	 * Observe the adding of the video.
	 * @param {MutationRecord[]} mutations 
	 */
	function videosObserverCallback(mutations) {
		for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
			let mutation = mutations[mutationIndex];
			if (mutation.addedNodes != null && mutation.addedNodes.length > 0) {
				for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
					let addedNode = mutation.addedNodes[nodeIndex];
					if (addedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					let videoEl = getVideoElement(addedNode);
					if (videoEl != null) {
						processVideo(videoEl);
						if (videoEl.play != null)
							videoEl.play();
					}
				}
			}
		}
	}
	
	/**
	 * Volume change event (or when the video is mute/unmute).
	 * @param {Event} event 
	 */
	function handleVideoVolumeChanged(event) {
		//.. Once a video is added to the DOM, it is muted.
		//.. If the previous video was unmuted, this new one become unmuted.
		//.. If the video is unmuted, the mute/unmute button is hidden.
		
		/** @type {HTMLVideoElement} */
		let videoEl = event.target;
		let overlay = getVideoOverlay(videoEl);
		if (overlay != null) {
			let button = overlay.querySelector("button");
			if (videoEl.muted == false) {
				button.parentElement.style.display = "none";
			} else {
				if (button.__caogl == null) {
					let useButtonHeight = false;
					if (useButtonHeight) {
						if (button != null) {
							overlay.style.height = button.clientHeight + "px";
						}
					} else {
						overlay.style.height = "90%";
					}
					overlay.addEventListener("click", handleOverlayClick);
					button.__caogl = true;
				}
			}
		}
	}
	
	/**
	 * 
	 * @param {HTMLVideoElement} videoEl 
	 */
	function processVideo(videoEl) {
		if (videoEl.__caogl != null)
			return;
		
		videoEl.controls = true;
		videoEl.addEventListener("volumechange", handleVideoVolumeChanged);
		let overlay = getVideoOverlay(videoEl);
		if (overlay != null) {
			let button = overlay.querySelector("button");
			let useButtonHeight = false;
			if (useButtonHeight) {
				if (button != null) {
					overlay.style.height = button.clientHeight + "px";
				}
			} else {
				overlay.style.height = "90%";
			}
		}
		videoEl.__caogl = true;
	}
	
	/**
	 * Get the overlay on top of the video.
	 * @param {HTMLVideoElement} videoEl 
	 */
	function getVideoOverlay(videoEl) {
		if (videoEl.nextElementSibling == null)
			return null;
		let nes = videoEl.nextElementSibling;
		if (nes.tagName == "DIV" && nes.hasAttribute("data-instancekey") && nes.children.length == 1)
			return nes.children[0];
		else
			return null;
	}
	
	/**
	 * Handle the click on the overlay to know if the click has been made on the mute/unmute button.
	 * @param {PointerEvent} pointerEvent 
	 */
	function handleOverlayClick(pointerEvent) {
		let button = isUnmuteButton(pointerEvent.target);
		if (button != null) {
			//.. The button is clicked to unmute the video, so it is now hidden.
			button.parentElement.style.display = "none";
		}
	}
	
	/**
	 * Determine if the given element is the mute/unmute button.
	 * @param {HTMLElement} element 
	 */
	function isUnmuteButton(element) {
		if (element == null || element.tagName == null)
			return null;
		if (element.tagName == "BUTTON")
			return element;
		if (element.children.length == 1 && element.children[0].tagName == "BUTTON")
			return element.children[0];
		return null;
	}
	
	//.. Observing the add of new videos (switching from a video to another doesn't make a hard refresh of the page).
	let observer = new MutationObserver(videosObserverCallback);
	observer.observe(document.body, { childList: true, subtree: true });
	
	(function () {
		//.. Process the videos already present on the page (the script is run at document_end).
		let videos = document.body.getElementsByTagName("video");
		for (let i = 0; i < videos.length; i++) {
			let video = videos[i];
			processVideo(video);
		}
	})();
})();