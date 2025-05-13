/**
 * This script:
 * - save to a local database the videos I like or dislike
 * - change the color of the title of the videos depending on if I liked or disliked them.
 */
const caoglRatingVideo = (function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos] Script started.");
	
	/** @type {Map<String, String>} */
	let _ratingByVideoId = new Map();
	
	/**
	 * The timestamp of the last time the background sent here the rated videos.
	 */
	let _lastSyncTime = 0;
	
	/**
	 * The observer of the body to get notice when the title of videos are added to the DOM. 
	 * @type {MutationObserver}
	 */
	let _mutationObserver = null;
	
	/**
	 * The HTML elements attached to a MutationObserver to observe the changes of their text.
	 * @type {Array<HTMLElement>}
	 */
	let _observedElements = [];
	
	window.addEventListener("caoglGetRatedVideosIS", function (customEvent) {
		if (customEvent.detail == null)
			return;
		
		/** @type {Array} */
		let ratedVideos = customEvent.detail;
		if (ratedVideos.length == 0)
			return;
		
		for (let i = 0; i < ratedVideos.length; i++) {
			/**
			 * The first element is the videoId, the second element is the rating. 
			 * @type {Array}
			 */
			let rv = ratedVideos[i];
			_ratingByVideoId.set(rv.videoId, rv.rating);
		}
		
		_lastSyncTime = Date.now();
		
		processVideoTitleElements(document.body);
		
		observeBody();
	});
	
	/**
	 * Observe the adding of #video-title elements in the body.
	 */
	function observeBody() {
		if (_mutationObserver != null)
			return;
		
		_mutationObserver = new MutationObserver(function (mutations) {
			let elementsAreRemoved = false;
			for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
				let mutation = mutations[mutationIndex];
				for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
					/** @type {HTMLElement} */
					let addedNode = mutation.addedNodes[nodeIndex];
					if (addedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					if (addedNode.id == "video-title")
						processVideoTitleElement(addedNode);
					else {
						processVideoTitleElements(addedNode);
					}
				}
				
				if (mutation.removedNodes.length > 0)
					elementsAreRemoved = true;
			}
			if (elementsAreRemoved)
				stopObservingRemovedElements();
		});
		_mutationObserver.observe(document.body, {
			attributes: false,
			childList: true,
			characterData: false,
			subtree: true
		});
	}
	
	/**
	 * Find all the video titles on the page and change their color.
	 * @param {HTMLElement} parent 
	 */
	function processVideoTitleElements(parent) {
		//.. It's easy: every videos (in the homepage or in a playlist
		//.. or on the right as suggested videos, or whatever...) have their title in a #video-title element.
		let videoTitleEls = Array.from(parent.querySelectorAll("#video-title"));
		videoTitleEls.forEach(el => processVideoTitleElement(el));
	}
	
	/**
	 * Change the color of the given element and observe its text changes.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function processVideoTitleElement(videoTitleEl) {
		let videoId = getVideoIdFromTitleElement(videoTitleEl);
		if (videoId == "")
			return;
		changeVideoTitleColor(videoTitleEl, videoId);
		observeVideoTitleElement(videoTitleEl);
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getVideoIdFromTitleElement(videoTitleEl) {
		if (document.location.href.indexOf("/playlist?list=") < 0) {
			if (videoTitleEl.__dataHost == null)
				return ""; //.. Maybe the video is an ad (promoted).
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
			changeVideoTitleColor(videoTitleEl, videoId);
		});
		mo.observe(videoTitleEl, {
			attributes: false,
			childList: true,
			characterData: true,
			characterDataOldValue: true,
			subtree: true,
		});
		videoTitleEl.__caogl_mo = mo;
		_observedElements.push(videoTitleEl);
	}
	
	/**
	 * Loop through the observed elements and disconnect their MutationObserve if they were removed from the DOM.
	 */
	function stopObservingRemovedElements() {
		for (let i = _observedElements.length - 1; i >= 0; i--) {
			let element = _observedElements[i];
			if (element.isConnected)
				continue;
			if (element.__caogl_mo != null) {
				element.__caogl_mo.disconnect();
				element.__caogl_mo = null;
			}
			_observedElements.splice(i, 1);
		}
	}
	
	/**
	 * Change the color of the given video title element depending on the rate of the given videoId.
	 * @param {HTMLElement} videoTitleEl 
	 * @param {String} videoId 
	 */
	function changeVideoTitleColor(videoTitleEl, videoId) {
		let rating = _ratingByVideoId.get(videoId);
		if (rating == null || rating == "") {
			//.. This video is not rated.
			//.. Maybe this element represented before a video I liked for example, so its color is "reset".
			videoTitleEl.style.color = "";
		} else {
			if (rating == "like")
				videoTitleEl.style.color = "green";
			else if (rating == "dislike")
				videoTitleEl.style.color = "red";
			else if (rating == "none")
				videoTitleEl.style.color = "yellow";
		}
	}
	
	/**
	 * Change the color of the like or of the dislike button depending on the given rating.
	 * @param {String} rating 
	 */
	function changeRatingButtonColor(rating) {
		let querySelectorLabel = "";
		let color = "";
		if (rating == "like" || rating == "none") {
			querySelectorLabel = "like-button-view-model";
			if (rating == "like")
				color = "green";
			else
				color = "yellow";
		} else if (rating == "dislike") {
			querySelectorLabel = "dislike-button-view-model";
			color = "red";
		} else {
			console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][changeRatingButtonColor] The rating \"" + rating + "\" is unknown.");
			return;
		}
		
		let buttons = document.querySelectorAll(querySelectorLabel);
		if (buttons.length == 0) {
			console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][changeRatingButtonColor] No button found with this querySelector: \"" + querySelectorLabel + "\".");
			return;
		}
		
		/** @type {HTMLElement} */
		let ratingButton = null;
		if (buttons.length == 1) {
			ratingButton = buttons[0];
		} else {
			//.. There should be 2 buttons, but only the first being visible.
			/** @type {Array<HTMLElement} */
			let buttonsToArray = Array.from(buttons);
			for (let i = buttonsToArray.length - 1; i >= 0; i--) {
				let button = buttonsToArray[i];
				if (button.checkVisibility() == false) {
					buttonsToArray.splice(i, 1);
				}
			}
			if (buttonsToArray.length != 1) {
				console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][changeRatingButtonColor] Can't found the visible button with this querySelector: \"" + querySelectorLabel + "\".");
				return;
			}
			ratingButton = buttonsToArray[0];
		}
		
		let paths = ratingButton.querySelectorAll("path");
		for (let i = 0; i < paths.length; i++) {
			let path = paths[i];
			path.style.fill = color;
			path.style.stroke = color;
		}
	}
	
	/**
	 * Save the details and the rating of the given video into a local database.
	 * @param {any} videoDetails 
	 * @param {String} rating 
	 */
	function sendRatedVideoToBackground(videoDetails, rating) {
		//.. Send a message to the content script, which will transmit it to the background.
		//.. The background will make a request to a localhost to save the details and the rating of the videos into a local database,
		//.. then send a response back here to know everything went well, in which case the color of the like or of the dislike button will change.
		
		/**
		 * 
		 * @param {CustomEvent} customEvent 
		 */
		function handleMessage(customEvent) {
			window.removeEventListener("caoglSetRatedVideoIS", handleMessage);
			
			if (customEvent.detail == null)
				return;
			
			let result = customEvent.detail;
			if (result.success) {
				changeRatingButtonColor(rating);
				_ratingByVideoId.set(videoDetails.videoId, rating);
			} else {
				console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][sendRatedVideoToBackground] " + result.error);
			}
		}
		window.addEventListener("caoglSetRatedVideoIS", handleMessage);
		
		let ce = new CustomEvent("caoglSetRatedVideoCS", { detail: { site: "Youtube", action: "setRatedVideo", videoDetails: videoDetails, rating: rating } });
		window.dispatchEvent(ce);
	}
	
	/**
	 * 
	 * @param {String} videoId 
	 * @param {String} rating 
	 */
	function rateVideo(videoId, rating) {
		let videoDetails = caoglVideoDetails.getVideoDetailsById(videoId);
		if (videoDetails == null) {
			console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][rateVideo] Can't find in the cache the details of the videoId " + videoId);
			return;
		}
		sendRatedVideoToBackground(videoDetails, rating);
	}
	
	/**
	 * Send a message to the background (through the content script) asking the list of all the rated videos.
	 */
	function getRatedVideosFromBackground() {
		let ce = new CustomEvent("caoglGetRatedVideosCS", { detail: { site: "Youtube", action: "getRatedVideos", lastSyncTime: _lastSyncTime } });
		window.dispatchEvent(ce);
	}
	
	document.addEventListener("visibilitychange", function (event) {
		//.. The visibility changes when going on another tab, or when Chrome is minimised.
		//.. Each time the visibility changes, all the rated videos are get, in case I liked/disliked a video on another tab.
		if (document.hidden == false) {
			getRatedVideosFromBackground();
		}
	});
	
	getRatedVideosFromBackground();
	
	return {
		/**
		 * Handler for the given request if it's made on an url looking like: https://www.youtube.com/youtubei/v1/like/...
		 * @param {Request} input 
		 */
		handleLikeRequest(input) {
			//.. Liking a video: https://www.youtube.com/youtubei/v1/like/like?key=<key>8&prettyPrint=false
			//.. Disliking a video: https://www.youtube.com/youtubei/v1/like/dislike?key=<key>&prettyPrint=false
			//.. Removing a like or a dislike: https://www.youtube.com/youtubei/v1/like/removelike?key=<key>&prettyPrint=false
			if ((input instanceof Request) == false)
				return null;
			if (input.url.startsWith("https://www.youtube.com/youtubei/v1/like/") == false)
				return null;
			
			//.. Get the rating from the url.
			let url = new URL(input.url);
			let paths = url.pathname.split("/");
			let lastPath = paths[paths.length - 1];
			if (lastPath != "like" && lastPath != "dislike" && lastPath != "removelike")
				return null;
			let rating = lastPath == "removelike" ? "none" : lastPath;
			
			let clonedRequest = input.clone();
			/**
			 * @param {Response} response 
			 */
			return function (response) {
				if (response.ok == false) {
					console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][handleLikeRequest] The 'like' request failed: " + response.status + " - " + response.statusText);
					return;
				}
				//.. The videoId is not in the response, the only way to get it is to read the POST of the request.
				clonedRequest.json().then(function (data) {
					if (data == null || data.target == null || data.target.videoId == null) {
						console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][handleLikeRequest] There is no videoId in the POST data of the 'like' request:\n", data);
						return;
					}
					let videoId = data.target.videoId;
					rateVideo(videoId, rating);
				});
				return response;
			};
		},
		
		/**
		 * 
		 * @param {String} rating 
		 */
		__debug_rateCurrentVideo(rating) {
			let url = new URL(document.location.href);
			let videoId = url.searchParams.get("v");
			if (videoId == null || videoId == "") {
				console.log("Can't get the videoId of the video in the url.");
				return;
			}
			rateVideo(videoId, rating);
		}
	}
})();
window.caoglRatingVideo = caoglRatingVideo;

/**
 * Note: using some MutationObserver to observe the adding and the text changing of the video title elements are necessary.
 * The alternative based on intercepting the requests that return the videos to display (these requests are called "browse" and "next")
 * is not efficient because:
 * - the videos returned by these requests are saved in a cache, so they are not made every time when navigating from page to page
 * - sometimes, to display a video, new HTML elements are created are added to the DOM, 
 * but other times these HTML elements are reused to display a different video (the same span will be the title of video1 then video2)
 * So to make it work, we must be as close as possible to the DOM, to what is actually on screen.
 */