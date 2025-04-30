console.log(new Date().toLocaleString() + " -- [Netflix] Script started.");

/**
 * Inject the script allowing to change the forward and backward jump times.
 */
(function injectSeekScript() {
	function sendMessageToInjectedScript(detail) {
		let event = new CustomEvent("caoglSeekIS", { detail: detail });
		window.dispatchEvent(event);
	}
	
	let scriptEl = document.createElement("script");
	scriptEl.src = chrome.extension.getURL("/sites/Netflix/netflix-is-seek.js");
	scriptEl.onload = function () {
		chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
			if (message.action == null)
				return;
			//.. Just passing messages between the popup and the injected script.
			if (message.action == "getJumpTimes") {
				function handleMessageFromInjectedScript(mess) {
					window.removeEventListener("caoglSeekCS", handleMessageFromInjectedScript);
					message.jumpTimes = mess.detail.jumpTimes;
					sendResponse(message);
				}
				window.addEventListener("caoglSeekCS", handleMessageFromInjectedScript);
				sendMessageToInjectedScript(message);
				return true; //.. async.
			} else if (message.action == "setJumpTimes") {
				function handleMessageFromInjectedScript(mess) {
					window.removeEventListener("caoglSeekCS", handleMessageFromInjectedScript);
					sendResponse(mess);
				}
				window.addEventListener("caoglSeekCS", handleMessageFromInjectedScript);
				sendMessageToInjectedScript(message);
				return true; //.. async.
			}
		});
	}
	let e = document.body || document.documentElement;
	e.appendChild(scriptEl);
})();