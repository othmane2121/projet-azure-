# 🗺️ Roadmap — Projet SupportMH
## Plateforme de Support Technique sur Microsoft Azure

---

## 📋 Informations du Projet

| Champ | Valeur |
|---|---|
| **Nom** | SupportMH |
| **Type** | Application web full-stack |
| **Plateforme** | Microsoft Azure (100% Cloud) |
| **URL Production** | https://support-tickets-api.azurewebsites.net |
| **Statut actuel** | ✅ Déployé et opérationnel |
| **Version** | 1.0.0 |
| **Date début** | Janvier 2026 |
| **Date livraison** | Mars 2026 |

---

## 🎯 Vision du Projet

> SupportMH est une plateforme de support technique complète permettant aux utilisateurs de soumettre des tickets, de communiquer avec des agents, et aux administrateurs de gérer l'ensemble des demandes — le tout déployé sur Microsoft Azure avec haute disponibilité et scalabilité automatique.

---

## ✅ PHASE 1 — Conception et Architecture
### Durée : Semaine 1

### 1.1 Analyse des besoins
- [x] Définir les acteurs : Utilisateurs, Agents, Administrateurs
- [x] Lister les fonctionnalités principales
- [x] Identifier les contraintes techniques (Azure for Students)
- [x] Choisir la région Azure : `norwayeast`
- [x] Rédiger le cahier des charges initial

### 1.2 Architecture technique
- [x] Choisir le stack technique : Node.js + Express + Azure SQL
- [x] Concevoir le schéma de la base de données (6 tables)
- [x] Définir les endpoints de l'API REST
- [x] Planifier les composants Azure nécessaires
- [x] Concevoir le flux de communication User ↔ Agent

### 1.3 Schéma de la base de données
- [x] Table `Utilisateurs` (id, nom, prenom, email, mot_de_passe, departement, telephone, statut)
- [x] Table `Agents` (id, nom, prenom, email, mot_de_passe, specialite, niveau, disponible)
- [x] Table `Tickets` (id, reference, titre, description, categorie, priorite, statut, sla_echeance)
- [x] Table `Commentaires` (id, ticket_id, auteur_id, auteur_type, contenu, interne, piece_jointe_url)
- [x] Table `HistoriqueTickets` (id, ticket_id, action, ancien_statut, nouveau_statut)
- [x] Table `Notifications` (id, destinataire_id, destinataire_type, titre, lu)

---

## ✅ PHASE 2 — Infrastructure Azure
### Durée : Semaine 1-2

### 2.1 Création des ressources Azure
- [x] Créer le Resource Group : `rg-support-tickets`
- [x] Créer le SQL Server : `support-tickets-sql`
- [x] Créer la base de données : `SupportTicketsDB` (SKU S2)
- [x] Créer l'App Service Plan : `asp-support-tickets` (SKU S2 Linux)
- [x] Créer la Web App : `support-tickets-api`
- [x] Créer le Storage Account : `supportmhstorage`
- [x] Créer le Function App : `support-mh-func`

### 2.2 Configuration réseau
- [x] Configurer le firewall Azure SQL (autoriser les services Azure)
- [x] Créer le réseau virtuel : `vnet-support`
- [x] Créer le sous-réseau : `subnet-appgw`
- [x] Créer l'IP publique : `pip-appgw-support`
- [x] Déployer l'Application Gateway : `appgw-support` (Standard v2)

### 2.3 Variables d'environnement
- [x] Configurer `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- [x] Configurer `JWT_SECRET`
- [x] Configurer `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- [x] Configurer `APP_URL`
- [x] Configurer `FUNC_TICKET_URL`, `FUNC_ASSIGN_URL`
- [x] Configurer `NODE_ENV=production`

---

## ✅ PHASE 3 — Développement Backend
### Durée : Semaines 2-3

### 3.1 Serveur Express (server.js)
- [x] Configuration Express + CORS + multer
- [x] Connexion Azure SQL avec pool de connexions
- [x] Middleware JWT pour l'authentification
- [x] Gestion des uploads (images, PDF, max 5 MB)
- [x] Service email Gmail SMTP (nodemailer)

### 3.2 API Authentification
- [x] `POST /api/auth/register` — Inscription utilisateur + email bienvenue
- [x] `POST /api/auth/login` — Connexion JWT (user et agent)

### 3.3 API Tickets
- [x] `POST /api/tickets` — Créer ticket + Azure Functions
- [x] `GET /api/tickets` — Lister tickets (avec filtres et pagination)
- [x] `GET /api/tickets/:id` — Détail ticket + commentaires + historique
- [x] `PATCH /api/tickets/:id/statut` — Changer statut + email notification
- [x] `PATCH /api/tickets/:id/assigner` — Assigner manuellement un agent
- [x] `POST /api/tickets/:id/commentaires` — Ajouter message + pièce jointe
- [x] `POST /api/tickets/:id/satisfaction` — Évaluation 1-5 étoiles

