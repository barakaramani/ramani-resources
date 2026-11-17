-- Ghala SMS: keep the provider's message id on each sent SMS so delivery reports can update it. Run once, after schema_v3.sql.
ALTER TABLE calls ADD COLUMN sms_message_id TEXT;
ALTER TABLE calls ADD COLUMN sms_provider TEXT;               -- ghala or semacall
CREATE INDEX IF NOT EXISTS calls_sms_message_id ON calls (sms_message_id);
CREATE INDEX IF NOT EXISTS calls_external_id ON calls (external_id);
