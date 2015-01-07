// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function () {

	// We'll ask the browser to use strict code to help us catch errors earlier.
	// https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
	'use strict';

	var translate = navigator.mozL10n.get;
	var sdcardManager = navigator.getDeviceStorage("sdcard");
	var messageManager = navigator.mozSms || navigator.mozMobileMessage;
	var hasMozSmsFilter = 'MozSmsFilter' in window;

	var notification = document.getElementById('notification');
	var buttonCountMesssages = document.getElementById('button-count-messages');
	var buttonCountThreads = document.getElementById('button-count-threads');
	// var buttonImport = document.getElementById('button-import');
	var buttonExport = document.getElementById('button-export');

	var messages;
	var threads;
	var settings = {
		exportName: 'SMMS.json'
		, smsProperties: ['body', 'delivery', 'deliveryStatus', 'id', 'messageClass', 'read', 'receiver', 'sender', 'threadId', 'timestamp', 'type']
		, mmsProperties: ['attachments', 'delivery', 'deliveryStatus', 'expiryDate', 'id', 'read', 'receivers', 'sender', 'smil', 'subject', 'threadId', 'timestamp', 'type']
	};

	// We want to wait until the localisations library has loaded all the strings.
	// So we'll tell it to let us know once it's ready.
	navigator.mozL10n.once(start);

	navigator.mozSetMessageHandler('activity', function (request) {
		var activityName = request.source.name;
		console.log(activityName);

		if (activityName === 'share') {
			importFile(request);
		}
		else if (activityName === 'open') {
			importFile(request);
		}
	});

	// ---

	/**
	 * Reset the variables and listen to DOM events
	 */
	function start () {
		reset();
		listen();
	}

	/**
	 * Add DOM events listeners
	 */
	function listen () {
		buttonCountMesssages.addEventListener('click', countMessages);
		buttonCountThreads.addEventListener('click', countThreads);
		// buttonImport.addEventListener('click', importMessages);
		buttonExport.addEventListener('click', exportMessages);
	}

	/**
	 * Remove DOM events listeners
	 */
	function unlisten () {
		buttonCountMesssages.removeventListener('click', countMessages);
		buttonCountThreads.removeEventListener('click', countThreads);
		// buttonImport.removeEventListener('click', importMessages);
		buttonExport.removeEventListener('click', exportMessages);
	}

	/**
	 * Reset the default counters, stores and the notifier content
	 */
	function reset () {
		messages = [];
		threads = [];

		notification.textContent = '';
	}

	// ---

	/**
	 * Count the SMS and MMS messages
	 * @param  {Event} event DOM event
	 */
	function countMessages (event) {
		event.preventDefault();

		reset();
		notification.textContent = 'Counting SMS and MMS...';

		fetchMessages(function () {
			notification.textContent = 'SMS and MMS count: ' + messages.length + '.';
		});
	}

	/**
	 * Count the threads of SMS and MMS messages
	 * @param  {Event} event DOM event
	 */
	function countThreads (event) {
		event.preventDefault();

		reset();
		notification.textContent = 'Counting threads...';

		fetchThreads(function () {
			notification.textContent = 'Threads count: ' + threads.length + '.';
		});
	}

	/**
	 * Export the SMS and MMS messages to the SD card
	 * @param  {Event} event DOM event
	 */
	function exportMessages (event) {
		event.preventDefault();

		reset();

		var now = new Date();
		var prefix = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes() + '-' + now.getSeconds();
		var filename = prefix + '-' + settings.exportName;

		notification.textContent = 'Exporting messages to "' + filename + '"...';

		fetchMessages(function () {
			notification.textContent = 'Exporting ' + messages.length + ' messages to "' + filename + '"...';

			saveMessagesToSdcard(filename, function () {
				notification.textContent = 'File "' + filename + '" successfully wrote on the sdcard storage area.';
			})
		});
	}

	// ---

	/**
	 * Fetch the SMS and MMS messages
	 * @param  {Function} callback Function executed once all the messages are fetched
	 */
	function fetchMessages (callback) {
		// METHOD USING DATES
		var now = Date.now();
		var timestamp;
		var id;
		var count = 0;

		function onsuccess () {
			if (this.result && this.result.id !== id) {
				messages.push(messageToJson(this.result));
				id = null;
			}

			if (!this.done) {
				this.continue();
			}
			else if (typeof callback === 'function') {
				console.info('Fetched messages with ' + count + ' loop(s).');
				callback();
			}
		}

		function onerror () {
			timestamp = messages[messages.length - 1].timestamp;
			id = messages[messages.length - 1].id;
			get();
		}

		function get () {
			count++;
			try {
				var filter = hasMozSmsFilter ? new MozSmsFilter() : {};

				if (timestamp) {
					filter.startDate = timestamp;
					timestamp = null;
				}

				var cursor = messageManager.getMessages(filter, true);
				cursor.onsuccess = onsuccess;
				cursor.onerror = onerror;
			} catch (error) {
				notification.textContent = 'Cannot access to messages: "' + error.name + '".';
				console.error(error);
			}
		}

		get();

		// METHOD USING THREADS
		// work well when not many messages in the thread
		// var count = -1;

		// function iterate () {
		// 	count++;
		// 	notification.textContent = messages.length + ' from ' + (count + 1) + ' thread(s)...';

		// 	if (threads[count]) {
		// 		fetchMessagesFromThread(threads[count], iterate);
		// 	}
		// 	else {
		// 		callback();
		// 	}
		// }

		// fetchThreads(iterate);
	}

	/**
	 * Fetch a SMS and MMS messages thread
	 * @param  {Object} thread The SMS and MMS messages thread to use as a filter
	 * @param  {Function} callback Function executed once all the messages are fetched
	 */
	function fetchMessagesFromThread (thread, callback) {
		var count = 0;

		function onsuccess () {
			if (this.result) {
				count++;
				messages.push(messageToJson(this.result));
			}

			if (!this.done) {
				this.continue();
			}
			else if (typeof callback === 'function') {
				callback();
			}
		}

		function onerror () {
			notification.textContent = 'Cannot fetch thread messages: "' + this.error.name + '". Message count was ' + messages.length + ' and ' + count + ' in this thread.';
			console.error(this.error);
		}

		try {
			var filter = hasMozSmsFilter ? new MozSmsFilter() : {};
			filter.threadId = thread.id;

			var cursor = messageManager.getMessages(filter, false);
			cursor.onsuccess = onsuccess;
			cursor.onerror = onerror;
		} catch (error) {
			notification.textContent = 'Cannot access to messages: "' + error.name + '".';
			console.error(error);
		}
	}

	/**
	 * Fetch the SMS and MMS messages threads
	 * @param  {Function} callback Function executed once all the threads are fetched
	 */
	function fetchThreads (callback) {
		function onsuccess () {
			if (this.result) {
				threads.push(this.result);
			}

			if (!this.done) {
				this.continue();
			}
			else if (typeof callback === 'function') {
				callback();
			}
		}

		function onerror () {
			notification.textContent = 'Cannot fetch threads: "' + this.error.name + '". Thread count was at index ' + threads.length + '.';
			console.error(this.error);
		}

		try {
			var cursor = messageManager.getThreads(null, false);
			cursor.onsuccess = onsuccess;
			cursor.onerror = onerror;
		} catch (error) {
			notification.textContent = 'Cannot access to messages: "' + error.name + '".';
			console.error(error);
		}
	}

	/**
	 * Create a new file with the SMS and MMS messages and save it to the SD card
	 * @param  {Function} callback Function executed once the file is saved
	 */
	function saveMessagesToSdcard (filename, callback) {
		var text = JSON.stringify(messages);
		var file = new Blob([text], { type : 'application/json' });
		var request = sdcardManager.addNamed(file, filename);

		request.onsuccess = function () {
			if (typeof callback === 'function') {
				callback();
			}
		}

		// An error typically occur if a file with the same name already exist
		request.onerror = function () {
			notification.textContent = 'Unable to write the file: "' + this.error.name + '".';
			console.error(this.error);
		}
	}

	/**
	 * Export a MozSmsMessage or a MozMmsMessage to a JSON object
	 * @param  {MozSmsMessage|MozMmsMessage} message A SMS or MMS message
	 * @return {Object} A JSON message object
	 */
	function messageToJson (message) {
		var properties = settings[message.type === 'mms' ? 'mmsProperties' : 'smsProperties'];
		var obj = {};

		for (var i in properties) {
			if (properties.hasOwnProperty(i)) {
				var property = properties[i];
				obj[property] = message[property];
			}
		}

		return obj;
	}

	/**
	 * Import a file from an activity request
	 * @param  {MozActivity} request The MozActivity request
	 */
	function importFile (request) {
		var data = request.source.data;
		var filename = basename(data.filepaths[0]);
		var reader = new FileReader();

		notification.textContent = 'Loading SMS and MMS from the file "' + filename + '"...'

		reader.addEventListener('loadend', function () {
			messages = JSON.parse(this.result);

			notification.textContent = messages.length + ' SMS and MMS loaded from the file "' + filename + '".';
		});

		reader.readAsText(data.blobs[0]);
	}

	function basename (filename) {
		return filename.substring(filename.lastIndexOf('/') + 1);
	}

	function importMessages (event) {
		event.preventDefault();

		reset();
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
		var count = 0;

		function onMessageReceived (event) {
			count++;
			console.log(event);

			notification.textContent = 'Importing message ' + count + '/' + messages.length + '.';

			if (count === messages.length) {
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
});
