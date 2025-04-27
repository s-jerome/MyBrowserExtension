(function () {
	let url = chrome.extension.getURL("/features/VideoSleep/video-sleep-modal.html");
	fetch(url).then(function (response) {
		response.text().then(function (text) {
			let container = document.getElementById("video-sleep-container");
			if (container != null)
				container.remove();
			container = document.createElement("div");
			container.id = "video-sleep-container";
			document.body.appendChild(container);
			container.innerHTML = text;
			
			let scriptEl = container.querySelector("script");
			eval(scriptEl.innerHTML);
		});
	});
})();