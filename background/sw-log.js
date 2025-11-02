import { readSessionItem, saveSessionItem } from "./sw-storage.js";

async function append(itemName, ...data) {
	/** @type {Array<String>} */
	let itemValue = await readSessionItem(itemName, []);
	if (data.length == 1)
		itemValue.push(data[0]);
	else
		itemValue.push(data);
	return await saveSessionItem(itemName, itemValue);
}

/**
 * Save the given log in the session storage,
 * because the console.log is reset each time the service worker restarts.
 * @param  {...any} data 
 */
export async function log(...data) {
	console.log(...data);
	
	return append("console.log", ...data);
}

export async function error(...data) {
	console.error(...data);
	
	return append("console.error", ...data);
}