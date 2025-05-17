import { OpusEncoder } from '@discordjs/opus'
const ogg = require('ogg')
const textToSpeech = require('@google-cloud/text-to-speech')

import { Throttle, throttled, Throttled } from '../../throttle'

const textToSpeechClient = new textToSpeech.TextToSpeechClient()

// TTS parameters
const sampleRate = 48000	// samples per second
const frameSize = 1920		// samples
//const blocksPerSecond = sampleRate / frameSize
//const blockDuration = 1.0 / blocksPerSecond

// Mic parameters (Dialogflow audio input)
const micSampleRate = 16000	// samples per second
const micFrameSize = 960	// samples
export const micFrameLength = micFrameSize / micSampleRate	// in seconds

// First packet for incoming audio (header data)
const opusInHeaderBuf = (() => {
	const header = new Uint8Array(19)
	header[0] = 0x4F // 'O'
	header[1] = 0x70 // 'p'
	header[2] = 0x75 // 'u'
	header[3] = 0x73 // 's'
	header[4] = 0x48 // 'H'
	header[5] = 0x65 // 'e'
	header[6] = 0x61 // 'a'
	header[7] = 0x64 // 'd'

	header[8] = 0x01 // version
	header[9] = 0x01 // channel count
	header[10] = 0x00 // preskip lo
	header[11] = 0x00 // preskip hi

	header[12] = 0x80 // sample rate b0
	header[13] = 0x3E // sample rate b1
	header[14] = 0x00 // sample rate b2
	header[15] = 0x00 // sample rate b3

	header[16] = 0x00 // output gain lo
	header[17] = 0x00 // output gain hi

	header[18] = 0x00 // channel map
	return Buffer.from(header.buffer)
})()

// Second packet for incoming audio (misc header data)
const opusInCommentBuf = (() => {
	const commentLen = 0x36
	const comment = new Uint8Array(commentLen)
	for (let i = 0; i < commentLen; i++) {
		comment[i] = 0
	}
	comment[0] = 0x4F // 'O'
	comment[1] = 0x70 // 'p'
	comment[2] = 0x75 // 'u'
	comment[3] = 0x73 // 's'
	comment[4] = 0x54 // 'T'
	comment[5] = 0x61 // 'a'
	comment[6] = 0x67 // 'g'
	comment[7] = 0x73 // 's'

	comment[8] = 0x0D
	comment[9] = 0x00
	comment[10] = 0x00
	comment[11] = 0x00

	comment[12] = 0x4C
	comment[13] = 0x61
	comment[14] = 0x76
	comment[15] = 0x66

	comment[16] = 0x35
	comment[17] = 0x38
	comment[18] = 0x2E
	comment[19] = 0x34

	comment[20] = 0x35
	comment[21] = 0x2E
	comment[22] = 0x31
	comment[23] = 0x30

	comment[24] = 0x30
	comment[25] = 0x01
	comment[26] = 0x00
	comment[27] = 0x00

	comment[28] = 0x00
	comment[29] = 0x15
	comment[30] = 0x00
	comment[31] = 0x00

	comment[32] = 0x00
	comment[33] = 0x65
	comment[34] = 0x6E
	comment[35] = 0x63

	comment[36] = 0x6F
	comment[37] = 0x64
	comment[38] = 0x65
	comment[39] = 0x72

	comment[40] = 0x3D
	comment[41] = 0x4C
	comment[42] = 0x61
	comment[43] = 0x76

	comment[44] = 0x66
	comment[45] = 0x35
	comment[46] = 0x38
	comment[47] = 0x2E

	comment[48] = 0x34
	comment[49] = 0x35
	comment[50] = 0x2E
	comment[51] = 0x31

	comment[52] = 0x30
	comment[53] = 0x30

	return Buffer.from(comment.buffer)
})()

type OggErrorCb = (err: any | undefined) => void

const throwAnyErr: OggErrorCb = (err: any | undefined) => {
	if (err) {
		throw err
	}
}

interface OggStream {
	flush(errcb: OggErrorCb): void
	packetin(packet: any, errcb: OggErrorCb): void
}

interface OggEncoder extends NodeJS.ReadableStream {
	stream(id: number): OggStream
}

/**
 * @class OpusInputStream
 * One Opus stream handling (i.e. one per intent)
 */
export class OpusInputStream {
	private length: number		// Total length since beginning of stream, in seconds
	private encoderIn: OggEncoder // Input encoder (Opus)
	private streamIn: OggStream // Input encoder stream (Opus)
	private streamInBuf?: Buffer // Incoming data to flush into stream
	private streamInBufFirst: boolean // Is streamInBuf uninitialized ?
	private packetNumIn: number // Incoming packed no

