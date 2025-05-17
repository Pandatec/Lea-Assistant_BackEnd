// Firestore env
process.env['FIRESTORE_EMULATOR_HOST'] = 'leassistant.fr:8000'
process.env['FIRESTORE_PROJECT_ID'] = 'lea-helper'

import { Id } from '../src/driver'
// Imports
import Patient from '../src/orm/patient'
import PatientUser from '../src/orm/patient-user'
import User from '../src/orm/user'

async function createDummyPatient(user_id: Id | undefined) {
  if (user_id === undefined) {
    console.error('Please give a user_id using\nnpm run dummy_patient --user_id=<your_id>')
    process.exit(1)
  }
  const loggedUser = await User.fromKey(user_id)
	if (loggedUser === undefined) {
    console.error('User does not exist, please make sure your user_id is valid')
    process.exit(1)
  }
  const patient = await Patient.createNew(1.0)
  await PatientUser.createNew(patient.getKey(), user_id)
  console.info('Dummy patient succesfully created and paired to your account !')
  process.exit(0)
}

createDummyPatient(process.env.npm_config_user_id)
