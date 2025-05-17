import fs from 'fs'
import { logger } from './utils'
import { Throttle } from './throttle'
import { MailService } from '@sendgrid/mail'
import { SENDGRID_API_KEY } from './constants'

const service: MailService = new MailService()
let isSetup = false
const html = fs.readFileSync('resources/mail.html', 'utf8')
const throttle = new Throttle(undefined)

export function setUpMailService() : void {
	if (SENDGRID_API_KEY !== undefined) {
		service.setApiKey(SENDGRID_API_KEY)
		logger.info('Sendgrid successfully set up')
		isSetup = true
	} else
		logger.warn('No sendgrid API key found, mails won\'t be sent and all new users will be validated by default at creation.')
}

export function isAvailable() {
	return isSetup;
}

export class Mail {
	to: string
	subject: string
	text: string
	html: string

	constructor(to: string, subject: string, text: string, html: string) {
		this.to = to
		this.subject = subject
		this.text = text
		this.html = html
	}

	async send() {
		if (isSetup) {
			if (!await throttle.next('mails', 1))
				return 'NlpThrottled'
			service
				.send({
					to: this.to,
					from: 'noreply@leassistant.fr',
					subject: `[Léa] ${this.subject}`,
					text: this.text,
					html: `${html.replace('$SUBJECT', this.subject).replace('$TEXT', this.html)}`,
				})
				.then(() => {
					logger.info(`Sent a email to ${this.to}`)
				})
				.catch((err: any) => {
					logger.warn(`Failed to send a mail to ${this.to}: ${err}`)
				})
		} else
			logger.warn('No sendgrid API key found, mail can\'t be sent')
	}
}