### 3.4 API Administration
- [x] `GET /api/admin/stats` — Statistiques globales
- [x] `GET /api/agents` — Lister agents + charge de travail
- [x] `POST /api/agents` — Créer un agent
- [x] `PUT /api/agents/:id` — Modifier un agent
- [x] `DELETE /api/agents/:id` — Supprimer un agent
- [x] `GET /api/utilisateurs` — Lister utilisateurs
- [x] `POST /api/utilisateurs` — Créer un utilisateur
- [x] `PUT /api/utilisateurs/:id` — Modifier un utilisateur
- [x] `DELETE /api/utilisateurs/:id` — Supprimer un utilisateur
- [x] `GET /health` — Health check avec statut des Functions

### 3.5 Système d'emails automatiques
- [x] Email bienvenue à l'inscription
- [x] Email confirmation création ticket (référence + SLA + agent assigné)
- [x] Email notification changement de statut
- [x] Email réponse de l'agent

---

## ✅ PHASE 4 — Azure Functions
### Durée : Semaine 3

### 4.1 Function 1 — GenerateTicketNumber
- [x] Créer le projet Function App local (`func init`)
- [x] Développer la logique de génération : `TKT-AAAA-NNNN`
- [x] Implémenter le verrou SQL (`UPDLOCK, HOLDLOCK`) pour l'unicité
- [x] Configurer `function.json` avec trigger HTTP
- [x] Tester en local sur port 7072
- [x] Déployer sur Azure (`func azure functionapp publish`)
- [x] Configurer `FUNC_TICKET_URL` dans l'App Service

### 4.2 Function 2 — AssignAgent
- [x] Développer la logique d'assignation intelligente
- [x] Critères : spécialité > urgence + niveau > charge minimale
- [x] Requête SQL optimisée avec `GROUP BY` et `ORDER BY`
- [x] Configurer `function.json` avec trigger HTTP POST
- [x] Tester en local
- [x] Déployer sur Azure
- [x] Configurer `FUNC_ASSIGN_URL` dans l'App Service

### 4.3 Fallback automatique
- [x] Implémenter la logique locale si Function indisponible
- [x] Logs d'avertissement en cas de fallback
- [x] Vérification dans le health check

---

## ✅ PHASE 5 — Développement Frontend
### Durée : Semaines 3-4

### 5.1 Page d'accueil (index.html)
- [x] Design dark theme moderne
- [x] Hero section avec statistiques
- [x] Section fonctionnalités (6 cartes)
- [x] Section "Comment ça marche" (4 étapes)
- [x] Section témoignages
- [x] CTA final
- [x] Footer
- [x] Animations CSS (fadeUp, pulse)
- [x] Design responsive (mobile, tablette, desktop)

### 5.2 Portail Utilisateur (/user)
- [x] Formulaire d'inscription (nom, prénom, email, mot de passe, département)
- [x] Formulaire de connexion
- [x] Tableau de bord avec KPIs personnels
- [x] Formulaire de création de ticket (titre, description, catégorie, priorité, pièce jointe)
- [x] Liste des tickets avec filtres par statut
- [x] Vue détail ticket avec historique
- [x] Interface de messagerie avec l'agent
- [x] Envoi de pièces jointes dans les messages
- [x] Évaluation de satisfaction (1-5 étoiles)
- [x] Lightbox pour visualiser les images
- [x] Bouton actualiser les messages
- [x] Affichage du SLA avec indicateur coloré

### 5.3 Portail Admin (/admin)
- [x] Formulaire de connexion agent
- [x] Dashboard avec KPIs (total, urgents, ouverts, résolus)
- [x] Graphique évolution 30 jours (Chart.js)
- [x] Graphique répartition par catégorie (donut Chart.js)
- [x] Liste complète des tickets avec filtres et recherche
- [x] Interface de messagerie avec tous les utilisateurs
- [x] Réponse aux messages avec pièces jointes
- [x] Changement de statut des tickets
- [x] Assignation manuelle d'un agent
- [x] Gestion CRUD des agents
- [x] Gestion CRUD des utilisateurs
- [x] Indicateurs SLA (vert/orange/rouge)

---

## ✅ PHASE 6 — Haute Disponibilité
### Durée : Semaine 4

### 6.1 Autoscaling
- [x] Créer la règle autoscale sur l'App Service Plan
- [x] Configurer minimum 2 instances permanentes
- [x] Règle Scale-OUT : CPU > 70% → +1 instance (cooldown 5 min)
- [x] Règle Scale-IN : CPU < 30% → -1 instance (cooldown 10 min)
- [x] Maximum 10 instances

