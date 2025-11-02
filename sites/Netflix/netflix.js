(function () {
	console.log(new Date().toLocaleString() + " -- [Netflix] Script started.");
	
	/**
	 * Inject some CSS to undo some rules made by Netflix preventing some texts to be selectable.
	 */
	function injectCSS() {
		let cssEl = document.createElement("style");
		cssEl.id = "caogl-css";
		cssEl.innerHTML = "body, html { user-select: auto; -webkit-user-select: auto; cursor: auto; }";
		document.head.appendChild(cssEl);
	}
	
	async function injectScript(jsFilePath) {
		return new Promise(function (resolve, reject) {
			try {
				let scriptEl = document.createElement("script");
				scriptEl.src = chrome.runtime.getURL(jsFilePath);
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
	
	/**
	 * Inject the script saving the video I add/remove from my playlist into a local database.
	 */
	async function injectPlaylistScript() {
		//.. Create a hidden input to store the id of the extension,
		//.. so that the injected script can fetch the playlist modal files.
		let hiddenInputEl = document.createElement("input");
		hiddenInputEl.id = "caogl-extension-id";
		hiddenInputEl.hidden = true;
		hiddenInputEl.setAttribute("extension-id", chrome.runtime.id);
		document.body.appendChild(hiddenInputEl);
		
		await injectScript("/sites/Netflix/playlist/netflix-is-playlist.js");
	}
	
	function sendMessageToSeekScript(detail) {
		let event = new CustomEvent("caoglSeekIS", { detail: detail });
		window.dispatchEvent(event);
	}
	
	async function init() {
		//.. Inject this script first because it has to intercept fetch requests.
		await injectPlaylistScript();
		
		injectCSS();
		
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
		
		window.addEventListener("caoglPlaylistCS", function (customEvent) {
			if (customEvent.detail == null || customEvent.detail.action == null)
				return;
			
			if (customEvent.detail.action == "saveVideoData") {
				chrome.runtime.sendMessage(customEvent.detail, function (response) {
					let event = new CustomEvent("caoglPlaylistIS", { detail: response });
					window.dispatchEvent(event);
				});
			}
		});
	}
	
	if (document.readyState == "loading") {
		window.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();