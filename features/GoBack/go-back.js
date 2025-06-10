(function () {
	console.log(new Date().toLocaleString() + " -- [GoBack] Script started.");
	
	document.addEventListener("keydown", function (keyboardEvent) {
		if (keyboardEvent.key == "b" && keyboardEvent.ctrlKey) {
			//.. If I press Ctrl+B I want to go back to the previous tab.
			chrome.runtime.sendMessage({ feature: "GoBack" });
		}
	});
})();