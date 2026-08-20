# Comptes, whitelist et albums Immich — Design

Date : 2026-08-20
Remplace en partie : `2026-08-11-event-scheduler-design.md`

## Problème

L'identité d'un invité tient aujourd'hui dans un cookie de navigateur. Cela a
rendu la réponse instantanée — aucun compte à créer — mais la conséquence est
qu'une réponse appartient à un navigateur, pas à une personne. Répondre depuis
le téléphone puis corriger depuis l'ordinateur est impossible : le second
navigateur est un inconnu. Le prénom et la photo sont ressaisis à chaque
événement, et personne ne peut consulter ce à quoi il a déjà répondu.

L'application est par ailleurs privée. Elle n'a jamais eu de contrôle d'accès :
quiconque devine ou reçoit un lien voit l'événement et la liste des invités.

## Périmètre

On remplace l'identité par navigateur par un compte identifié par une adresse
e-mail, vérifiée par un code à usage unique. Seules les adresses présentes dans
une liste blanche peuvent se connecter, et **toute** page — consultation comme
création — exige une session. Le compte porte le prénom et la photo, réutilisés
d'un événement à l'autre, et donne accès à l'historique des événements auxquels
la personne a répondu.

L'organisateur peut, à la création ou après coup, faire créer un album photo
partagé Immich dont le lien est visible par tous les invités de l'événement.

Hors périmètre : mots de passe, OAuth, rôles, invitations par e-mail,
notifications, gestion de la liste blanche depuis l'interface.

## Découpage

Deux phases livrables séparément. La première conditionne la seconde.

1. **Comptes et accès** — table `users`, connexion OTP, liste blanche,
   migration du modèle, profil et historique. Le profil n'est pas un chantier
   distinct : dès lors que l'identité vit dans `users`, prénom, photo et
   historique en découlent.
2. **Albums Immich** — case à cocher à la création, bouton de rattrapage sur la
   page d'administration.

## Décisions

| Sujet | Choix | Raison |
|---|---|---|
| Vérification | Code à 6 chiffres par e-mail | Rien à mémoriser, rien à stocker côté visiteur ; adapté à un cercle d'amis. |
| Transport | SMTP via nodemailer | Fonctionne avec n'importe quel fournisseur, aucun service tiers à provisionner. Sans configuration, le code est journalisé — le flux reste testable. |
| Liste blanche | Fichier externe désigné par une variable d'environnement | Une seule liste partagée entre plusieurs applications, modifiable sans redéploiement. |
| Session | Jeton opaque en base + cookie httpOnly | Révocable immédiatement, contrairement à un JWT qu'on ne peut que laisser expirer. |
| Lien d'administration | Supprimé | L'organisateur est désormais identifié par son compte. Un secret dans une URL est un risque qui n'a plus de contrepartie. |
| Identité affichée | Toujours celle du profil | Une seule source de vérité : changer sa photo la met à jour partout, ce qui est précisément l'intention. |

## Modèle de données

`users` — `id`, `email` (unique, normalisée en minuscules), `name`, `photo`
(data URL), `created_at`, `last_seen_at`.

`login_codes` — `id`, `email`, `code_hash`, `expires_at`, `attempts`,
`consumed_at`, `created_at`. Le code n'est jamais stocké en clair : on garde
l'empreinte SHA-256 du code concaténé à `AUTH_SECRET`. Un code vit dix minutes,
tolère cinq tentatives, et `consumed_at` le rend inutilisable après succès.

`sessions` — `id` (le secret lui-même, porté par le cookie), `user_id`,
`created_at`, `expires_at`. Quatre-vingt-dix jours, prolongés à chaque visite.

`events` — inchangée, moins `admin_token` et `host_name`, plus
`host_user_id` → `users.id`, `immich_album_id` et `immich_share_url`.

`rsvps` — remplace `guests` : `id`, `event_id`, `user_id`, `status`,
`plus_ones`, `message`, `created_at`, `updated_at`, avec unicité sur
`(event_id, user_id)`. Ni prénom ni photo : ils viennent du profil.

## Migration

La table `guests` n'est jamais supprimée. Elle devient une archive que
l'application ne lit plus, ce qui rend l'opération réversible.

Au démarrage, après création des nouvelles tables, une passe idempotente
s'exécute :

1. `ALTER TABLE guests ADD COLUMN email TEXT` et `migrated_at INTEGER`, si ces
   colonnes manquent.
2. Pour chaque ligne portant un e-mail et dont `migrated_at` est nul : créer ou
   retrouver le compte correspondant, y recopier prénom et photo si le compte
   n'en a pas encore, insérer la réponse dans `rsvps`, puis horodater
   `migrated_at`.
