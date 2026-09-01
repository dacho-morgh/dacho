import { runMigrations } from './migrate.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required to run migrations')
  process.exit(1)
}

runMigrations(databaseUrl)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
