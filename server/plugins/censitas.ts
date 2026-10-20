import { registerModule } from '#nexitas/server/utils/nexitas'
import { censitas } from '../core/module'

export default defineNitroPlugin(() => registerModule(censitas))
