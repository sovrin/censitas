import { ownerCredentialsSchema } from '#shared/contracts'
import { authenticate } from '../../core/auth'
import { checkAuthRate, setOwnerSession } from '../../utils/auth'
import { censitasDatabase } from '../../utils/censitas'

export default defineEventHandler(async (event) => {
  checkAuthRate(event, 'login')
  const body = ownerCredentialsSchema.safeParse(await readBody(event))
  if (
    !body.success ||
    !(await authenticate(censitasDatabase(), body.data.email, body.data.password))
  ) {
    throw createError({ statusCode: 401, statusMessage: 'Email or password is incorrect.' })
  }
  setOwnerSession(event)
  return { email: body.data.email }
})