	constructor(id: number) {
		this.length = 0
		this.encoderIn = new ogg.Encoder()
		this.streamIn = this.encoderIn.stream(id)
		this.streamInBuf = undefined
		this.streamInBufFirst = true
		this.packetNumIn = 0

		this.streamInBuf = opusInHeaderBuf
		this.flush(false, true)
		this.streamInBuf = opusInCommentBuf
		this.flush(false, true)
	}

	/**
	 * Get abstract stream that can be transmitted (pumped) to DialogFlow
	 * @return NodeJS.ReadableStream - the input stream
	 */
	getStream(): NodeJS.ReadableStream {
		return this.encoderIn
	}

	/**
	 * Send incoming data into stream
	 * @param {Buffer} buf - the audio data
	 */
	in(buf: Buffer) {
		this.length += micFrameLength
		this.streamInBuf = buf;
	}

	/**
	 * Get length attribute, computed on the basis of frame count so far
	 * @return number - number of seconds elapsed since beginning of stream
	 */
	getLength() {
		return this.length
	}

	/**
	 * Close stream
	 */
	close() {
		this.flush(true, false)
		this.streamIn.flush(throwAnyErr)
	}

	/**
	 * Flush Opus buffer to input stream
	 * @param {boolean} last - is this packet the last one of the stream ?
	 * @param {boolean} zeroGranulePos - is this packet the first one of the stream ?
	 */
	flush(last: boolean, zeroGranulePos: boolean) {
		if (this.streamInBuf === undefined)
			return
		const vals = new Int32Array(12)
		const flush = (this.packetNumIn % 16) === 0
		vals[0] = 0xBAADBEEF
		vals[1] = 0xBAADBEEF
		vals[2] = this.streamInBuf.length
		vals[3] = 0
		vals[4] = this.streamInBufFirst ? 256 : 0
		vals[5] = 0
		vals[6] = last ? 512 : 0
		vals[7] = 0
		vals[8] = zeroGranulePos ? 0 : (flush ? (this.packetNumIn - 1) * 960 * 3 : -1)
		vals[9] = zeroGranulePos ? 0 : (flush ? 0 : -1)
		vals[10] = this.packetNumIn
		vals[11] = 0
		this.packetNumIn++
		const packet = ogg.ogg_packet()
		const valsBuf = Buffer.from(vals.buffer)
		for (let i = 0; i < 48; i++) {
			packet[i] = valsBuf[i]
		}
		packet._packet = this.streamInBuf
		packet.packet = this.streamInBuf
		this.streamIn.packetin(packet, throwAnyErr)
		this.streamInBufFirst = false
		this.streamInBuf = undefined
	}
}

/**
 * Convert PCM 16-bit buffer to Opus packets
 * @param {buf} Buffer - PCM 16-bit audio
 * @return Buffer[] - converted packets
 */
function opusFromPCM(buf: Buffer): Buffer[] {
	const sampleCount = buf.length / 2
	const rem = sampleCount % frameSize
	if (rem > 0) {
		const toAdd = (frameSize - rem) * 2
		const pad = new Int8Array(toAdd)
		for (let i = 0; i < toAdd; i++) {
			pad[i] = 0
		}
		buf = Buffer.concat([buf, Buffer.from(pad)])
	}
	const blocks = buf.length / 2 / frameSize
	const encoder = new OpusEncoder(sampleRate, 1)
	let res: Buffer[] = []
	for (let i = 0; i < blocks; i++) {
		const pcm = buf.slice((i * frameSize) * 2, ((i + 1) * frameSize) * 2)
		const encoded = encoder.encode(pcm)
		res.push(encoded)
	}
	return res
}

/**
 * Opus text-to-speech
 * @param {string} text - the text to speak
 * @return Buffer[] | Throttled - converted packets
 */
export async function speakOpus(throttle: Throttle, text: string): Promise<Buffer[] | Throttled> {
	if (!await throttle.next('tts', text.length))
		return throttled
	const request = {
		input: { text: text },
		// Select the language and SSML voice gender (optional)
		voice: {
			languageCode: 'fr-FR',
			name: 'fr-FR-Wavenet-A',
			ssmlGender: 'FEMALE'
		},
		// select the type of audio encoding
		audioConfig: {
			audioEncoding: 'LINEAR16',
			sampleRateHertz: sampleRate
		}
	}
	const [response] = await textToSpeechClient.synthesizeSpeech(request)
	return opusFromPCM(response.audioContent)
}