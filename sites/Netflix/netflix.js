(function () {
	console.log(new Date().toLocaleString() + " -- [Netflix] Script started.");
	
	async function injectScript(jsFilePath) {
		return new Promise(function (resolve, reject) {
			try {
				let scriptEl = document.createElement("script");
				scriptEl.src = chrome.extension.getURL(jsFilePath);
				scriptEl.onload = function () {
					resolve();
				};
				scriptEl.onerror = function (errorEvent) {
					reject(errorEvent);
				};
				document.body.appendChild(scriptEl);
			} catch (e) {
				reject(e);
			}
		});
	}
	
	/**
	 * Inject the script displaying the elapsed time of a video on the left of the progressbar.
	 */
	async function injectElapsedTimeScript() {
		await injectScript("/sites/Netflix/netflix-is-elapsed-time.js");
	}
	
	/**
	 * Inject the main script in charge of the MutationObserver.
	 */
	async function injectMainScript() {
		await injectScript("/sites/Netflix/netflix-is.js");
	}
	
	/**
	 * Inject the script allowing to change the forward and backward jump times.
	 */
	async function injectSeekScript() {
		await injectScript("/sites/Netflix/netflix-is-seek.js");
	}
	
	function sendMessageToSeekScript(detail) {
		let event = new CustomEvent("caoglSeekIS", { detail: detail });
		window.dispatchEvent(event);
	}
	
	async function init() {
		await injectElapsedTimeScript();
		await injectSeekScript();
		//.. The main script is injected last because it is the one interacting with the others.
		await injectMainScript();
		
		chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
			if (message.action == null)
				return;
			//.. Just passing messages between the popup and the seek script.
			if (message.action == "getJumpTimes") {
				function handleMessageFromSeekScript(mess) {
					window.removeEventListener("caoglSeekCS", handleMessageFromSeekScript);
					message.jumpTimes = mess.detail.jumpTimes;
					sendResponse(message);
				}
				window.addEventListener("caoglSeekCS", handleMessageFromSeekScript);
				sendMessageToSeekScript(message);
				return true; //.. async.
			} else if (message.action == "setJumpTimes") {
				function handleMessageFromSeekScript(mess) {
					window.removeEventListener("caoglSeekCS", handleMessageFromSeekScript);
					sendResponse(mess);
				}
				window.addEventListener("caoglSeekCS", handleMessageFromSeekScript);
				sendMessageToSeekScript(message);
				return true; //.. async.
			}
		});
	}
	
	if (document.readyState == "loading") {
		window.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();