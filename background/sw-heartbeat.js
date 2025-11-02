/**
 * Code based on the one given by Google: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#keep_a_service_worker_alive_continuously
 * 
 * It's just a setInterval.
 */

import * as Config from "./sw-config.js";

let _interval = null;

function run() {
	let pi = chrome.runtime.getPlatformInfo();
}

function start() {
	if (_interval == null)
		_interval = setInterval(run, 20 * 1000);
}

function stop() {
	if (_interval != null) {
		clearInterval(_interval);
		_interval = null;
	}
}

/**
 * Determine if the heartbeat is enabled in the config.
 */
async function isEnabledAsync() {
	let result = await Config.getBooleanAsync("enableHeartbeat", false);
	return result;
}

function isRunning() {
	let result = _interval != null;
	return result;
}

/**
 * Start the heartbeat or not, depending on the config.
 * 
 * The heartbeat keeps the service worker alive all the time.  
 * The advantages are:
 * - no need to save the states of every variables (because once the service worker stops, all the variables are lost)
 * - the console is not cleared so we can see all the messages printed here without having to store them in the storage.
 * @returns {Boolean} whether the heartbeat is enabled or not.
 */
export async function init() {
	let enableHeartbeat = await isEnabledAsync();
	if (enableHeartbeat)
		start();
	return enableHeartbeat;
}

(function createConsoleFunctions() {
	globalThis.HeartbeathConsole = {
		start,
		stop,
		isEnabledAsync: isEnabledAsync,
		isRunning
	};
})();