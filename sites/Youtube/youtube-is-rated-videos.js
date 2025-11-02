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
		
		updateVideoTitleElements();
	});
	
	/**
	 * Ask the Observer script to update the state of the video titles.
	 */
	function updateVideoTitleElements() {	
		//.. When the page is loaded for the fist time,
		//.. the Observer script is loaded after this current script (the rated videos script).
		//.. When this current script is loaded, it sends a message to the background to get the rated videos,
		//.. and when processing the response, the Observer script should not be loaded yet.
		//.. There is no need to wait for it to be loaded, because it will intercept the adding
		//.. of video titles using its MutationObserver.
		if (window.caoglObserver != null)
			caoglObserver.processVideoTitleElements();
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
				_lastSyncTime = Date.now();
			} else {
				console.log(new Date().toLocaleString() + " -- [Youtube-is-rated-videos][sendRatedVideoToBackground] " + result.error);
			}
		}
		window.addEventListener("caoglSetRatedVideoIS", handleMessage);
		
		let ce = new CustomEvent("caoglSetRatedVideoCS", { detail: { site: "Youtube", domain: "rating", action: "setRatedVideo", videoDetails: videoDetails, rating: rating } });
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
		let ce = new CustomEvent("caoglGetRatedVideosCS", { detail: { site: "Youtube", domain: "rating", action: "getRatedVideos", lastSyncTime: _lastSyncTime } });
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
		 * Change the color of the given video title element depending on the rate of the given videoId.
		 * @param {HTMLElement} videoTitleEl 
		 * @param {String} videoId 
		 */
		changeVideoTitleColor(videoTitleEl, videoId) {
			let color = "";
			let rating = _ratingByVideoId.get(videoId);
			if (rating == null || rating == "") {
				//.. This video is not rated.
				//.. Maybe this element represented before a video I liked for example, so its color is "reset".
			} else {
				if (rating == "like")
					color = "green";
				else if (rating == "dislike")
					color = "red";
				else if (rating == "none")
					color = "yellow";
			}
			videoTitleEl.style.color = color;
			return color;
		},
	
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