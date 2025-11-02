import * as Config from "../sw-config.js"
import { error } from "../sw-log.js";

class RatingData {
	/** @type {Number} */
	ratedTime;
	/** @type {String} */
	rating;
	/** @type {String} */
	videoId;
	
	/**
	 * @param {String} videoId 
	 * @param {Number} ratedTime 
	 * @param {String} rating 
	 */
	constructor(videoId, ratedTime, rating) {
		this.ratedTime = ratedTime;
		this.rating = rating;
		this.videoId = videoId;
	}
}

/** @type {Array<RatingData>} */
let _ratedVideos = null;

/**
 * Send a request to my localhost to select, from my SQLite database, all the Youtube videos I rated.
 */
async function requestAllRatedVideosAsync() {
	if (_ratedVideos != null)
		return;
	
	let key = "Youtube.ratedVideos";
	let { [key]: ratedVideos } = await chrome.storage.session.get(key);
	if (ratedVideos != null) {
		_ratedVideos = ratedVideos;
		return;
	}
	
	let port = await Config.getAsync("localhostPort");
	let url = "http://localhost:" + port + "/youtube/rating/get-rated-videos";
	let response = null;
	try {
		response = await fetch(url);
	} catch (ex) {
		if (ex.message != null)
			error(new Date().toLocaleString() + " -- [Youtube-rating][requestAllRatedVideosAsync] Fetch error: " + ex.message);
		else
			error(new Date().toLocaleString() + " -- [Youtube-rating][requestAllRatedVideosAsync] Fetch error: " + ex);
		return;
	}
	
	if (response.ok == false) {
		error(new Date().toLocaleString() + " -- [Youtube-rating][requestAllRatedVideosAsync] Request failed: " + response.status + " -- " + response.statusText);
		return;
	}
	
	try {
		let data = await response.json();
		if (Array.isArray(data) && data.length > 0) {
			_ratedVideos = [];
			let now = Date.now();
			for (let i = 0; i < data.length; i++) {
				let savedData = data[i];
				let rd = new RatingData(savedData.videoId, now, savedData.rating);
				_ratedVideos.push(rd);
			}
		}
		
		await chrome.storage.session.set({ [key]: _ratedVideos });
	} catch (ex) {
		if (ex.message != null) //.. TypeError
			error(new Date().toLocaleString() + " -- [Youtube-rating][requestAllRatedVideosAsync] Can't get the JSON response: " + ex.message);
		else
			error(new Date().toLocaleString() + " -- [Youtube-rating][requestAllRatedVideosAsync] Can't get the JSON response: " + ex);
	}
}

/**
 * Get the videos I liked or disliked since the last sync.
 * @param {Number} lastSyncTime 
 */
export async function getRatedVideosAsync(lastSyncTime) {
	await requestAllRatedVideosAsync();
	
	if (lastSyncTime == null || lastSyncTime == 0) {
		return _ratedVideos;
	} else {
		//.. The array has to be in the chronological order.
		let videos = [];
		for (let i = _ratedVideos.length - 1; i >= 0; i--) {
			let rd = _ratedVideos[i];
			if (rd.ratedTime == null || rd.ratedTime == 0 || rd.ratedTime < lastSyncTime)
				break;
			videos.push(rd);
		}
		return videos;
	}
}

/**
 * 
 * @param {any} videoDetails 
 * @param {String} rating 
 * @returns 
 */
export async function setRatedVideoAsync(videoDetails, rating) {
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
	
	let port = await Config.getAsync("localhostPort");
	let url = "http://localhost:" + port + "/youtube/rating/set-video-rating";
	let response = null;
	try {
		response = await fetch(url, {
			method: "POST",
			body: body
		});
	} catch (ex) {
		error(new Date().toLocaleString() + " -- [Youtube-rating][setRatedVideoAsync] " + ex.message);
		return { success: false, error: ex.message };
	}
	
	if (response.ok == false) {
		let error = "Request failed: " + response.status + " -- " + response.statusText;
		error(new Date().toLocaleString() + " -- [Youtube-rating][setRatedVideoAsync] " + error);
		return { success: false, error: error };
	}
	
	let rd = new RatingData(videoDetails.videoId, Date.now(), rating);
	//.. I want to preserve the chronological order.
	let index = _ratedVideos.findIndex(item => item.videoId == videoDetails.videoId);
	if (index >= 0) {
		if (index == _ratedVideos.length - 1) {
			_ratedVideos[index] = rd;
		} else {
			_ratedVideos.splice(index, 1);
			_ratedVideos.push(rd);
		}
	} else {
		_ratedVideos.push(rd);
	}
	return { success: true };
}