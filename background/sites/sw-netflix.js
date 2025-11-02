import * as Config from "../sw-config.js";
import { error } from "../sw-log.js";

/**
 * Returns the current date to this format: YYYY-MM-DD hh:mm:ss offset
 * The offset is in this format: +02:00
 */
function getNowToString() {
	let now = new Date();
	let offset = (now.getTimezoneOffset() / 60) * -1;
	let offsetToString = offset.toString().padStart(2, "0") + ":00";
	if (offset >= 0)
		offsetToString = "+" + offsetToString;
	
	return now.getFullYear() + "-" + (now.getMonth() + 1).toString().padStart(2, "0") + "-" + now.getDate().toString().padStart(2, "0") + " " +
		now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0") + ":" + now.getSeconds().toString().padStart(2, "0") + " " +
		offsetToString;
}

/**
 * Send a request to my localhost to insert/update the video data in my database.
 * @param {String} operation add/remove
 * @param {String} reason The reason why I add (or remove) the video from my list.
 * @param {any} videoData 
 */
export async function saveVideoDataAsync(operation, reason, videoData) {
	let result = {
		error: null,
		result: null
	};
	
	if (operation == null || operation == "")
		operation = "add or remove";
	if (reason == null)
		reason = "";
	
	let nowToString = getNowToString();
	videoData.status = nowToString + " -- " + operation + "\r\n" + reason;
	let body = JSON.stringify(videoData);
	
	let port = await Config.getAsync("localhostPort");
	let url = "http://localhost:" + port + "/netflix/save-video-to-playlist";
	let response = null;
	try {
		response = await fetch(url, {
			method: "POST",
			body: body
		});
	} catch (ex) {
		error(new Date().toLocaleString() + " -- [Netflix][saveVideoDataAsync] " + ex.message);
		result.error = ex.message;
		return result;
	}
	
	if (response.ok == false) {
		let data = await response.json();
		let error = "Request failed: " + response.status + " -- " + response.statusText;
		error(new Date().toLocaleString() + " -- [Netflix][saveVideoDataAsync] " + error, data);
		result.error = error;
		if (data["error"] != null)
			result.error += "\n" + data["error"];
		if (data["operation"] != null)
			result.error += "\nOperation: " + data["operation"];
		return result;
	}
	
	result.result = await response.json();
	return result;
}