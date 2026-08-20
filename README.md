# Convier

Crée un événement, partage un lien. Tes invités disent s'ils viennent,
l'ajoutent à leur agenda d'un clic, et retrouvent leur réponse depuis
n'importe quel appareil.

## Démarrer

```bash
npm install && npm run dev
```

L'application tourne sur http://localhost:3000 et crée sa base SQLite dans
`data/local.db` au démarrage. Deux réglages sont nécessaires, dans `.env.local` :

```
AUTH_SECRET=n-importe-quelle-chaine-en-developpement
WHITELIST_FILE=./data/whitelist.txt
```

Sans transport SMTP configuré, le code de connexion s'affiche dans les logs du
serveur — le parcours complet reste donc utilisable en local.

```bash
npm test        # tests unitaires (node --test)
npm run build   # build de production
npm run lint
```

## Comment ça marche

Tout le monde se connecte avec son adresse e-mail et un code à six chiffres :
pas de mot de passe, et surtout une réponse qui appartient à une personne plutôt
qu'à un navigateur. C'est ce qui permet de répondre depuis son téléphone et de
corriger depuis son ordinateur.

Le compte porte le prénom et la photo, réutilisés d'un événement à l'autre, et
donne accès à l'historique des invitations sur `/profil`. Les photos sont
recadrées en vignette 256×256 dans le navigateur avant l'envoi et stockées en
data URL : aucun service de stockage externe n'est requis.

**La liste blanche ne filtre que la création d'un événement.** N'importe qui
peut se connecter et répondre ; seules les adresses listées voient le
formulaire de création, et l'action serveur refuse même si on la rejoue.

## Liste blanche

`WHITELIST_FILE` désigne un fichier partagé entre plusieurs applications :

```
# les amis
camille@exemple.fr, lea@exemple.fr
mehdi@exemple.fr
```

Virgules, points-virgules et retours à la ligne se mélangent librement, les
lignes commençant par `#` sont ignorées, et la casse n'a pas d'importance. Le
fichier est relu dès que sa date de modification change : ajouter une adresse
ne demande pas de redéploiement.

Fichier absent, illisible, ou variable non définie : **personne** ne peut créer
d'événement et l'erreur est journalisée. L'application continue de fonctionner
normalement pour tout le reste.

## Migration depuis la version sans comptes

Les réponses d'avant appartenaient à des navigateurs et n'ont pas d'adresse
e-mail. Rien n'est détruit : la table `guests` devient une archive.

Sauvegarde d'abord le volume — trente secondes, et tout le reste devient
rattrapable :

```bash
docker run --rm -v convier-data:/data -v "$PWD":/backup alpine \
  cp /data/local.db /backup/convier-$(date +%F).db
```

**1.** Déployer. Les nouvelles tables, les colonnes `guests.email` et
`guests.migrated_at`, et la reconstruction de `events` sans `admin_token` se
font au démarrage.

**2.** Lister les réponses à rattacher, avec le nom que la personne avait donné :

```bash
docker exec <conteneur> node -e '
const {createClient}=require("/app/node_modules/@libsql/client");
createClient({url:"file:/app/data/local.db"})
  .execute("select g.id, g.name, e.title from guests g join events e on e.id=g.event_id where g.migrated_at is null order by g.name")
  .then(r=>{r.rows.forEach(x=>console.log(`${x.id}\t${x.name}\t${x.title}`));process.exit(0)});'
```

**3.** Renseigner les adresses, en complétant la liste de couples :

```bash
docker exec <conteneur> node -e '
const {createClient}=require("/app/node_modules/@libsql/client");
const c=createClient({url:"file:/app/data/local.db"});
const couples = [
  ["g1","lea@exemple.fr"],
  ["g2","mehdi@exemple.fr"],
];
(async()=>{ for (const [id,email] of couples) {
  await c.execute({sql:"update guests set email=? where id=?",args:[email,id]});
} console.log("fait"); process.exit(0); })();'
```

**4.** Redémarrer le conteneur. Chaque ligne pourvue d'une adresse devient un
compte et une réponse ; les autres restent dans `guests`, intactes. Les logs
disent combien ont été promues.

**5.** Réclamer les événements d'avant, qui n'ont pas de propriétaire et que
personne ne pourrait donc administrer. À faire après t'être connecté une fois,
pour que ton compte existe :

```bash
docker exec <conteneur> node -e '
const {createClient}=require("/app/node_modules/@libsql/client");
const c=createClient({url:"file:/app/data/local.db"});
const EMAIL="toi@exemple.fr";
(async()=>{
  const u=await c.execute({sql:"select id from users where email=?",args:[EMAIL]});
  if(!u.rows.length){console.log("connecte-toi une fois d abord");process.exit(1);}
  const r=await c.execute({sql:"update events set host_user_id=? where host_user_id is null",args:[u.rows[0].id]});
  console.log("événements réclamés :", r.rowsAffected); process.exit(0);
})();'
```

L'étape 3 peut être répétée au fil de l'eau : la promotion est idempotente, et
une réponse retirée après coup n'est pas ressuscitée par un redémarrage.

