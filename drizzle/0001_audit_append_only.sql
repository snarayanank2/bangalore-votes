-- Custom SQL migration file, put your code below! --
-- Enforce append-only audit_log at the DB level (architecture §13): once a
-- row lands it can never be updated or deleted, even by a bug or a
-- compromised app-layer query. INSERT is untouched.
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
