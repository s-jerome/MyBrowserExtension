/**
 * I want to be able to open the page of a post in a new tab.
 * 
 * Because this site is so well coded, to do that we need to click on the "..." icon at the top right,
 * wait the loading of a context menu (yes, there is a loading to display the div), then click on "Copy link to post"
 * and then create a new tab and paste the url. Pathetic.
 * 
 * To open the post in a new tab, we need its url. And to get this url, a HTTPS request has to be made. What a great idea.
 * 
 * So I create a "Open" button in charge of requesting the url of the post and opens it in a new tab if I want to
 * (I can decide to open the post on the current tab too).
*/
(function () {
	console.log(new Date().toLocaleString() + " -- [LinkedIn-is-open-post-new-tab] Script started.");
	
	/**
	 * The selector used to get the divs relative to posts.
	 */
	const POSTS_SELECTOR = "div[data-urn]";
	
	/**
	 * The regex used to get the post id in the "data-urn".
	 */
	const REGEX_POST_ID = /urn:li:activity:(?<postId>\d+)/;
	
	/**
	 * The class name of the "..." icon at the top right of the posts.
	 */
	const MENU_CLASSNAME_SELECTOR = "feed-shared-update-v2__control-menu";
	
	/**
	 * The post urls by their id.
	 * Just in case I want to open a post in a new tab, for which I already requested the url.
	 * The post id is a long number, but I treate it as a string.
	 * @type {Map<String, String>}
	 */
	let _urlsById = new Map();
	
	/**
	 * A session id in the cookies that has to be sent in the graphql request.
	 */
	let JSESSIONID = "";
	
	//.. Get the JSESSIONID in the cookies.
	(function getJSessionId() {
		let cookies = document.cookie.split("; ");
		for (let i = 0; i < cookies.length; i++) {
			let cookie = cookies[i];
			if (cookie.startsWith("JSESSIONID=")) {
				JSESSIONID = cookie.split("=")[1];
				//.. The value looks like: "ajax:3880713748885038960" (the " at the start and at the end are included).
				if (JSESSIONID.startsWith("\""))
					JSESSIONID = JSESSIONID.substring(1);
				if (JSESSIONID.endsWith("\""))
					JSESSIONID = JSESSIONID.substring(0, JSESSIONID.length - 1);
				break;
			}
		}
	})();
	
	window.addEventListener("DOMContentLoaded", function () {
		//.. The content script is run at document_start.
		
		/**
		 * Observe the adding of posts.
		 */
		const mo = new MutationObserver((pMutations) => {
			for (let mutationIndex = 0; mutationIndex < pMutations.length; mutationIndex++) {
				let mutation = pMutations[mutationIndex];
				for (let addedNodeIndex = 0; addedNodeIndex < mutation.addedNodes.length; addedNodeIndex++) {
					let addedNode = mutation.addedNodes[addedNodeIndex];
					if (addedNode.nodeType != Node.ELEMENT_NODE)
						continue;
					
					let postElement = isOrContainsPost(addedNode);
					if (postElement != null) {
						addButtonToPost(addedNode);
						continue;
					}
				}
			}
		});
		
		mo.observe(document.body, {
			attributes: true,
			childList: true,
			characterData: true,
			subtree: true
		});
		
		(function () {
			let postEls = document.body.querySelectorAll(POSTS_SELECTOR);
			for (let i = 0; i < postEls.length; i++) {
				addButtonToPost(postEls[i]);
			}
		})();
	});
	
	/**
	 * Return the element relative to a post.
	 * @param {HTMLElement} element 
	 */
	function isOrContainsPost(element) {
		if (element.tagName == "DIV" && element.hasAttribute("data-urn"))
			return element;
		return element.querySelector(POSTS_SELECTOR);
	}
	
	/**
	 * Add my "Open" button.
	 * @param {HTMLElement} postElement
	 */
	function addButtonToPost(postElement) {
		if (postElement.__caogl != null)
			return;
		
		let dataUrn = postElement.getAttribute("data-urn");
		if (dataUrn == null)
			return;
		
		//.. Get the "..." icon at the top right.
		let menuEls = postElement.getElementsByClassName(MENU_CLASSNAME_SELECTOR);
		if (menuEls.length != 1)
			return;
		let menuEl = menuEls[0];
		
		//.. Add my "Open" button before the menu.
		//.. TODO: sometimes my button is placed on top of a follow link.
		let buttonEl = document.createElement("button");
		//.. Some CSS classes from LinkedIn.
		buttonEl.className = "artdeco-pill artdeco-pill--slate artdeco-pill--3 artdeco-pill--choice ember-view mr1 mb2";
		buttonEl.textContent = "Open";
		buttonEl.__caogl_dataUrn = dataUrn;
		buttonEl.setAttribute("caogl-data-urn", dataUrn);
		buttonEl.addEventListener("mousedown", handleOpenButtonMouseDown);
		buttonEl.addEventListener("mouseup", handleOpenButtonMouseUp);
		menuEl.insertBefore(buttonEl, menuEl.children[0]);
		
		postElement.__caogl = true;
	}
	
	/**
	 * Prevent the wheel to appear if a middle mouse click is made.
	 * @param {PointerEvent} pointerEvent
	 */
	function handleOpenButtonMouseDown(pointerEvent) {
		if (pointerEvent.button == 1)
			pointerEvent.preventDefault();
	}
	
	/**
	 * 
	 * @param {PointerEvent} pointerEvent
	 */
	async function handleOpenButtonMouseUp(pointerEvent) {
		if (pointerEvent.button == 2)
			return; //.. Right click.
		
		pointerEvent.preventDefault();
		
		/** @type {HTMLButtonElement} */
		let thisButton = this;
		
		//.. Get the post id.
		//.. The "data-urn" looks like: urn:li:activity:<postId>
		//.. But it also might look like: urn:li:aggregate:(urn:li:activity:<postId1>,urn:li:activity:<postId2>)
		//.. In that case, I want the postId1.
		let match = thisButton.__caogl_dataUrn.match(REGEX_POST_ID);
		if (match == null)
			return;
		let postId = match.groups["postId"];
		
		let postUrl = _urlsById.get(postId);
		if (postUrl == null) {
			thisButton.disabled = true;
			
			let result = await requestPostUrl(postId);
			
			if (result.url != "") {
				_urlsById.set(postId, result.url);
				if (pointerEvent.button == 0)
					document.location.href = result.url;
				else
					openPostInNewTab(result.url);
			} else {
				if (result.error != null) {
					console.log(new Date().toLocaleString() + " -- [LinkedIn] " + result.error);
					thisButton.textContent = "Error";
				}
				if (result.url == "") {
					console.log(new Date().toLocaleString() + " -- [LinkedIn] Can't find the post url in the graphql request for unknown reason.");
					thisButton.textContent = "null";
				}
			}
			thisButton.disabled = false;
		} else {
			if (pointerEvent.button == 0)
				document.location.href = postUrl;
			else
				openPostInNewTab(postUrl);
		}
	}
	
	/**
	 * Fetch the graphql request to get the url for the given post id.
	 * @param {String} postId 
	 */
	async function requestPostUrl(postId) {
		let result = {
			url: "",
			error: null
		};
		
		//.. The url is always the same. I didn't bother. I just copied/pasted it and I'm only changing the post id.
		let url = "https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(updateActionsUrn:urn%3Ali%3Afsd_updateActions%3A%28urn%3Ali%3Aactivity%3A" + postId + "%2CMAIN_FEED%2CEMPTY%2Curn%3Ali%3Areason%3A-%2Curn%3Ali%3AadCreative%3A-%29)&queryId=voyagerFeedDashUpdateActions.0e1324862773fa7b27ca71f622bb9ae5";
		let fetchData = {
			"headers": {
				"accept": "application/vnd.linkedin.normalized+json+2.1",
				"cache-control": "no-cache",
				"csrf-token": JSESSIONID,
				"pragma": "no-cache",
				"sec-ch-ua-mobile": "?0",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-origin",
			},
			"referrer": document.location.href,
			"referrerPolicy": "strict-origin-when-cross-origin",
			"body": null,
			"method": "GET",
			"mode": "cors",
			"credentials": "include"
		};
		
		let response;
		try {
			response = await fetch(url, fetchData);
		} catch (ex) {
			if (ex.message != null) //.. TypeError
				result.error = "Fetch error: " + ex.message;
			else
				result.error = "Fetch error: " + ex;
			return result;
		}
		
		if (response.ok == false) {
			result.error = "Request failed: " + response.status + " - " + response.statusText;
			return result;
		}
		
		let json;
		try {
			json = await response.json();
		} catch (ex) {
			if (ex.message != null) //.. TypeError
				result.error = "Can't get the JSON response: " + ex.message;
			else
				result.error = "Can't get the JSON response: " + ex;
			return result;
		}
		
		if (json.included == null || Array.isArray(json.included) == false) {
			result.error = "The property \"included\" is not in the JSON response.";
			return result;
		}
		
		/** @type {Array} */
		const included = json.included;
		for (let incluIndex = 0; incluIndex < included.length; incluIndex++) {
			let inclu = included[incluIndex];
			if (inclu.actions == null || Array.isArray(inclu.actions) == false)
				continue;
			/** @type {Array} */
			const actions = inclu.actions;
			for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
				let action = actions[actionIndex];
				if (action.actionType == null || action.actionType != "SHARE_VIA")
					continue;
				
				//.. I want to remove all the GET parameters (utm_source, utm_medium, rcm, ...).
				let uri = new URL(action.url);
				let params = [];
				for (const key of uri.searchParams.keys()) {
					params.push(key);
				}
				for (let i = params.length - 1; i >= 0; i--) {
					let param = params[i];
					uri.searchParams.delete(param);
				}
				
				result.url = uri.toString();
				return result;
			}
		}
		
		return result;
	}
	
	/**
	 * Send a message to the content script, asking to open the given url in a new tab.
	 * @param {String} url 
	 */
	function openPostInNewTab(url) {
		let ce = new CustomEvent("caoglOpenTab", { detail: { site: "LinkedIn", action: "openTab", url: url } });
		window.dispatchEvent(ce);
	}
})();