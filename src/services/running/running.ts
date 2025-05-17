import { Service } from "../../orm/service";
import { getDateNowParis } from "../../utils";
import { Multiplexer } from "../main_multiplexer";

export interface RunningService {
	release(): void
}

interface TimeInDay {
	hour: number
	minute: number
}

function copySetHoursMinutes(date: Date, timeInDay: TimeInDay) {
	let res = new Date(date)
	res.setHours(timeInDay.hour)
	res.setMinutes(timeInDay.minute)
	return res
}

function copySetHoursMinutesInFuture(dateNow: Date, date: Date, timeInDay: TimeInDay) {
	let res = copySetHoursMinutes(date, timeInDay)
	while (dateNow.getTime() > res.getTime())
		res = new Date(res.getTime() + 24 * 60 * 60 * 1000)
	return res
}

function timeoutNextTimeInDay(dateNow: Date, timeInDay: TimeInDay, callback: (dateNow: Date) => void): RunningService {
	const dateNext = copySetHoursMinutesInFuture(dateNow, dateNow, timeInDay)
	const timeout = setTimeout(() => {
		callback(dateNext)
	}, dateNext.getTime() - dateNow.getTime())
	return {
		release() {
			clearTimeout(timeout)
		}
	}
}

function createAbstractPeriodic(dateNow: Date, timeInDay: TimeInDay, callback: (dateNow: Date) => void): RunningService {
	let current: RunningService | undefined
	const doNext = (dateNow?: Date) => {
		current = timeoutNextTimeInDay(dateNow !== undefined ? dateNow : new Date(getDateNowParis().getTime() + 12 * 60 * 60 * 1000), timeInDay, dateNow => {
			current?.release()
			current = undefined
			doNext()
			callback(dateNow)
		})
	}
	doNext(dateNow)
	return current!
}

interface ActivationDays {
	mon: boolean,
	tue: boolean,
	wed: boolean,
	thu: boolean,
	fri: boolean,
	sat: boolean,
	sun: boolean
}

function doesMatchActivationDays(date: Date, activationDays: ActivationDays) {
	const filter = [
		activationDays.sun,
		activationDays.mon,
		activationDays.tue,
		activationDays.wed,
		activationDays.thu,
		activationDays.fri,
		activationDays.sat,
		activationDays.sun
	]
	return filter[date.getDay()]
}

function createPeriodic(service: Service): RunningService {
	const payload = (service.trigger.payload as any)
	return createAbstractPeriodic(getDateNowParis(), payload.time, dateNow => {
		if (doesMatchActivationDays(dateNow, payload.activation_days))
			Multiplexer.runAction(service)
	})
}

function createTimeRange(service: Service): RunningService {
	const payload = (service.trigger.payload as any)
	const now = getDateNowParis()

	// Run action start if start running within interval
	let lastStartPassed = false
	{
		const startDate = copySetHoursMinutes(now, payload.start)
		const endDate = copySetHoursMinutesInFuture(startDate, startDate, payload.end)
		if (
			startDate.getTime() < now.getTime() &&
			now.getTime() < endDate.getTime() &&
			doesMatchActivationDays(now, payload.activation_days)
		) {
			Multiplexer.runAction(service, false)
			lastStartPassed = true
		}
	}

	const start = createAbstractPeriodic(now, payload.start, dateNow => {
		lastStartPassed = doesMatchActivationDays(dateNow, payload.activation_days)
		if (lastStartPassed)
			Multiplexer.runAction(service, false)
	})
	const end = createAbstractPeriodic(now, payload.end, () => {
		if (lastStartPassed)
			Multiplexer.runAction(service, true)
	})
	return {
		release() {
			if (lastStartPassed)
				Multiplexer.runAction(service, true)
			end.release()
			start.release()
		}
	}
}

/**
 * Returns undefined if the service has nothing to run
 */
export function createRunningService(service: Service): RunningService | undefined {
	if (service.trigger.type === 'PERIODIC')
		return createPeriodic(service)
	else if (service.trigger.type === 'TIME_RANGE')
		return createTimeRange(service)
	return undefined
}