/**
 * This script makes some changes in the CSS of the site to have a better video interface (subtitles background, vignetting...).
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [tv.orange.fr] Script started.");
	
	const DEFAULT_CONFIG = {
		subtitlesBackgroundEnabled: true,
		subtitlesBackgroundColor: "black",
		removeVignetting: true,
		changeInterfacePadding: true,
		interfacePadding: "20px"
	};
	
	let _config = Object.assign({}, DEFAULT_CONFIG);
	
	(function readConfig() {
		let itemValue = localStorage.getItem("caoglConfig");
		if (itemValue != null && itemValue != "")
			_config = JSON.parse(itemValue);
	})();
	
	/** @type {HTMLLinkElement} */
	let _cssEl = null;
	
	/**
	 * Create some CSS rules from the config.
	 */
	function getCSSRules() {
		//.. The class names are the ones made by the site.
		//.. I juste add some rules to them.
		
		let css = ".sqp-ttml-inner-p {";
		if (_config.subtitlesBackgroundEnabled)
			css += " background-color: " + _config.subtitlesBackgroundColor + ";";
		css += " } ";
		
		css += ".stv-pgui-control-bar {";
		if (_config.removeVignetting)
			css += " background: none !important; ";
		if (_config.changeInterfacePadding) {
			let px = parseInt(_config.interfacePadding);
			if (isNaN(px) == false && px >= 0) {
				_config.interfacePadding = px.toString() + "px";
				css += " padding: " + _config.interfacePadding + " !important; ";
			}
		}
		css += "}";
		
		return css;
	}
	
	function injectCSS() {
		if (_cssEl == null) {
			_cssEl = document.createElement("style");
			_cssEl.id = "caogl-css";
			document.head.appendChild(_cssEl);
		}
		_cssEl.innerHTML = getCSSRules();
	}
	
	injectCSS();
	
	chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
		if (message.action == null)
			return;
		
		if (message.action == "getConfig") {
			message.config = _config;
			message.defaultConfig = DEFAULT_CONFIG;
			sendResponse(message);
		} else if (message.action == "setConfig") {
			_config = message.config;
			injectCSS();
			localStorage.setItem("caoglConfig", JSON.stringify(_config));
			sendResponse(message);
		}
	});
})();