3. Journaliser le nombre de lignes promues et lister celles restées sans
   e-mail.

`migrated_at` est ce qui autorise le redémarrage répété sans ressusciter une
réponse que quelqu'un aurait entre-temps retirée.

L'ordre d'exploitation est donc : déployer, remplir les e-mails en base,
redémarrer le conteneur. Les lignes sans e-mail ne sont pas perdues, elles
attendent dans `guests`.

## Liste blanche

`WHITELIST_FILE` désigne un fichier lisible par le conteneur. Le format est
délibérément permissif — adresses séparées par des virgules, des points-virgules
ou des retours à la ligne, lignes commençant par `#` ignorées — parce que le
fichier est écrit à la main et partagé entre plusieurs applications.

Le fichier est relu quand sa date de modification change : ajouter une adresse
ne demande pas de redéploiement.

En l'absence de variable, ou si le fichier est illisible, **personne** n'est
autorisé et l'erreur est journalisée sans détour. Une liste de contrôle d'accès
qui échoue en laissant tout passer est un piège ; mieux vaut une application
temporairement fermée qu'une application ouverte à tous sans que cela se voie.

## Variables d'environnement ajoutées

| Variable | Rôle |
|---|---|
| `AUTH_SECRET` | Sel serveur mêlé au code avant empreinte. Obligatoire ; l'application refuse de démarrer sans, plutôt que de hacher avec une valeur par défaut connue. |
| `WHITELIST_FILE` | Chemin du fichier de liste blanche, monté dans le conteneur. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Transport e-mail. Toutes absentes, le code est journalisé au lieu d'être envoyé. |
| `IMMICH_URL`, `IMMICH_API_KEY` | Activent les albums partagés. Absentes, la fonctionnalité est masquée. |

## Parcours de connexion

`/connexion` demande une adresse. L'action normalise, vérifie la liste blanche,
et si l'adresse n'y figure pas le dit franchement : sur une application privée
entre amis, l'ambiguïté protège moins qu'elle ne dessert. Sinon un code est
émis, au plus trois par adresse par quart d'heure.

`/connexion/code` demande le code, crée le compte s'il n'existe pas encore,
ouvre la session et redirige vers la page demandée à l'origine.

Toute page appelle `requireUser()`, qui redirige vers `/connexion?next=…` en
l'absence de session valide. Cela inclut la route `.ics`, qui divulgue autant
que la page de l'événement. Le contrôle est explicite dans chaque page plutôt
que délégué à un middleware : cinq pages ne justifient pas une couche dont le
comportement dépend du routage.

## Profil

`/profil` permet de changer prénom et photo — les mêmes composants qu'aujourd'hui
— et liste les événements organisés et ceux auxquels la personne a répondu,
séparés en à venir et passés.

Le formulaire de réponse se pré-remplit depuis le profil. Répondre pour la
première fois y recopie le prénom et la photo si le profil est vide, de sorte
que la deuxième invitation ne demande plus rien.

## Albums Immich

`IMMICH_URL` et `IMMICH_API_KEY` activent la fonctionnalité ; sans elles la case
et le bouton n'apparaissent pas.

La création enchaîne deux appels authentifiés par l'en-tête `x-api-key` :
`POST /api/albums` avec `albumName` et `description`, puis
`POST /api/shared-links` avec `type: "ALBUM"`, l'`albumId` obtenu et
`allowUpload: true` — l'intérêt étant que les invités déposent leurs photos. Le
lien public vaut `{IMMICH_URL}/share/{key}`.

L'album est créé **après** l'événement, jamais dans la même transaction : une
panne d'Immich ne doit pas empêcher d'inviter des gens. En cas d'échec,
l'événement existe, l'erreur est affichée sur la page d'administration, et le
bouton de rattrapage permet de réessayer.

## Erreurs

Zod valide toutes les entrées côté serveur. Un code expiré, déjà consommé ou
épuisé en tentatives donne le même message qu'un code faux : ces distinctions
n'aident que celui qui devine. Un événement inconnu et un événement auquel on
n'a pas accès rendent le même 404.

## Tests

Le risque se concentre dans des fonctions pures, testées en priorité : analyse
du fichier de liste blanche (séparateurs mélangés, casse, commentaires, fichier
vide), normalisation des adresses, cycle de vie d'un code (expiration, plafond
de tentatives, consommation, rejeu), construction des URL Immich, et
planification de la migration à partir d'un jeu de lignes `guests`.

Le parcours complet — connexion, réponse, changement d'appareil, retrait
d'accès — est vérifié dans le navigateur avant livraison.
