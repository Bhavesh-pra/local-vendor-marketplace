# Disaster Recovery, Backups & Maintenance

This guide details recovery, backup, database audits, and maintenance procedures.

---

## 1. Database Backups

### Creating a manual backup
Run the backup script to generate a hot backup of the live database:
```bash
node scripts/backup.js
```
This produces a file named `backups/backup-YYYY-MM-DDTHH-MM-SS-MSZ.sqlite` using SQLite `VACUUM INTO` command, ensuring it does not block active queries.

### Automated Backups
Configure a cron job (on Linux) to automate backups daily:
```cron
0 2 * * * cd /path/to/project/backend && node scripts/backup.js >> /var/log/db-backup.log 2>&1
```

---

## 2. Database Restoration

To restore the database from a backup file:
```bash
# Restore the latest backup automatically
node scripts/restore.js

# Restore a specific backup file
node scripts/restore.js backup-2026-07-16T13-22-21-444Z.sqlite
```
The restore script automatically:
1. Performs an integrity check on the backup database file (`PRAGMA integrity_check`).
2. Creates a temporary backup of the active database before replacement.
3. Replaces the active database, rolling back immediately in case of write errors.

---

## 3. Database Integrity Audits

To audit the database for broken foreign keys, orphaned rows, negative wallet balances, or duplicate keys:
```bash
node scripts/dbAudit.js
```
This generates a detailed audit JSON report in `reports/` and an optional SQL repair script (e.g. `reports/repair-script-YYYY-MM-DD.sql`) if any correctable issues are found.

To apply the corrective repair script manually:
```bash
sqlite3 ecommerce.sqlite < reports/repair-script-YYYY-MM-DD.sql
```

---

## 4. Maintenance & Dependency Review

To prevent security debt accumulation:
1. **Monthly Dependency Audit**: Run `npm audit` to identify critical vulnerabilities.
2. **Quarterly Dependency Review**: Audit outdated dependencies using `npm outdated` and execute major/minor updates with testing validations.
3. **Log Rotation**: Ensure Nginx and system console output logs are rotated regularly to prevent disk space exhaustion.
