ALTER TABLE star_gift_catalog DROP CONSTRAINT IF EXISTS star_gift_catalog_collectible_revision_fk;
ALTER TABLE star_gift_catalog ADD CONSTRAINT star_gift_catalog_collectible_revision_fk
  FOREIGN KEY (collectible_revision_id) REFERENCES star_gift_collectible_revisions(id)
  ON DELETE RESTRICT;
ALTER TABLE star_gift_catalog DROP CONSTRAINT IF EXISTS star_gift_catalog_active_revision_fk;
ALTER TABLE star_gift_catalog ADD CONSTRAINT star_gift_catalog_active_revision_fk
  FOREIGN KEY (active_revision_id) REFERENCES star_gift_catalog_revisions(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
