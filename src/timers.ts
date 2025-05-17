import CalendarEvent from './orm/calendar_event'
import PatientCalendarEvent from './orm/patient-calendar_event'
import { getCurrentTime, logger, setTimeoutSec } from './utils'
import { clients } from './websocket/dev/client'

const ONE_HOUR_SECONDS = 60 * 60

class Timers {

    private _nextHourBatch: Map<CalendarEvent, NodeJS.Timeout> = new Map();
    private _currentTimeLimit = getCurrentTime();

    public async launchBatchRoutine() {
        await this.reinitNextHourBatch()
    }

    public shouldBeInBatch(calendarEvent: CalendarEvent): boolean {
        const reinitDate = this._currentTimeLimit - ONE_HOUR_SECONDS
        const evtTime = +calendarEvent.datetime
        return (evtTime >= reinitDate && evtTime <= this._currentTimeLimit)
    }

    public insertEvent(calendarEvent: CalendarEvent) {
        const reinitDate = this._currentTimeLimit - ONE_HOUR_SECONDS
        const delay = +calendarEvent.datetime - reinitDate
        logger.info(`Inserting a next hour event ${calendarEvent.getKey()}: in ${delay} s`)
        const timeout = setTimeoutSec(async () => {
            logger.info(`Sending speak to patient (event)`)
            let pce = await PatientCalendarEvent.getByCalendarEventId(calendarEvent.getKey())
            if (pce === undefined) {
                logger.warn(`Error: No patient associated with the calendarEvent '${calendarEvent.getKey()}'`)
                return
            }
            let c = clients[pce.patientId]
            if (c === undefined) {
                logger.warn(`Error: No websocket dev client associated with the patient '${pce.patientId}'`)
                return
            }
            let d = calendarEvent.data
            await c.speak(...[
                    {text: `Vous avez un ${calendarEvent.type == 'REMINDER' ? 'rappel' : 'événement'} programmé concernant :`, isPublic: true},
                    {text: d.title, isPublic: false}
                ].concat(d.desc !== "" && d.desc !== undefined ?
                    [
                        {text: "Détails supplémentaires :", isPublic: true},
                        {text: d.desc, isPublic: false},
                    ] :
                    []
                )
            )
        }, delay)
        this._nextHourBatch.set(calendarEvent, timeout)
    }

    public removeEvent(calendarEvent: CalendarEvent) {
        logger.info('Removing a event from next hour batch')
        if (this._nextHourBatch.has(calendarEvent)) {
            const timeout: NodeJS.Timeout = this._nextHourBatch.get(calendarEvent)!
            clearTimeout(timeout)
            this._nextHourBatch.delete(calendarEvent)
        }
    }

    public finishBatchRoutine() {
        this._nextHourBatch.values.prototype.forEach((to: NodeJS.Timeout) => clearTimeout(to))
        this._nextHourBatch.clear()
    }

    private async reinitNextHourBatch() {
        // Empty last hours batch
        logger.info('Resetting CalendarEvents hourly batch')
        this._nextHourBatch.clear()

        // Create timeouts for new events
        const currentDate = this._currentTimeLimit;
        const events = await this.fetchBatchEvents(currentDate)
        events.forEach(calendarEvent => this.insertEvent(calendarEvent));

        // Run in hourly loop
        setTimeoutSec(async () => {
            this.reinitNextHourBatch()
        }, ONE_HOUR_SECONDS)
    }

    private async fetchBatchEvents(currentDate: number): Promise<CalendarEvent[]> {
        // One hour later (upper limit)
        this._currentTimeLimit = currentDate + ONE_HOUR_SECONDS
        const batch = await CalendarEvent.getAllWithinTimeRange(currentDate, this._currentTimeLimit)
        if (batch.length === 0)
            logger.info('No event scheduled in the hour')
        return batch
    }
}

export let timers = new Timers();
