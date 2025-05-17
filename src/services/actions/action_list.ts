import { Action } from './base_action'
import { SayMessage } from './say_message'
import { SayTime } from './say_time'
import { SayDate } from './say_date'
import { SayForecast } from './say_forecast'
import { LockNeutral } from './lock_neutral'
import { GuideHome } from './guide_home'
import { AskForgotten } from './ask_forgotten'
import { ListForgotten } from './list_forgotten'
import { DeleteForgotten } from './delete_forgotten'

enum ActionTypeEnum {
  ASK_FORGOTTEN,
  LIST_FORGOTTEN,
  DELETE_FORGOTTEN,
  LOCK_NEUTRAL,
  GUIDE_HOME,
  SAY_MESSAGE,
  SAY_FORECAST,
  SAY_TIME,
  SAY_DATE
}

export type ActionType = keyof typeof ActionTypeEnum

enum LocaleEnum {
  EN,
  FR
}

export type Locale = keyof typeof LocaleEnum

export let ActionList = new Map<ActionType, Action>()
ActionList.set('ASK_FORGOTTEN', new AskForgotten())
ActionList.set('LIST_FORGOTTEN', new ListForgotten())
ActionList.set('DELETE_FORGOTTEN', new DeleteForgotten())
ActionList.set('LOCK_NEUTRAL', new LockNeutral())
ActionList.set('GUIDE_HOME', new GuideHome())
ActionList.set('SAY_MESSAGE', new SayMessage())
ActionList.set('SAY_FORECAST', new SayForecast())
ActionList.set('SAY_TIME', new SayTime())
ActionList.set('SAY_DATE', new SayDate())