(function () {
	function createRow() {
		let e = document.createElement("div");
		e.className = "row";
		return e;
	}
	
	function createLabel(id, text) {
		let label = document.createElement("label");
		label.setAttribute("for", id);
		label.textContent = text;
		return label;
	}
	
	function createInput(id, value) {
		let input = document.createElement("input");
		input.id = id;
		input.value = value;
		return input;
	}
	
	function createControls(labelText, inputId, inputValue) {
		let row = createRow();
		document.body.appendChild(row);
		let label = createLabel(inputId, labelText);
		row.appendChild(label);
		let input = createInput(inputId, inputValue);
		row.appendChild(input);
		return input;
	}
	
	document.getElementById("title").innerText = "Getting jump times...";
	chrome.tabs.sendMessage(window.selectedTab.id, { action: "getJumpTimes" }, function (response) {
		let jumpTimes = response.jumpTimes;
		
		document.body.innerHTML = "";
		
		let title = document.createElement("h2");
		title.innerText = "The jump times are in ms";
		title.style.textAlign = "center";
		document.body.appendChild(title);
		
		let smallInput = createControls("Small:", "small", jumpTimes.small);
		smallInput.focus();
		
		let mediumInput = createControls("Medium (SHIFT key):", "medium", jumpTimes.medium);
		let largeInput = createControls("Large (CTRL key):", "large", jumpTimes.large);
		
		let saveButtonContainer = document.createElement("div");
		document.body.appendChild(saveButtonContainer);
		saveButtonContainer.style.textAlign = "center";
		saveButtonContainer.style.marginBottom = "12px";
		let saveButton = document.createElement("button");
		saveButtonContainer.appendChild(saveButton);
		saveButton.textContent = "Save";
		saveButton.addEventListener("click", function (mouseEvent) {
			let jumpTimes = {};
			jumpTimes.small = parseInt(smallInput.value);
			if (isNaN(jumpTimes.small) || jumpTimes.small <= 0) {
				alert("The small jump is invalid.");
				return;
			}
			jumpTimes.medium = parseInt(mediumInput.value);
			if (isNaN(jumpTimes.medium) || jumpTimes.medium <= 0) {
				alert("The medium jump is invalid.");
				return;
			}
			jumpTimes.large = parseInt(largeInput.value);
			if (isNaN(jumpTimes.large) || jumpTimes.large <= 0) {
				alert("The large jump is invalid.");
				return;
			}
			let messageToSend = { action: "setJumpTimes", jumpTimes: jumpTimes };
			chrome.tabs.sendMessage(window.selectedTab.id, messageToSend, function (r) {
				window.close();
			});
		});
	});
})();