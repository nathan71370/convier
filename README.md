# Convier

Crée un événement, partage un lien. Tes invités mettent leur prénom, une photo
s'ils veulent, disent s'ils viennent, et l'ajoutent à leur agenda d'un clic.
Aucun compte, aucune adresse e-mail.

## Démarrer

```bash
npm install && npm run dev
```

L'application tourne sur http://localhost:3000 et crée sa base SQLite dans
`data/local.db` au premier chargement. Aucune configuration n'est nécessaire
pour développer.

```bash
npm test        # tests unitaires (node --test)
npm run build   # build de production
npm run lint
```

## Comment ça marche

L'organisateur remplit un formulaire et reçoit deux liens : un **lien public**
à partager, et un **lien d'administration** secret qui permet de modifier ou de
supprimer l'événement. Le lien d'administration n'est affiché qu'une fois, à la
création.

Les invités n'ont pas de compte. Un cookie aléatoire identifie le navigateur,
ce qui permet à chacun de revenir modifier sa propre réponse — et rien d'autre.
Les photos sont recadrées en vignette 256×256 dans le navigateur avant l'envoi
et stockées en data URL : aucun service de stockage externe n'est requis.

Le bouton calendrier propose un fichier `.ics` (Apple Calendar, Outlook,
Thunderbird) et un lien Google Agenda. L'`UID` du fichier `.ics` est stable :
retélécharger après une modification met l'entrée à jour au lieu d'en créer une
seconde.

## Fuseaux horaires

Les dates sont stockées en instants absolus (millisecondes epoch) et le fuseau
IANA de l'événement est conservé à part. La conversion entre horloge murale et
instant se fait **côté serveur** (`src/lib/zoned.ts`), y compris aux passages
heure d'été / heure d'hiver. Concrètement : un organisateur à Tokyo qui modifie
un événement parisien voit et saisit des heures de Paris.

## Structure

```
src/
  app/            pages (App Router) et Server Actions
  components/     interface — ne parle jamais à la base
  db/             schéma Drizzle et client libSQL
  lib/            fonctions pures : ics, fuseaux, validation, photo
```

Chaque module de `lib/` a une responsabilité unique et ses propres tests. Les
pages sont des composants serveur qui lisent la base directement ; les
mutations passent par des Server Actions. La seule route API est celle qui sert
le fichier `.ics`, parce qu'elle doit répondre avec ses propres en-têtes.

## Déploiement

L'application parle à libSQL. En local c'est un fichier ; en production, pointe
`DATABASE_URL` vers une base [Turso](https://turso.tech) — le code ne change
pas.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | `file:./data/local.db` par défaut, ou `libsql://…` en production |
| `DATABASE_AUTH_TOKEN` | jeton Turso, en production uniquement |
| `SITE_URL` | origine publique utilisée dans les liens partagés et le `.ics` ; déduite des en-têtes de la requête si absente |

Volontairement pas préfixée `NEXT_PUBLIC_` : ces variables-là sont figées à la
compilation, ce qui lierait une image construite à un seul domaine. `SITE_URL`
est lue côté serveur à chaque requête, donc la même image sert n'importe quel
hôte.
