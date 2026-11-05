# Recipient Scope

- contact_id harus ada di direktori kontak (data/contacts.json).
- contact_id ambigu (c_budi_unresolved) → AMBIGUOUS_RECIPIENT.
- Penerima di luar scope → RECIPIENT_NOT_ALLOWED.
- Multi-recipient: semua harus diizinkan.
- Validasi di backend (policy-engine + executor), bukan hanya frontend.

## Sumber
- packages/policy-engine/src/rules.ts (checkRecipientScope)
- packages/store/src/repository.ts (getContactById)