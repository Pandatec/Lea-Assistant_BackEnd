/**
 * @interface Statement
 * Interface describing some text and whether it can be shared publicly or not
 */
export interface Statement {
	text: string,
	isPublic: boolean
}

/**
 * @interface Speaker
 * Interface for speaking to somebody
 */
export interface Speaker {
	speak(...stmts: Statement[]): void;
}