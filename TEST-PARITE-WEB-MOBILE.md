# Scénario de test — Parité données Mobile ↔ Web

> **Objectif** : s'assurer que l'app mobile (Expo) affiche **exactement les
> mêmes valeurs** que le portail web pour un même livreur, sur le même
> backend Spring Boot.
>
> **Pré-requis** : web ouvert dans un navigateur + mobile lancé via Expo Go,
> les deux pointant sur le **même** `EXPO_PUBLIC_API_BASE_URL` (cf.
> `gestion-livraison-mobile/.env`).
>
> **Compte de test** : un livreur réel, avec
>   - ≥ 3 clients (1 avec prix de vente, 1 sans, 1 catégorie remise)
>   - ≥ 1 livraison `ENCAISSEE`, 1 `LIVREE` aujourd'hui, 1 `LIVREE` > 30j
>   - ≥ 1 versement, ≥ 1 encaissement
>   - ≥ 1 achat fournisseur récent (alimente le stock)
>
> **Méthode** : pour chaque scénario, faire l'action sur les deux côtés,
> noter les valeurs, vérifier qu'elles concordent au centime / à l'unité.

---

## A. Authentification et dashboard d'accueil

| # | Action | Web | Mobile | Doit matcher |
|---|--------|-----|--------|---|
| A.1 | Connexion avec mêmes credentials | Login OK → Tournée | Login OK → Tournée | Nom + rôle livreur |
| A.2 | Tournée du jour, header | Total CA jour | Total CA jour | **Identique au franc** |
| A.3 | Tournée du jour, marge | Total marge cumulée | Banner "Marge" | **Identique** |
| A.4 | Cards de statuts | Encaissée / Livrée / Impayée | 3 cards en haut | **Mêmes counts** |

---

## B. Liste des livraisons (Tournée)

| # | Action | À comparer |
|---|--------|------------|
| B.1 | Filtre "Aujourd'hui" sur les deux | Nombre de lignes affichées |
| B.2 | Filtre "Cette semaine" | Nombre de lignes |
| B.3 | Filtre "Ce mois" | Nombre de lignes |
| B.4 | Pour chaque ligne : client, montant livré, statut | **Match exact** |
| B.5 | Total CA banner / footer | **Match au franc** |
| B.6 | Total marge (Plan D : Σ qteLivree × margeUnitaire) | **Match au franc** |
| B.7 | Recherche par nom client | Mêmes résultats |
| B.8 | Tap sur une livraison → détail | Lignes produits, qté, prix, sous-total identiques |

---

## C. Liste clients

| # | Action | À comparer |
|---|--------|------------|
| C.1 | Onglet Clients | Nombre total de clients du livreur |
| C.2 | Pour les 3 premiers : prénom + nom + téléphone | **Identique caractère par caractère** |
| C.3 | Encours par client | Σ montant des livraisons `LIVREE` non encaissées — **doit matcher** |
| C.4 | Solde par client | (Σ livraisons − Σ encaissements) signé — **doit matcher** |
| C.5 | Recherche par nom / téléphone | Mêmes résultats |
| C.6 | Tap sur client → détail | Adresse, quartier, catégorie, prix de vente par défaut, remise — **identiques** |

> ℹ️ Le calcul du solde mobile (`lib/credit.ts`) miroir 1:1 du web
> (`computeSoldeForClient`). En cas de divergence : c'est un bug.

---

## D. Création d'un nouveau client (Step 1 + Step 2)

| # | Action | Vérification |
|---|--------|--------------|
| D.1 | Step 1 : ouvrir le dropdown **Zone** | Mêmes zones que la page web `/admin/zones` |
| D.2 | Choisir une zone, ouvrir **Quartier** | Mêmes quartiers, **filtrés** par la zone choisie |
| D.3 | Ouvrir **Catégorie** | Mêmes catégories que `/admin/categories` |
| D.4 | Toggle « Avec remise » | Persistance correcte |
| D.5 | Submit côté mobile | Le client apparaît immédiatement sur le web après refresh |
| D.6 | Step 2 : géolocalisation manuelle | Le `latitudeLongitude` est bien `lat,lng` (séparé par virgule) |
| D.7 | Champs back-office (admin web) | `prenom`, `nom`, `contact`, `email`, `adresse`, `quartierId`, `categorieId`, `livreurId`, `prixDeVenteProduitParDefault=0`, `avecOuSansRemise` — **tous présents** |

---

## E. Nouvelle livraison — cœur du business

> ⚠️ **C'est ici que les bugs prix / quantité signalés par toi se vérifient.**

| # | Action | À vérifier |
|---|--------|------------|
| E.1 | Sélectionner même client sur web et mobile | Prix de vente par défaut affiché — **identique** |
| E.2 | Ajouter même produit (chip catalogue) | Le prix unitaire pré-rempli est identique au web |
| E.3 | **Cas client SANS prixDeVenteProduitParDefault** | Le mobile affiche une bordure rouge + « Définis un prix unitaire » |
| E.4 | Saisir un prix manuellement dans le champ Prix | Tap sur le champ → tout le contenu sélectionné, retape direct OK |
| E.5 | Saisir une quantité dans le champ Qté | Tap → tout sélectionné → retape direct OK |
| E.6 | Sous-total par ligne | `prix × qte` — **identique au web** |
| E.7 | Total livraison | Σ sous-totaux — **identique** |
| E.8 | Tenter de submit avec `prix=0` sur une ligne | Bloqué : « Définis un prix unitaire (> 0) pour chaque ligne » |
| E.9 | Submit OK → refresh tournée web | La nouvelle livraison apparaît avec **mêmes lignes, prix, qtés** |
| E.10 | Cliquer sur la livraison fraîchement créée | Marge unitaire (Plan D) renseignée côté backend, identique |

