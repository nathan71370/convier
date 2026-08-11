# Event Scheduler — Design

Date: 2026-08-11

## Problème

Organiser un événement informel (dîner, anniversaire, week-end) demande aujourd'hui
soit un groupe de discussion où les réponses se perdent, soit un outil qui force
tout le monde à créer un compte. On veut le chemin le plus court : une personne
crée l'événement, partage un lien, et chaque invité répond en dix secondes sans
inscription.

## Périmètre

Un organisateur crée un événement et reçoit deux liens : un lien public à
partager et un lien admin secret. Sur le lien public, un invité saisit son
prénom, éventuellement une photo, choisit `présent` / `absent` / `je ne sais pas
encore`, peut indiquer un nombre d'accompagnants et un mot court, puis ajoute
l'événement à son calendrier en un clic. Tout le monde voit la liste des
participants et le décompte par réponse.

Hors périmètre : comptes utilisateurs, invitations par e-mail, événements
récurrents, sondage de dates, notifications.

## Décisions

| Sujet | Choix | Raison |
|---|---|---|
| Persistance | Drizzle ORM sur libSQL | Le même code parle à un fichier SQLite local et à Turso en production ; aucun credential nécessaire pour démarrer. |
| Photos | Redimensionnement dans le navigateur, stockage en data URL | Pas de service de stockage externe à provisionner ; une vignette 256×256 en JPEG pèse ~20 Ko. |
| Édition | Jeton admin secret dans l'URL | Conserve le principe « pas de compte » tout en permettant de corriger une date. |
| Identité invité | Cookie aléatoire par navigateur | Permet à un invité de modifier sa propre réponse et de pré-remplir son prénom, sans authentification. |

## Modèle de données

Deux tables SQLite.

`events` — `id`, `slug` (unique, dans l'URL publique), `admin_token` (unique,
secret), `title`, `description`, `location`, `starts_at` et `ends_at` en
millisecondes epoch, `all_day`, `timezone` (IANA, capturée à la création),
`host_name`, `rsvp_deadline`, `created_at`.

`guests` — `id`, `event_id`, `guest_key`, `name`, `photo` (data URL ou nul),
`status` (`yes` | `no` | `maybe`), `plus_ones`, `message`, `created_at`,
`updated_at`. Contrainte d'unicité sur `(event_id, guest_key)` : c'est elle qui
transforme une seconde réponse du même navigateur en mise à jour plutôt qu'en
doublon.

Les dates sont stockées en instants absolus (epoch ms). Le fuseau est conservé à
part, uniquement pour réafficher l'heure telle que l'organisateur l'a voulue et
pour générer le fichier calendrier.

## Architecture

Next.js 16, App Router. Les pages sont des composants serveur qui lisent
directement la base ; les mutations passent par des Server Actions. Aucune route
API sauf une : la génération du fichier `.ics`, qui doit répondre avec un
`Content-Type` propre.

- `/` — formulaire de création.
- `/e/[slug]` — page publique : détails, formulaire de réponse, liste des invités.
- `/e/[slug]/share` — écran affiché juste après la création, montrant les deux liens.
- `/e/[slug]/manage` — édition et suppression, protégé par le jeton admin.
- `/api/e/[slug]/ics` — fichier calendrier.

Chaque unité a une responsabilité isolée : `src/lib/ics.ts` ne sait que
fabriquer un VEVENT à partir d'un événement, `src/lib/photo.ts` ne sait que
réduire une image dans un canvas, `src/lib/validation.ts` porte les schémas Zod
partagés entre formulaire et action. Les composants d'interface reçoivent des
données déjà formées et ne parlent jamais à la base.

## Ajout au calendrier

Deux chemins depuis le même bouton : un lien Google Agenda construit par
paramètres d'URL, et un téléchargement `.ics` qui couvre Apple Calendar, Outlook
et Thunderbird. Le fichier `.ics` est généré côté serveur avec un `UID` stable
dérivé de l'identifiant de l'événement, si bien qu'un second téléchargement après
modification met à jour l'entrée au lieu d'en créer une deuxième.

## Validation et erreurs

Zod valide les entrées dans la Server Action, jamais uniquement dans le
navigateur. Les règles qui comptent : le titre est obligatoire et limité à 120
caractères, la date de fin doit suivre la date de début, la photo doit être une
data URL d'image de moins de 200 Ko, le nombre d'accompagnants est borné entre 0
et 20.

Les erreurs remontent dans l'état du formulaire via `useActionState` et
s'affichent sous le champ concerné. Un slug inconnu rend un `notFound()`. Un
jeton admin invalide rend la même page 404 qu'un événement inexistant, pour ne
pas révéler qu'un événement existe à cette adresse. Passée la date limite de
réponse, le formulaire est remplacé par un message et l'action refuse toute
écriture, y compris si elle est rejouée directement.

## Tests

Les fonctions pures portent l'essentiel du risque et sont testées en priorité :
génération et échappement du `.ics` (retours à la ligne, virgules, pliage des
lignes à 75 octets), construction de l'URL Google, schémas de validation aux
bornes. Le parcours complet — créer, répondre, changer de réponse, voir le
décompte — est vérifié dans le navigateur avant livraison.