Si tu restaures une sauvegarde dans le volume, rends la main à l'utilisateur du
conteneur, sinon l'application refusera de démarrer :

```bash
docker run --rm -v convier-data:/data alpine chown -R 1000:1000 /data
```

## Albums photo Immich

Renseigner `IMMICH_URL` et `IMMICH_API_KEY` fait apparaître une case à la
création d'un événement, et un bouton sur la page d'administration pour les
événements déjà créés. L'album est créé avec un lien public autorisant le dépôt,
affiché à tous les invités sur la page de l'événement.

L'album est créé **après** l'événement : une panne d'Immich n'empêche jamais
d'inviter des gens, et le bouton d'administration sert alors à réessayer.

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
  lib/            fonctions pures : ics, fuseaux, validation, photo,
                  liste blanche, codes, migration, client Immich
```

Chaque module de `lib/` a une responsabilité unique et ses propres tests. Les
pages sont des composants serveur qui lisent la base directement ; les
mutations passent par des Server Actions. La seule route API est celle qui sert
le fichier `.ics`, parce qu'elle doit répondre avec ses propres en-têtes.

## Déployer sur Komodo

Le dépôt contient tout ce dont un Stack Komodo a besoin à sa racine :
`compose.yaml` et le `Dockerfile` qu'il référence. En mode **Git repo**, Komodo
clone le dépôt sur le serveur puis lance compose depuis ce clone — le
`build: context: .` trouve donc le Dockerfile et Komodo construit l'image
lui-même. Aucun registre externe n'est nécessaire.

Configuration du Stack :

| Champ | Valeur |
|---|---|
| Mode | Git repo |
| Repo / Branch | ton dépôt, `main` |
| Run directory | `.` (racine du dépôt) |
| File paths | `compose.yaml` |

Dans le champ **Environment** du Stack — Komodo l'écrit dans un `.env` qu'il
passe à compose via `--env-file` :

```
CONVIER_HOST=convier.limperiam.com
AUTH_SECRET=<openssl rand -hex 32>
WHITELIST_HOST_FILE=/srv/limperiam/whitelist.txt
SMTP_HOST=...
IMMICH_URL=...
IMMICH_API_KEY=...
```

`WHITELIST_HOST_FILE` est le chemin **sur le serveur**, obligatoirement absolu
et hors du dépôt : Komodo reclone le dépôt à chaque déploiement, un chemin
relatif y serait donc écrasé. Le fichier doit exister avant le premier
déploiement — Docker crée un répertoire à la place d'un fichier absent, et
l'application ne verrait alors jamais aucune adresse autorisée.

Ce nom d'hôte alimente à la fois la règle de routage Traefik et `SITE_URL`,
l'origine publique utilisée pour les liens montrés à l'organisateur et pour
l'URL inscrite dans le `.ics`. Les faire dériver d'une même variable évite le
cas pénible où le proxy sert un domaine pendant que l'app envoie des liens vers
un autre. Si l'origine publique doit différer de `https://CONVIER_HOST`, pose
`SITE_URL` explicitement : elle prime.

Ce champ accepte l'interpolation des Variables et Secrets Komodo avec la
syntaxe à doubles crochets, si tu préfères centraliser la valeur :

```
CONVIER_HOST=[[CONVIER_HOST]]
```

### Traefik

Le service se rattache au réseau externe `traefik` et porte les labels de
routage ; il ne publie **aucun port** sur l'hôte. Traefik le joint par le
réseau docker sur le port 3000, ce qui évite d'exposer l'app en HTTP clair à
côté du HTTPS servi par le proxy. Le réseau doit exister sur le serveur :

```bash
docker network create traefik   # si ce n'est pas déjà fait
```

Le volume nommé `convier-data` monté sur `/app/data` porte la base SQLite.
C'est la seule chose à ne pas perdre : les redéploiements et les mises à jour
d'image le laissent intact, mais un `down -v` efface tous les événements.

Un webhook sur le dépôt permet de redéployer automatiquement à chaque push.

## Déploiement

L'application parle à libSQL. En local c'est un fichier ; en production, pointe
`DATABASE_URL` vers une base [Turso](https://turso.tech) — le code ne change
pas.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | `file:./data/local.db` par défaut, ou `libsql://…` en production |
| `DATABASE_AUTH_TOKEN` | jeton Turso, en production uniquement |
| `SITE_URL` | origine publique utilisée dans les liens partagés et le `.ics` ; déduite des en-têtes de la requête si absente |
| `AUTH_SECRET` | **obligatoire** — sel des codes de connexion (`openssl rand -hex 32`) |
| `WHITELIST_FILE` | fichier des adresses autorisées à créer un événement |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | envoi des codes ; absentes, le code est journalisé |
| `IMMICH_URL`, `IMMICH_API_KEY` | albums photo partagés ; absentes, la fonctionnalité est masquée |

Volontairement pas préfixée `NEXT_PUBLIC_` : ces variables-là sont figées à la
compilation, ce qui lierait une image construite à un seul domaine. `SITE_URL`
est lue côté serveur à chaque requête, donc la même image sert n'importe quel
hôte.
