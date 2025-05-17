import { micFrameLength, OpusInputStream } from './opus'
import pump from 'pump'
import stream from 'stream'
const Transform = stream.Transform
import { struct } from 'pb-util'
import dialogflow from '@google-cloud/dialogflow'
import { Throttle } from '../../throttle'

const diagflowSessClient = new dialogflow.SessionsClient({
	apiEndpoint: "europe-west2-dialogflow.googleapis.com"
})

export class DiagResult {
	intent: any
	params: any

	constructor(intent: any, params: any) {
		this.intent = intent
		this.params = params
	}
};

export enum InAudioRes {
	AddedPacked,
	OpenedIntent,
	NlpThrottled
}

/**
 * @class Input
 * Manage incoming Opus audio streams and detect intents using DialogFlow
 */
export class Input {
	private streamId: number // Stream no : increases at each new incoming stream (discrete audio press)
	private diagSessionPath: String
	private onIntent: (res: DiagResult | undefined) => void
	private opusStream?: OpusInputStream

	constructor(diagSessionPath: String, onIntent: (res: DiagResult | undefined) => void) {
		this.streamId = 0
		this.diagSessionPath = diagSessionPath
		this.onIntent = onIntent
	}

	/**
	 * Receive an audio packet
	 * @note will create a new intent if no current
	 * @param {Buffer} data - audio data
	 */
	async inAudio(throttle: Throttle, data: Buffer): Promise<keyof typeof InAudioRes> {
		let res: keyof typeof InAudioRes = 'AddedPacked'
		if (!await throttle.next('nlp', micFrameLength))
			return 'NlpThrottled'
		if (this.opusStream === undefined) {
			this.opusStream = new OpusInputStream(this.streamId++)
			this.createIntentListener(this.opusStream.getStream(), (res: DiagResult | undefined) => {
				this.onIntent(res)
			})
			res = 'OpenedIntent'
		}
		this.opusStream.flush(false, false)
		this.opusStream.in(data)
		return res
	}

	/**
	 * Close current intent, if any
	 */
	close() {
		if (this.opusStream !== undefined) {
			this.opusStream.close()
			this.opusStream = undefined
			return true
		}
		return false
	}

	/**
	 * Setup a DialogFlow stream
	 * @param {OpusInputStream} inStream - the input stream from which Opus data comes from
	 * @param {(res: DiagResult | undefined) => void} callbackFunction - Callback to call with the detected intent
	 */
	private createIntentListener(inStream: NodeJS.ReadableStream, callbackFunction: (res: DiagResult | undefined) => void) {
		const initialStreamRequest = {
			session: this.diagSessionPath,
			queryInput: {
				audioConfig: {
					// audioEncoding: 'AUDIO_ENCODING_LINEAR_16',
					audioEncoding: 'AUDIO_ENCODING_OGG_OPUS',
					sampleRateHertz: 16000,
					languageCode: 'fr-FR',
					singleUtterance: false
				}
			}
		}
		const detectStream = diagflowSessClient
		.streamingDetectIntent()
		.on('error', console.error)
		.on('data', (data: {recognitionResult: {transcript: string}; queryResult: {intent: any, parameters: any}}) => {
			if (data.recognitionResult) {
			/* console.log(
				`Intermediate transcript: ${data.recognitionResult.transcript}`
			) */
			} else {
				const result = data.queryResult
				if (result.intent)
					callbackFunction(new DiagResult(result.intent, struct.decode(result.parameters)))
				else
					callbackFunction(undefined)
			}
		})
		detectStream.write(initialStreamRequest)
		pump(
			inStream,
			new Transform({
				objectMode: true,
				transform: (chunk: any, _encoding: BufferEncoding, callback: (error: null, data: {inputAudio: any}) => void) => {
					callback(null, { inputAudio: chunk })
				}
			}),
			detectStream
		)
	}
}