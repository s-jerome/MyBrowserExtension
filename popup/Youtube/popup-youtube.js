class StreamingData_AdaptiveFormat {
	/** @type {String} */
	approxDurationMs;
	/** @type {Number} */
	/** 
	 * This property is only available for audio streams.
	 * @type {String}
	 */
	audioQuality;
	averageBitrate;
	/** @type {Number} */
	bitrate;
	/**
	 * Yes, the content length is a string and not a number. 
	 * @type {String}
	 */
	contentLength;
	/** @type {Number} */
	itag;
	/** @type {String} */
	mimeType;
	/** @type {String} */
	url;
}

/** @type {HTMLInputElement} */
let _downloadVideoStreamCheckbox = document.getElementById("download-video-stream");
/** @type {HTMLSelectElement} */
let _videoStreamSelect = document.getElementById("video-streams");
/** @type {HTMLSelectElement} */
let _audioStreamSelect = document.getElementById("audio-streams");
/** @type {HTMLButtonElement} */
let _downloadButton = document.getElementById("download");
_downloadButton.addEventListener("click", download);
/** @type {HTMLButtonElement} */
let _openFileButton = document.getElementById("open-file");
_openFileButton.addEventListener("click", openFile);

let _videoId = "";
let _videoData = null;

/** @type {Array<StreamingData_AdaptiveFormat>} */
let _videoFormats = [];
/** @type {Array<StreamingData_AdaptiveFormat>} */
let _audioFormats = [];

/**
 * Regex used to get the codecs in the mimeType.
 */
const REGEX_CODECS = /codecs="(?<codecs>.+)"/;

function getVideoData() {
	_openFileButton.style.display = "";
	
	let selectedTab = window.selectedTab;
	let url = new URL(selectedTab.url);
	_videoId = url.searchParams.get("v");
	chrome.tabs.sendMessage(selectedTab.id, { action: "getVisitorData", videoId: _videoId }, null, function (tabResponse) {
		console.log(new Date().toLocaleString() + " -- Data from page:\n", tabResponse);
		
		if (tabResponse.error != null) {
			document.body.innerHTML = "<span style=\"color: red;\">" + tabResponse.error + "</span>";
			return;
		}
		
		let message = {
			site: "Youtube",
			domain: "download",
			action: "getVideoData",
			videoId: _videoId,
			visitorData: tabResponse.VISITOR_DATA
		};
		chrome.runtime.sendMessage(message, function (localhostResponse) {
			console.log(new Date().toLocaleString() + " -- Video data from my localhost request:\n", localhostResponse);
			
			if (localhostResponse.error != null) {
				alert(localhostResponse.error);
				return;
			}
			
			_videoData = localhostResponse.videoData;
			
			document.getElementById("title").innerText = _videoData.videoDetails.title;
			document.getElementById("url").innerText = selectedTab.url;
			
			displayAdaptiveFormats();
			
			let localFileExists = localhostResponse.localFileExists;
			if (localFileExists != null && localFileExists == true) {
				_openFileButton.style.display = "block";
			}
		});
	});
}

