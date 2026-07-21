/**
 * En-têtes d'authentification par service token Cloudflare Access.
 *
 * partner-node est protégé par Cloudflare : les requêtes serveur-à-serveur venant de Vercel/AWS
 * sont bloquées sauf si elles présentent un service token Access. whitelabel envoie donc, sur ses
 * appels serveur vers partner-node, les en-têtes `CF-Access-Client-Id` / `CF-Access-Client-Secret`.
 *
 * Les deux valeurs sont optionnelles : si l'une manque (dev local, partner-node non protégé),
 * aucun en-tête n'est ajouté et le comportement reste inchangé.
 */
export function buildPartnerAccessHeaders(
  clientId: string | undefined,
  clientSecret: string | undefined,
): Record<string, string> {
  const id = clientId?.trim();
  const secret = clientSecret?.trim();

  if (!id || !secret) {
    return {};
  }

  return {
    "CF-Access-Client-Id": id,
    "CF-Access-Client-Secret": secret,
  };
}
