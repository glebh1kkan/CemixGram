-- Allow catalog teardown in one transaction: RESTRICT checks fire immediately
-- and cannot be deferred, NO ACTION DEFERRABLE keeps the same protection but
-- evaluates at COMMIT, so revisions/pools can be removed before the catalog row.
ALTER TABLE star_gift_catalog DROP CONSTRAINT IF EXISTS star_gift_catalog_active_revision_fk;
ALTER TABLE star_gift_catalog ADD CONSTRAINT star_gift_catalog_active_revision_fk
  FOREIGN KEY (active_revision_id) REFERENCES star_gift_catalog_revisions(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE star_gift_catalog DROP CONSTRAINT IF EXISTS star_gift_catalog_collectible_revision_fk;
ALTER TABLE star_gift_catalog ADD CONSTRAINT star_gift_catalog_collectible_revision_fk
  FOREIGN KEY (collectible_revision_id) REFERENCES star_gift_collectible_revisions(id)
  ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
