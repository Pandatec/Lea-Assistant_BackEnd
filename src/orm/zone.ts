import { ZoneType } from './ZoneType';
import { ZoneSafetyType } from './ZoneSafety';
import { Entity, BaseEntity, Col, FwdQuery, fwdQuery, vs_danger, vs, Met } from '../orm'
import { getCenter, isPointInPolygon, isPointWithinRadius } from 'geolib'
import { GeolibInputCoordinates } from 'geolib/es/types'
import Patient from './patient'
import { getCurrentTime } from '../utils'
import { Id } from '../driver'
import { updateTypeQueryNode } from 'typescript';

const latLngVal = (v: any) => vs_danger.key_count(2)(v) && vs.float(v['lat']) && vs.float(v['lng'])

@Entity()
export class Zone extends BaseEntity<Zone>() {
	@Col({spec: 'id'}) patient_id!: Id
	@Col() type!: ZoneType
	@Col() name!: string
	@Col() color!: number
	@Col() safety!: ZoneSafetyType

	// /!\ tricky part /!\
	// this is saved in DB as JSONB, but in requests is merged in full with the object.
	// see static methods `unflatten` (DB suitable) and instance `toJsonFull` (request suitable)
	// in requests, this field is not present
	@Col({val: v => vs_danger.object(v) &&
		(vs_danger.key_count(1)(v) && vs_danger.array_size(4)(v['points']) && vs_danger.each(latLngVal)(v['points'])) ||
		(vs_danger.key_count(2)(v) && latLngVal(v['center']) && vs.float(v['radius']))
	}) coords!: any

	static async allForPatientId(patientId: Id, fwd: FwdQuery = undefined) {
		return await this.query(q => fwdQuery(q.where('patient_id', '==', patientId), fwd))
	}

	static async fromKeyWithPatientId(key: Id, patientId: Id) {
		const res = await this.fromKey(key)
		if (res === undefined)
			return undefined
		if (res.patient_id !== patientId)
			return undefined
		return res
	}

	public static async getHomeCenter(patientId: Id) : Promise<LatLng | undefined> {
		const home = await this.query(q => q.where('patient_id', '==', patientId).where('safety', '==', 'home'))
		if (home[0] === undefined)
			return undefined
		return this.getZoneCenter(home[0])
	}

	// convert to DB object with bounded field count
	static unflatten(obj: any): {patient_id: Id, type: string, name: string, color: number, is_safe: boolean, coords: any} {
		const res = Object.assign({}, obj)
		const pot_fields = ['points', 'center', 'radius']
		res.coords = {}
		for (const f of pot_fields)
			if (res[f] !== undefined) {
				res.coords[f] = res[f]
				delete res[f]
			}
		return res
	}

	// convert to request object with unbounded field count
	@Met()
	toJsonFull() {
		const res = Object.assign({}, this.toJson())
		Object.assign(res, res.coords)
		delete res.coords
		return res
	}

	static getZoneCenter(z: Zone): LatLng {
		if (z.type === 'circle')
			return z.coords.center;
		else if (z.type === 'polygon') {
			var res = getCenter(z.coords.points.map(latLngToGeolib));
			if (!res)
				throw new Error(`Invalid Coordinates for zone ${z.id}`);
			return GeoLibToLatLng(res);
		} else 
			throw new Error(`Missing Zone type for zone ${z.id}`);
	}

	static isSafe(safety: ZoneSafetyType) {
		return safety !== 'danger';
	}
}

export type LatLng = {
	lat: number,
	lng: number
}

type PolygonZone = {
	points: LatLng[]
}

function castPolygonZone(z: Zone): PolygonZone | undefined {
	if (z.type === 'polygon')
		return z.coords as PolygonZone
	else
		return undefined
}

type CircleZone = {
	center: LatLng,
	radius: number
}

function castCircleZone(z: Zone): CircleZone | undefined {
	if (z.type === 'circle')
		return z.coords as CircleZone
	else
		return undefined
}

function latLngToGeolib(pos: LatLng): GeolibInputCoordinates {
	return {
		latitude: pos.lat,
		longitude: pos.lng
	}
}

function GeoLibToLatLng(pos: {longitude: number, latitude: number}): LatLng {
	return {
		lng: pos.longitude,
		lat: pos.latitude,
	}
}

function isInsideZone(pos: GeolibInputCoordinates, z: Zone): boolean {
	{
		const p = castPolygonZone(z)
		if (p !== undefined)
			return isPointInPolygon(pos, p.points.map(latLngToGeolib))
	}
	{
		const c = castCircleZone(z)
		if (c !== undefined)
			return isPointWithinRadius(pos, latLngToGeolib(c.center), c.radius)
	}
	throw new Error(`Unknown zone type '${z.type}'`)
}

export class LocationReport {
	enteredAt: number
	insideZone: Zone | undefined
	isSafe: boolean
	private sign: string

	constructor(pos: LatLng, zs: Zone[], isNeutralDanger: boolean) {
		this.enteredAt = getCurrentTime()
		const p = latLngToGeolib(pos)
		this.isSafe = !isNeutralDanger
		for (const z of zs)
			if (isInsideZone(p, z)) {
				this.insideZone = z
				this.isSafe = Zone.isSafe(z.safety) //TODO: zone handling
				if (!this.isSafe)
					break
			}
		this.sign = `${this.insideZone === undefined ? '' : this.insideZone.getKey()} - ${this.isSafe}`
	}

	isEqual(other: LocationReport): boolean {
		return this.sign === other.sign
	}

	doSendReport(old?: LocationReport): boolean {
		if (old === undefined)
			return !this.isSafe
		else
			return old.isSafe !== this.isSafe
	}

	textReport(patient: Patient): { title: string, message: string } {
		const name = patient.fullName()
		return {
			title: this.isSafe ? `${name} est en lieu sûr!` : `${name} n'est plus dans une zone sûre!`,
			message: this.insideZone !== undefined ? `${name} se trouve dans la zone ${this.insideZone.name}` : `${name} est dans un lieu non classifié. Ouvrez la carte dans l'onglet Géolocalisation pour plus de détails.`
		}
	}

	getInsideZoneId() {
		if (this.insideZone === undefined)
			return undefined
		else
			return this.insideZone.getKey()
	}
}