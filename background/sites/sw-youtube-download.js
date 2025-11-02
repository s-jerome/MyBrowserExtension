import * as Config from "../sw-config.js";
import { error } from "../sw-log.js";

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
	/**
	 * Timestamp.
	 * @type {Number}
	 */
	retrievedAt;
}

let _videoDataById = (function () {
	let __sessionStorageKey = "Youtube.videoDataById";
	
	/** @type {Object.<string, VideoData|null>} */
	let __videoDataById = null;
	
	async function readCacheAsync() {
		if (__videoDataById != null)
			return;
		
		let { [__sessionStorageKey]: videoDataById } = await chrome.storage.session.get(__sessionStorageKey);
		__videoDataById = videoDataById || {};
	}
	
	return {
		/**
		 * @param {String} videoId 
		 */
		async getAsync(videoId) {
			await readCacheAsync();
			let data = __videoDataById[videoId];
			return data;
		},
		
		/**
		 * @param {String} id 
		 * @param {VideoData} data 
		 */
		async setAsync(id, data) {
			await readCacheAsync();
			__videoDataById[id] = data;
			await chrome.storage.session.set({ [__sessionStorageKey]: __videoDataById });
		},
		
		async clearAsync() {
			__videoDataById = {};
			await chrome.storage.session.remove(__sessionStorageKey);
		}
	};
})();

(function createConsoleFunctions() {
	globalThis.YoutubeDownloadConsole = {
		async getVideoDataByIdAsync(videoId) {
			let data = await _videoDataById.getAsync(videoId);
			return data;
		},
		
		async clearVideoDataCacheAsync() {
			await _videoDataById.clearAsync();
		}
	};
})();

/**
 * @param {String} videoId 
 * @param {String} visitorData 
 */
export async function getVideoDataAsync(videoId, visitorData) {
	let now = Date.now();
	
	let videoData = await _videoDataById.getAsync(videoId);
	if (videoData != null) {
		let ts = now - videoData.retrievedAt;
		if (ts < 3600000) {
			//.. The data was retrieved less than 1 hour ago, so the downloadable urls have not expired.
			//.. I think they expire after about 6h.
			return videoData.localhostResponse;
		}
	}
	
	let result = await requestVideoDataAsync(videoId, visitorData);
	if (result.error == null) {
		let vd = new VideoData();
		vd.localhostResponse = new LocalhostResponse(result.localFileExists, result.videoData);
		vd.retrievedAt = now;
		_videoDataById.setAsync(videoId, vd);
	}
	return result;
}

/**
 * @param {String} videoId 
 * @param {String} visitorData 
 */
async function requestVideoDataAsync(videoId, visitorData) {
	let visitorDataEncoded = encodeURIComponent(visitorData);
	let port = await Config.getAsync("localhostPort");
	let url = "http://localhost:" + port + "/youtube/download/get-video-data?video-id=" + videoId + "&visitor-data=" + visitorDataEncoded;
	
	let response = null;
	try {
		response = await fetch(url);
	} catch (ex) {
		error(new Date().toLocaleString() + " -- [Youtube-download][requestVideoDataAsync] " + ex.message);
		return { error: ex.message };
	}
	
	let data = await response.json();
	if (response.ok == false) {
		let result = {
			error: "Request failed: " + response.status + " -- " + response.statusText
		};
		error(new Date().toLocaleString() + " -- [Youtube-download][requestVideoDataAsync] " + result.error + "\n", data);
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
		error(new Date().toLocaleString() + " -- [Youtube-download][requestVideoDataAsync] " + result.error + "\n", data);
		return result;
	}
	
	return data;
}

/**
 * Ask the localhost to download the given video.
 * @param {String} videoId 
 * @param {String} audioUrl 
 * @param {Number} audioContentLength 
 * @param {String} videoUrl 
 * @param {Number} videoContentLength 
 */
export async function downloadAsync(videoId, audioUrl, audioContentLength, videoUrl, videoContentLength) {
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
	
	let port = await Config.getAsync("localhostPort");
	let url = "http://localhost:" + port + "/youtube/download/download?video-id=" + videoId +
		"&audio-url=" + encodedAudioUrl + "&audio-content-length=" + audioContentLength +
		"&video-url=" + encodedVideoUrl + "&video-content-length=" + videoContentLength;
	
	let response = null;
	try {
		response = await fetch(url);
	} catch (ex) {
		error(new Date().toLocaleString() + " -- [Youtube-download][downloadAsync] " + ex.message);
		result.error = ex.message;
		return result;
	}
	
	let data = await response.json();
	result.result = data;
	if (response.ok == false) {
		let errorMessage = "Request failed: " + response.status + " -- " + response.statusText;
		error(new Date().toLocaleString() + " -- [Youtube-download][downloadAsync] " + errorMessage, data);
		result.error = errorMessage;
		if (data.error != null)
			result.error += "\n" + data.error;
		if (data.operation != null)
			result.error += "\nOperation: " + data.operation;
	}
	
	if (data.success != null && data.success == true) {
		let videoData = await _videoDataById.getAsync(videoId);
		if (videoData != null) {
			videoData.localhostResponse.localFileExists = true;
		}
	}
	
	return result;
}

/**
 * Ask the localhost to open the video file for the given id.
 * @param {String} videoId 
 */
export async function openFileAsync(videoId) {
	let port = await Config.getAsync("localhostPort");
	let url = "http://localhost:" + port + "/youtube/download/open-file?video-id=" + videoId;
	
	let response = null;
	try {
		response = await fetch(url);
	} catch (ex) {
		error(new Date().toLocaleString() + " -- [Youtube-download][openFileAsync] " + ex.message);
		return { error: ex.message }
	}
	
	let data = await response.json();
	if (response.ok == false) {
		let result = {
			error: data.error,
			status: response.status + " -- " + response.statusText
		};
		let errorMessage = "Request failed: " + result.status;
		error(new Date().toLocaleString() + " -- [Youtube-download][openFileAsync] " + errorMessage + "\n", data);
		return result;
	}
	
	return data;
}