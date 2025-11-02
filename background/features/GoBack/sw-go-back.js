/**
 * This script keep trace of the open tabs, so I can jump back from one tab to the previous one using a keyboard shortcut.
 * 
 * This feature is designed to go back and forth between 2 tabs (the one currently selected, and the previous one).
 * It is not designed to go back up the entire thread of the tabs that I have selected in the reversed order.
 */

import { readSessionItem, saveSessionItem } from "../../sw-storage.js";

/** @type {Array<Number>} */
let _tabIds = [];

let _key = "feature.GoBack";

async function readTabIds() {
	if (_tabIds.length > 0)
		return;
	
	_tabIds = await readSessionItem(_key, []);
}

export function init() {
	chrome.tabs.onHighlighted.addListener(async function (highlightInfo) {
		if (highlightInfo.tabIds.length != 1)
			return;
		
		await readTabIds();
		
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
		await saveSessionItem(_key, _tabIds);
	});
	
	chrome.tabs.onRemoved.addListener(async function (tabId, removeInfo) {
		await readTabIds();
		
		let index = _tabIds.indexOf(tabId);
		if (index < 0)
			return;
		_tabIds.splice(index, 1);
		await saveSessionItem(_key, _tabIds);
	});
	
	chrome.tabs.query({ active: true }, async function (tabs) {
		await readTabIds();
		
		let tab = tabs[0];
		_tabIds.push(tab.id);
		await saveSessionItem(_key, _tabIds);
	});
}

/**
 * Go to the previous tab, ignoring the ones with a "chrome://" url.
 * Note: these tabs are ignored, because it's impossible to run a content script in them,
 * so my keyboard shortcut is not setup in these tabs, therefore I can't go back to the previous tab from them.
 * @param {Number} tabIndex 
 */
async function goBackInternalAsync(tabIndex) {
	if (tabIndex < 0 || tabIndex >= _tabIds.length || _tabIds.length <= 1)
		return;
	
	let tabId = _tabIds[tabIndex];
	let tab = await chrome.tabs.get(tabId);
	if (tab.url.startsWith("chrome://") == false)
		chrome.tabs.update(tabId, { active: true });
	else
		await goBackInternalAsync(--tabIndex);
}

/**
 * Go to the previous tab.
 */
export async function goBackAsync() {
	await readTabIds();
	await goBackInternalAsync(_tabIds.length - 2);
}