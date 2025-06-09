(function () {
	console.log(new Date().toLocaleString() + " -- [Netflix] Playlist modal loaded.");
	
	/** @type {HTMLDivElement} */
	let _modalEl = document.getElementById("caogl-playlist-modal");
	/** @type {HTMLDivElement} */
	let _containerEl = _modalEl.parentElement;
	/** @type {HTMLTextAreaElement} */
	let _reasonEl = _modalEl.querySelector("#reason");
	/** @type {HTMLButtonElement} */
	let _saveButton = _modalEl.querySelector("#save");
	/** @type {HTMLButtonElement} */
	let _cancelButton = _modalEl.querySelector("#cancel");
	
	_reasonEl.focus();
	
	_saveButton.addEventListener("click", async function () {
		_saveButton.disabled = true;
		let buttonText = _saveButton.innerText;
		_saveButton.innerText = "Saving...";
		
		let success = await saveAsync();
		if (success) {
			closeModal();
		} else {
			_saveButton.innerText = buttonText;
			_saveButton.disabled = false;
		}
	});
	
	async function saveAsync() {
		let data = _modalEl.__caogl;
		let result = await caoglPlaylist.saveVideoAsync(data.videoData, data.operation, _reasonEl.value);
		console.log(new Date().toLocaleString() + " -- [Netflix] Save video result:\n", result);
		
		if (result.error != null && result.error != "") {
			alert(result.error);
			return false;
		}
		if (result.result == null) {
			alert("There is no result data.");
			return false;
		}
		if (result.result.error != null && result.result.error != "") {
			//.. Should never be null, but can be empty if no error.
			alert(result.result.error);
			return false;
		}
		
		if (result.result.query == "UPDATE") {
			let columns = result.result.updatedColumns.join(", ");
			if (result.result.updatedColumns.length == 1)
				alert("This column has been updated: " + columns);
			else
				alert("These columns have been updated: " + columns);		
		}
		
		return true;
	}
	
	_cancelButton.addEventListener("click", function () {
		closeModal();
	});
	
	function closeModal() {
		_modalEl = null;
		_reasonEl = null;
		_saveButton = null;
		_cancelButton = null;
		_containerEl.remove();
		_containerEl = null;
		delete window.caoglPlaylistModal;
	}
	
	(function init() {
		let h2 = _modalEl.querySelector("h2");
		let data = _modalEl.__caogl;
		if (data.operation != null && data.operation != "")
			h2.innerText = h2.innerText.replace("{{ operation }}", data.operation[0].toUpperCase() + data.operation.slice(1));
		if (data.videoData != null)
			h2.innerText = h2.innerText.replace("{{ title }}", data.videoData.title);
		else
			_saveButton.style.display = "none";
	})();
	
	/**
	 * Intercept Tab keydown to switch the focus.
	 * @param {KeyboardEvent} keyboardEvent 
	 */
	_modalEl.addEventListener("keydown", function (keyboardEvent) {
		if (keyboardEvent.key != "Tab")
			return;
		if (keyboardEvent.target == _reasonEl)
			_saveButton.focus();
		else if (keyboardEvent.target == _saveButton)
			_cancelButton.focus();
		else
			_reasonEl.focus();
		keyboardEvent.preventDefault();
	});
	
	//.. Export the function to close the modal from the devtools console.
	window.caoglPlaylistModal = {};
	window.caoglPlaylistModal.close = closeModal;
})();