import { migrate } from "./orm"

migrate().then(() => {
	process.exit(0)
})