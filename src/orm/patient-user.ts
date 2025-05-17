import { logger } from '../utils'
import { Entity, BaseEntity, Col, commit } from '../orm'
import { Id } from '../driver'

@Entity()
export default class PatientUser extends BaseEntity<PatientUser>() {
  @Col({spec: 'id'}) patientId!: Id
  @Col({spec: 'id'}) userId!: Id

  /**
  * Creates a new Patient-User entity in the data store
  * Returns the corresponding Patient-User ORM instance
  *
  * @static @async
  * @param {Id} patientId                 Patient-User patientId
  * @param {Id} userId                    Patient-User userId
  * @returns {Promise<PatientUser>}   Promise of the corresponding Patient-User ORM instance
  */
  static async createNew (
    patientId: Id,
    userId: Id
  ): Promise<PatientUser> {
    // Creates a new GCP key
    const patientUser = this.new({
      patientId: patientId,
      userId: userId
    })

    // Saves patient-user
    await commit(patientUser)

    // Prints and returns
    logger.info(`Patient-User '${patientUser.getKey()}' created`)
    return patientUser
  }

  /**
  * Gets the PatientUser instance corresponding to the given Patient
  *
  * @static @async
  * @param {Id} patientId                                    Patient id to look for
  * @returns {Promise<PatientUser[]>}   Corresponding PatientUser ORM instance or undefined if not found
  */
   static async getByPatientId (
    patientId: Id
  ): Promise<PatientUser[]> {
    return await this.query(q => q.where('patientId', '==', patientId))
  }

  /**
  * Gets the PatientUser instance corresponding to the given User
  *
  * @static @async
  * @param {string} userId                     User id to look for
  * @returns {Promise<PatientUser[]>}   Corresponding PatientUser ORM instance or undefined if not found
  */
   static async getByUserId (
    userId: Id
  ): Promise<PatientUser[]> {
    return await this.query(q => q.where('userId', '==', userId))
  }

  static async exists (
    patientId: Id,
    userId: Id
  ): Promise<boolean> {
    const entities = await this.query(q => q
      .where('userId', '==', userId)
      .where('patientId', '==', patientId)
    )

    // Check if entity exists
    return entities.length > 0
  }
}

export async function isPaired(userId: Id, patientId: Id): Promise<boolean> {
  const patientsUsers = await PatientUser.getByUserId(userId)

  let found = false
  for (let i = 0; i < patientsUsers.length; i++)
    if (patientsUsers[i].patientId === patientId)
      found = true
  return found
}
