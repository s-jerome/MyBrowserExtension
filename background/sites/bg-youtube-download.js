const YoutubeDownload = (function () {
	class LocalhostResponse {
		/**
		 * Determine if the video has already been downloaded. 
		 * @type {Boolean}
		 */
		localFileExists;
		/**
		 * Result from the Youtube player request. 
		 * @type {any}
		 */
		videoData;
		
		/**
		 * @param {Boolean} localFileExists 
		 * @param {any} videoData 
		 */
		constructor(localFileExists, videoData) {
			this.localFileExists = localFileExists;
			this.videoData = videoData;
		}
	}
	class VideoData {
		/** @type {LocalhostResponse} */
		localhostResponse;
		/** @type {Date} */
		retrievedAt;
	}
	
	/** @type {Map<String, VideoData>} */
	let _videoDataById = new Map();
	
	(function createConsoleFunctions() {
		window.YoutubeDownloadConsole = {
			getVideoDataById(videoId) {
				return _videoDataById.get(videoId);
			},
			
			clearVideoDataCache() {
				_videoDataById.clear();
			}
		};
	})();
	
	return {
		/**
		 * @param {String} videoId 
		 * @param {String} visitorData 
		 */
		async getVideoDataAsync(videoId, visitorData) {
			let now = new Date();
			
			let videoData = _videoDataById.get(videoId);
			if (videoData != null) {
				let ts = now - videoData.retrievedAt;
				if (ts < 3600000) {
					//.. The data was retrieved less than 1 hour ago, so the downloadable urls have not expired.
					//.. I think they expire after about 6h.
					return videoData.localhostResponse;
				}
			}
			
			let result = await this.requestVideoDataAsync(videoId, visitorData);
			if (result.error == null) {
				let vd = new VideoData();
				vd.localhostResponse = new LocalhostResponse(result.localFileExists, result.videoData);
				vd.retrievedAt = now;
				_videoDataById.set(videoId, vd);
			}
			return result;
		},
		
		/**
		 * @param {String} videoId 
		 * @param {String} visitorData 
		 */
		async requestVideoDataAsync(videoId, visitorData) {
			let visitorDataEncoded = encodeURIComponent(visitorData);
			let port = Config.get("localhostPort");
			let url = "http://localhost:" + port + "/youtube/download/get-video-data?video-id=" + videoId + "&visitor-data=" + visitorDataEncoded;
			
			let response = null;
			try {
				response = await fetch(url);
			} catch (ex) {
				console.error(new Date().toLocaleString() + " -- [Youtube-download][requestVideoDataAsync] " + ex.message);
				return { error: ex.message };
			}
			
			let data = await response.json();
			if (response.ok == false) {
				let result = {
					error: "Request failed: " + response.status + " -- " + response.statusText
				};
				console.error(new Date().toLocaleString() + " -- [Youtube-download][requestVideoDataAsync] " + result.error + "\n", data);
				if (data.error != null)
					result.error += "\n" + data.error;
				if (data.operation != null)
					result.error += "\nOperation: " + data.operation;
				return result;
			}
			
			if (data == null || data.videoData == null || data.videoData.videoDetails == null || data.videoData.streamingData == null) {
				//.. If the visitorData is invalid, the response is ok (status 200) but the response has no video data.
				
				let result = {
					error: "The Youtube player request returned no videa data",
					data: data
				};
				console.error(new Date().toLocaleString() + " -- [Youtube-download][requestVideoDataAsync] " + result.error + "\n", data);
				return result;
			}
			
			return data;
		},
		
		/**
		 * Ask the localhost to download the given video.
		 * @param {String} videoId 
		 * @param {String} audioUrl 
		 * @param {Number} audioContentLength 
		 * @param {String} videoUrl 
		 * @param {Number} videoContentLength 
		 */
		async downloadAsync(videoId, audioUrl, audioContentLength, videoUrl, videoContentLength) {
			let result = {
				error: null,
				result: null
			};
			
			if (audioUrl == null || audioUrl == "") {
				result.error = "No audio url given.";
				return result;
			}
			let encodedAudioUrl = encodeURIComponent(audioUrl);
			let encodedVideoUrl = "";
			if (videoUrl != null && videoUrl != "")
				encodedVideoUrl = encodeURIComponent(videoUrl);
			
			let port = Config.get("localhostPort");
			let url = "http://localhost:" + port + "/youtube/download/download?video-id=" + videoId +
				"&audio-url=" + encodedAudioUrl + "&audio-content-length=" + audioContentLength +
				"&video-url=" + encodedVideoUrl + "&video-content-length=" + videoContentLength;
			
			let response = null;
			try {
				response = await fetch(url);
			} catch (ex) {
				console.error(new Date().toLocaleString() + " -- [Youtube-download][downloadAsync] " + ex.message);
				result.error = ex.message;
				return result;
			}
			
			let data = await response.json();
			result.result = data;
			if (response.ok == false) {
				let error = "Request failed: " + response.status + " -- " + response.statusText;
				console.error(new Date().toLocaleString() + " -- [Youtube-download][downloadAsync] " + error, data);
				result.error = error;
				if (data.error != null)
					result.error += "\n" + data.error;
				if (data.operation != null)
					result.error += "\nOperation: " + data.operation;
			}
			
			if (data.success != null && data.success == true) {
				let videoData = _videoDataById.get(videoId);
				if (videoData != null) {
					videoData.localhostResponse.localFileExists = true;
				}
			}
			
			return result;
		},
		
		/**
		 * Ask the localhost to open the video file for the given id.
		 * @param {String} videoId 
		 */
		async openFileAsync(videoId) {
			let port = Config.get("localhostPort");
			let url = "http://localhost:" + port + "/youtube/download/open-file?video-id=" + videoId;
			
			let response = null;
			try {
				response = await fetch(url);
			} catch (ex) {
				console.error(new Date().toLocaleString() + " -- [Youtube-download][openFileAsync] " + ex.message);
				return { error: ex.message }
			}
			
			let data = await response.json();
			if (response.ok == false) {
				let result = {
					error: data.error,
					status: response.status + " -- " + response.statusText
				};
				let error = "Request failed: " + result.status;
				console.error(new Date().toLocaleString() + " -- [Youtube-download][openFileAsync] " + error + "\n", data);
				return result;
			}
			
			return data;
		}
	}
})();