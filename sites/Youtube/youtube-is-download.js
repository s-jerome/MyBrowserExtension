/**
 * This injected script is used to get:
 * - the variable VISITOR_DATA which needs to be sent in the header of the player request is to get the video data
 * - the selected quality video (optionnal)
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-download] Script started.");
	
	/**
	 * Get the quality selected for the video (360p -> "medium" / 480p -> "large" / 720p -> "hd720"...).
	 */
	function getCurrentQuality() {
		// let player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
		let player = document.getElementById("movie_player");
		if (player != null)
			return player.getPlaybackQuality();
		else
			return null;
	}
	
	/**
	 * Get the VISITOR_DATA (used for the request made on Youtube API to get the video data).
	 */
	function getVisitorData() {
		if (window.ytcfg != null && window.ytcfg.data_ != null)
			return window.ytcfg.data_.VISITOR_DATA;
		else
			return null;
	}
	
	function getData() {
		let data = {};
		let visitorData = getVisitorData();
		if (visitorData != null && visitorData != "")
			data.VISITOR_DATA = visitorData;
		else
			data.error = "Can't get the VISITOR_DATA";
		//.. If I can't get it, it's not a big deal.
		data.currentQuality = getCurrentQuality();
		return data;
	}
	
	window.addEventListener("caoglDownloadVideosIS", function (customEvent) {
		if (customEvent.detail == null || customEvent.detail.action == null)
			return;
		
		if (customEvent.detail.action == "getVisitorData") {
			let data = getData();
			Object.assign(data, customEvent.detail);
			
			let ce = new CustomEvent("caoglDownloadVideosCS", { detail: data });
			window.dispatchEvent(ce);
		}
	});
})();