/**
 * This script keep trace of the open tabs, so I can jump back from one tab to the previous one using a keyboard shortcut.
 * 
 * This feature is designed to go back and forth between 2 tabs (the one currently selected, and the previous one).
 * It is not designed to go back up the entire thread of the tabs that I have selected in the reversed order.
 */
const GoBack = (function () {
	/** @type {Array<Number>} */
	let _tabIds = [];
	
	chrome.tabs.onHighlighted.addListener(function (highlightInfo) {
		if (highlightInfo.tabIds.length != 1)
			return;
		
		let activeTabId = highlightInfo.tabIds[0];
		let index = _tabIds.indexOf(activeTabId);
		if (index >= 0) {
			//.. I selected a tab that is already in the list,
			//.. so I remove it and place it at the end.
			// _tabIds.splice(index, 1);
			// _tabIds.push(activeTabId);
			for (let i = index; i < _tabIds.length - 1; i++) {
				_tabIds[i] = _tabIds[i + 1];
			}
			_tabIds[_tabIds.length - 1] = activeTabId;
		} else {
			_tabIds.push(activeTabId);
		}
	});
	
	chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
		let index = _tabIds.indexOf(tabId);
		if (index < 0)
			return;
		_tabIds.splice(index, 1);
	});
	
	/**
	 * Go to the previous tab, ignoring the ones with a "chrome://" url.
	 * Note: these tabs are ignored, because it's impossible to run a content script in them,
	 * so my keyboard shortcut is not setup in these tabs, therefore I can't go back to the previous tab from them.
	 * @param {Number} tabIndex 
	 */
	function goBackInternal(tabIndex) {
		if (tabIndex < 0 || tabIndex >= _tabIds.length || _tabIds.length <= 1)
			return;
		
		let tabId = _tabIds[tabIndex];
		chrome.tabs.get(tabId, function (tab) {
			if (tab.url.startsWith("chrome://") == false)
				chrome.tabs.update(tabId, { active: true });
			else
				goBackInternal(--tabIndex);
		});
	}
	
	chrome.tabs.query({ active: true }, function (tabs) {
		let tab = tabs[0];
		_tabIds.push(tab.id);
	});
	
	return {
		/**
		 * Go to the previous tab.
		 */
		goBack() {
			goBackInternal(_tabIds.length - 2);
		},
		
		__debug_getTabIds() {
			return _tabIds;
		}
	}
})();