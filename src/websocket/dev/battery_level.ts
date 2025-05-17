import { setIntervalSec } from "../../utils"
import { Provider } from "./provider";

export class BatteryLevelProvider extends Provider<number> {
	private fs: number		// sampling rate: 1/s
	private minLower: number	// 1
	private minUpper: number	// 1
	private chargeRate: number	// 1/s
	private dischargeRate: number	// 1/s

	private current: number
	private isDischarging: boolean
	private min: number

	private getCurrentRate() {
		if (this.isDischarging)
			return -this.dischargeRate
		else
			return this.chargeRate
	}

	private sampleMin() {
		return this.minLower + (this.minUpper - this.minLower) * Math.random()
	}

	constructor(fs: number, minLower: number, minUpper: number, chargeRate: number, dischargeRate: number) {
		super()

		this.fs = fs
		this.minLower = minLower
		this.minUpper = minUpper
		this.chargeRate = chargeRate
		this.dischargeRate = dischargeRate

		this.current = 1.0
		this.isDischarging = true
		this.min = this.sampleMin()

		setIntervalSec(async () => {
			this.current += this.fs * this.getCurrentRate()
			this.current = Math.min(this.current, 1.0)
			if (this.current <= this.min || this.current >= 1.0) {
				this.min = this.sampleMin()
				this.isDischarging = !this.isDischarging
			}
			this.issue(this.current)
		}, fs)
	}
}

export const defaultBatteryLevelProvider = new BatteryLevelProvider(
	2.0,		// fs
	5.0 / 100.0,	// minLower
	15.0 / 100.0,	// minUpper
	0.1 / 100.0,	// chargeRate
	0.02 / 100.0,	// dischargeRate
)