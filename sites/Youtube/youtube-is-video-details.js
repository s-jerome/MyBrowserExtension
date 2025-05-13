/**
 * This script keeps in a cache the details of the videos (title, channel, description...).
 */
const caoglVideoDetails = (function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-video-details] Script started.");
	
	/** @type {Map<String, any>} */
	const _videoDetailsById = new Map();
	
	function createVideoDetails(source) {
		let videoDetails = {};
		videoDetails.channelId = source.channelId;
		videoDetails.channelName = source.author;
		videoDetails.videoTitle = source.title;
		videoDetails.videoDescription = source.shortDescription;
		videoDetails.videoDurationSeconds = source.lengthSeconds;
		videoDetails.videoId = source.videoId;
		return videoDetails;
	}
	
	function getCurrentVideoDetails() {
		//.. If the first page visited is a video page, the details of the video can be find in a variable.
		//.. If the first page visited is not a video page (if it's the homepage for example) this variable doesn't exist.
		if (window.ytInitialPlayerResponse == null || window.ytInitialPlayerResponse.videoDetails == null)
			return;
		let videoDetails = createVideoDetails(window.ytInitialPlayerResponse.videoDetails);
		_videoDetailsById.set(videoDetails.videoId, videoDetails);
	}
	
	if (document.readyState == "loading")
		window.addEventListener("DOMContentLoaded", getCurrentVideoDetails);
	else
		getCurrentVideoDetails();
	
	return {
		/**
		 * Handler for the given request if it's made on: https://www.youtube.com/youtubei/v1/player?prettyPrint=false
		 * The response of this request contains the details of a video.
		 * @param {Request} input 
		 */
		handlePlayerRequest(input) {
			if ((input instanceof Request) == false)
				return null; //.. The "player" request is a Request, not a String.
			//.. There are 2 "player" urls:
			//.. - https://www.youtube.com/youtubei/v1/player?key=<key>&prettyPrint=false
			//.. - https://www.youtube.com/youtubei/v1/player?prettyPrint=false
			//.. The one with the "key" parameter is useless. The request has no header (and so no Content-Type), and no body.
			if (input.url != "https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
				return null;
			/**
			 * @param {Response} response 
			 */
			return function (response) {
				if (response.ok == false)
					return response;
				let clonedResponse = response.clone();
				clonedResponse.json().then(function (data) {
					if (data.videoDetails != null) {
						let videoDetails = createVideoDetails(data.videoDetails);
						_videoDetailsById.set(videoDetails.videoId, videoDetails);
					}
				});
				return response;
			};
		},
		
		/**
		 * @param {String} videoId 
		 */
		getVideoDetailsById(videoId) {
			let details = _videoDetailsById.get(videoId);
			return details;
		},
		
		__debug_getAllVideoDetails() {
			return _videoDetailsById;
		},
		
		__debug_getCurrentVideoDetails() {
			let url = new URL(document.location.href);
			let videoId = url.searchParams.get("v");
			if (videoId == null || videoId == "") {
				console.log("Can't get the videoId of the video in the url.");
				return;
			}
			return this.getVideoDetailsById(videoId);
		}
	}
})();
window.caoglVideoDetails = caoglVideoDetails;