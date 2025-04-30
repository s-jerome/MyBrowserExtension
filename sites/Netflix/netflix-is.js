(function () {
	console.log(new Date().toLocaleString() + " -- [Netflix-is] Script started.");
	
	let mutationObserver = new MutationObserver(function (mutations) {
		for (let mutationIndex = 0; mutationIndex < mutations.length; mutationIndex++) {
			let mutation = mutations[mutationIndex];
			for (let nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex++) {
				/**
				 * @type {HTMLElement}
				 */
				let addedNode = mutation.addedNodes[nodeIndex];
				if (addedNode.nodeType != Node.ELEMENT_NODE)
					continue;
				
				let successSeek = caoglSeek.isOrContainsPlayerElement(addedNode);
				let successElapsedTime = caoglElapsedTime.isOrContainsTimelineElement(addedNode);
				if (successSeek && successElapsedTime)
					break;
			}
		}
	});
	
	mutationObserver.observe(document.body, {
		attributes: false,
		attributeOldValue: false,
		childList: true,
		characterData: false,
		characterDataOldValue: false,
		subtree: true
	});
})();