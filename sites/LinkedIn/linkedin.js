console.log(new Date().toLocaleString() + " -- [LinkedIn] Script started.");

/**
 * Get the post id from the url.
 */
function getPostId() {
	/**
	 * The regex used to know if the url of the post is in the "post" form, lookink like this:
	 * https://www.linkedin.com/posts/<author-name>_<slug>-activity-<post-id>-<4-chars>/
	 */
	const REGEX_POST_PAGE = /\/posts\/(.*_.+?-)?(\w*-(?<postId>\d{19}))/;
	
	/**
	 * The regex used to know if the url of the post is in the "feed" form, looking like this:
	 * https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A<post-id>/?origin=SHARED_BY_YOUR_NETWORK
	 * https://www.linkedin.com/feed/update/urn:li:activity:<post-id>/?origin=SHARED_BY_YOUR_NETWORK
	 */
	const REGEX_POST_FEED = /\/feed\/update\/.*(?<postId>\d{19})/;
	
	let postId = "";
	let postPageMatch = document.location.href.match(REGEX_POST_PAGE);
	if (postPageMatch == null) {
		let feedPageMatch = document.location.href.match(REGEX_POST_FEED);
		if (feedPageMatch == null) {
			//.. The page is not a post page, so no need to inject the script.
			return postId;
		}
		else {
			postId = feedPageMatch.groups["postId"];
		}
	} else {
		postId = postPageMatch.groups["postId"];
	}
	
	return postId;
}

/**
 * Inject the script displaying the absolute date of a post.
 * @param {String} postId 
 */
function injectPostScript(postId) {
	//.. The content script is run at document_start, so the document might not be ready yet.
	if (document.readyState == "interactive" || document.readyState == "complete") {
		handlePageLoaded();
	} else {
		//.. The "DOMContentLoaded" event should do it, not need to use the "load" event.
		window.addEventListener("DOMContentLoaded", handlePageLoaded);
	}
	
	function handlePageLoaded() {
		//.. Create a hidden input to store the post id, so that the injected script can retrieve it.
		let hiddenInputEl = document.createElement("input");
		hiddenInputEl.id = "caogl-post-id";
		hiddenInputEl.hidden = true;
		hiddenInputEl.setAttribute("post-id", postId);
		document.body.appendChild(hiddenInputEl);
		
		let scriptEl = document.createElement("script");
		scriptEl.src = chrome.runtime.getURL("/sites/LinkedIn/linkedin-is-post-absolute-date.js");
		document.head.appendChild(scriptEl);
	}
}

/**
 * Inject the script intercepting the fetch requests to block those made by the site on "chrome-extension://".
 */
function injectRequestBlockingScript() {
	let scriptEl = document.createElement("script");
	scriptEl.src = chrome.runtime.getURL("/sites/LinkedIn/linkedin-is-request-blocking.js");
	scriptEl.onload = function () {
		chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
			if (message.action == "getConfig") {
				let requestBlocking = localStorage.getItem("caoglRequestBlocking");
				message.requestBlockingIsEnabled = (requestBlocking != null && requestBlocking == "true") ? true : false;
				sendResponse(message);
			} else if (message.action == "setConfig") {
				localStorage.setItem("caoglRequestBlocking", message.requestBlockingIsEnabled);
				//.. Just respond something so that the popup knows everything went well.
				sendResponse(message);
			}
		});
	};
	let e = document.body || document.documentElement;
	e.appendChild(scriptEl);
}

(function () {
	injectRequestBlockingScript();
	
	let postId = getPostId();
	if (postId != "") {
		injectPostScript(postId);
	}
	
	if (document.location.href.indexOf("/posts/") < 0) {
		//.. Maybe I'm on the homepage, where posts are listed.
		//.. Or maybe I'm in a post page but the url is in the "feed" format.
		//.. In that case, I want my "Open" button to open the post with its "post" format.
		//.. I inject the script adding a button to open posts on new tabs.
		
		let scriptEl = document.createElement("script");
		scriptEl.src = chrome.runtime.getURL("/sites/LinkedIn/linkedin-is-open-post-new-tab.js");
		scriptEl.onload = function () {
			window.addEventListener("caoglOpenTab", function (customEvent) {
				chrome.runtime.sendMessage(customEvent.detail);
			});
		};
		let e = document.body || document.documentElement;
		e.appendChild(scriptEl);
	}
})();