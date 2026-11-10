import { registerModule } from '#nexitas/server/utils/nexitas'
import { censitas } from '#self/server/core/module'

export default defineNitroPlugin(() => registerModule(censitas))
