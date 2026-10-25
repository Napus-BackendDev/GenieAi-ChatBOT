"""Identity and Channel Migration Script for GenieAI.

Normalizes user emails, backfills additive identity fields (email_normalized,
google_sub), generates channel credential fingerprints, and detects conflicts.

Usage:
    python -m scripts.migrate_identity_and_channels --dry-run
    python -m scripts.migrate_identity_and_channels --apply
"""

import argparse
import asyncio
import hashlib
import json
import logging
import os
import shutil
import sys
from datetime import datetime, timezone

# Add parent directory to sys.path so app modules import correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.db import normalize_email, db_load_users, db_save_users, db_load_profile, db_save_profile
from app.core.mongodb import is_mongo_connected, get_mongo_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migration")


def redact_email(email: str) -> str:
    if not email or "@" not in email:
        return "<redacted>"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*"
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


def compute_line_fingerprint(token: str) -> str:
    if not token:
        return ""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def compute_fb_fingerprint(page_id: str, token: str) -> str:
    if not page_id or not token:
        return ""
    return hashlib.sha256(f"{page_id.strip()}:{token.strip()}".encode("utf-8")).hexdigest()


async def run_migration(apply: bool = False):
    mode_str = "APPLY" if apply else "DRY-RUN"
    logger.info("=== Starting Identity & Channel Migration [%s] ===", mode_str)

    db = get_mongo_db() if is_mongo_connected() else None
    storage_type = "MongoDB" if db is not None else "JSON Files"
    logger.info("Storage backend detected: %s", storage_type)

    users = await db_load_users()
    logger.info("Scanned %d user records", len(users))

    seen_emails = {}  # email_normalized -> list of tenant_ids
    seen_subs = {}    # google_sub -> list of tenant_ids
    conflicts = []
    user_updates = []

    for u in users:
        tenant_id = u.get("tenant_id")
        raw_email = u.get("email", "")
        norm_email = normalize_email(raw_email)
        google_sub = u.get("google_sub")

        if norm_email:
            seen_emails.setdefault(norm_email, []).append(tenant_id)
        if google_sub:
            seen_subs.setdefault(google_sub, []).append(tenant_id)

        needs_update = False
        updates = {}

        if u.get("email_normalized") != norm_email:
            updates["email_normalized"] = norm_email
            needs_update = True

        if google_sub is not None and not isinstance(google_sub, str):
            updates["google_sub"] = str(google_sub)
            needs_update = True

        if "contact_email" not in u and raw_email:
            updates["contact_email"] = raw_email
            needs_update = True

        if needs_update:
            user_updates.append((tenant_id, raw_email, updates))

    # Check for conflicts
    for norm_email, tenants in seen_emails.items():
        if len(tenants) > 1:
            conflicts.append(f"Duplicate email '{redact_email(norm_email)}' shared by tenants: {tenants}")

    for sub, tenants in seen_subs.items():
        if len(tenants) > 1:
            conflicts.append(f"Duplicate google_sub '{sub[:4]}...' shared by tenants: {tenants}")

    if conflicts:
        logger.warning("Found %d identity conflicts:", len(conflicts))
        for c in conflicts:
            logger.warning("  ! %s", c)
    else:
        logger.info("Zero identity conflicts found across %d users", len(users))

    # Profile audits & channel fingerprints
    profile_updates = []
    seen_line_bots = {}  # line_bot_user_id -> list of tenant_ids
    seen_fb_pages = {}   # fb_page_id -> list of tenant_ids

    for u in users:
        tenant_id = u.get("tenant_id")
        profile = await db_load_profile(tenant_id) or {}
        p_updates = {}

        line_token = profile.get("line_channel_access_token", "")
        line_fp = profile.get("line_credential_fingerprint", "")
        line_bot = profile.get("line_bot_user_id", "")

        if line_bot:
            seen_line_bots.setdefault(line_bot, []).append(tenant_id)

        if line_token and not line_fp:
            p_updates["line_credential_fingerprint"] = compute_line_fingerprint(line_token)

        fb_token = profile.get("facebook_page_access_token", "")
        fb_page_id = profile.get("facebook_page_id", "")
        fb_fp = profile.get("facebook_credential_fingerprint", "")

        if fb_page_id:
            seen_fb_pages.setdefault(fb_page_id, []).append(tenant_id)

        if fb_token and fb_page_id and not fb_fp:
            p_updates["facebook_credential_fingerprint"] = compute_fb_fingerprint(fb_page_id, fb_token)

        if p_updates:
            profile_updates.append((tenant_id, p_updates))

    # Channel conflicts
    for bot_id, tenants in seen_line_bots.items():
        if len(tenants) > 1:
            conflicts.append(f"Duplicate LINE bot '{bot_id}' shared by tenants: {tenants}")
            logger.warning("  ! Duplicate LINE bot '%s' shared by tenants: %s", bot_id, tenants)

    for page_id, tenants in seen_fb_pages.items():
        if len(tenants) > 1:
            conflicts.append(f"Duplicate Facebook Page '{page_id}' shared by tenants: {tenants}")
            logger.warning("  ! Duplicate Facebook Page '%s' shared by tenants: %s", page_id, tenants)

    if conflicts:
        logger.error("=== MIGRATION CONFLICTS DETECTED (%d) ===", len(conflicts))
        for c in conflicts:
            logger.error("  ! %s", c)
        if apply:
            logger.error("Halted: Data conflicts must be manually inspected and resolved before --apply.")
            sys.exit(1)

    logger.info("Planned user identity updates: %d", len(user_updates))
    logger.info("Planned profile channel updates: %d", len(profile_updates))

    for tenant_id, raw_email, up in user_updates:
        logger.info("  User [%s] (%s) -> fields: %s", tenant_id, redact_email(raw_email), list(up.keys()))

    for tenant_id, pup in profile_updates:
        logger.info("  Profile [%s] -> fields: %s", tenant_id, list(pup.keys()))

    if not apply:
        logger.info("=== DRY-RUN Complete. No changes written. Run with --apply to commit. ===")
        return

    # Apply changes
    logger.info("Applying changes to %s...", storage_type)

    if db is not None:
        # MongoDB Apply
        for tenant_id, _, up in user_updates:
            up["updated_at"] = datetime.now(timezone.utc)
            await db.users.update_one({"tenant_id": tenant_id}, {"$set": up})

        for tenant_id, pup in profile_updates:
            pup["updated_at"] = datetime.now(timezone.utc)
            await db.tenant_profiles.update_one({"tenant_id": tenant_id}, {"$set": pup}, upsert=True)
    else:
        # JSON Apply with Backup
        backup_dir = os.path.abspath("data/backups")
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if os.path.exists("data/users.json"):
            shutil.copy2("data/users.json", os.path.join(backup_dir, f"users_{timestamp}.json"))

        updated_users = []
        user_map = {t: up for t, _, up in user_updates}
        for u in users:
            tid = u.get("tenant_id")
            if tid in user_map:
                u.update(user_map[tid])
            updated_users.append(u)
        await db_save_users(updated_users)

        for tenant_id, pup in profile_updates:
            p_file = f"data/tenant_profile_{tenant_id}.json"
            if os.path.exists(p_file):
                shutil.copy2(p_file, os.path.join(backup_dir, f"tenant_profile_{tenant_id}_{timestamp}.json"))
            raw = await db_load_profile(tenant_id) or {}
            raw.update(pup)
            await db_save_profile(tenant_id, raw)

    logger.info("=== Migration successfully APPLIED. %d users, %d profiles updated. ===", len(user_updates), len(profile_updates))


def main():
    parser = argparse.ArgumentParser(description="GenieAI Identity & Channel Migration")
    parser.add_argument("--apply", action="store_true", help="Apply the migration (modifies storage)")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without modifying storage")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        parser.print_help()
        sys.exit(1)

    asyncio.run(run_migration(apply=args.apply))


if __name__ == "__main__":
    main()
