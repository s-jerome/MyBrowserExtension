/**
 * This script displays the absolute date of a post.
 * The creation date of a post is nowhere to be find in the page code, but it can be determined from the post id,
 * which needs to be divide by a magic number to get a timestamp close to about 5 seconds max.
 */
(function () {
	console.log(new Date().toLocaleString() + " -- [LinkedIn-is-post-absolute-date] Script started.");
	
	/**
	 * The magic number allowing to determin the timestamp of the post based on its id.
	 */
	const POSTID_TO_TIMESTAMP_MAGIC_NUMBER = 4194304;
	
	if (document.readyState == "interactive" || document.readyState == "complete") {
		//.. The page should be already loaded.
		displayDateFromPostId();
	} else {
		window.addEventListener("DOMContentLoaded", displayDateFromPostId);
	}
	
	function displayDateFromPostId() {
		//.. Get the post id stored in a hidden input by the content script.
		let hiddenInputEl = document.getElementById("caogl-post-id");
		let postId = hiddenInputEl.getAttribute("post-id");
		
		let absoluteDate = getPostDateFromPostId(postId);
		
		//.. Get the post container element.
		let dataUrnValue = "urn:li:activity:" + postId;
		let selector = "div[data-urn='" + dataUrnValue + "']";
		let postEls = document.body.querySelectorAll(selector);
		if (postEls.length != 1) {
			//.. Happens if I'm not authenticated.
			//.. Need to add "data-featured-activity-urn" otherwise multiple elements are returned.
			selector = "article[data-activity-urn='" + dataUrnValue + "'][data-featured-activity-urn='" + dataUrnValue + "']";
			postEls = document.body.querySelectorAll(selector);
			if (postEls.length != 1)
				return;
		}
		let postEl = postEls[0];
		
		//.. Get the line where the relative date is written (below the author's name).
		/** @type {HTMLSpanElement} */
		let timeSpanEl;
		let spanEls = postEl.querySelectorAll("span.update-components-actor__sub-description");
		if (spanEls.length == 1) {
			let spanEl = spanEls[0];
			if (spanEl.children.length != 2)
				return;
			timeSpanEl = spanEl.children[0];
		} else {
			//.. Maybe I'm not authenticated.
			let timeEls = postEl.getElementsByTagName("time");
			if (timeEls.length != 1)
				return;
			timeSpanEl = timeEls[0];
		}
		
		//.. Important to use "childNodes" rather than "children" because the relative date is written in a node, not in an element.
		for (let i = 0; i < timeSpanEl.childNodes.length; i++) {
			let childNode = timeSpanEl.childNodes[i];
			if (childNode.nodeType != Node.TEXT_NODE)
				continue;
			
			if (timeSpanEl.__caogl == null) {
				timeSpanEl.__caogl = childNode.textContent;
			}
			childNode.textContent = absoluteDate.toLocaleString() + " • " + timeSpanEl.__caogl;
			break;
		}
	}
	
	function getPostDateFromPostId(_postId) {
		//.. To get the timestamp of a post, its id needs to be divided by a magic number.
		
		//.. The result number is to big to be an int, so it is rounded.
		//.. The impact on the timestamp is less than 5 seconds.
		let id = parseInt(_postId);
		
		let timestamp = id / POSTID_TO_TIMESTAMP_MAGIC_NUMBER;
		let date = new Date(timestamp);
		return date;
	}
})();