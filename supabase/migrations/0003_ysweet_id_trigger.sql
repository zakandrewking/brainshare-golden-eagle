CREATE OR REPLACE FUNCTION set_ysweet_id_default()
    RETURNS TRIGGER
    AS $$
BEGIN
    IF NEW.ysweet_id IS NULL THEN
        NEW.ysweet_id = NEW.id::text;
    END IF;
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

--> statement-breakpoint
CREATE OR REPLACE TRIGGER document_ysweet_id_default_trigger
    BEFORE INSERT ON "document"
    FOR EACH ROW
    EXECUTE FUNCTION set_ysweet_id_default();

