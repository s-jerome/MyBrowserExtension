chrome.tabs.sendMessage(window.selectedTab.id, { action: "getConfig" }, function (response) {
	document.body.innerHTML = "";
	
	let titleEl = document.createElement("span");
	document.body.appendChild(titleEl);
	titleEl.textContent = "LinkedIn";
	titleEl.className = "title";
	if (response == null) {
		//.. Just in case something went wrong.
		titleEl.style.color = "red";
		console.error(new Date().toLocaleString() + " -- Can't get the config.");
		return;
	}
	
	let div = document.createElement("div");
	document.body.appendChild(div);
	div.className = "container";
	let span = document.createElement("span");
	div.appendChild(span);
	span.style.marginRight = "20px";
	span.textContent = "Block \"chrome-extension\" requests:";
	
	/**
	 * Create a swithc On/Off to enable/disable the request blocking.
	 * @param {HTMLElement} parentEl 
	 */
	function createSwitch(parentEl) {
		let label = document.createElement("label");
		parentEl.appendChild(label);
		label.className = "switch";
		
		let input = document.createElement("input");
		label.appendChild(input);
		input.type = "checkbox";
		
		let span = document.createElement("span");
		label.appendChild(span);
		span.className = "slider round";
		
		return input;
	}
	
	let switchEl = createSwitch(div);
	switchEl.checked = response.requestBlockingIsEnabled;
	switchEl.addEventListener("change", function (event) {
		let isChecked = switchEl.checked;
		switchEl.disabled = true;
		let messageToSend = { action: "setConfig", requestBlockingIsEnabled: isChecked };
		chrome.tabs.sendMessage(window.selectedTab.id, messageToSend, function (setConfigResponse) {
			if (setConfigResponse != null) {
				switchEl.disabled = false;
			} else {
				//.. Just in case something went wrong.
				span.style.color = "red";
				console.error(new Date().toLocaleString() + " -- Can't set the request blocking.");
			}
		});
	});
});