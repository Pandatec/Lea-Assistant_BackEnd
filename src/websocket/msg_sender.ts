
/**
 * @interface Logger
 * Interface for message sending
 */
export interface MsgSender {
	/**
	 * Send bytes to the other end
	 * @param {Buffer} bytes - the bytes to send
	 */
	send(bytes: Buffer): void;

	/**
	 * Send message to the other end
	 * @param {string} type - message type
	 * @param {string | object | undefined} data - data associated with type, undefined if type is self-explanatory
	 */
	send(type: string, msg: string | object | undefined): void;

	/**
	 * Send error to the other end of the connection
	 * @param {string} reason - error details
	 * @param {boolean} fatal - whether the connection should be closed after this error or not
	 */
	error(reason: string): void;
}