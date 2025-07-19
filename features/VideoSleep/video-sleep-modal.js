(async function () {
	console.log(new Date().toLocaleString() + " -- [VideoSleep] Modal loaded.");
	
	async function loadHTML() {
		let url = chrome.runtime.getURL("/features/VideoSleep/video-sleep-modal.html");
		let response = await fetch(url);
		let text = await response.text();
		let container = document.getElementById("video-sleep-container");
		if (container != null)
			container.remove();
		container = document.createElement("div");
		container.id = "video-sleep-container";
		document.body.appendChild(container);
		container.innerHTML = text;
	}
	await loadHTML();
	
	let _redirectUrl = "https://www.google.com/";
	
	/**
	 * Determine if the modal is closed after the click on the button STOP.
	 */
	let _closeAfterStop = false;
	
	/**
	 * The interval used to calcul the time left before the end of the sleep, if enabled.
	 * @type {Number} 
	 */
	let _timeLeftInterval = null;
	
	/** @type {HTMLDivElement} */
	let _videoSleepModal = document.getElementById("video-sleep-modal");
	
	/** @type {HTMLDivElement} */
	let _containerEl = _videoSleepModal.parentElement;
	_containerEl.addEventListener("click", function (pointerEvent) {
		if (pointerEvent != null && pointerEvent.target != _containerEl)
			return;
		closeModal();
	});
	
	/** @type {HTMLButtonElement} */
	let _addOrUpdateButton = _videoSleepModal.querySelector("#add-or-update-video-sleep");
	_addOrUpdateButton.addEventListener("click", function () {
		let minutes = parseInt(_minutesInput.value);
		if (isNaN(minutes) || minutes <= 0) {
			alert("Minutes are invalid.");
			return;
		}
		
		let scope = _scopeSelect.value;
		if (scope == "page") {
			if (window.videoSleepData != null && window.videoSleepData.timeout != null)
				clearTimeout(window.videoSleepData.timeout);
			window.videoSleepData = {};
			window.videoSleepData.scope = scope;
			window.videoSleepData.minutes = minutes;
			window.videoSleepData.timeout = setTimeout(function () {
				//.. Useless to write this in the console, considering it will be cleared after the redirection.
				console.log(new Date().toLocaleString() + " -- [VideoSleep] timeout over.");
				//.. Useless considering the variable won't exist anymore after the redirection.
				window.videoSleepData = null;
				document.location.href = _redirectUrl;
			}, minutes * 60 * 1000);
			window.videoSleepData.startedAt = new Date();
			onTimeoutCreated(minutes, scope);
		} else {
			_addOrUpdateButton.disabled = true;
			
			let message = {
				feature: "VideoSleep",
				action: "create",
				minutes: minutes,
				scope: scope,
				redirectUrl: _redirectUrl,
				addOrUpdate: _addOrUpdateButton.innerText.toLowerCase()
			};
			chrome.runtime.sendMessage(message, processBackgroundResponse);
		}
	});
	
	/** @type {HTMLButtonElement} */
	let _stopButton = _videoSleepModal.querySelector("#stop");
	_stopButton.addEventListener("click", function () {
		let scope = _scopeSelect.value;
		if (scope == "page") {
			console.log(new Date().toLocaleString() + " -- [VideoSleep] stop.");
			clearTimeout(window.videoSleepData.timeout);
			window.videoSleepData = null;
			onTimeoutStopped();
		} else {
			_stopButton.disabled = true;
			_stopButton.innerText = "Stopping...";
			let message = {
				feature: "VideoSleep",
				action: "stop"
			};
			chrome.runtime.sendMessage(message, processBackgroundResponse);
		}
	});
	
	let _statusSpan = _videoSleepModal.querySelector("#status");
	
	/** @type {HTMLSelectElement} */
	let _scopeSelect = _videoSleepModal.querySelector("#scope");
	
	/** @type {HTMLInputElement} */
	let _minutesInput = _videoSleepModal.querySelector("#minutes");
	_minutesInput.focus();
	_minutesInput.addEventListener("keydown", function (keyboardEvent) {
		if (keyboardEvent.key == "ArrowUp") {
			//.. Increase the number as long as the ArrowUp is pressed.
			let minutes = parseInt(_minutesInput.value);
			if (isNaN(minutes) || minutes <= 0) {
				minutes = 1;
			} else {
				minutes++;
			}
			_minutesInput.value = minutes;
		} else if (keyboardEvent.key == "ArrowDown") {
			//.. Decrease the number as long as the ArrowDown is pressed.
			let minutes = parseInt(_minutesInput.value);
			if (isNaN(minutes) || minutes < 1) {
				minutes = 1;
			} else if (minutes > 1) {
				minutes--;
			} else {
				return;
			}
			_minutesInput.value = minutes;
		} else if (keyboardEvent.key == "Enter") {
			_addOrUpdateButton.click();
		}
		
		//.. Specially usefull for tv.orange.fr because when taping a number it changes the TV channel.
		keyboardEvent.stopPropagation();
	});
	
	_videoSleepModal.querySelector("#min30").addEventListener("click", function () {
		_minutesInput.value = "30";
	});
	_videoSleepModal.querySelector("#min60").addEventListener("click", function () {
		_minutesInput.value = "60";
	});
	
	function processBackgroundResponse(response) {
		console.log(new Date().toLocaleString() + " -- [VideoSleep] Backgroud response:", response);
		if (response.action == "getData") {
			_backgroundSleep = response.videoSleepData;
			if (response.videoSleepData == null) {
				_statusSpan.innerText = "Off";
				
				let lastValue = localStorage.getItem("VideoSleep");
				if (lastValue != null) {
					let last = JSON.parse(lastValue);
					_scopeSelect.value = last.scope;
					_minutesInput.value = last.minutes;
				}
				
				_addOrUpdateButton.innerText = "Add";
			} else {
				displayData(response.videoSleepData);
			}
		} else if (response.action == "create") {
			onTimeoutCreated(response.minutes, response.scope);
		} else if (response.action == "stop") {
			console.log(new Date().toLocaleString() + " -- [VideoSleep] background timeout stopped.");
			onTimeoutStopped();
		}
	}
	
	/**
	 * @param {Number} minutes 
	 * @param {String} scope 
	 */
	function onTimeoutCreated(minutes, scope) {
		let now = new Date();
		localStorage.setItem("VideoSleep", JSON.stringify({ scope: scope, minutes: minutes, startedAt: now }));
		let addOrUpdate = _addOrUpdateButton.innerText.toLowerCase();
		console.log(now.toLocaleString() + " -- [VideoSleep] " + addOrUpdate + " sleep of " + minutes + " min in the " + scope + " scope.");
		closeModal();
	}
	
	function onTimeoutStopped() {
		if (_closeAfterStop) {
			closeModal();
		} else {
			stopTimeLeftInterval();
			_stopButton.style.display = "none";
			_statusSpan.innerText = "Off";
			_scopeSelect.disabled = false;
			_addOrUpdateButton.innerText = "Add";
		}
	}
	
	function stopTimeLeftInterval() {
		if (_timeLeftInterval != null)
			clearInterval(_timeLeftInterval);
	}
	
	/**
	 * Close the dialog by removing its container.
	 */
	function closeModal() {
		stopTimeLeftInterval();
		_containerEl.remove();
	}
	
	function displayData(videoSleepData) {
		displayTimeLeft(videoSleepData.startedAt, videoSleepData.minutes);
		_timeLeftInterval = setInterval(function () {
			displayTimeLeft(videoSleepData.startedAt, videoSleepData.minutes);
		}, 1000);
		_addOrUpdateButton.innerText = "Update";
		_scopeSelect.value = videoSleepData.scope;
		_scopeSelect.disabled = true;
		_minutesInput.value = videoSleepData.minutes;
		_stopButton.style.display = "";
	}
	
	/**
	 * Display the time left before the end of the sleep.
	 * @param {Date} startedAt 
	 * @param {Number} minutes 
	 */
	function displayTimeLeft(startedAt, minutes) {
		let endDate = new Date(startedAt);
		endDate.setMinutes(endDate.getMinutes() + minutes);
		let now = new Date();
		let totalSeconds = parseInt((endDate - now) / 1000);
		if (totalSeconds > 60) {
			let all = totalSeconds / 60;
			let minutes = parseInt(all);
			let left = all - minutes;
			let seconds = parseInt(left * 60);
			_statusSpan.innerText = "On (" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0") + "min left)";
		} else {
			_statusSpan.innerText = "On (" + totalSeconds.toString().padStart(2, "0") + "sec left)";
		}
	}
	
	if (window.videoSleepData != null) {
		displayData(window.videoSleepData);
	} else {
		//.. There is no sleep in the page scope,
		//.. but maybe there is one in the background scope.
		_statusSpan.innerText = "...";
		let message = {
			feature: "VideoSleep",
			action: "getData"
		};
		chrome.runtime.sendMessage(message, processBackgroundResponse);
	}
})();