function displayAdaptiveFormats() {
	/** @type {Array<StreamingData_AdaptiveFormat>} */
	let adaptiveFormats = _videoData.streamingData.adaptiveFormats;
	_videoFormats = [];
	_audioFormats = [];
	for (let i = 0; i < adaptiveFormats.length; i++) {
		let af = adaptiveFormats[i];
		if (af.mimeType.startsWith("video/"))
			_videoFormats.push(af);
		else if (af.mimeType.startsWith("audio/"))
			_audioFormats.push(af);
	}
	
	document.getElementById("adaptive-formats").innerText = adaptiveFormats.length + " adaptiveFormats (" + _videoFormats.length + " video and " + _audioFormats.length + " audio)";
	
	//.. The video/mp4 are placed first, ordered by quality DESC (1080p, 720p...).
	_videoFormats.sort(function (format1, format2) {
		if (format1.mimeType.startsWith("video/mp4;") && format2.mimeType.startsWith("video/mp4;") == false)
			return -1; //.. Place format1 before format2.
		if (format1.mimeType.startsWith("video/mp4;") == false && format2.mimeType.startsWith("video/mp4;"))
			return 1; //.. Place format2 before format1.
		
		let quality1 = parseInt(format1.qualityLabel);
		let quality2 = parseInt(format2.qualityLabel);
		return quality2 - quality1;
	});
	_videoStreamSelect.innerHTML = "";
	for (let i = 0; i < _videoFormats.length; i++) {
		let format = _videoFormats[i];
		let o = document.createElement("option");
		o.value = format.itag;
		o.text = "[" + format.qualityLabel + "] " + format.mimeType + " // " + format.itag.toString() + " // size: " + format.contentLength;
		_videoStreamSelect.appendChild(o);
		
		//.. Avoid the codec "av01", because it's not very compatible with MPC, but works fine with VLC.
		let match = format.mimeType.match(REGEX_CODECS);
		if (match != null && match.groups["codecs"].startsWith("av01"))
			o.className = "codecs-av01";
	}
	//.. TODO: auto select the video quality based on the quality actually selected on the page and returned in the property "currentQuality"?
	
	//.. The audio/mp4 are placed first, ordered by bitrate DESC.
	_audioFormats.sort(function (format1, format2) {
		if (format1.mimeType.startsWith("audio/mp4;") && format2.mimeType.startsWith("audio/mp4;") == false)
			return -1; //.. Place format1 before format2.
		if (format1.mimeType.startsWith("audio/mp4;") == false && format2.mimeType.startsWith("audio/mp4;"))
			return 1; //.. Place format2 before format1.
		
		return format2.bitrate - format1.bitrate;
	});
	_audioStreamSelect.innerHTML = "";
	for (let i = 0; i < _audioFormats.length; i++) {
		let format = _audioFormats[i];
		let o = document.createElement("option");
		o.value = format.itag;
		o.text = "[" + format.audioQuality.replace("AUDIO_QUALITY_", "") + "] " + format.mimeType + " // " + format.itag.toString() + " // size: " + format.contentLength;
		_audioStreamSelect.appendChild(o);
	}
	
	setBodyWidth();
}

function setBodyWidth() {
	let videoStreamsContainer = document.getElementById("video-streams-container");
	let videoWidth = calculWidth(videoStreamsContainer);
	let audioStreamsContainer = document.getElementById("audio-streams-container");
	let audioWidth = calculWidth(audioStreamsContainer);
	let maxWidth = Math.max(videoWidth, audioWidth);
	if (maxWidth > document.body.clientWidth)
		document.body.style.width = Math.ceil(maxWidth).toString() + "px";
}

/**
 * Calcul the total width for the given element and all its children.
 * @param {HTMLElement} element 
 */
function calculWidth(element) {
	let totalWidth = 0;
	for (let i = 0; i < element.children.length; i++) {
		let child = element.children[i];
		if (child.tagName == "DIV")
			continue;
		let rect = child.getBoundingClientRect();
		let width = rect.x + rect.width;
		totalWidth += width;
	}
	return totalWidth;
}

function download() {
	_downloadButton.disabled = true;
	_downloadButton.textContent = "Downloading...";
	_downloadButton.style.color = "";
	_openFileButton.disabled = true;
	
	let audioFormat = _audioFormats.find(f => f.itag == _audioStreamSelect.value);
	let audioUrl = audioFormat.url;
	let audioContentLength = parseInt(audioFormat.contentLength);
	let videoUrl = "";
	let videoContentLength = 0;
	if (_downloadVideoStreamCheckbox.checked) {
		let videoFormat = _videoFormats.find(f => f.itag == _videoStreamSelect.value);
		videoUrl = videoFormat.url;
		videoContentLength = parseInt(videoFormat.contentLength);
	}
	
	let message = {
		site: "Youtube",
		domain: "download",
		action: "download",
		videoId: _videoId,
		audioUrl: audioUrl,
		audioContentLength: audioContentLength,
		videoUrl: videoUrl,
		videoContentLength: videoContentLength
	};
	chrome.runtime.sendMessage(message, function (response) {
		console.log(new Date().toLocaleString() + " -- Download result:\n", response);
		
		if (response.error == null) {
			_downloadButton.style.color = "green";
			_openFileButton.style.display = "block";
		} else {
			_downloadButton.style.color = "red";
			_openFileButton.style.display = "";
		}
		
		_downloadButton.textContent = "Download";
		_downloadButton.disabled = false;
		_openFileButton.disabled = false;
	});
}

function openFile() {
	_openFileButton.disabled = true;
	_openFileButton.style.color = "";
	
	let message = {
		site: "Youtube",
		domain: "download",
		action: "openFile",
		videoId: _videoId
	};
	chrome.runtime.sendMessage(message, function (response) {
		console.log(new Date().toLocaleString() + " -- Open file result:\n", response);
		
		if (response != null && response.error != null) {
			_openFileButton.style.color = "red";
		}
		_openFileButton.disabled = false;
	});
}

getVideoData();