---

## F. Encaissement (Cash → encaisser)

| # | Action | À vérifier |
|---|--------|------------|
| F.1 | Choisir client, mode « Solde libre », montant 5 000 | OK sur les deux |
| F.2 | Mode « Sur une période », dates picker | Plage envoyée correcte (`dateDebut`, `dateFin` ISO yyyy-MM-dd) |
| F.3 | Submit → vérifier solde du client (Section C.4) | Diminué exactement de 5 000 sur les deux |
| F.4 | Réessayer en doublon (chevauchement de période) | Mêmes erreurs backend remontées sur les deux |

---

## G. Versement fournisseur (Cash → versement)

| # | Action | À comparer |
|---|--------|------------|
| G.1 | Choisir fournisseur | Mêmes fournisseurs disponibles |
| G.2 | Période 7 derniers jours | Card "Situation" : `valeurAchat`, `margeCumulee`, `detteAvant`, `totalDu` — **identiques au franc** |
| G.3 | Quick-fill « Verser tout (totalDu) » | Montant rempli identique |
| G.4 | Mode libre vs période | Mêmes contraintes back-office |
| G.5 | Submit → recharger | Versement enregistré, dette `detteApres` recalculée, **identique** |

---

## H. Stock (livreur)

| # | Action | À vérifier |
|---|--------|------------|
| H.1 | Onglet Stock (caché → menu Plus) | Liste produits + stock courant livreur — **identique au web** |
| H.2 | Déclarer un achat fournisseur (3 produits) | Soumission OK, stock courant incrémenté **du même delta** sur les deux |
| H.3 | Faire une livraison consommant 2 unités | Stock courant décrémenté de 2 sur les deux |
| H.4 | Faire un retour client de 1 unité (cf. I.) | Stock courant ré-incrémenté de 1 sur les deux |

---

## I. Retour client (Cash → retour-client)

| # | Action | À vérifier |
|---|--------|------------|
| I.1 | Liste des livraisons retournables (30j, retournables) | Mêmes livraisons proposées |
| I.2 | Choisir une livraison, saisir qté retour | Max calculé = `qteLivre − qteRetourne` — **identique** |
| I.3 | Submit | Total retour déduit du solde client + stock ré-incrémenté |
| I.4 | Recharger les deux apps | Solde client, stock, livraison source — **tous identiques** |

---

## J. Cas limites (edge cases)

| # | Cas | Comportement attendu |
|---|-----|----------------------|
| J.1 | Client sans aucune livraison | Encours = 0, Solde = 0 sur les deux |
| J.2 | Livraison entièrement retournée | Statut conservé, stock OK, solde OK |
| J.3 | Hors-ligne mobile (couper le wifi) | Bouton submit grisé + message « Hors ligne » sur encaisser/versement/retour |
| J.4 | Token expiré | Refresh auto → re-login transparent (cf. axios interceptor) |
| J.5 | Livreur supplanté par admin | Le livreur ne voit que ses propres clients / livraisons |

---

## K. Marge cristallisée Plan D (point critique)

> ⚠️ Le mobile lit la marge depuis `produitLivraison.margeUnitaire` (Plan D
> backend) — **pas** un calcul fait côté front. Vérifier que :

| # | Action | À vérifier |
|---|--------|------------|
| K.1 | Créer une livraison aujourd'hui avec un produit | `margeUnitaire = prixDeVente − prixAchatLivreurMoyen` calculée côté back |
| K.2 | Vérifier sur le détail livraison mobile | La marge affichée = `Σ qteLivree × margeUnitaire` |
| K.3 | Comparer avec le web | **Identique au franc** |
| K.4 | Modifier le prix d'achat fournisseur après coup | La marge des **anciennes** livraisons reste figée (cristallisée) |

---

## Procédure de signalement d'un écart

Si une valeur diverge entre web et mobile :

1. **Capturer** les deux écrans côte-à-côte (screenshot)
2. **Noter** :
   - Endpoint impacté (réseau → onglet Network web ou logs Expo)
   - ID des entités concernées (`clientId`, `livraisonId`, etc.)
   - Filtre / période actif
3. **Vérifier d'abord** que les deux apps lisent bien le **même backend**
   (URL dans `.env` mobile vs `VITE_API_URL` web)
4. **Vider le cache** de la query mobile (TanStack Query persiste 24h
   dans AsyncStorage) : forcer un swipe-to-refresh ou réinstaller l'app
5. **Reproduire** le scénario sur le compte de test
6. **Ouvrir un ticket** avec captures + payload réseau

---

## Checklist finale

- [ ] A — Auth + dashboard
- [ ] B — Liste livraisons (tournée)
- [ ] C — Liste clients (encours + solde)
- [ ] D — Création client (zones, quartiers, catégories)
- [ ] E — Nouvelle livraison (prix éditable + selectTextOnFocus)
- [ ] F — Encaissement (libre + période)
- [ ] G — Versement fournisseur (situation 7j)
- [ ] H — Stock courant
- [ ] I — Retour client
- [ ] J — Edge cases (offline, token, scoping)
- [ ] K — Marge cristallisée Plan D

> ✅ Tous les scénarios passent → l'app mobile est en parité fonctionnelle
> avec le portail web pour le profil livreur.
