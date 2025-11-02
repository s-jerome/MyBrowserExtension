/**
 * @param {any} storage 
 * @param {String} key 
 * @param {any} defaultValue 
 */
async function getItem(storage, key, defaultValue) {
	//.. @@alternative :
	// let { [key]: itemValue } = await storage.get(key);
	// return itemValue;
	
	let result = await storage.get(key);
	//.. It's an object with the key as property: { key: itemValue }
	if (result == null || result[key] == null)
		return defaultValue;
	let itemValue = result[key];
	return itemValue;
}

/**
 * Read the given item from the session storage.
 * @param {String} key 
 * @param {any} defaultValue 
 */
export async function readSessionItem(key, defaultValue) {
	let val = await getItem(chrome.storage.session, key, defaultValue);
	return val;
}

/**
 * Save the given item in the session storage.
 * @param {String} key 
 * @param {any} val 
 */
export async function saveSessionItem(key, val) {
	return await chrome.storage.session.set({ [key]: val });
}