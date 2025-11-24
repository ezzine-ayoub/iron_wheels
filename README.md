# 🔔 Firebase Notification Service

Service de notifications Firebase professionnel et complet pour Node.js avec support Firestore.

## 📁 Structure du Projet

```
iron_wheels/
├── send-notification.ts      # Classe NotificationService (principale)
├── config.js                 # Configuration centralisée
├── examples.js               # Exemples d'utilisation
├── keyFirebase.json          # Clé de service Firebase (à protéger!)
├── firestore.indexes.json    # Définition des index Firestore
├── NOTIFICATION_GUIDE.md     # Guide complet des notifications FCM
├── FIRESTORE_INDEXES.md      # Guide des index Firestore
└── README.md                 # Ce fichier
```

## ✨ Fonctionnalités

✅ **Envoi de notifications**
- Notification simple vers un appareil
- Notifications multicast (plusieurs appareils)
- Données personnalisées avec les notifications

✅ **Gestion Firestore**
- Enregistrement automatique des notifications
- Récupération des notifications (avec/sans filtre)
- Mise à jour des notifications
- Suppression des notifications

✅ **Gestion des erreurs**
- Messages d'erreur clairs et localisés
- Suggestions de résolution automatiques
- Support pour les tokens invalides/expirés
- Pas de crash, retours structurés

