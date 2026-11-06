"""Seed one real admin user so /login works (no users exist in DB).

Idempotent: if admin exists, only (re)set its password hash.
Backed by backend's own hashing/model code — not fabricated data.
"""
import sys
from datetime import datetime, timezone

sys.path.insert(0, r"D:\dextra\backend")
from dextra.database.session import get_session_factory
from dextra.database.base import new_id
from dextra.models.identity import User
from dextra.models.tenant import Membership
from dextra.core.passwords import hash_password
from dextra.repositories.tenants import ensure_system_role, add_membership, get_tenant_by_slug

EMAIL = "admin@dextra.local"
PASSWORD = "DextraAdmin123!"

db = get_session_factory()()
try:
    role = ensure_system_role(db, "admin")
    tenant = get_tenant_by_slug(db, "kenari")
    assert tenant is not None, "tenant kenari tidak ditemukan"
    user = db.query(User).filter(User.email == EMAIL).first()
    if user is None:
        user = User(id=new_id("usr"), email=EMAIL, display_name="Admin Dextra", is_active=True)
        db.add(user)
        db.flush()
        add_membership(db, tenant_id=tenant.id, user_id=user.id, role_id=role.id, is_default=True)
    else:
        # ensure membership exists
        existing = db.query(Membership).filter(Membership.user_id == user.id).first()
        if existing is None:
            add_membership(db, tenant_id=tenant.id, user_id=user.id, role_id=role.id, is_default=True)
    user.is_active = True
    user.verified_at = datetime.now(timezone.utc)
    user.password_hash = hash_password(PASSWORD)
    user.password_changed_at = datetime.now(timezone.utc)
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    print(f"OK user={user.id} role=admin tenant=kenari ({EMAIL})")
finally:
    db.close()
