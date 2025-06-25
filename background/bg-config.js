const Config = (function () {
	const _config = {
		localhostPort: "8888"
	};
	
	return {
		async read() {
			let url = chrome.runtime.getURL("/config.json");
			let response = await fetch(url);
			let data = await response.json();
			for (let propertyName in data) {
				let propertyValue = data[propertyName];
				_config[propertyName] = propertyValue;
			}
		},
		
		/**
		 * Get the config value for the given key. If there is no value, an empty string is returned.
		 * @param {String} key 
		 */
		get(key) {
			let value = _config[key];
			if (value == null)
				value = "";
			return value;
		},
		
		/**
		 * Get the number config value for the given key.
		 * If there is no value, or it's not a number, the given default value is returned.
		 * @param {String} key 
		 * @param {Number} defaultValue 
		 */
		getNumber(key, defaultValue) {
			let value = this.get(key);
			let number = parseInt(value);
			if (isNaN(number) == false)
				return number;
			else
				return defaultValue;
		}
	}
})();