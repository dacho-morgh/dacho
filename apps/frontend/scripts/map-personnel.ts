import 'dotenv/config'
import { getPayload } from 'payload'
import { OPERATIONAL_ROLES, type OperationalRole } from '../../../packages/cms-core/src/access/roles.js'
import config from '../src/payload.config.js'
import { readOption } from './args.js'

async function main() {
  const id = readOption('id', 'PERSONNEL_ID')
  const role = readOption('role', 'PERSONNEL_ROLE')
  if (!id || !role || !OPERATIONAL_ROLES.includes(role as OperationalRole)) throw new Error('Supply explicit --id and one --role. No automatic legacy admin mapping is allowed.')
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id })
  await payload.update({ collection: 'users', id, data: { operationalRole: role as OperationalRole, isActive: true, backendService: false }, context: { allowPersonnelProvisioning: true } })
  console.log(`Mapped user ${user.id} to ${role}; legacy evidence and editorial privilege retained.`)
  await payload.destroy()
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1) })
