const Youtube = (function () {
	class RatingData {
		/** @type {Number} */
		ratedTime;
		/** @type {String} */
		rating;
		
		/**
		 * @param {Number} ratedTime 
		 * @param {String} rating 
		 */
		constructor(ratedTime, rating) {
			this.ratedTime = ratedTime;
			this.rating = rating;
		}
	}
	
	/** @type {Map<String, RatingData>} */
	let _ratingByVideoId = new Map();
	
	return {
		/**
		 * Send a request to my localhost to select, from my SQLite database, all the Youtube videos I rated.
		 */
		async getAllRatedVideosAsync() {
			let port = Config.get("localhostPort");
			let url = "http://localhost:" + port + "/youtube/rating/get-rated-videos";
			let response = null;
			try {
				response = await fetch(url);
			} catch (ex) {
				if (ex.message != null)
					console.error(new Date().toLocaleString() + " -- [Youtube][getAllRatedVideosAsync] Fetch error: " + ex.message);
				else
					console.error(new Date().toLocaleString() + " -- [Youtube][getAllRatedVideosAsync] Fetch error: " + ex);
				return;
			}
			
			if (response.ok == false) {
				console.error(new Date().toLocaleString() + " -- [Youtube][getAllRatedVideosAsync] Request failed: " + response.status + " -- " + response.statusText);
				return;
			}
			
			try {
				let data = await response.json();
				if (Array.isArray(data)) {
					let now = Date.now();
					for (let i = 0; i < data.length; i++) {
						let savedData = data[i];
						let cachedRating = _ratingByVideoId.get(savedData.videoId);
						if (cachedRating == null) {
							_ratingByVideoId.set(savedData.videoId, new RatingData(now, savedData.rating));
						} else {
							if (cachedRating.rating != savedData.rating) {
								//.. Should only happen if I have changed manually the rating directly in the database.
								cachedRating.rating = savedData.rating;
								cachedRating.ratedTime = now;
								//.. In order to have the rated videos in chronological order,
								//.. I remove it from the list, and add it again at the end.
								_ratingByVideoId.delete(savedData.videoId);
								_ratingByVideoId.set(savedData.videoId, cachedRating);
							}
						}
					}
				}
			} catch (ex) {
				if (ex.message != null) //.. TypeError
					console.error(new Date().toLocaleString() + " -- [Youtube][getAllRatedVideosAsync] Can't get the JSON response: " + ex.message);
				else
					console.error(new Date().toLocaleString() + " -- [Youtube][getAllRatedVideosAsync] Can't get the JSON response: " + ex);
			}
		},
		
		/**
		 * Get the videos I liked or disliked since the last sync.
		 * @param {Number} lastSyncTime 
		 */
		getRatedVideos(lastSyncTime) {
			if (lastSyncTime == null || lastSyncTime == 0) {
				let i = 0;
				let videos = new Array(_ratingByVideoId.size);
				for (let key of _ratingByVideoId.keys()) {
					let rv = _ratingByVideoId.get(key);
					videos[i] = { videoId: key, rating: rv.rating };
					i++;
				}
				return videos;
			} else {
				let videos = [];
				let ratedVideos = Array.from(_ratingByVideoId);
				for (let i = ratedVideos.length - 1; i >= 0; i--) {
					let rv = ratedVideos[i];
					let rate = rv[1];
					if (rate.ratedTime == null || rate.ratedTime == 0 || rate.ratedTime < lastSyncTime)
						break;
					videos.push({ videoId: rv[0], rating: rate.rating });
				}
				return videos;
			}
		},
		
		/**
		 * 
		 * @param {any} videoDetails 
		 * @param {String} rating 
		 * @returns 
		 */
		async setRatedVideoAsync(videoDetails, rating) {
			let data = {
				videoId: videoDetails.videoId,
				rating: rating,
				channelId: videoDetails.channelId,
				channelName: videoDetails.channelName,
				videoTitle: videoDetails.videoTitle,
				videoDescription: videoDetails.videoDescription,
				videoDurationSeconds: videoDetails.videoDurationSeconds
			};
			let body = JSON.stringify(data);
			
			let port = Config.get("localhostPort");
			let url = "http://localhost:" + port + "/youtube/rating/set-video-rating";
			let response = null;
			try {
				response = await fetch(url, {
					method: "POST",
					body: body
				});
			} catch (ex) {
				console.error(new Date().toLocaleString() + " -- [bg-Youtube][setRatedVideoAsync] " + ex.message);
				return { success: false, error: ex.message };
			}
			
			if (response.ok == false) {
				let error = "Request failed: " + response.status + " -- " + response.statusText;
				console.error(new Date().toLocaleString() + " -- [bg-Youtube][setRatedVideoAsync] " + error);
				return { success: false, error: error };
			}
			
			//.. In order to have the rated videos in chronological order,
			//.. if I just changed the rating of a video, I remove it from the list,
			//.. and add it again at the end.
			_ratingByVideoId.delete(videoDetails.videoId);
			_ratingByVideoId.set(videoDetails.videoId, new RatingData(Date.now(), rating));
			return { success: true };
		}
	}
})();