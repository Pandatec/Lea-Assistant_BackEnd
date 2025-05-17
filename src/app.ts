import { Server } from './server'
import { HTTP_PORT, HTTP_ADMIN_PORT } from './constants'

(new Server(HTTP_PORT, HTTP_ADMIN_PORT)).launch()