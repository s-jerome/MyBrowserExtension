let _configIsRead = false;

const _config = {
	localhostPort: "8888"
};

export async function read() {
	if (_configIsRead)
		return;
	
	let url = chrome.runtime.getURL("/config.json");
	let response = await fetch(url);
	let data = await response.json();
	for (let propertyName in data) {
		let propertyValue = data[propertyName];
		_config[propertyName] = propertyValue;
	}
	_configIsRead = true;
}

/**
 * Get the config value for the given key. If there is no value, an empty string is returned.
 * @param {String} key 
 */
export async function getAsync(key) {
	await read();
	
	let value = _config[key];
	if (value == null)
		value = "";
	return value;
}

/**
 * If `defaultValue` is true, return false only if the config value equals "false".
 * 
 * If `defaultValue` is false, return true only if the config value equals "true".
 * @param {String} key 
 * @param {Boolean} defaultValue 
 * @returns {Promise<Boolean>} 
 */
export async function getBooleanAsync(key, defaultValue) {
	let value = await getAsync(key);
	let type = typeof value;
	if (type == "boolean")
		return value;
	if (type == "string") {
		if (defaultValue) {
			let result = value == "false";
			return result
		} else {
			let result = value == "true";
			return result
		}
	}
	return defaultValue;
}

/**
 * Get the number config value for the given key.
 * If there is no value, or it's not a number, the given default value is returned.
 * @param {String} key 
 * @param {Number} defaultValue 
 */
export async function getNumberAsync(key, defaultValue) {
	let value = await getAsync(key);
	let number = parseInt(value);
	if (isNaN(number) == false)
		return number;
	else if (defaultValue != null && isNaN(defaultValue) == false)
		return defaultValue;
	else
		return 0;
}