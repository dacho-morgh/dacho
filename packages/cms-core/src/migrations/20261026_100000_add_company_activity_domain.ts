/**
 * Retain the signup migration identity for databases that recorded it before
 * staging integration. The dossier migration owns activity_domain exclusively;
 * this entry must not remove that column or its data on rollback.
 */
export async function up(): Promise<void> {}

export async function down(): Promise<void> {}
