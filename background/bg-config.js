const Config = (function () {
	const _config = {
		localhostPort: "8888"
	};
	
	return {
		async read() {
			let url = chrome.runtime.getURL("/config.json");
			let response = await fetch(url);
			let data = await response.json();
			for (let propertyName in _config) {
				let propertyValue = data[propertyName];
				if (propertyValue == null)
					continue;
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
		}
	}
})();