### 6.2 Disponibilité
- [x] Activer Always On (pas de cold start)
- [x] Désactiver ARR Affinity (load balancing équitable)
- [x] Configurer Health Check sur `/health`
- [x] Déployer l'Application Gateway (Standard v2)
- [x] Configurer le backend pool vers l'App Service
- [x] Configurer le health probe HTTPS sur `/health`

### 6.3 Monitoring
- [x] Créer alerte CPU > 80% (Azure Monitor)
- [x] Créer alerte erreurs 5xx > 10 (Azure Monitor)
- [x] Vérification périodique via health check

---

## ✅ PHASE 7 — Sécurité
### Durée : Semaine 3-4

### 7.1 Authentification
- [x] Hashage des mots de passe avec bcrypt (10 rounds)
- [x] Tokens JWT signés (expiration 7 jours)
- [x] Séparation des rôles : `utilisateur` vs `agent`
- [x] Vérification du rôle à chaque requête API
- [x] Isolation : un user ne voit que ses propres tickets

### 7.2 Base de données
- [x] Connexion chiffrée SSL/TLS (`encrypt: true`)
- [x] Firewall Azure SQL : seuls les services Azure autorisés
- [x] Requêtes SQL paramétrées (anti-injection SQL)
- [x] Credentials dans les variables d'environnement Azure

### 7.3 Uploads
- [x] Taille maximale : 5 MB par fichier
- [x] Types autorisés : jpg, jpeg, png, gif, pdf, doc, docx
- [x] Noms de fichiers générés automatiquement (horodatage)

### 7.4 Azure Functions
- [x] Authentification par clé de fonction
- [x] URLs non exposées publiquement
- [x] Variables SQL dans les App Settings Azure

---

## ✅ PHASE 8 — Déploiement et Tests
### Durée : Semaine 4

### 8.1 Déploiement Backend
- [x] Construire le dossier `build/` avec tous les fichiers
- [x] Déployer via `az webapp up --sku S2 --runtime NODE:20-lts`
- [x] Vérifier le démarrage avec `/health`
- [x] Tester tous les endpoints API
- [x] Corriger bug `interne='false'` (FormData string vs boolean)
- [x] Ajouter colonnes manquantes (`piece_jointe_url`, `derniere_connexion`)

### 8.2 Déploiement Azure Functions
- [x] Créer les fichiers `index.js` et `function.json` sans backticks PowerShell
- [x] Déployer avec `func azure functionapp publish support-mh-func --node`
- [x] Récupérer la clé master
- [x] Configurer `FUNC_TICKET_URL` et `FUNC_ASSIGN_URL`
- [x] Tester `GenerateTicketNumber` sur Azure
- [x] Tester `AssignAgent` sur Azure

### 8.3 Tests fonctionnels
- [x] Inscription utilisateur + email reçu
- [x] Connexion utilisateur et agent
- [x] Création ticket → référence Azure Function → agent assigné auto
- [x] Envoi message utilisateur → visible côté admin
- [x] Réponse admin → visible côté utilisateur
- [x] Email reçu à chaque action
- [x] Upload pièce jointe + visualisation lightbox
- [x] Changement statut + email notification
- [x] Évaluation satisfaction

### 8.4 Tests de charge
- [x] Vérifier autoscaling avec Azure Monitor
- [x] Vérifier Health Check toutes les minutes
- [x] Vérifier Application Gateway en production

---

## ✅ PHASE 9 — Corrections et Bugs
### Durée : Semaine 4-5

### Bugs corrigés
- [x] **Bug #1** : Messages utilisateur non visibles → `interne='false'` (string) évalué truthy → fix `interneVal` avec comparaison stricte
- [x] **Bug #2** : Agents avec hash bcrypt invalide → script `create-agents.js` pour recréer
- [x] **Bug #3** : Colonne `piece_jointe_url` manquante → `ALTER TABLE Commentaires ADD piece_jointe_url`
- [x] **Bug #4** : Colonne `derniere_connexion` manquante → `ALTER TABLE Agents ADD derniere_connexion`
- [x] **Bug #5** : Portails 404 → ancien server.js non redéployé → `az webapp up`
- [x] **Bug #6** : Azure Functions — backticks PowerShell corrompaient les template literals JS
- [x] **Bug #7** : Autoscaling sur Web App (non supporté) → déplacé sur App Service Plan
- [x] **Bug #8** : Application Gateway inaccessible → probe HTTP → changé en HTTPS port 443

---

## ✅ PHASE 10 — Documentation
### Durée : Semaine 5

### 10.1 Documentation technique
- [x] Cahier des charges complet (13 sections, 25+ pages)
- [x] Résumé simplifié du cahier des charges (8 sections)
- [x] Roadmap du projet (ce document)
- [x] Schéma d'architecture interactif
- [x] Documentation API REST (tous les endpoints)

