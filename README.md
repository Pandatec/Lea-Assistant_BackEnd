# Lea-Back

| Main | Staging |
|------|---------|
| [![Deploy](https://github.com/Lea-Voc/Lea-Back/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/Lea-Voc/Lea-Back/actions/workflows/deploy.yml) | [![Deploy](https://github.com/Lea-Voc/Lea-Back/actions/workflows/deploy.yml/badge.svg?branch=staging)](https://github.com/Lea-Voc/Lea-Back/actions/workflows/deploy.yml) |

This repository contains all the code for the Lea API and Lea websockets, the landing pages and web application are not in this repository.

Please do not push to the `main` branch under any circumstances. This branch is used by the production server, any push to it will result in an update of the production server.

The developpment and most up to date branch is `staging`, please use this one for all your work. It should also be the branch to derive from when creating a new branch. Like `main`, staging is directly linked to the a running server, so please do no push to it, create a pull request, we will review it as soon as possible.

* [Requirements](#requirements)
* [Setup the server](#setup-the-server)
* [Configure port](#configure-port)
* [Build Storage](#build-storage)
* [Run the tests](#run-the-tests)
* [Create a dummy patient](#create-a-dummy-patient)
* [Error message ID](#error-message-id)
* [Services](#services)

## Requirements
- Node.js v16 or more recent, 64 bits

## Setup the server

1. Clone `Lea-Back` at `git@github.com:Lea-Voc/Lea-Back.git`

2. Checkout the `staging` branch

3. Download staging GCP service key `lea-helper-4963185665f1.json` from [Lea Google Drive](https://drive.google.com/drive/u/1/folders/10qPiAhJ6NpmF4n6_-KXcvcpZCbHRd3OX)  
Place it where ever you want - if you choose to have it inside the repository you should have it in your `.git/info/exclude`, it shall not be checked out.

4. Have a `setenv.sh` you can `source` (example in your favorite Bash-like shell: `source setenv.sh`) so that the `GOOGLE_APPLICATION_CREDENTIALS` environment variable (among others) points to the GCP service key.

```bash
export GOOGLE_APPLICATION_CREDENTIALS="{path}/lea-helper-4963185665f1.json"
export HTTP_PORT=8080                   # 80 by default, set that if you cannot accept on port 80 on your systeù
export HTTP_THROTTLE_PORT=7999          # Throttle port (see 6.), mandatory

export PGUSER=$YOUR_AWESOME_POSTGRES_USERNAME
export PGPASSWORD=$YOUR_AWESOME_POSTGRES_PASSWORD_FOR_USERNAME
export PGDATABASE=lea
```

5. Install dependencies defined in `package-lock.json` by running `npm ci`

6. Clone `Lea-Throttle` from `git@github.com:Lea-Voc/Lea-Throttle.git`, `npm ci`, again have a `setenv.sh` defining `HTTP_PORT=7999` and run using `npm start`

7. Make sure you have postgresql available on your environment. If the following defaults, install postgres and create a user which has the rights to create databases.  
Set these credentials in your `setenv.sh`. The database name doesn't matter much, it simply shall not refer to a database currently used for any other application.

8. Create the database as configured in your environment: `npm run create_db`

9. Migrate the fresly created DB to the latest schema: `npm run migrate`

10. Everything is set up, you can launch the server!
```bash
npm start
```

## Configure port
If you already have a web server or simply do not like to use the port 80, you can change the port the server is listening to by changing the HTTP_PORT environment variable, the server will then be hosted at <http://localhost:${HTTP_PORT}/>

## Build storage
The service keeps track of builds to inform clients whether they are up-to-date or not.
By default, all clients are told they are up-to-date. On staging and production, all tracking must be enabled.
Set `BUILD_DEVICE_ESP32_ENABLE=true`, `BUILD_APP_ANDROID_ENABLE=true`, `BUILD_APP_IOS_ENABLE=true` and `BUILD_DEVICE_ANDROID_ENABLE=true` to allow the server to scan builds in `build` directory and return meaningful comparison to versions queried by clients.

## Run the tests
To run the test, simply run `npm test` and voilà.  
If you just want to run tests, which require no GCP credentials, you may want to define the environment variable `IGNORE_GOOGLE_APPLICATION_CREDENTIALS=true` instead of defining `GOOGLE_APPLICATION_CREDENTIALS` to a proper value.

## Create a dummy patient
To create a dummy patient, you will have to run `npm run dummy_patient --user_id=<your_id>` with <your_id> being your user ID. Please note that this command will ONLY work in the developpment database.

## Error message ID

### Possible errors for HTTP API

| Error ID | Description |
|------------------|-----------------|
| MISSING_FIELD | One of the required field is missing |
| AUTHENTIFICATION_FAILED | The email or password is incorrect |
| ALREADY_REGISTERED | The email is already registered |
| INVALID_FIELD | One of the fields is invalid |
| NO_FIELD | No field was provided |
| UNKNOWN_PATIENT | The provided patientID is unknown |
| NOT_PAIRED | The provided patientID is not paired with the current user |
| UNKNOWN_CALENDAR_EVENT | The provided calendar event ID is unknown |
| UNKNOWN_CODE | The provided pairing code is unknown |
| WAITING_FOR_CONFIRMATION | The pairing process is still waiting for user's confirmation |
| NOT_LOGGED_IN | The user is not logged in |
| NOT_VERIFIED | The user didn't verified his email |
| INTERNAL_ERROR | An internal error occured (and will need to be fixed manually) |
| USER_DOES_NOT_EXIST | This user does not exist |
| UNKNOWN_MESSAGE | The provided message ID is unknown |
| INVALID_PATIENT | The provided patient ID is invalid |
| NO_PATH | The provided path is invalid (for Websocket only) |
| INVALID_DEVICE_ID | The provided device ID is invalid (for device OTA only) |

### Possible errors for all WebSocket clients

The channel will be closed with code **CLOSE_REASON_INVALID_DATA**, and **Error ID** as description.

| Error ID | Description |
|------------------|-----------------|
| BAD_MSG | Ill-formed JSON supplied as input |
| BAD_MSG_TYPE | The supplied message type is unknown, see the [WebSocket reference](https://github.com/Lea-Voc/Lea-Wiki/tree/main/websocket) |
| NO_LOGIN_SUPPLIED | Client failed to supply identification within 5 seconds |
| BAD_LOGIN | Supplied identification is either invalid or outdated |
| NOT_LOGGED_IN | Must be identified first before proceeding with such request |
| MISSING_FIELD | The request is ill-formed: some required information is missing (read the wiki ^) |
| BUSY_OTHER_PATIENT | User did not release resources related to some other patient before acquiring a new one for this class of request |
| NOT_PAIRED | User attempts to interact with some unknown patient |

## Services

Here are some help about the service architecture, might be worth reading.

## Trigger list
Here is the list of all triggers, their type and payload.

### Intent
Activated by voice command.

**type**: `INTENT`

**payload**:
```json
{
  "intent": "string",
}
```

### Zone type changed
Activated when the zone type is changed (i.e. HOME, SAFE...).

**type**: `ZONE_TYPE_CHANGED`

**payload**:
```json
{
  "zone_in": "ZoneType",
  "zone_out": "ZoneType"
}
```

### Zone changed
**_NOTE_**: this one is optional.
Activated when the zone is changed (works for each zone created by the user).

**type**: `ZONE_CHANGED`

**payload**:
```json
{
  "zone_in": "string (zone_id)",
  "zone_out": "string (zone_id)"
}
```

### Periodic
Activated at selected days and specified hour.

**type**: `PERIODIC`

**payload**:
```json
{
  "activation_days": {
    "mon": "boolean",
    "tue": "boolean",
    "wed": "boolean",
    "thu": "boolean",
    "fri": "boolean",
    "sat": "boolean",
    "sun": "boolean",
  },
  "time": {
    "hour": "number",
    "minute": "number"
  }
}
```

### Time range
Activated at selected days during specified time range.

**type**: `TIME_RANGE`

**payload**:
```json
{
  "activation_days": {
    "mon": "boolean",
    "tue": "boolean",
    "wed": "boolean",
    "thu": "boolean",
    "fri": "boolean",
    "sat": "boolean",
    "sun": "boolean",
  },
  "start": {
    "hour": "number",
    "minute": "number"
  },
  "end": {
    "hour": "number",
    "minute": "number"
  },
}
```

## Action List
Here is the list of all actions, their type and payload.
### Ask forgotten items
Asks the patient if they did not forgot anything

**type**: `ASK_FORGOTTEN`

**payload**: none

### List forgotten items
Lists items that the patient may have forgotten

**type**: `LIST_FORGOTTEN`

**payload**:
```json
{
  "items": "string[]"
}
```

### Lock neutral zones
Marks all non safe zones as non safe

**type**: `LOCK_NEUTRAL`

**payload**: none

### Guide home
Guides the user to their home

**type**: `GUIDE_HOME`

**payload**: none

### Say message
Says a message to the user

**type**: `SAY_MESSAGE`

**payload**:
```json
{
  "text": "string"
}
```

### Tell forecast
Tells the user the weather forecast

**type**: `TELL_FORECAST`

**payload**: none

### Tell time
Tells the user the time and date

**type**: `TELL_TIME`

**payload**: none

**_NOTE:_**  The following section is most certainly innacurate and deprecated, please refer to the code for the most up-to-date information.

### Add a new action

To add a new action you must do the following:
* Create the file `<action_name>.ts` in the `src/services/actions` folder
* In this file, create a class that extends the `Action` class found in `src/services/actions/base_action.ts`
* If the action needs some kind of payload, set the property `needsPayload` to true
* Add your action in the `ActionList` array in the `src/services/actions/action_list.ts` file (and please comment with it's ID next to it)
* Add your action in the Action/ID table above and voilà !

### Add a new event type
To add a new event type you must do the following:
* Add the event type in the `EventTypeEnum` in the `src/services/actions/main_multiplexer.ts` file if it does not already exist
* Create the file `<event_type>_multiplexer.ts` in the `src/services` folder
* In this file, create a class that extends the `BaseMultiplexer` class found in `src/services/actions/base_multiplexer.ts` and call the super with the good `EventType` value
* Add a new property in the `MainMultiplexer` class with it's type being the new class you just created
* Add a `case` in the `getMultiplexer` function and there you go !
