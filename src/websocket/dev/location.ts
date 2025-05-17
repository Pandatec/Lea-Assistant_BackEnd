import {computeDestinationPoint, getDistance, isPointWithinRadius } from "geolib"
import { LatLng } from "../../orm/zone"
import { getCurrentTimeFrac, setIntervalSec, setTimeoutSec } from "../../utils"
import { Provider } from "./provider";

function lerp(a: number, b: number, k: number) {
	return (1.0 - k) * a + k * b;
}

class Vec2 {
	x: number
	y: number

	constructor(x: number, y: number) {
		this.x = x
		this.y = y
	}

	clone() {
		return new Vec2(this.x, this.y)
	}

	add(o: Vec2) {
		return new Vec2(this.x + o.x, this.y + o.y)
	}

	mulSca(k: number) {
		return new Vec2(k * this.x, k * this.y)
	}

	lerp(o: Vec2, k: number) {
		return new Vec2(lerp(this.x, o.x, k), lerp(this.y, o.y, k))
	}

	toLatLng(): LatLng {
		return {
			lat: this.x,
			lng: this.y
		}
	}

	static fromLatLng(p: {latitude: number, longitude: number}) {
		return new Vec2(p.latitude, p.longitude)
	}
}

export class LocationProvider extends Provider<LatLng> {
	private center: Vec2		// GPS
	private radius: number		// m
	private fs: number		// sampling rate: 1/s
	private moveMaxDist: number	// m
	private moveMaxSpeed: number	// m/s
	private moveMaxWait: number	// s

	private base!: Vec2		// GPS
	private next!: Vec2		// GPS
	private speedNext!: number	// m/s
	private deltaNext!: number	// s
	private timeNext!: number	// s

	constructor(center: Vec2, radius: number, fs: number, moveMaxDist: number, moveMaxSpeed: number, moveMaxWait: number) {
		super()

		this.center = center
		this.radius = radius
		this.fs = fs
		this.moveMaxDist = moveMaxDist
		this.moveMaxSpeed = moveMaxSpeed
		this.moveMaxWait = moveMaxWait

		this.base = this.center.clone()
		this.next = this.center.clone()
		this.nextMove()

		setIntervalSec(async () => {
			let d = this.base
			if (this.deltaNext > 0)
				d = this.base.lerp(this.next, (getCurrentTimeFrac() - this.timeNext) / this.deltaNext)
			this.issue(d.toLatLng())
		}, fs)
	}

	private nextMove() {
		// set static
		this.base = this.next
		this.next = this.base.clone()
		this.speedNext = 0.0
		this.deltaNext = 0.0
		this.timeNext = getCurrentTimeFrac()

		setTimeoutSec(async () => {
			const ang = 360.0 * Math.random()
			let dist = this.moveMaxDist * Math.random()
			let dest = Vec2.fromLatLng(computeDestinationPoint(this.base.toLatLng(), dist, ang))
			if (!isPointWithinRadius(this.center.toLatLng(), dest.toLatLng(), this.radius)) {
				dest = this.center
				dist = getDistance(this.base.toLatLng(), dest.toLatLng())
			}

			this.timeNext = getCurrentTimeFrac()
			this.speedNext = 2.0 * 1000.0 / 3600.0 + this.moveMaxSpeed * Math.random()
			this.next = dest
			this.deltaNext = dist / this.speedNext

			setTimeoutSec(async () => {
				this.nextMove()
			}, this.deltaNext)
		}, this.moveMaxWait * Math.random())
	}
}

export const defaultLocationProvider = new LocationProvider(
	new Vec2(48.8584, 2.2945),	// center
	2000,		// radius
	2.0,		// freq
	200.0,		// moveMaxDist
	5.0 * 1000.0 / 3600.0,	// moveMaxSpeed, 10 km/h
	10.0		// moveMaxWait
)