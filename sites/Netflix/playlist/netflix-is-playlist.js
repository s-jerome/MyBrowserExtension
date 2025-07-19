const caoglPlaylist = (function () {
	console.log(new Date().toLocaleString() + " -- [Netflix-is-playlist] Script started.");
	
	class VideoData {
		/** @type {Number} */
		videoId;
		
		/**
		 * "movie" or "show"
		 * @type {String}
		 */
		type;
		/** @type {String} */
		title;
		
		/** @type {String} */
		casting;
		/** @type {String} */
		creators;
		/** @type {String} */
		directors;
		/** @type {String} */
		writers;
		
		/** @type {String} */
		genres;
		/** @type {String} */
		mood;
		/** @type {String} */
		tags;
		
		/** @type {Number} */
		ageAdvised;
		/**
		 * The reason why there is an age advised (for example, "violence" for a "18+" movie). 
		 * @type {String}
		 */
		ageAdvisedReason;
		
		/** @type {String} */
		synopsis;
		
		/**
		 * The number of seasons (if it's a serie).
		 * @type {Number}
		 */
		seasonCount;
		/**
		 * For example "x Seasons" or "Limited Series" ("Mini-série").
		 * @type {String}
		 */
		numSeasonLabel;
		/**
		 * The number of episodes (if it's a serie).
		 * @type {Number}
		 */
		episodeCount;
		
		/** @type {Number} */
		durationSec;
		
		/** @type {String} */
		availabilityStartTime;
		
		/**
		 * Where I get the data from.
		 * @type {String}
		 */
		_dataFrom;
		
		constructor() {
			this._dataFrom = "";
			this.ageAdvised = 0;
			this.ageAdvisedReason = "";
			this.availabilityStartTime = "";
			this.casting = "";
			this.creators = "";
			this.directors = "";
			this.durationSec = 0;
			this.episodeCount = 0;
			this.genres = "";
			this.mood = "";
			this.numSeasonLabel = "";
			this.seasonCount = 0;
			this.synopsis = "";
			this.tags = "";
			this.title = "";
			this.type = "";
			this.writers = "";
		}
	}
	
	const GRAPHQL_URL = "https://web.prod.cloud.netflix.com/graphql";
	
	/**
	 * The regex used to get the video id in the url if it contains the "jbv" param.
	 * It can look like this if I click on the "More Info" button of a video while I'm on the homepage for example:
	 * netflix.com/browse?jbv=$videoId
	 * Or it can look like this if I click on the "More Info" button of a video while I search something:
	 * netflix.com/search?q=$search&jvb=$videoId
	 */
	const REGEX_VIDEO_ID_FROM_JBV_URL = /(\?|&)jbv=(?<videoId>\d+)/;
	/**
	 * The regex used to get the video id in the url if it looks like: netflix.com/title/$videoId
	 */
	const REGEX_VIDEO_ID_FROM_TITLE_URL = /\/title\/(?<videoId>\d+)/;
	
	/** @type {Map<Number, VideoData>} */
	let _dataByVideoId = new Map();
	
	/** @type {String} */
	let _extensionId = document.getElementById("caogl-extension-id").getAttribute("extension-id");
	
	/**
	 * @param {Number} videoId 
	 */
	function createVideoData(videoId) {
		let videoData = new VideoData();
		videoData.videoId = videoId;
		_dataByVideoId.set(videoData.videoId, videoData);
		return videoData
	}
	
	/**
	 * Override XHR to intercept the graphql requests.
	 */
	(function overrideXHR() {
		//.. The graphql requests are done using fetch, not XHR.
		//.. So by default, XHR requests are not intercepted.
		//.. But just in case, I add a config to setup that.
		let needToIntercept = (function () {
			let itemValue = localStorage.getItem("caoglPlaylist");
			if (itemValue == null || itemValue == "") {
				localStorage.setItem("caoglPlaylist", "interceptXHR=false");
				return false;
			}
			let interceptValue = itemValue.replace("interceptXHR=", "");
			return interceptValue == "true";
		})();
		if (needToIntercept == false)
			return;
		
		let _xpo = XMLHttpRequest.prototype.open;
		let _xps = XMLHttpRequest.prototype.send;
		
		/**
		 * @param {String} method 
		 * @param {String} url 
		 */
		XMLHttpRequest.prototype.open = function (method, url) {
			//.. Note: the request "pathEvaluator" only contains the title, the advised age, the synopsis and the episode count.
			//.. It doesn't contain the casting, directors, moods, tags...
			
			if (url == GRAPHQL_URL) {
				this.__caogl_isGraphqlRequest = true;
			}
			return _xpo.apply(this, arguments);
		}
		
		XMLHttpRequest.prototype.send = function (dataSent) {
			if (this.__caogl_isGraphqlRequest == null)
				return _xps.apply(this, arguments);
			
			let data = JSON.parse(dataSent);
			if (data == null || data.operationName == null) {
				return _xps.apply(this, arguments);
			}
			
			let processFn = null;
			if (data.operationName == "AddToPlaylist" || data.operationName == "RemoveFromPlaylist") {
				//.. I add or remove the video from my playlist.
				processFn = processAddOrRemoveToPlaylistRequest;
			} else if (data.operationName == "DetailModal") {
				//.. The response of this request contains video data.
				processFn = processGraphqlDetailModalRequest;
			}
			if (processFn != null) {
				this.addEventListener("load", async function (progressEvent) {
					let data = await getResponseData(this);
					if (data == null)
						return;
					processFn(data);
				});
			}
			
			return _xps.apply(this, arguments);
		}
		
		/**
		 * Get the response for the given XHR.
		 * @param {XMLHttpRequest} request 
		 */
		async function getResponseData(request) {
			if (request.status != 200)
				return;
			let json = null;
			if (request.responseType == "blob") {
				//.. Yes, the response type is blob.
				let text = await request.response.text();
				json = JSON.parse(text);
			} else {
				if (request.responseText == "")
					return;
				json = JSON.parse(request.responseText);
			}
			if (json == null || json.data == null)
				return null;
			return json.data;
		}
	})();
	
	/**
	 * Override fetch to intercept the graphql requests.
	 */
	(function overrideFetch() {
		let _originalFetch = fetch;
		fetch = async function (input, init) {
			if (typeof (input) != "string") {
				//.. When the fetch is done on the graphql url, it's a String not a Request.
				return _originalFetch(input, init);
			}
			if (input != GRAPHQL_URL)
				return _originalFetch(input, init);
			
			if (init == null || init.body == null)
				return _originalFetch(input, init);
			let dataSent;
			try {
				dataSent = JSON.parse(init.body);
			} catch (reason) {
				return _originalFetch(input, init);
			}
			if (dataSent == null || dataSent.operationName == null)
				return _originalFetch(input, init);
			
			let processFn = null;
			if (dataSent.operationName == "AddToPlaylist" || dataSent.operationName == "RemoveFromPlaylist") {
				//.. I add or remove the video from my playlist.
				processFn = processAddOrRemoveToPlaylistRequest;
			} else if (dataSent.operationName == "DetailModal") {
				//.. The response of this request contains video data.
				processFn = processGraphqlDetailModalRequest;
			}
			if (processFn != null) {
				return _originalFetch(input, init).then(async function (response) {
					let data = await response.clone().json();
					if (data != null && data.data != null)
						processFn(data.data);
					return response;
				});
			}
			
			return _originalFetch(input, init);
		}
	})();
	
	function processAddOrRemoveToPlaylistRequest(data) {
		let operation = "?";
		let videoId = null;
		if (data.addEntityToPlaylist != null) {
			if (data.addEntityToPlaylist.entity == null ||
				data.addEntityToPlaylist.entity.isInPlaylist == null || data.addEntityToPlaylist.entity.isInPlaylist != true)
				return;
			operation = "add";
			videoId = data.addEntityToPlaylist.entity.videoId;
		}
		else if (data.removeEntityFromPlaylist != null) {
			if (data.removeEntityFromPlaylist.entity == null ||
				data.removeEntityFromPlaylist.entity.isInPlaylist == null || data.removeEntityFromPlaylist.entity.isInPlaylist != false)
				return;
			operation = "remove";
			videoId = data.removeEntityFromPlaylist.entity.videoId;
		} else
			return;
		
		let videoData = getDataByVideoId(videoId);
		if (videoData == null) {
			alert("Can't get the video data.");
			return;
		}
		
		displayModal(operation, videoData);
	}
	
	/**
	 * Get videos data from a graphql DetailModal request.
	 * 
	 * Video data are retrieved from this request:
	 * - when I open directly the page of a video with a url looking like: https://www.netflix.com/title/$videoId
	 * - when I put the cursor on the thumbnail of a video to enlarge it (whether on the homepage, or in the "My List" page, or during a research...).
	 * @param {any} data 
	 */
	async function processGraphqlDetailModalRequest(data) {
		if (data.unifiedEntities == null || Array.isArray(data.unifiedEntities) == false)
			return;
		
		/**
		 * @param {any} unifiedEntity 
		 * @param {String} propertyName 
		 */
		function getEdgesData(unifiedEntity, propertyName) {
			let val = unifiedEntity[propertyName];
			if (val == null || val.edges == null || Array.isArray(val.edges) == false || val.edges.length == 0)
				return "";
			
			let values = [];
			for (let i = 0; i < val.edges.length; i++) {
				let edge = val.edges[i];
				if (edge.node == null || edge.node.name == null || edge.node.name == "")
					continue;
				values.push(edge.node.name);
			}
			let result = values.join(", ");
			return result;
		}
		
		for (let i = 0; i < data.unifiedEntities.length; i++) {
			let unifiedEntity = data.unifiedEntities[i];
			if (unifiedEntity.videoId == null)
				continue;
			let videoData = _dataByVideoId.get(unifiedEntity.videoId);
			if (videoData == null)
				videoData = createVideoData(unifiedEntity.videoId);
			videoData._dataFrom = "graphql";
			
			if (unifiedEntity.__typename != null) {
				videoData.type = unifiedEntity.__typename.toLowerCase();
				
				if (videoData.type == "show") {
					if (unifiedEntity.seasons != null)
						videoData.seasonCount = getPropertyNumericValue(unifiedEntity.seasons, "totalCount");
					
					//.. Apparently there is not the episode count of a serie in the graphql request.
					//.. But, it's curious because it is present in the variable "netflix.falcorCache".
					videoData.episodeCount = getEpisodeCountFromFalcorCache(unifiedEntity.videoId);
				}
			}
			
			if (unifiedEntity.title != null && unifiedEntity.title != "" && (videoData.title == null || videoData.title == ""))
				videoData.title = unifiedEntity.title;
			
			if (unifiedEntity.contextualSynopsis != null && unifiedEntity.contextualSynopsis.text != null)
				videoData.synopsis = unifiedEntity.contextualSynopsis.text;
			
			if (unifiedEntity.availabilityStartTime != null)
				videoData.availabilityStartTime = unifiedEntity.availabilityStartTime;
			
			videoData.casting = getEdgesData(unifiedEntity, "cast");
			videoData.creators = getEdgesData(unifiedEntity, "creators");
			videoData.directors = getEdgesData(unifiedEntity, "directors");
			videoData.writers = getEdgesData(unifiedEntity, "writers");
			
			videoData.genres = getEdgesData(unifiedEntity, "genreTags");
			
			let moods = [];
			let tags = [];
			if (unifiedEntity.moodTags != null && Array.isArray(unifiedEntity.moodTags) && unifiedEntity.moodTags.length > 0) {
				for (let i = 0; i < unifiedEntity.moodTags.length; i++) {
					let mood = unifiedEntity.moodTags[i];
					if (mood.displayName == null || mood.displayName == "")
						continue;
					if (mood.isMood == null || mood.isMood == true)
						moods.push(mood.displayName);
					else
						tags.push(mood.displayName);
				}
			}
			videoData.mood = moods.join(", ");
			videoData.tags = tags.join(", ");
			
			if (unifiedEntity.contentAdvisory != null) {
				videoData.ageAdvised = getPropertyNumericValue(unifiedEntity.contentAdvisory, "certificationValue");
				
				if (unifiedEntity.contentAdvisory.i18nReasonsText != null)
					videoData.ageAdvisedReason = unifiedEntity.contentAdvisory.i18nReasonsText;
			}
			
			if (unifiedEntity.displayRuntimeSec != null && isNaN(unifiedEntity.displayRuntimeSec) == false) {
				videoData.durationSec = unifiedEntity.displayRuntimeSec;
			}
			
			videoData.numSeasonLabel = unifiedEntity.numSeasonsLabel || "";
		}
	}
	
	/**
	 * Display the modal when I add or remove a video from my playlist.
	 * @param {String} operation add/remove
	 * @param {VideoData} videoData 
	 */
	function displayModal(operation, videoData) {
		//.. Note: when the page of a video is open, it's already a modal.
		//.. The dialog/modal has these attributes: role="dialog" / aria-modal="true" / tabindex="-1"...
		
		let url = "chrome-extension://" + _extensionId + "/sites/Netflix/playlist/netflix-playlist-modal.html";
		fetch(url).then(function (response) {
			response.text().then(function (text) {
				let container = document.getElementById("caogl-playlist-container");
				if (container != null)
					container.remove();
				container = document.createElement("div");
				container.id = "caogl-playlist-container";
				document.body.appendChild(container);
				container.innerHTML = text;
				
				let modalEl = container.querySelector("#caogl-playlist-modal");
				modalEl.__caogl = {
					operation: operation,
					videoData: videoData
				};
				
				let scriptEl = document.createElement("script");
				scriptEl.src = "chrome-extension://" + _extensionId + "/sites/Netflix/playlist/netflix-playlist-modal.js";
				container.appendChild(scriptEl);
			});
		});
	}
	
	/**
	 * Get the video data for the given id in the variable "netflix.falcorCache.videos.$videoId"
	 * @param {Number} videoId 
	 */
	function getFalcorCacheByVideoId(videoId) {
		if (window.netflix == null || window.netflix.falcorCache == null || window.netflix.falcorCache.videos == null)
			return null;
		let video = window.netflix.falcorCache.videos[videoId];
		return video;
	}
	
	/**
	 * Get, if exists, the number of episodes in the variable "netflix.falcorCache.videos.$video.jawSummary.value.episodeCount"
	 * @param {Number} videoId 
	 */
	function getEpisodeCountFromFalcorCache(videoId) {
		//.. Note: sometimes, when I add a serie in my playlist, it is saved in the database with the correct number of episodes.
		//.. But, when I remove this serie from my playlist, the episode count can't be find in the different variables.
		//.. So, for now, based on where the problem is, I set a negative value (sometimes I get -1, or -2).
		//.. And the localhost won't update the database if it receives a negative value.
		//.. TODO: find a final solution for this, maybe by intercepting a request having the episode count, like the "pathEvaluator".
		
		let falcorCache = getFalcorCacheByVideoId(videoId);
		if (falcorCache == null)
			return -1;
		
		//.. Either the property "episodeCount" is directly accessible
		//.. (if we get here from the variable "reactContext" with an url looking like: https://www.netflix.com/browse?jbv=<video-id>)
		//.. or there is the property "jawSummary" that contains the property "episodeCount".
		if (falcorCache.episodeCount != null && falcorCache.episodeCount.value != null) {
			let episodeCount = getPropertyNumericValue(falcorCache.episodeCount, "value");
			if (episodeCount > 0)
				return episodeCount;
		}
		if (falcorCache.jawSummary == null || falcorCache.jawSummary.value == null)
			return -2;
		let episodeCount = getPropertyNumericValue(falcorCache.jawSummary.value, "episodeCount");
		if (episodeCount <= 0)
			return -3;
		return episodeCount;
	}
	
	/**
	 * Get, if exists, the numeric value of the given property.
	 * @param {any} obj 
	 * @param {String} propertyName 
	 */
	function getPropertyNumericValue(obj, propertyName) {
		let val = obj[propertyName];
		if (val == null || val == "")
			return 0;
		let number = parseInt(val);
		if (isNaN(number))
			return 0;
		return number;
	}
	
	/**
	 * Get the video data for the given video id in the variable "netflix.reactContext".
	 * @param {Number} videoId 
	 */
	function getReactContextByVideoId(videoId) {
		if (window.netflix == null || window.netflix.reactContext == null || window.netflix.reactContext.models == null ||
			window.netflix.reactContext.models.graphql == null || window.netflix.reactContext.models.graphql.data == null)
			return null;
		
		let data = window.netflix.reactContext.models.graphql.data;
		
		let propKey = "Movie:{\"videoId\":" + videoId + "}"
		let movieData = data[propKey];
		if (movieData == null) {
			//.. If it's a serie.
			propKey = "Show:{\"videoId\":" + videoId + "}"
			movieData = data[propKey];
			if (movieData == null)
				return null;
		}
		return { data: data, movieData: movieData };
	}
	
	function getDataByVideoId(videoId) {
		let videoData = _dataByVideoId.get(videoId);
		if (videoData == null) {
			//.. First I get the video data from the variable "netflix.reactContext",
			//.. because the variable "netflix.falcorCache" doesn't contain the tags of the video.
			videoData = getVideoDataFromReactContext(videoId);
			if (videoData == null) {
				videoData = getVideoDataFromFalcorCache(videoId);
			}
			if (videoData != null) {
				_dataByVideoId.set(videoId, videoData);
			}
		}
		return videoData;
	}
	
	function getCurrentVideoData() {
		let videoId = getCurrentVideoIdFromUrl();
		if (videoId == 0)
			return null;
		let videoData = getDataByVideoId(videoId);
		return videoData;
	}
	
	/**
	 * Get the id of the current video from the url. Return 0 if any.
	 */
	function getCurrentVideoIdFromUrl() {
		let match = document.location.href.match(REGEX_VIDEO_ID_FROM_JBV_URL);
		if (match == null) {
			match = document.location.href.match(REGEX_VIDEO_ID_FROM_TITLE_URL);
			if (match == null) {
				return 0;
			}
		}
		
		let videoId = match.groups["videoId"];
		return parseInt(videoId);
	}
	
	/**
	 * If the video data were not found in the graphql DetailModal requests,
	 * then I look for them in the variable "netflix.falcorCache".
	 * @param {Number} videoId 
	 */
	function getVideoDataFromFalcorCache(videoId) {
		let video = getFalcorCacheByVideoId(videoId);
		if (video == null)
			return null;
		if (video.jawSummary == null || video.jawSummary.value == null)
			return null;
		let jawSummary = video.jawSummary.value;
		
		/**
		 * The value of the given property should be an array of strings. Return these strings separated with a coma.
		 * @param {any} jawSummary 
		 * @param {String} propertyName 
		 */
		function getPropertyJoinedStringsValue(jawSummary, propertyName) {
			let values = jawSummary[propertyName];
			if (values == null || Array.isArray(values) == false || values.length == 0)
				return "";
			let strings = [];
			for (let i = 0; i < values.length; i++) {
				let val = values[i];
				if (val.name == null || val.name == "")
					continue;
				strings.push(val.name);
			}
			let result = strings.join(", ");
			return result;
		}
		
		let videoData = new VideoData();
		videoData.videoId = videoId;
		videoData._dataFrom = "netflix.falcorCache";
		
		videoData.type = jawSummary.type || "";
		
		videoData.seasonCount = getPropertyNumericValue(jawSummary, "seasonCount");
		videoData.episodeCount = getPropertyNumericValue(jawSummary, "episodeCount");
		
		videoData.title = jawSummary.title || "";
		if (jawSummary.contextualSynopsis != null && jawSummary.contextualSynopsis.text != "")
			videoData.synopsis = jawSummary.contextualSynopsis.text;
		
		videoData.casting = getPropertyJoinedStringsValue(jawSummary, "cast");
		videoData.creators = getPropertyJoinedStringsValue(jawSummary, "creators");
		videoData.directors = getPropertyJoinedStringsValue(jawSummary, "directors");
		videoData.writers = getPropertyJoinedStringsValue(jawSummary, "writers");
		
		videoData.genres = getPropertyJoinedStringsValue(jawSummary, "genres");
		videoData.mood = getPropertyJoinedStringsValue(jawSummary, "tags");
		
		if (jawSummary.maturity != null && jawSummary.maturity.rating != null) {
			videoData.ageAdvised = getPropertyNumericValue(jawSummary.maturity.rating, "value");
			videoData.ageAdvisedReason = jawSummary.maturity.rating.specificRatingReason || "";
		}
		
		if (jawSummary.availability != null && jawSummary.availability.availabilityStartTime != null && isNaN(jawSummary.availability.availabilityStartTime) == false) {
			let date = new Date(jawSummary.availability.availabilityStartTime);
			videoData.availabilityStartTime = date.toISOString();
		}
		
		if (video.displayRuntime != null)
			videoData.durationSec = getPropertyNumericValue(video.displayRuntime, "value");
		
		videoData.numSeasonLabel = jawSummary.numSeasonsLabel || "";
		
		//.. Note: there is no "tags" in the globale variable "netflix.falcorCache".
		//.. And I don't think there is the duration either.
		
		return videoData;
	}
	
	/**
	 * If the video data were not found in the graphql DetailModal requests, nor in the variable "netflix.falcorCache"
	 * then I look for them in the variable "netflix.reactContext".
	 * 
	 * The video data are retrieved from this variable:
	 * - if the video was the main video on top of the homepage and I clicked on the "More Info" button
	 * - if I'm on the page of the video (https://www.netflix.com/title/$videoId)
	 * @param {Number} videoId 
	 */
	function getVideoDataFromReactContext(videoId) {
		let result = getReactContextByVideoId(videoId);
		if (result == null)
			return null;
		
		/**
		 * @param {any} data 
		 * @param {any} movieData 
		 * @param {String} propertyName 
		 */
		function getRefData(data, movieData, propertyName) {
			let val = movieData[propertyName];
			if (val == null || val.edges == null || Array.isArray(val.edges) == false || val.edges.length == 0)
				return "";
			
			let values = [];
			for (let i = 0; i < val.edges.length; i++) {
				let edge = val.edges[i];
				if (edge.node == null && edge.node.__ref == null || edge.node.__ref == "")
					continue;
				let ref = edge.node.__ref;
				let refData = data[ref];
				if (refData == null || refData.name == null)
					continue;
				values.push(refData.name);
			}
			let result = values.join(", ");
			return result;
		}
		
		let data = result.data;
		let movieData = result.movieData;
		
		let videoData = new VideoData();
		videoData.videoId = videoId;
		videoData._dataFrom = "netflix.reactContext";
		
		if (movieData.__typename != null)
			videoData.type = movieData.__typename.toLowerCase();
		else if (movieKey.startsWith("Movie"))
			videoData.type = "movie";
		else
			videoData.type = "show";
		
		if (movieData.availabilityStartTime != null && movieData.availabilityStartTime != "") {
			videoData.availabilityStartTime = movieData.availabilityStartTime;
		}
		
		if (movieData.displayRuntimeSec != null && isNaN(movieData.displayRuntimeSec) == false) {
			videoData.durationSec = movieData.displayRuntimeSec;
		}
		
		videoData.title = movieData.title || "";
		
		let contextualSynopsis = movieData["contextualSynopsis({\"context\":{\"clientCapabilities\":[\"SUPPORTS_250_CHARS\"],\"textEvidenceUiContext\":\"ODP\"}})"];
		if (contextualSynopsis != null && contextualSynopsis.__ref != null && contextualSynopsis.__ref != "") {
			let synopsisData = data[contextualSynopsis.__ref];
			if (synopsisData != null && synopsisData.text != null) {
				videoData.synopsis = synopsisData.text;
			}
		}
		
		videoData.casting = getRefData(data, movieData, "persons:{\"roles\":\"ACTOR\"}");
		videoData.creators = getRefData(data, movieData, "persons:{\"roles\":\"CREATOR\"}");
		videoData.directors = getRefData(data, movieData, "persons:{\"roles\":\"DIRECTOR\"}");
		videoData.writers = getRefData(data, movieData, "persons:{\"roles\":[\"WRITER\",\"SCREENWRITER\",\"STORY_BY\"]}");
		
		videoData.genres = getRefData(data, movieData, "genres");
		
		let moods = [];
		let tags = [];
		let movieTags = movieData["tags({\"tagsCriteria\":{\"tagsRecipe\":\"ALT_GENRE_SOURCE\"}})"];
		if (movieTags != null && Array.isArray(movieTags) && movieTags.length > 0) {
			for (let i = 0; i < movieTags.length; i++) {
				let tag = movieTags[i];
				if (tag == null || tag.__ref == null || tag.__ref == "")
					continue;
				let tagData = data[tag.__ref];
				if (tagData == null)
					continue;
				if (tagData.isMood == null || tagData.isMood == true)
					moods.push(tagData.displayName);
				else
					tags.push(tagData.displayName);
			}
		}
		videoData.mood = moods.join(", ");
		videoData.tags = tags.join(", ");
		
		if (movieData.contentAdvisory != null) {
			videoData.ageAdvised = getPropertyNumericValue(movieData.contentAdvisory, "certificationValue");
			videoData.ageAdvisedReason = movieData.contentAdvisory.i18nReasonsText || "";
		}
		
		if (videoData.type == "show") {
			if (movieData.seasons != null)
				videoData.seasonCount = getPropertyNumericValue(movieData.seasons, "totalCount");
			
			//.. Apparently there is not the episode count of a serie in the variable "reactContext".
			//.. But, may be it's present in the variable "netflix.falcorCache".
			videoData.episodeCount = getEpisodeCountFromFalcorCache(videoId);
		}
		videoData.numSeasonLabel = movieData.numSeasonsLabel || "";
		
		return videoData;
	}
	
	/**
	 * Create some functions accessible in the devtools console.
	 */
	(function consoleFunctions() {
		let caoglPlaylistConsole = {};
		
		caoglPlaylistConsole.getCurrentVideoIdFromUrl = getCurrentVideoIdFromUrl;
		
		/**
		 * Get the current video data from the variable "netflix.falcorCache".
		 */
		caoglPlaylistConsole.getCurrentVideoDataFromFalcorCache = function () {
			let videoId = getCurrentVideoIdFromUrl();
			if (videoId == 0) {
				console.log("Can't get the id of the current video from the url.");
				return null;
			}
			let videoData = getVideoDataFromFalcorCache(videoId);
			return videoData;
		};
		
		/**
		 * Get the variable "netflix.falcorCache" for the given video id.
		 * @param {Number} videoId 
		 */
		caoglPlaylistConsole.getFalcorCacheByVideoId = function (videoId) {
			let data = getFalcorCacheByVideoId(videoId);
			return data;
		};
		
		/**
		 * Get the variable "netflix.falcorCache" for the current video.
		 */
		caoglPlaylistConsole.getCurrentVideoDataFromFalcorCache = function () {
			let videoId = getCurrentVideoIdFromUrl();
			if (videoId == 0) {
				console.log("Can't get the id of the current video from the url.");
				return null;
			}
			let data = getFalcorCacheByVideoId(videoId);
			return data;
		};
		
		/**
		 * Get the current video data from the variable "netflix.reactContext".
		 * TODO: another function has the same name...
		 */
		caoglPlaylistConsole.getCurrentVideoDataFromReactContext = function () {
			let videoId = getCurrentVideoIdFromUrl();
			if (videoId == 0) {
				console.log("can't get the id of the current video from the url.");
				return null;
			}
			let videoData = getVideoDataFromReactContext(videoId);
			return videoData;
		};
		
		/**
		 * Get the variable "netflix.reactContext" for the given video id.
		 * @param {Number} videoId 
		 */
		caoglPlaylistConsole.getReactContextByVideoId = function (videoId) {
			let data = getReactContextByVideoId(videoId);
			return data;
		};
		
		/**
		 * Get the variable "netflix.reactContext" for the current video.
		 * TODO: another function has the same name...
		 */
		caoglPlaylistConsole.getCurrentVideoDataFromReactContext = function () {
			let videoId = getCurrentVideoIdFromUrl();
			if (videoId == 0) {
				console.log("can't get the id of the current video from the url.");
				return null;
			}
			let data = getReactContextByVideoId(videoId);
			return data;
		};
		
		/**
		 * @param {String} operation add/remove
		 * @param {Number} videoId 
		 */
		caoglPlaylistConsole.displayModal = function (operation, videoId) {
			if (operation == null)
				operation = "add/remove";
			let videoData = null;
			if (videoId != null)
				videoData = getDataByVideoId(videoId);
			else
				videoData = getCurrentVideoData();
			displayModal(operation, videoData);
		};
		
		caoglPlaylistConsole.getCachedVideoData = function () {
			return _dataByVideoId;
		};
		
		caoglPlaylistConsole.getCurrentVideoEpisodeCountFromFalcorCache = function () {
			let videoId = caoglPlaylistConsole.getCurrentVideoIdFromUrl();
			let episodeCount = getEpisodeCountFromFalcorCache(videoId);
			return episodeCount;
		};
		
		window.caoglPlaylistConsole = caoglPlaylistConsole;
	})();
	
	/**
	 * Send a message to the content script to save the given video data on my local database.
	 * @param {String} operation add/remove
	 * @param {String} reason The reason why I add (or remove) the video from my list.
	 * @param {VideoData} videoData 
	 * @param {Function} callback 
	 */
	function saveVideo(operation, reason, videoData, callback) {
		/**
		 * @param {CustomEvent} customEvent 
		 */
		function handleMessage(customEvent) {
			window.removeEventListener("caoglPlaylistIS", handleMessage);
			callback(customEvent.detail);
		}
		
		window.addEventListener("caoglPlaylistIS", handleMessage);
		
		let detail = {
			site: "Netflix",
			action: "saveVideoData",
			operation: operation,
			reason: reason,
			videoData: videoData
		};
		let event = new CustomEvent("caoglPlaylistCS", { detail: detail });
		window.dispatchEvent(event);
	}
	
	return {
		/**
		 * Save the given video data on my local database.
		 * @param {VideoData} videoData 
		 * @param {String} operation add/remove
		 * @param {String} reason The reason why I add (or remove) the video from my list.
		 */
		async saveVideoAsync(videoData, operation, reason) {
			return new Promise(function (resolve, reject) {
				if (videoData == null) {
					resolve({ error: "No video data." });
					return;
				}
				saveVideo(operation, reason, videoData, resolve);
			});
		},
		
		/**
		 * Save the current video data on my local database.
		 * @param {String} operation add/remove
		 * @param {String} reason The reason why I add (or remove) the video from my list.
		 */
		async saveCurrentVideoAsync(operation, reason) {
			return new Promise(function (resolve, reject) {
				let videoData = getCurrentVideoData();
				if (videoData != null)
					saveVideo(operation, reason, videoData, resolve);
				else
					resolve({ error: "Can't get the current video data." });
			});
		}
	}
})();