✅ **Optimisations**
- Requêtes Firestore optimisées (pas besoin d'index composite)
- Tri en mémoire pour éviter les index
- Validation des tokens
- Conversion automatique des données

## 🚀 Installation

```bash
# 1. Installer les dépendances
npm install firebase-admin

# 2. Obtenir keyFirebase.json depuis Firebase Console
# Firebase Console > Project Settings > Service Accounts > Generate New Private Key

# 3. Configurer le chemin dans config.js
```

## 📖 Utilisation Rapide

### Exemple Basique

```javascript
const NotificationService = require('./send-notification');

// Initialiser le firebase
const service = new NotificationService("./keyFirebase.json");
service.initialize();

// Envoyer une notification
const result = await service.sendNotification(
    "FCM_TOKEN_ICI",
    {
        title: "🎉 Titre",
        body: "Message de la notification"
    },
    {
        type: "promo",
        screen: "Offers",
        id: "123"
    }
);

if (result.success) {
    console.log("✅ Envoyé!", result.messageId);
} else {
    console.log("❌ Erreur:", result.error.message);
}
```

### Avec Configuration

```javascript
const NotificationService = require('./send-notification');
const config = require('./config');

const service = new NotificationService(config.serviceAccountPath);
service.initialize();

// Utiliser les tokens de config
const result = await service.sendNotification(
    config.testTokens.device1,
    { title: "Test", body: "Message" },
    { type: "test", id: "1" }
);
```

## 📚 Exemples Complets

### 1. Notification Simple

```javascript
const service = new NotificationService("./keyFirebase.json");
service.initialize();

await service.sendNotification(token, {title: "Bienvenue!", body: "Merci de nous rejoindre."}, {
    type: "welcome",
    screen: "Home",
    id: "w1"
});
```

### 2. Notifications Multiples

```javascript
const tokens = ["token1", "token2", "token3"];

const result = await service.sendMulticastNotification(
    tokens,
    { title: "Alerte Groupe", body: "Nouveau message" },
    { type: "alert", id: "a1" }
);

console.log(`Succès: ${result.successCount}, Échecs: ${result.failureCount}`);
```

### 3. Gestion Firestore

```javascript
// Récupérer toutes les notifications
const all = await service.getAllNotifications();

// Récupérer par ID
const filtered = await service.getAllNotifications("promo-001");

// Mettre à jour
await service.updateNotificationById("promo-001", {
    title: "Nouveau titre",
    body: "Nouveau message"
});

// Supprimer
await service.deleteNotificationById("promo-001");
```

### 4. Avec Retry

```javascript
async function sendWithRetry(token, notification, data, maxRetries = 3) {
    for (let i = 1; i <= maxRetries; i++) {
        const result = await service.sendNotification(token, notification, data);

        if (result.success) {
            return result;
        }

        if (i < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    return {success: false, error: {message: "Max retries exceeded"}};
}
```

## 🎮 Tester

### Test Basique

```bash
# Modifier le token dans send-notification.ts (ligne ~312)
node send-notification.ts
```

### Exemples Interactifs

```bash
# Éditer examples.js et décommenter les exemples souhaités
node examples.js
```

## 🔧 API Reference

### `new NotificationService(serviceAccountPath)`

Crée une nouvelle instance du service.

**Paramètres:**
- `serviceAccountPath` (string): Chemin vers keyFirebase.json

### `initialize()`

Initialise Firebase Admin SDK. À appeler une seule fois.

### `sendNotification(fcmToken, notification, data)`

Envoie une notification à un appareil.

**Paramètres:**
- `fcmToken` (string): Token FCM de l'appareil
- `notification` (object): `{title, body}`
- `data` (object): Données personnalisées

**Retour:**
```javascript
{
    success: boolean,
    messageId: string | null,
    error: {
        code: string,
        message: string,
        suggestion: string,
        originalError: string
    } | null
}
```

### `sendMulticastNotification(fcmTokens, notification, data)`

Envoie une notification à plusieurs appareils.

**Paramètres:**
- `fcmTokens` (array): Liste de tokens FCM
- `notification` (object): `{title, body}`
- `data` (object): Données personnalisées

**Retour:**
```javascript
{
    successCount: number,
    failureCount: number,
    responses: array
}
```

### `getAllNotifications(notificationId?)`

Récupère les notifications depuis Firestore.

**Paramètres:**
- `notificationId` (string, optionnel): Filtrer par ID

**Retour:** `Array<Object>`

### `updateNotificationById(notificationId, newData)`

Met à jour des notifications par ID.

**Paramètres:**
- `notificationId` (string): ID de la notification
- `newData` (object): Nouvelles données

**Retour:** `number` (nombre de docs mis à jour)

### `deleteNotificationById(notificationId)`

Supprime des notifications par ID.

**Paramètres:**
- `notificationId` (string): ID de la notification

**Retour:** `number` (nombre de docs supprimés)

### `isValidTokenFormat(token)`

Valide le format d'un token FCM.

**Paramètres:**
- `token` (string): Token à valider

**Retour:** `boolean`

## 🐛 Résolution des Problèmes

### Token Invalide / Expiré

```
❌ Token invalide ou expiré
💡 Le token n'est plus valide. L'appareil doit se réenregistrer.
```

**Solution:** Obtenir un nouveau token FCM depuis l'application mobile.
Voir `NOTIFICATION_GUIDE.md` pour plus de détails.

### Erreur d'Index Firestore

```
❌ The query requires an index
```

**Solution:** Le code est déjà optimisé pour éviter ce problème.
Si vous voulez quand même créer l'index, voir `FIRESTORE_INDEXES.md`.

### Erreur d'Authentification

```
❌ Erreur d'authentification Firebase
```

**Solution:** Vérifier que `keyFirebase.json` est correct et à jour.

## 📖 Documentation Complète

- **NOTIFICATION_GUIDE.md** - Guide complet pour obtenir des tokens FCM
- **FIRESTORE_INDEXES.md** - Guide de configuration des index Firestore
- **examples.js** - Exemples d'utilisation détaillés

## 🔒 Sécurité

⚠️ **IMPORTANT:** 
- Ne jamais commit `keyFirebase.json` dans Git
- Ajouter à `.gitignore`
- Utiliser des variables d'environnement en production
- Valider tous les tokens avant envoi

## 📊 Performance

- ✅ Supporte des milliers de notifications
- ✅ Tri optimisé en mémoire
- ✅ Pas besoin d'index composite
- ✅ Gestion efficace des erreurs

## 🤝 Intégration Odoo

### Backend Python

```python
# Exemple d'intégration avec Odoo
from odoo import models, api
import requests

class NotificationManager(models.Model):
    _name = 'notification.manager'
    
    @api.model
    def send_to_user(self, user_id, title, body):
        user = self.env['res.users'].browse(user_id)
        
        response = requests.post(
            'http://localhost:3000/send',
            json={
                'token': user.fcm_token,
                'notification': {'title': title, 'body': body},
                'data': {'user_id': str(user_id)}
            }
        )
        
        return response.json()
```

## 📝 Licence

MIT License - Libre d'utilisation

## 👨‍💻 Support

Pour toute question ou problème:
1. Consulter la documentation complète
2. Vérifier les exemples dans `examples.js`
3. Consulter les guides spécifiques (NOTIFICATION_GUIDE.md, FIRESTORE_INDEXES.md)

---

**Version:** 1.0.0  
**Dernière mise à jour:** 2025  
**Status:** ✅ Production Ready
