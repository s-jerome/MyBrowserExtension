(function () {
	chrome.tabs.sendMessage(window.selectedTab.id, { action: "getConfig" }, function (response) {
		/** @type {HTMLButtonElement} */
		let saveButton = document.getElementById("save");
		/** @type {HTMLButtonElement} */
		let restoreDefaultsButton = document.getElementById("restore-defaults");
		
		if (response == null || response.config == null) {
			if (response == null)
				console.error(new Date().toLocaleString() + " -- Can't get the config.");
			else if (response.config == null)
				console.error(new Date().toLocaleString() + " -- The config is null.\n", response);
			let e = document.getElementById("title");
			e.style.color = "red";
			saveButton.disabled = true;
			restoreDefaultsButton.disabled = true;
			return;
		}
		
		let config = response.config;
		
		/** @type {HTMLInputElement} */
		let subtitlesBackgroundEnabledCheckbox = document.getElementById("subtitles-background-enabled");
		subtitlesBackgroundEnabledCheckbox.checked = config.subtitlesBackgroundEnabled;
		
		/** @type {HTMLInputElement} */
		let subtitlesBackgroundColorInput = document.getElementById("subtitles-background-color");
		subtitlesBackgroundColorInput.value = config.subtitlesBackgroundColor;
		
		/** @type {HTMLInputElement} */
		let removeVignettingCheckbox = document.getElementById("remove-vignetting");
		removeVignettingCheckbox.checked = config.removeVignetting;
		
		/** @type {HTMLInputElement} */
		let changeInterfacePaddingCheckbox = document.getElementById("change-interface-padding");
		changeInterfacePaddingCheckbox.checked = config.changeInterfacePadding;
		
		/** @type {HTMLInputElement} */
		let interfacePaddingInput = document.getElementById("interface-padding");
		interfacePaddingInput.value = config.interfacePadding;
		
		saveButton.addEventListener("click", function () {
			let interfacePadding = parseInt(interfacePaddingInput.value);
			if (isNaN(interfacePadding) || interfacePadding < 0) {
				alert("The interface padding is invalid.")
				return;
			}
			
			saveButton.disabled = true;
			let config = {
				subtitlesBackgroundEnabled: subtitlesBackgroundEnabledCheckbox.checked,
				subtitlesBackgroundColor: subtitlesBackgroundColorInput.value,
				removeVignetting: removeVignettingCheckbox.checked,
				changeInterfacePadding: changeInterfacePaddingCheckbox.checked,
				interfacePadding: interfacePadding.toString() + "px"
			};
			let messageToSend = { action: "setConfig", config: config };
			chrome.tabs.sendMessage(window.selectedTab.id, messageToSend, function (saveResponse) {
				saveButton.disabled = false;
			});
		});
		
		restoreDefaultsButton.addEventListener("click", function () {
			let defaultConfig = response.defaultConfig;
			
			subtitlesBackgroundEnabledCheckbox.checked = defaultConfig.subtitlesBackgroundEnabled;
			subtitlesBackgroundColorInput.value = defaultConfig.subtitlesBackgroundColor;
			removeVignettingCheckbox.checked = defaultConfig.removeVignetting;
			changeInterfacePaddingCheckbox.checked = defaultConfig.changeInterfacePadding;
			interfacePaddingInput.value = defaultConfig.interfacePadding;
		});
	});
})();