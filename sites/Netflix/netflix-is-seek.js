/**
 * Listen the "keydown" event to intercept the "ArrowLeft" and "ArrowRight" 
 * so that I can change the forward and backward jump times from the 10 seconds by default.
 */
const caoglSeek = (function () {
	console.log(new Date().toLocaleString() + " -- [Netflix-is-seek] Script started.");
	
	let _jumpTimes = {
		/**
		 * The small jump, with just the ArrowLeft and ArrowRight.
		 */
		small: 5000,
		/**
		 * The medium jump, with the SHIFT key.
		 */
		medium: 8000,
		/**
		 * The large jump, with the CTRL key.
		 */
		large: 10000
	};
	
	(function readJumpTimes() {
		let itemValue = localStorage.getItem("caoglSeek");
		if (itemValue == null || itemValue == "")
			return;
		let jumpTimes = JSON.parse(itemValue);
		if (jumpTimes.small != null)
			_jumpTimes.small = jumpTimes.small;
		if (jumpTimes.medium != null)
			_jumpTimes.medium = jumpTimes.medium;
		if (jumpTimes.large != null)
			_jumpTimes.large = jumpTimes.large;
	})();
	
	/**
	 * Determine if the given element is the one able to intercept the "keydown" event.
	 * This event doesn't work on the document/window/video, it only works on a specific element.
	 * @param {HTMLElement} element 
	 */
	function isPlayerElement(element) {
		if (element.tagName != "DIV")
			return false;
		
		let attributeValue = element.getAttribute("data-uia");
		if (attributeValue == null || attributeValue == "" || attributeValue != "player")
			return false;
		
		if (element.hasAttribute("data-videoid") == false)
			return false;
		
		if (element.__caoglVideo == null) {
			let videos = document.querySelectorAll("video");
			if (videos.length != 1)
				return false;
			
			/** @type {HTMLVideoElement} */
			let video = videos[0];
			element.__caoglVideo = video;
			
			element.addEventListener("keydown", function (keyboardEvent) {
				if (keyboardEvent.key == "ArrowLeft") {
					keyboardEvent.stopPropagation();
					if (keyboardEvent.shiftKey)
						jumpBackward(_jumpTimes.medium);
					else if (keyboardEvent.ctrlKey)
						jumpBackward(_jumpTimes.large);
					else
						jumpBackward(_jumpTimes.small);
				} else if (keyboardEvent.key == "ArrowRight") {
					keyboardEvent.stopPropagation();
					if (keyboardEvent.shiftKey)
						jumpForward(_jumpTimes.medium);
					else if (keyboardEvent.ctrlKey)
						jumpForward(_jumpTimes.large);
					else
						jumpForward(_jumpTimes.small);
				}
			});
		}
		return true;
	}
	
	/**
	 * Make a jump forward by the given ms (increase the current time of the video).
	 * @param {Number} ms 
	 */
	function jumpForward(ms) {
		let player = getAPIPlayer();
		let currentTime = player.getCurrentTime();
		let newTime = currentTime + ms;
		let duration = player.getDuration();
		if (newTime > duration)
			newTime = duration;
		player.seek(newTime);
	}
	
	/**
	 * Make a jump backward by the given ms (decrease the current time of th e video).
	 * @param {Number} ms 
	 */
	function jumpBackward(ms) {
		let player = getAPIPlayer();
		let currentTime = player.getCurrentTime();
		let newTime = currentTime - ms;
		if (newTime < 0)
			newTime = 0;
		player.seek(newTime);
	}
	
	/**
	 * Get the API player (which is not the same thing as the HTML video element).
	 */
	function getAPIPlayer() {
		//.. https://stackoverflow.com/questions/61963921/seek-to-a-point-in-a-netflix-video
		//.. The only way to change the currentTime of a video, is to use the API player,
		//.. it can't be done directly on the HTML video element.
		
		if (netflix == null || netflix.appContext == null || netflix.appContext.state == null ||
			netflix.appContext.state.playerApp == null || netflix.appContext.state.playerApp.getAPI == null)
			return null;
		let getAPIType = typeof (netflix.appContext.state.playerApp.getAPI);
		if (getAPIType != "function")
			return null;
		
		let api = netflix.appContext.state.playerApp.getAPI();
		
		if (api.videoPlayer == null || api.videoPlayer.getVideoPlayerBySessionId == null || api.videoPlayer.getAllPlayerSessionIds == null)
			return null;
		let type1 = typeof (api.videoPlayer.getVideoPlayerBySessionId);
		if (type1 != "function")
			return null;
		let type2 = typeof (api.videoPlayer.getAllPlayerSessionIds);
		if (type2 != "function")
			return null;
		
		/** @type {Array<String>} */
		let playerIds = api.videoPlayer.getAllPlayerSessionIds();
		if (playerIds == null || Array.isArray(playerIds) == false)
			return null;
		if (playerIds.length == 0)
			return null;
		if (playerIds.length > 1) {
			//.. It may happen that there are 2 ids :
			//.. "motion-billboard-47b1eeea-e4d2-421a-9d9a-fa76ca610b24"
			//.. "watch-402ffcda-1e62-4bc5-98bd-efe7721d1d37"
			//.. I guess I only need to focus on the "watch-" ones.
			for (let i = playerIds.length - 1; i >= 0; i--) {
				let playerId = playerIds[i];
				if (playerId.startsWith("watch-") == false)
					playerIds.splice(i, 1);
			}
			if (playerIds.length != 1)
				return null;
		}
		
		let player = api.videoPlayer.getVideoPlayerBySessionId(playerIds[0]);
		return player;
	}
	
	/**
	 * 
	 * @param {Number} small 
	 * @param {Number} medium 
	 * @param {Number} large 
	 */
	function setJumpTimes(small, medium, large) {
		if (isNaN(small) == false && small > 0)
			_jumpTimes.small = small;
		if (isNaN(medium) == false && medium > 0)
			_jumpTimes.medium = medium;
		if (isNaN(large) == false && large > 0)
			_jumpTimes.large = large;
		
		localStorage.setItem("caoglSeek", JSON.stringify(_jumpTimes));
	}
	
	window.addEventListener("caoglSeekIS", function (customEvent) {
		if (customEvent.detail == null || customEvent.detail.action == null)
			return;
		
		if (customEvent.detail.action == "getJumpTimes") {
			let response = new CustomEvent("caoglSeekCS", { detail: { jumpTimes: _jumpTimes } });
			window.dispatchEvent(response);
		} else if (customEvent.detail.action == "setJumpTimes") {
			let jumpTimes = customEvent.detail.jumpTimes;
			setJumpTimes(jumpTimes.small, jumpTimes.medium, jumpTimes.large);
			//.. Just respond something so that the popup knows everything went.
			let response = new CustomEvent("caoglSeekCS", { detail: customEvent.detail });
			window.dispatchEvent(response);
		}
	});
	
	return {
		getAPIPlayer() {
			return getAPIPlayer();
		},
		
		/**
		 * Determine if the given element is, or contains, the element able to intercept the "keydown" event.
		 * @param {HTMLElement} element 
		 */
		isOrContainsPlayerElement(element) {
			let success = isPlayerElement(element);
			if (success)
				return success;
			
			if (element.children.length == 0)
				return false;
			
			for (let i = 0; i < element.children.length; i++) {
				let child = element.children[i];
				let childSuccess = isPlayerElement(child);
				if (childSuccess)
					return childSuccess;
			}
			
			return false;
		},
		
		setJumpTimes(small, medium, large) {
			setJumpTimes(small, medium, large);
		}
	}
})();