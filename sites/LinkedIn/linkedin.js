console.log(new Date().toLocaleString() + " -- [LinkedIn] Script started.");

/**
 * Inject the script displaying the absolute date of a post.
 */
(function injectPostScript() {
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
			return;
		}
		else {
			postId = feedPageMatch.groups["postId"];
		}
	} else {
		postId = postPageMatch.groups["postId"];
	}
	
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
		scriptEl.src = chrome.extension.getURL("/sites/LinkedIn/linkedin-is-post-absolute-date.js");
		document.head.appendChild(scriptEl);
	}
})();