### 10.2 Documentation utilisateur
- [x] Guide de connexion (identifiants admin)
- [x] Guide de déploiement (14 étapes)
- [x] Guide de configuration Azure Functions
- [x] Guide de présentation du projet

---

## 🔮 PHASE 11 — Améliorations Futures
### Statut : Planifié

### 11.1 Fonctionnalités
- [ ] Notifications temps réel (Azure SignalR ou WebSockets)
- [ ] Application mobile (React Native ou PWA)
- [ ] Base de connaissance / FAQ auto-assistance
- [ ] Rapports PDF automatiques des tickets résolus
- [ ] Intégration Microsoft Teams pour les agents
- [ ] Tableau de bord analytics avancé (Application Insights)
- [ ] Chatbot IA pour pré-qualification des tickets
- [ ] Système de SLA automatique avec escalade

### 11.2 Améliorations techniques
- [ ] Migration vers Azure Kubernetes Service (AKS)
- [ ] Cache Redis pour les sessions et données fréquentes
- [ ] CDN Azure pour les fichiers statiques
- [ ] Sauvegarde SQL automatique vers Azure Blob Storage
- [ ] CI/CD avec GitHub Actions (déploiement automatique)
- [ ] Tests unitaires et d'intégration automatisés (Jest)
- [ ] SSL personnalisé avec Azure Key Vault
- [ ] Rate limiting et protection DDoS

### 11.3 Sécurité avancée
- [ ] Authentification multi-facteurs (MFA)
- [ ] Azure Active Directory (SSO entreprise)
- [ ] WAF sur Application Gateway
- [ ] Audit logs Azure Monitor complets
- [ ] Chiffrement des pièces jointes au repos

---

## 📊 Récapitulatif des Composants

### Ressources Azure créées
| Ressource | Nom | SKU | Statut |
|---|---|---|---|
| Resource Group | rg-support-tickets | — | ✅ Actif |
| SQL Server | support-tickets-sql | — | ✅ Actif |
| SQL Database | SupportTicketsDB | S2 | ✅ Actif |
| App Service Plan | asp-support-tickets | S2 Linux | ✅ Actif |
| Web App | support-tickets-api | — | ✅ Actif |
| Function App | support-mh-func | Consumption | ✅ Actif |
| Storage Account | supportmhstorage | Standard LRS | ✅ Actif |
| Application Gateway | appgw-support | Standard v2 | ✅ Actif |
| Autoscaling | autoscale-support | 2→10 instances | ✅ Actif |

### Technologies utilisées
| Catégorie | Technologie | Version |
|---|---|---|
| Runtime serveur | Node.js | 20 LTS |
| Framework API | Express.js | 4.18 |
| Base de données | Azure SQL / mssql | S2 / 10.0 |
| Authentification | jsonwebtoken + bcryptjs | 9.0 / 2.4 |
| Email | nodemailer + Gmail SMTP | 6.9 |
| Upload | multer | 1.4 |
| Functions | Azure Functions Core Tools | v4 |
| Frontend | HTML5 + CSS3 + Vanilla JS | — |
| Graphiques | Chart.js | 4.4 |
| Polices | Clash Display + Satoshi | — |

---

## 🔑 Identifiants de Production

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | admin@support.com | Admin2024! |
| Agent Senior | sophie.martin@support.com | Admin2024! |
| Agent N2 | pierre.dubois@support.com | Admin2024! |

---

## 📈 Métriques de Haute Disponibilité

| Paramètre | Configuration |
|---|---|
| Instances minimum | 2 |
| Instances maximum | 10 |
| Scale-OUT | CPU > 70% → +1 instance |
| Scale-IN | CPU < 30% → -1 instance |
| Health Check | /health toutes les minutes |
| Always On | Activé |
| ARR Affinity | Désactivé |
| Alerte CPU | > 80% |
| Alerte erreurs | 5xx > 10 |

---

## 🏁 État Final du Projet

```
✅ Phase 1  — Conception et Architecture     TERMINÉE
✅ Phase 2  — Infrastructure Azure           TERMINÉE
✅ Phase 3  — Développement Backend          TERMINÉE
✅ Phase 4  — Azure Functions                TERMINÉE
✅ Phase 5  — Développement Frontend         TERMINÉE
✅ Phase 6  — Haute Disponibilité            TERMINÉE
✅ Phase 7  — Sécurité                       TERMINÉE
✅ Phase 8  — Déploiement et Tests           TERMINÉE
✅ Phase 9  — Corrections et Bugs            TERMINÉE
✅ Phase 10 — Documentation                  TERMINÉE
🔮 Phase 11 — Améliorations Futures         PLANIFIÉ
```

---

