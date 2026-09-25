/** A listing's template name only earns a badge when it differs from the listing title. */
export function showsTemplateNameBadge(listing: { title: string; templateName?: string | null }): boolean {
  const templateName = listing.templateName?.trim() ?? "";
  return templateName !== "" && templateName.toLocaleLowerCase() !== listing.title.trim().toLocaleLowerCase();
}
