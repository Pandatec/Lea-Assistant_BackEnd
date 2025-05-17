/**
 * @interface Logger
 * Interface for logging
 */
export interface Logger {
	/**
	 * Log text
	 * @param {string} str - the message to log
	 */
	log(str: string): void;
}