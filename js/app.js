// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {

	// We'll ask the browser to use strict code to help us catch errors earlier.
	// https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
	'use strict';

	var translate = navigator.mozL10n.get;
	var sdcardManager = navigator.getDeviceStorage("sdcard");
	var messageManager = window.navigator.mozSms || navigator.mozMobileMessage;

	var notification = document.getElementById('notification');
	var buttonCount = document.getElementById('button-count');
	var buttonImport = document.getElementById('button-import');

	var messages = [];
	var messageCount = 0;

	// We want to wait until the localisations library has loaded all the strings.
	// So we'll tell it to let us know once it's ready.
	navigator.mozL10n.once(start);

	// ---

	function start() {
		listen();
	}

	function listen() {
		buttonCount.addEventListener('click', count);
		buttonImport.addEventListener('click', importMessages);
	}

	function count (event) {
		event.preventDefault();

		messageCount = 0;
		notification.textContent = 'Counting SMS and MMS...';

		function onsuccess () {
			messages.push(this.result);
			messageCount++;

			if (!this.done) {
				this.continue();
			}
			else {
				notification.textContent = 'SMS and MMS count: ' + messageCount + '.';
			}
		}

		function onerror () {
			notification.textContent = 'Error while counting SMS and MMS: "' + this.error.name + '". Count was at index ' + messageCount + '.';
		}

		try {
			var cursor = messageManager.getMessages(null, false);
			cursor.onsuccess = onsuccess;
			cursor.onerror = onerror;
		} catch (e) {
			notification.textContent = 'Cannot count SMS and MMS: "' + e.message + '".';
		}
	}

	function importMessages (event) {
		event.preventDefault();

		messageCount = 0;
		notification.textContent = 'Importing SMS and MMS...';

		var messages = [
			{
				type: 'sms',
				id: 1,
				threadId: 1,
				body: 'Hello World!',
				delivery: 'sent',
				read: true,
				receiver: '+33612345678',
				sender: null,
				timestamp: '1408892131258',
				messageClass: 'normal'
			}, {
				type: 'sms',
				id: 2,
				threadId: 2,
				body: 'Foo bar',
				delivery: 'sent',
				read: true,
				receiver: null,
				sender: '+33623456789',
				timestamp: '1408892169052',
				messageClass: 'normal'
			}
		];
		var total = messages.length;
		var count = 0;

		function onMessageReceived (event) {
			count++;
			console.log(event);

			notification.textContent = 'Importing message ' + count + '/' + total + '.';

			if (count === total) {
				messageManager.removeEventListener('received', onMessageReceived);
				notification.textContent = 'Import successful.';
			}
		}

		messageManager.addEventListener('message-received', onMessageReceived);

		messages.forEach(importMessage);
	}

	function importMessage (message, ind) {
		if (typeof ind === 'undefined') {
			return;
		}

		var messageEvent;

		switch (message.type) {
			case 'sms':
				messageEvent = new MozSmsEvent('received', message);
				break;
			case 'mms':
				messageEvent = new MozMmsEvent('received', message);
				break;
		}

		messageManager.dispatchEvent(messageEvent);
	}

	function exportMessages() {
		var messageRequest = messageManager.getMessages(null, false);

		messageRequest.onsuccess = function () {
			messages.push(messageRequest.result);

			if (!cursor.done) {
				messageRequest.continue();
			}
			else {
				save();
			}
		}

		messageRequest.onerror = function () {

		}
	}

	function save (messages) {
		var oMyBlob = new Blob(messages, { "type" : "text\/json" });
		var storageRequest = sdcardManager.addNamed(oMyBlob, "backup-messages.json");
	}
});
