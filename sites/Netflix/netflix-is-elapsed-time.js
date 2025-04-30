/**
 * Display, on the left, the elapsed time of a video.
 */
const caoglElapsedTime = (function () {
	console.log(new Date().toLocaleString() + " -- [Netflix-is-elapsed-time] Script started.");
	
	//.. The code is based on the extension called "Netflix Extended"
	//.. https://chromewebstore.google.com/detail/netflix-extended/gjcgfkhgpaccjpjokgpekpgpphgaanej
	
	/**
	 * The interval displaying the elapsed time.
	 * @type {Number}
	 */
	let _elapsedInterval = null;
	
	/**
	 * The span used to display the elapsed time on the left.
	 * @type {HTMLSpanElement}
	 */
	let _elapsedElement = null;
	
	/**
	 * Convert the given number of seconds into a string "$minutes:$secondes"
	 * @param {Number} seconds 
	 */
	function convertToInterval(seconds) {
		//.. This code is copied from the extension "Netflix Extended".
		
		var interval = '';
		var sec = Math.floor(seconds);
		var int_days = Math.floor(sec / 86400);
		var int_hours = Math.floor(((sec % 31536000) % 86400) / 3600);
		var int_mins = Math.floor((((sec % 31536000) % 86400) % 3600) / 60).toString();
		var int_secs = ((((sec % 31536000) % 86400) % 3600) % 60).toString();
		
		if (int_days != 0) {
			interval += int_days + ' ';
		}
		
		if (int_hours != 0) {
			interval += int_hours + ':';
		}
		
		interval += int_mins.padStart(2, '0') + ':' + int_secs.padStart(2, '0');
		
		return interval;
	}
	
	/**
	 * Display the elapsed time if the progressbar is visible.
	 */
	function displayElapsedTime() {
		if (_elapsedElement == null)
			return;
		
		//.. At each interval, the progressbar is retrieved to check if it's still visible.
		let timelineElement = document.body.querySelector("[data-uia='timeline']");
		if (timelineElement == null) {
			stopInterval();
			return;
		}
		
		//.. At each interval, the video element is retrieved, because if the video is paused for a long time,
		//.. the video element is removed from the DOM, and then a new video element is added when the video is resumed.
		let video = document.body.querySelector("video");
		if (video == null) {
			stopInterval();
			return;
		}
		_elapsedElement.textContent = convertToInterval(video.currentTime);
	}
	
	function stopInterval() {
		if (_elapsedInterval != null) {
			clearInterval(_elapsedInterval);
			_elapsedInterval = null;
		}
		_elapsedElement = null;
	}
	
	return {
		/**
		 * Determine if the given element is, or contains, the progressbar of the video.
		 * @param {HTMLElement} element 
		 */
		isOrContainsTimelineElement: function (element) {
			if (_elapsedInterval != null)
				return;
			
			if (element.tagName == "DIV" && element.getAttribute("data-uia") == "timeline") {
				let parent = element.parentElement.parentElement;
				let timeRemainingSpan = parent.querySelector("span[data-uia='controls-time-remaining']");
				if (timeRemainingSpan == null)
					return false;
				let elapsedElementContainer = timeRemainingSpan.parentElement.cloneNode(true);
				elapsedElementContainer.id = "caogl_elapsed_container";
				
				//.. These CSS properties add some space between the progress bar and the span element, without moving the latter to the left.
				elapsedElementContainer.style.setProperty("padding-left", "0em", "important");
				elapsedElementContainer.style.setProperty("padding-right", "1em", "important");
				
				parent.insertBefore(elapsedElementContainer, parent.children[0]);
				_elapsedElement = elapsedElementContainer.children[0];
				_elapsedInterval = setInterval(displayElapsedTime, 500);
				displayElapsedTime();
				return true;
			}
			
			for (let i = 0; i < element.children.length; i++) {
				let child = element.children[i];
				if (this.isOrContainsTimelineElement(child))
					return true;
			}
			
			return false;
		}
	}
})();