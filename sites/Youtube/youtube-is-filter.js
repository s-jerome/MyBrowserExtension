/**
 * This script filters videos, in multiple ways, based on multiple criteria.
 * 
 * TODO: filter videos released after or before a specific date?
 * il y a x heure/heures;jour/jours;semaine/semaines;mois;an/ans
 * x hour/hours;day/days;week/weeks;month/months;year/years ago
 * 
 * TODO: make a menu to exclude specific videos from being filtered?
 * 
 * TODO: make a popup or a full page to manage the filters? (for now I have to set manually the filters in the localStorage).
 */
const caoglFilter = (function () {
	console.log(new Date().toLocaleString() + " -- [Youtube-is-filter] Script started.");
	
	/**
	 * A video is filtered if it matches ALL the criteria.
	 */
	class Filter {
		/**
		 * If I want to give a name to a filter. No need to be unique.
		 * @type {String}
		 */
		name;
		/** @type {Boolean} */
		isEnabled;
		/** 
		 * A video is filtered if its title contains one of these terms.
		 * @type {Array<String>}
		 */
		terms;
		/**
		 * A video is filtered if it belongs to one of these channels.
		 * @type {Array<Channel>}
		 */
		channels;
		/** 
		 * A video is filtered if its duration in seconds exceeds this value.
		 * @type {Number}
		 */
		maxDurationSec;
		/**
		 * The way the video is filtered.
		 * @type {FilterMode}
		 */
		filterMode;
		/**
		 * Determine if the title of a filtered video is hidden. 
		 * @type {Boolean}
		 */
		hideTitle;
		
		constructor() {
			//.. Some default values in case they are not setup in the data saved in the localStorage.
			this.isEnabled = true;
			this.filterMode = FilterMode.HideThumbnail;
			this.hideTitle = true;
		}
		
		/**
		 * Make sure that all terms and channel info are lower case.
		 */
		valuesToLowerCase() {
			if (this.terms != null)
				this.terms = this.terms.map(term => term.toLowerCase());
			
			if (this.channels != null) {
				this.channels = this.channels.map(channel => {
					let newChannel = new Channel();
					if (channel.display != null)
						newChannel.display = channel.display.toLowerCase();
					if (channel.id != null) {
						newChannel.id = channel.id.toLowerCase();
						//.. If think some channel names start with the @ in the url, and some don't.
						//.. Just to be sure, I remove this character.
						if (newChannel.id.startsWith("@"))
							newChannel.id = newChannel.id.substring(1);
					}
					return newChannel;
				});
			}
		}
	}
	
	class Channel {
		/**
		 * The name of a channel as it's displayed.
		 * Exemple: BBC Earth
		 * @type {String}
		 */
		display;
		/**
		 * The id of a channel in the url.
		 * Exemple: https://www.youtube.com/@bbcearth
		 * @type {String}
		 */
		id;
	}
	
	/**
	 * The way a video is filtered.
	 */
	let FilterMode = {
		BlurThumbnail: "blurThumbnail",
		HideThumbnail: "hideThumbnail",
		/**
		 * Hide the entire video component, so the video doesn't appear at all.
		 */
		HideComponent: "hideComponent"
	};
	
	class FilterReason {
		/** @type {Channel} */
		channel;
		/** @type {String} */
		termOrDuration;
		
		/**
		 * @param {Channel} channel 
		 * @param {String} termOrDuration 
		 */
		constructor(channel, termOrDuration) {
			this.channel = channel;
			this.termOrDuration = termOrDuration;
		}
		
		channelToString() {
			if (this.channel.display != null)
				return this.channel.display.toUpperCase()
			else
				return "@" + this.channel.id.toUpperCase();
		}
	}
	
	/**
	 * The regex used to get the name of the channel from the url (if I'm on a channel pages).
	 */
	const REGEX_CHANNELNAME_FROM_URL = /youtube\.com\/@?(?<channel_name>\w*)\/?/;
	
	/** @type {Array<Filter>} */
	let _filters = [];
	
	/**
	 * Cache of the filters by video id.
	 *  @type {Map<String, {filter: Filter, filterReason: FilterReason}>}
	 */
	let _filtersByVideoId = new Map();
	
	/**
	 * @type {Map<String, String>}
	 */
	let _channelNamesByVideoId = new Map();
	/**
	 * @type {Map<String, String>}
	 */
	let _channelNamesByUrl = new Map();
	
	/**
	 * Read the saved filters in the localStorage.
	 */
	function readSavedFilters() {
		let item = localStorage.getItem("caoglFilters");
		if (item != null && item != "") {
			/** @type {Array} */
			let savedFilters = JSON.parse(item);
			castFilters(savedFilters);
		}
	}
	readSavedFilters();
	
	/**
	 * Cast regular "filter" objects into instances of the class Filter.
	 * @param {Array} filters 
	 */
	function castFilters(filters) {
		if (Array.isArray(filters) == false)
			return;
		for (let i = 0; i < filters.length; i++) {
			let filter = filters[i];
			let newFilter = new Filter();
			Object.assign(newFilter, filter);
			newFilter.valuesToLowerCase();
			_filters.push(newFilter);
		}
	}
	
	function saveFilters() {
		let itemValue = JSON.stringify(_filters);
		localStorage.setItem("caoglFilters", itemValue);
	}
	
	/**
	 * Add some CSS rules to blur or hide the thumbnails.
	 */
	(function addCSS() {
		let cssEl = document.createElement("style");
		cssEl.id = "caogl-filter-css";
		cssEl.innerText = "[caogl-filter=\"blur-thumbnail\"] { filter: blur(30px); } ";
		cssEl.innerText += "[caogl-filter=\"hide-thumbnail\"] { visibility: hidden; } ";
		//.. These selectors are useless because some CSS rules have higher priorities:
		// cssEl.innerText += "[caogl-filter=\"hide-title\"] { display: none; }";
		// cssEl.innerText += "[caogl-filter=\"hide-component\"] { display: none; } ";
		cssEl.innerText += "#caogl-title span { display: block; }";
		document.head.appendChild(cssEl);
	})();
	
	/**
	 * Get the channel name displayed under the video title.
	 * Note: I don't think the channel info can be found in properties like the video id.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getChannelNameFromElement(videoTitleEl) {
		/** @type {String} */
		let videoId = videoTitleEl.__caoglFilter.videoId;
		let channelName = _channelNamesByVideoId.get(videoId);
		if (channelName != null)
			return channelName;
		
		/** @type {HTMLElement} */
		let videoComponentEl = videoTitleEl.__caoglFilter.componentEl;
		
		//.. There could be 1 element, or 2 with only one visible.
		/** @type {HTMLElement} */
		let channelNameEl = null;
		let channelNameEls = videoComponentEl.querySelectorAll("#channel-name");
		if (channelNameEls.length == 1) {
			channelNameEl = channelNameEls[0];
		} else {
			for (let i = 0; i < channelNameEls.length; i++) {
				let e = channelNameEls[i];
				let visibility = e.checkVisibility();
				if (visibility == false)
					continue;
				channelNameEl = e;
				break;
			}
		}
		if (channelNameEl == null)
			return "";
		channelName = channelNameEl.innerText.toLowerCase().trim();
		_channelNamesByVideoId.set(videoId, channelName);
		return channelName;
	}
	
	/**
	 * Get the channel name from the url, if I'm on one of the channel pages.
	 */
	function getChannelNameFromUrl() {
		if (document.location.href.indexOf("watch?v=") > 0 ||
			document.location.href.indexOf("/shorts/") > 0 ||
			document.location.href.indexOf("/playlist?list=") > 0)
			return "";
		
		let channelName = _channelNamesByUrl.get(document.location.href);
		if (channelName != null)
			return channelName;
		let urlLower = document.location.href.toLowerCase();
		let match = urlLower.match(REGEX_CHANNELNAME_FROM_URL);
		if (match == null)
			return "";
		channelName = match.groups["channel_name"];
		_channelNamesByUrl.set(document.location.href, channelName);
		return channelName;
	}
	
	/**
	 * Get the anchor that contains the thumbnail.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getThumbnailAnchor(videoTitleEl) {
		/** @type {HTMLElement} */
		let videoComponentEl = videoTitleEl.__caoglFilter.componentEl;
		
		//.. It's important to specify in the selector that I want a anchor,
		//.. because there is a div#thumbnail and 2 a#thumbnail, with only one visible (the first),
		//.. and the 2 anchors should have the same href.
		/** @type {NodeListOf<HTMLAnchorElement>} */
		let thumbnailAnchors = videoComponentEl.querySelectorAll("a#thumbnail");
		for (let i = 0; i < thumbnailAnchors.length; i++) {
			let thumbnailAnchor = thumbnailAnchors[i];
			if (thumbnailAnchor.href == null || thumbnailAnchor.href == "")
				continue;
			let visibility = thumbnailAnchor.checkVisibility();
			if (visibility == false)
				continue;
			return thumbnailAnchor;
		}
		return null;
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getThumbnails(videoTitleEl) {
		//.. A video component should have at least 2 images : the thumbnail of the video, and the avatar of the channel.
		//.. Luckely, the thumbnail of the video is a child of a a#thumbnail element.
		
		/** @type {HTMLAnchorElement} */
		let thumbnailAnchor = getThumbnailAnchor(videoTitleEl);
		if (thumbnailAnchor == null)
			return null; //.. Can happen, notably if videoTitleEl.checkVisibility() == false
		let imgEls = thumbnailAnchor.getElementsByTagName("img");
		return imgEls;
	}
	
	/**
	 * Set the given attribute value to the thumbnail relative to the given video title,
	 * in order to blur or hide it.
	 * @param {HTMLElement} videoTitleEl 
	 * @param {String} attributeValue "blur-thumbnail" or "hide-thumbnail".
	 */
	function setFilterAttributeToThumbnail(videoTitleEl, attributeValue) {
		//.. When the video component is added to the DOM, there should be no image returned.
		//.. But if we got here from the MutationObserver, there should be only 1 image.
		let imgEls = getThumbnails(videoTitleEl);
		if (imgEls == null || imgEls.length == 0)
			return;
		for (let i = 0; i < imgEls.length; i++) {
			let imgEl = imgEls[i];
			imgEl.setAttribute("caogl-filter", attributeValue);
		}
	}
	
	/**
	 * Hide the given video title and replace it by the reason why the video is filtered.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function hideTitle(videoTitleEl) {
		if (videoTitleEl.__caoglFilter.myTitleEl != null) {
			if (videoTitleEl.__caoglFilter.myTitleEl.__caoglFilter.videoId == videoTitleEl.__caoglFilter.videoId) {
				//.. Important to check if the video id matches,
				//.. because if the video component is reused for another video, my title won't change.
				return;
			} else {
				//.. My title is relative to another video, so I remove it.
				//.. I remove it and create a new one because I can't set the outerHTML or innerHTML because of an error about TrustedHTML assignment.
				videoTitleEl.__caoglFilter.myTitleEl.remove();
				videoTitleEl.__caoglFilter.myTitleEl = null;
			}
		}
		
		//.. There are some CSS rules having higher priority and overriding my selector,
		//.. so I set directly the display.
		// videoTitleEl.setAttribute("caogl-filter", "hide-title");
		videoTitleEl.style.display = "none";
		
		/** @type {{filter: Filter, filterReason: FilterReason}} */
		let filterDetails = videoTitleEl.__caoglFilter.filterDetails;
		let filterReason = filterDetails.filterReason;
		
		let div = document.createElement("div");
		div.id = "caogl-title";
		div.__caoglFilter = { videoTitleEl: videoTitleEl, videoId: videoTitleEl.__caoglFilter.videoId };
		div.className = videoTitleEl.className;
		let span = document.createElement("span");
		div.appendChild(span);
		if (filterReason.channel == null && filterReason.termOrDuration != "") {
			span.innerText = filterReason.termOrDuration;
		} else if (filterReason.channel != null && filterReason.termOrDuration == "") {
			span.innerText = filterReason.channelToString();
		} else {
			span.innerText = filterReason.channelToString();
			span = document.createElement("span");
			span.innerText = filterReason.termOrDuration;
			div.appendChild(span);
		}
		
		//.. I want my text to have the same size of the video title,
		//.. and the size depends of the kind of the video component
		//.. (homepage / search result / suggested video / playlist...).
		let cs = window.getComputedStyle(videoTitleEl);
		div.style.fontSize = cs.fontSize;
		div.style.fontWeight = cs.fontWeight;
		div.style.lineHeight = cs.lineHeight;
		
		videoTitleEl.parentElement.appendChild(div);
		videoTitleEl.__caoglFilter.myTitleEl = div;
	}
	
	/**
	 * Get the video component (containg thumbnail, title, duration, channel name, relative date...) for the given title.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getVideoComponentEl(videoTitleEl) {
		let parent = videoTitleEl.parentElement;
		while (true) {
			if (parent == null)
				return null;
			if (parent.tagName == "BODY")
				return null; //.. We go back too far.
			if (parent.tagName == "YTD-RICH-ITEM-RENDERER" //.. A video on the homepage.
				|| parent.tagName == "YTD-COMPACT-VIDEO-RENDERER" //.. A suggested video on the right.
				|| parent.tagName == "YTD-VIDEO-RENDERER" //.. A result of a search.
				|| parent.tagName == "YTD-PLAYLIST-VIDEO-RENDERER" //.. A video in a playlist.
				|| parent.tagName == "YTD-GRID-VIDEO-RENDERER") {
				return parent;
			}
			parent = parent.parentElement;
		}
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function getVideoSecondsDuration(videoTitleEl) {
		let length = "";
		if (videoTitleEl.__dataHost != null && videoTitleEl.__dataHost.__data != null && videoTitleEl.__dataHost.__data.data != null &&
			videoTitleEl.__dataHost.__data.data.lengthText != null && videoTitleEl.__dataHost.__data.data.lengthText.simpleText != null &&
			videoTitleEl.__dataHost.__data.data.lengthText.simpleText != "") {
			length = videoTitleEl.__dataHost.__data.data.lengthText.simpleText;
		} else {
			//.. For videos in a playlist, or in the different categories in the home page of a channel.
			
			/** @type {HTMLElement} */
			let videoComponentEl = videoTitleEl.__caoglFilter.componentEl;
			/** @type {HTMLElement} */
			let lengthEl = videoComponentEl.querySelector("ytd-thumbnail-overlay-time-status-renderer");
			if (lengthEl == null) {
				//.. This element is not present at first when the video info are displayed, so a MutationObserver is needed here.
				if (videoComponentEl.__caoglFilter.moTime != null)
					return -1;
				let mo = new MutationObserver(function (mutations) {
					lengthEl = videoComponentEl.querySelector("ytd-thumbnail-overlay-time-status-renderer");
					if (lengthEl != null) {
						//.. I think it's not necessary to proceed like the video title was added to the DOM by doing a bunch of stuff.
						//.. Just getting the filter and apply it is enough.
						// caoglFilter.filter(videoTitleEl, videoTitleEl.__caoglFilter.videoId);
						filter(videoTitleEl);
						
						mo.disconnect();
						mo = null;
						videoComponentEl.__caoglFilter.moTime = null;
					}
				});
				mo.observe(videoComponentEl, {
					attributes: false,
					childList: true,
					characterData: false,
					subtree: true
				});
				videoComponentEl.__caoglFilter.moTime = mo;
				return -1;
			} else {
				length = lengthEl.innerText;
				if (length.indexOf("\n") > 0) {
					//.. We get here after the element was added during the MutationObserver setup above.
					//.. But when this element is added, the duration is present in 2 elements.
					//.. The easiest way is to find a div#time-status which should contain a span#text.
					let timeStatusEl = lengthEl.querySelector("#time-status");
					if (timeStatusEl != null) {
						length = timeStatusEl.innerText;
					} else {
						let textEl = lengthEl.querySelector("#text");
						if (textEl != null) {
							length = textEl.innerText;
						}
					}
				}
			}
		}
		if (length == null || length == "")
			return -1;
		
		length = length.trim();
		let lengthSplitted = length.split(':');
		if (lengthSplitted.length == 0)
			return -1;
		let secDuration = parseInt(lengthSplitted[lengthSplitted.length - 1]);
		if (lengthSplitted.length > 1)
			secDuration += (parseInt(lengthSplitted[lengthSplitted.length - 2]) * 60);
		if (lengthSplitted.length > 2)
			secDuration += (parseInt(lengthSplitted[lengthSplitted.length - 3]) * 3600);
		return secDuration;
	}
	
	/**
	 * 
	 * @param {HTMLElement} videoTitleEl 
	 */
	function filter(videoTitleEl) {
		let filterDetails = findFilter(videoTitleEl);
		videoTitleEl.__caoglFilter.filterDetails = filterDetails;
		if (filterDetails != null)
			applyFilter(videoTitleEl);
		else
			removeFilter(videoTitleEl);
	}
	
	/**
	 * Find the first filter matching the given video.
	 * @param {HTMLElement} videoTitleEl 
	 */
	function findFilter(videoTitleEl) {
		/** @type {String} */
		let videoId = videoTitleEl.__caoglFilter.videoId;
		let filterDetails = _filtersByVideoId.get(videoId);
		if (filterDetails != null)
			return filterDetails;
		
		//.. To avoid recovering the channel names in every iteration.
		let channelNamesAreRetrieved = false;
		
		//.. A video is filtered if all the criteria match. It's like a AND query, not a OR.
		/** @type {String} */
		let titleLower = videoTitleEl.__caoglFilter.titleLower;
		for (let filterIndex = 0; filterIndex < _filters.length; filterIndex++) {
			let filter = _filters[filterIndex];
			
			if (filter.isEnabled == false)
				continue;
			
			let correspondingChannel = null;
			if (filter.channels != null && filter.channels.length > 0) {
				if (channelNamesAreRetrieved == false) {
					//.. I create this property, that has no use, except for debugging.
					if (videoTitleEl.__caoglFilter.channelNames == null)
						videoTitleEl.__caoglFilter.channelNames = {};
					//.. The name of the channel under the title.
					videoTitleEl.__caoglFilter.channelNames.fromElement = getChannelNameFromElement(videoTitleEl);
					//.. The name of the channel in the url, if I'm on one of a channel pages,
					//.. because in that case, there is not always the name of the channel under the title.
					videoTitleEl.__caoglFilter.channelNames.fromUrl = getChannelNameFromUrl();
					
					channelNamesAreRetrieved = true;
				}
				
				//.. Note: If in the filter I set just the id of a channel, and not its displayed name,
				//.. I can filter videos only in the "Videos" page of a channel for exemple.
				//.. If they appear on the right as suggested videos, they won't be filtered.
				correspondingChannel = filter.channels.find(channel =>
					(channel.display != null && channel.display == videoTitleEl.__caoglFilter.channelNames.fromElement) ||
					(channel.id != null && channel.id == videoTitleEl.__caoglFilter.channelNames.fromUrl));
				if (correspondingChannel == null)
					continue;
			}
			
			let correspondingTerm = null;
			if (filter.terms != null && filter.terms.length > 0) {
				correspondingTerm = filter.terms.find(term => titleLower.indexOf(term) >= 0);
				if (correspondingTerm == null)
					continue;
			}
			
			let correspondingMaxDuration = null;
			if (filter.maxDurationSec != null && filter.maxDurationSec > 0) {
				if (videoTitleEl.__caoglFilter.duration == null || videoTitleEl.__caoglFilter.duration == -1) {
					let duration = getVideoSecondsDuration(videoTitleEl);
					videoTitleEl.__caoglFilter.duration = duration;
				}
				if (videoTitleEl.__caoglFilter.duration < 0 || videoTitleEl.__caoglFilter.duration > filter.maxDurationSec)
					continue;
				correspondingMaxDuration = filter.maxDurationSec;
			}
			
			if (correspondingChannel == null && correspondingTerm == null && correspondingMaxDuration == null)
				continue;
			
			if (correspondingChannel != null && correspondingChannel.id == null &&
				videoTitleEl.__caoglFilter.channelNames.fromUrl != "" &&
				correspondingTerm == null && correspondingMaxDuration == null) {
				//.. Only the channel display name is setup in this filter, with any other criteria.
				//.. So every videos from this channel have to be filtered, assuming there is a HTML element that displays the channel name.
				//.. But here I'm on one of this channel page, I decided to get here,
				//.. and I don't want to filter every videos, otherwise what's the point of getting here if I can't see any video?
				continue;
			}
			
			let termOrDuration = "";
			if (correspondingTerm != null)
				termOrDuration = "\"" + correspondingTerm + "\"";
			else if (correspondingMaxDuration != null)
				termOrDuration = "/" + correspondingMaxDuration + "sec max\\";
			let filterReason = new FilterReason(correspondingChannel, termOrDuration);
			filterDetails = { filter: filter, filterReason: filterReason };
			break;
		}
		_filtersByVideoId.set(videoId, filterDetails);
		return filterDetails;
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function applyFilter(videoTitleEl) {
		/** @type {HTMLElement} */
		let videoComponentEl = videoTitleEl.__caoglFilter.componentEl;
		/** @type {{filter: Filter, filterReason: FilterReason}} */
		let filterDetails = videoTitleEl.__caoglFilter.filterDetails;
		let filterToApply = filterDetails.filter;
		
		if (filterToApply.filterMode == FilterMode.HideComponent) {
			//.. There are some CSS rules having higher priority and overriding my selector,
			//.. so I set directly the display.
			// videoComponentEl.setAttribute("caogl-filter", "hide-component");
			videoComponentEl.style.display = "none";
			return;
		} else if (filterToApply.filterMode == FilterMode.BlurThumbnail)
			setFilterAttributeToThumbnail(videoTitleEl, "blur-thumbnail");
		else if (filterToApply.filterMode == FilterMode.HideThumbnail)
			setFilterAttributeToThumbnail(videoTitleEl, "hide-thumbnail");
		
		if (filterToApply.hideTitle)
			hideTitle(videoTitleEl);
		
		if (videoComponentEl.__caoglFilter.mouseevents == null) {
			//.. Prevent the video to load when the mouse enters the element.
			//.. Also, if the mouse enters the element, and stays for x seconds,
			//.. the filter is removed so I can see the thumbnail and the title,
			//.. and the filter is reapplied when the mouse leaves.
			videoComponentEl.addEventListener("mouseenter", handleVideoComponentMouseEnter, true); //.. Important to set true here, otherwise the event is not triggered at all.
			videoComponentEl.addEventListener("mouseleave", handleVideoComponentMouseLeave); //.. Important to not set true here, otherwise the event is triggered when the mouse moves over each child of the component (title, thumbnail, etc).
			videoComponentEl.__caoglFilter.mouseevents = true;
		}
	}
	
	/**
	 * @param {HTMLElement} videoTitleEl 
	 */
	function removeFilter(videoTitleEl) {
		if (videoTitleEl.__caoglFilter == null)
			return;
		
		//.. Remove the filter on the thumbnail.
		let imgEls = getThumbnails(videoTitleEl);
		if (imgEls != null && imgEls.length > 0) {
			for (let imgIndex = 0; imgIndex < imgEls.length; imgIndex++) {
				let imgEl = imgEls[imgIndex];
				imgEl.removeAttribute("caogl-filter");
			}
		}
		
		//.. Stop hiding the title and remove my title replacer.
		if (videoTitleEl.__caoglFilter.myTitleEl != null) {
			/** @type {HTMLElement} */
			let myTitleEl = videoTitleEl.__caoglFilter.myTitleEl;
			myTitleEl.remove();
			videoTitleEl.__caoglFilter.myTitleEl = null;
			videoTitleEl.style.display = "";
		}
		
		//.. Remove the filter and the mouse events on the video component.
		if (videoTitleEl.__caoglFilter.componentEl != null) {
			/** @type {HTMLElement} */
			let videoComponentEl = videoTitleEl.__caoglFilter.componentEl;
			videoComponentEl.style.display = "";
			removeVideoComponentMouseEvents(videoComponentEl);
		}
	}
	
	/**
	 * The filter is removed if the mouse enters and stays for x seconds over the video component.
	 * @param {MouseEvent} mouseEvent 
	 */
	function handleVideoComponentMouseEnter(mouseEvent) {
		/** @type {HTMLElement} */
		let videoComponentEl = mouseEvent.currentTarget;
		if (videoComponentEl.__caoglFilter == null || videoComponentEl.__caoglFilter.videoTitleEl == null ||
			videoComponentEl.__caoglFilter.videoTitleEl.__caoglFilter == null ||
			videoComponentEl.__caoglFilter.videoTitleEl.__caoglFilter.filterDetails == null) {
			removeVideoComponentMouseEvents(videoComponentEl);
			return;
		}
		/** @type {HTMLElement} */
		let videoTitleEl = videoComponentEl.__caoglFilter.videoTitleEl;
		
		//.. Prevent the video to load.
		mouseEvent.stopPropagation();
		
		if (videoComponentEl.__caoglFilter.timeout != null)
			return;
		
		if (videoComponentEl.__caoglFilter.filterRemoved != null) {
			//.. Important to check that, in case of the timeout is already finished,
			//.. the filter is already removed, and I move the mouse over the component but not leave it yet,
			//.. otherwise a new timeout is created although the filtered is already removed.
			return;
		}
		
		//.. Setup a timeout to remove the filter at the end.
		videoComponentEl.__caoglFilter.timeout = setTimeout(function () {
			clearTimeout(videoComponentEl.__caoglFilter.timeout);
			removeFilter(videoTitleEl);
			videoComponentEl.__caoglFilter.filterRemoved = true;
			videoComponentEl.__caoglFilter.timeout = null;
		}, 2000);
	}
	
	/**
	 * Reapply the filter when the mouse leaves the video component.
	 * @param {MouseEvent} mouseEvent 
	 */
	function handleVideoComponentMouseLeave(mouseEvent) {
		/** @type {HTMLElement} */
		let videoComponentEl = mouseEvent.currentTarget;
		if (videoComponentEl.__caoglFilter == null || videoComponentEl.__caoglFilter.videoTitleEl == null ||
			videoComponentEl.__caoglFilter.videoTitleEl.__caoglFilter == null ||
			videoComponentEl.__caoglFilter.videoTitleEl.__caoglFilter.filterDetails == null) {
			removeVideoComponentMouseEvents(videoComponentEl);
			return;
		}
		/** @type {HTMLElement} */
		let videoTitleEl = videoComponentEl.__caoglFilter.videoTitleEl;
		
		if (videoComponentEl.__caoglFilter.timeout != null) {
			clearTimeout(videoComponentEl.__caoglFilter.timeout);
			videoComponentEl.__caoglFilter.timeout = null;
		}
		
		if (videoComponentEl.__caoglFilter.filterRemoved != null) {
			videoComponentEl.__caoglFilter.filterRemoved = null;
			applyFilter(videoTitleEl);
		}
	}
	
	/**
	 * @param {HTMLElement} videoComponentEl 
	 */
	function removeVideoComponentMouseEvents(videoComponentEl) {
		if (videoComponentEl.__caoglFilter == null || videoComponentEl.__caoglFilter.mouseevents == null)
			return;
		if (videoComponentEl.__caoglFilter.timeout != null) {
			//.. The filter is removing at the end of the timeout when the mouse enters the component.
			return;
		}
		videoComponentEl.removeEventListener("mouseenter", handleVideoComponentMouseEnter);
		videoComponentEl.removeEventListener("mouseleave", handleVideoComponentMouseLeave);
		videoComponentEl.__caoglFilter.mouseevents = null;
	}
	
	return {
		/**
		 * @param {HTMLElement} videoTitleEl 
		 */
		removeFilter(videoTitleEl) {
			removeFilter(videoTitleEl);
		},
		
		/**
		 * Cleanup of the given video title that has been removed from the DOM.
		 * @param {HTMLElement} videoTitleEl 
		 */
		handleRemovedVideoTitleEl(videoTitleEl) {
			if (videoTitleEl.__caoglFilter == null)
				return;
			removeFilter(videoTitleEl);
			
			/** @type {HTMLElement} */
			let videoComponentEl = videoTitleEl.__caoglFilter.componentEl;
			if (videoComponentEl != null && videoComponentEl.__caoglFilter != null && videoComponentEl.__caoglFilter.moTime != null) {
				//.. Disconnect the MutationObserver used to get notice when the element displaying the duration is added.
				videoComponentEl.__caoglFilter.moTime.disconnect();
				videoComponentEl.__caoglFilter.moTime = null;
			}
			videoTitleEl.__caoglFilter.componentEl = null;
			videoTitleEl.__caoglFilter = null;
		},
		
		/**
		 * Filter, if necessary, the given video title.
		 * @param {HTMLElement} videoTitleEl 
		 * @param {String} videoId 
		 */
		filter(videoTitleEl, videoId) {
			let videoComponentEl = getVideoComponentEl(videoTitleEl);
			if (videoComponentEl == null)
				return;
			
			if (videoTitleEl.__caoglFilter == null)
				videoTitleEl.__caoglFilter = {};
			videoTitleEl.__caoglFilter.title = videoTitleEl.innerText;
			videoTitleEl.__caoglFilter.titleLower = videoTitleEl.innerText.toLowerCase();
			videoTitleEl.__caoglFilter.videoId = videoId;
			videoTitleEl.__caoglFilter.componentEl = videoComponentEl;
			
			if (videoComponentEl.__caoglFilter == null)
				videoComponentEl.__caoglFilter = {};
			videoComponentEl.__caoglFilter.videoTitleEl = videoTitleEl;
			
			filter(videoTitleEl);
		},
		
		/**
		 * I just changed manually the filters in the localStorage, and want to reload them and refresh the page.
		 */
		__debug_refresh() {
			if (window.caoglObserver == null) {
				console.log("window.caoglObserver is null.");
				return;
			}
			
			_filters = [];
			_filtersByVideoId.clear();
			readSavedFilters();
			
			//.. Remove all the filters applied.
			let videoTitleEls = document.body.querySelectorAll("#video-title");
			for (let i = 0; i < videoTitleEls.length; i++) {
				let videoTitleEl = videoTitleEls[i];
				//.. I think it's better to considerer the element as removed, instead of just remove the filter.
				// removeFilter(videoTitleEl);
				caoglFilter.handleRemovedVideoTitleEl(videoTitleEl);
			}
			
			caoglObserver.processVideoTitleElements();
		},
		
		__debug_getFilters() {
			return _filters;
		},
		
		/**
		 * @param {Array<Filter>} filters 
		 */
		__debug_setFilters(filters) {
			_filters = [];
			castFilters(filters);
			saveFilters();
		},
		
		/**
		 * @param {Filter} filter 
		 */
		__debug_addFilter(filter) {
			let newFilter = new Filter();
			Object.assign(newFilter, filter);
			newFilter.valuesToLowerCase();
			_filters.push(newFilter);
			saveFilters();
		}
	};
})();
window.caoglFilter = caoglFilter;