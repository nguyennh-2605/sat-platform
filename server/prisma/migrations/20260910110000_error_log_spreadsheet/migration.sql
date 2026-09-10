-- Preserve the original whyChosen column for compatibility and recovery.
-- Existing reflections were plain text: escape before converting to semantic HTML.
UPDATE "ErrorLog"
SET "whyWrong" = NULLIF(concat_ws('',
  CASE WHEN NULLIF(btrim("whyChosen"), '') IS NOT NULL THEN '<p>' || replace(replace(replace("whyChosen", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>' END,
  CASE WHEN NULLIF(btrim("whyWrong"), '') IS NOT NULL THEN '<p>' || replace(replace(replace("whyWrong", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>' END), ''),
  "whyRight" = CASE WHEN "whyRight" IS NOT NULL THEN '<p>' || replace(replace(replace("whyRight", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>' END,
  "takeaway" = CASE WHEN "takeaway" IS NOT NULL THEN '<p>' || replace(replace(replace("takeaway", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>' END;

DROP INDEX "ErrorLog_userId_createdAt_idx";
CREATE INDEX "ErrorLog_userId_createdAt_id_idx" ON "ErrorLog"("userId", "createdAt", "id");
