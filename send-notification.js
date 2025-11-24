// send-notification.ts

const admin = require("firebase-admin");

/**
 * NotificationService - Classe pour gérer les notifications Firebase
 */
class NotificationService {
    /**
     * @param {string} serviceAccountPath - Chemin vers le fichier JSON du firebase account
     */
    constructor(serviceAccountPath) {
        this.serviceAccount = require(serviceAccountPath);
        this.isInitialized = false;
    }

    /**
     * Initialiser Firebase Admin SDK
     */
    initialize() {
        if (!this.isInitialized) {
            admin.initializeApp({
                credential: admin.credential.cert(this.serviceAccount),
            });
            this.isInitialized = true;
            console.log("🔥 Firebase Admin initialized");
        }
    }

    /**
     * Envoyer une notification et l'enregistrer dans Firestore
     * @param {string} fcmToken - Token FCM de l'appareil
     * @param {Object} notification - Contenu de la notification {title, body}
     * @param {Object} data - Données supplémentaires {type, screen, id, ...}
     * @returns {Promise<Object>} Résultat {success, messageId, error}
     */
    async sendNotification(fcmToken, notification, data = {}) {
        try {
            const messagePayload = {
                token: fcmToken,
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                data: this._convertDataToStrings(data)
            };

            // Envoyer la notification via FCM
            const response = await admin.messaging().send(messagePayload);
            console.log("✅ Message sent successfully!");
            console.log("Message ID:", response);

            // Enregistrer dans Firestore
            await this._logNotification(notification, data);

            return {
                success: true,
                messageId: response,
                error: null
            };

        } catch (error) {
            return this._handleMessagingError(error, fcmToken);
        }
    }

    /**
     * Enregistrer une notification dans Firestore
     * @param {Object} notification - Contenu de la notification
     * @param {Object} data - Données supplémentaires
     * @private
     */
    async _logNotification(notification, data) {
        try {
            const notificationData = {
                ...notification,
                data: data,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            await admin.firestore().collection('notifications').add(notificationData);
            console.log("💾 Notification logged in Firestore.");

        } catch (error) {
            console.error("❌ Error logging notification:", error);
            throw error;
        }
    }

    /**
     * Récupérer toutes les notifications
     * @param {string} [notificationId] - ID optionnel pour filtrer
     * @returns {Promise<Array>} Liste des notifications
     */
    async getAllNotifications(notificationId = null) {
        try {
            let query = admin.firestore().collection('notifications');

            if (notificationId) {
                // Utiliser where sans orderBy pour éviter le besoin d'index composite
                query = query.where("data.id", "==", notificationId);
                const snapshot = await query.get();

                if (snapshot.empty) {
                    console.log("📭 No notifications found.");
                    return [];
                }

                // Trier en mémoire au lieu de dans la query
                const notifications = snapshot.docs
                    .map(doc => ({
                        docId: doc.id,
                        ...doc.data()
                    }))
                    .sort((a, b) => {
                        const aTime = a.timestamp?.toMillis() || 0;
                        const bTime = b.timestamp?.toMillis() || 0;
                        return bTime - aTime; // desc
                    });

                console.log(`📄 Found ${notifications.length} notification(s)`);
                return notifications;
            } else {
                // Sans filtre, on peut utiliser orderBy directement
                const snapshot = await query.orderBy('timestamp', 'desc').get();

                if (snapshot.empty) {
                    console.log("📭 No notifications found.");
                    return [];
                }

                const notifications = snapshot.docs.map(doc => ({
                    docId: doc.id,
                    ...doc.data()
                }));

                console.log(`📄 Found ${notifications.length} notification(s)`);
                return notifications;
            }

        } catch (error) {
            console.error("❌ Error fetching notifications:", error);
            return [];
        }
    }

    /**
     * Mettre à jour une notification par son ID
     * @param {string} notificationId - ID de la notification
     * @param {Object} newData - Nouvelles données à mettre à jour
     * @returns {Promise<number>} Nombre de documents mis à jour
     */
    async updateNotificationById(notificationId, newData) {
        try {
            const snapshot = await admin.firestore()
                .collection('notifications')
                .where("data.id", "==", notificationId)
                .get();

            if (snapshot.empty) {
                console.log("📭 No notifications found to update.");
                return 0;
            }

            const updatePromises = snapshot.docs.map(doc => 
                doc.ref.update({
                    ...newData,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                })
            );

            await Promise.all(updatePromises);
            console.log(`✅ ${snapshot.size} notification(s) updated successfully`);
            return snapshot.size;

        } catch (error) {
            console.error("❌ Error updating notifications:", error);
            throw error;
        }
    }

    /**
     * Supprimer une notification par son ID
     * @param {string} notificationId - ID de la notification
     * @returns {Promise<number>} Nombre de documents supprimés
     */
    async deleteNotificationById(notificationId) {
        try {
            const snapshot = await admin.firestore()
                .collection('notifications')
                .where("data.id", "==", notificationId)
                .get();

            if (snapshot.empty) {
                console.log("📭 No notifications found to delete.");
                return 0;
            }

            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);

            console.log(`✅ ${snapshot.size} notification(s) deleted successfully`);
            return snapshot.size;

        } catch (error) {
            console.error("❌ Error deleting notifications:", error);
            throw error;
        }
    }

    /**
     * Gérer les erreurs FCM
     * @param {Error} error - Erreur Firebase
     * @param {string} token - Token concerné
     * @returns {Object} Résultat d'erreur
     * @private
     */
    _handleMessagingError(error, token) {
        const errorCode = error.errorInfo?.code;
        let errorMessage = error.message;
        let suggestion = "";

        switch (errorCode) {
            case 'messaging/registration-token-not-registered':
                errorMessage = "Token FCM invalide ou expiré";
                suggestion = "Le token n'est plus valide. L'appareil doit se réenregistrer et obtenir un nouveau token.";
                console.error("❌ Token invalide ou expiré:", token.substring(0, 20) + "...");
                break;
            
            case 'messaging/invalid-registration-token':
                errorMessage = "Format de token FCM invalide";
                suggestion = "Vérifiez que le token FCM est correct.";
                console.error("❌ Format de token invalide:", token.substring(0, 20) + "...");
                break;
            
            case 'messaging/invalid-argument':
                errorMessage = "Arguments invalides dans le message";
                suggestion = "Vérifiez les données de la notification.";
                console.error("❌ Arguments invalides dans le message");
                break;
            
            case 'messaging/authentication-error':
                errorMessage = "Erreur d'authentification Firebase";
                suggestion = "Vérifiez votre fichier keyFirebase.json.";
                console.error("❌ Erreur d'authentification Firebase");
                break;
            
            default:
                console.error("❌ Error sending notification:", error.message);
        }

        console.error("💡 Suggestion:", suggestion);

        return {
            success: false,
            messageId: null,
            error: {
                code: errorCode,
                message: errorMessage,
                suggestion: suggestion,
                originalError: error.message
            }
        };
    }

    /**
     * Convertir toutes les valeurs en strings pour FCM data payload
     * @param {Object} data - Données à convertir
     * @returns {Object} Données converties en strings
     * @private
     */
    _convertDataToStrings(data) {
        const converted = {};
        for (const [key, value] of Object.entries(data)) {
            converted[key] = String(value);
        }
        return converted;
    }

    /**
     * Valider un token FCM
     * @param {string} token - Token à valider
     * @returns {boolean} True si le format semble valide
     */
    isValidTokenFormat(token) {
        // Format basique de validation
        return token && typeof token === 'string' && token.length > 50;
    }

    /**
     * Envoyer une notification à plusieurs appareils
     * @param {Array<string>} fcmTokens - Liste des tokens FCM
     * @param {Object} notification - Contenu de la notification
     * @param {Object} data - Données supplémentaires
     * @returns {Promise<Object>} Résultats de l'envoi
     */
    async sendMulticastNotification(fcmTokens, notification, data = {}) {
        try {
            const message = {
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                data: this._convertDataToStrings(data),
                tokens: fcmTokens
            };

            const response = await admin.messaging().sendMulticast(message);
            console.log(`✅ ${response.successCount} messages sent successfully`);
            
            if (response.failureCount > 0) {
                console.log(`❌ ${response.failureCount} messages failed`);
            }

            return response;

        } catch (error) {
            console.error("❌ Error sending multicast notification:", error);
            throw error;
        }
    }
}

// Export de la classe
module.exports = NotificationService;

// Exemple d'utilisation si le fichier est exécuté directement
if (require.main === module) {
    (async () => {
        // Initialiser le firebase
        const notificationService = new NotificationService(
            "C:\\Users\\hp\\Desktop\\iron_wheels\\keyFirebase.json"
        );
        notificationService.initialize();

        // Token FCM de test
        const FCM_TOKEN = "cujQjSKlTF2CBG9qPyfouC:APA91bHF9ovgUECw6Cq9qJvzwo4CmAuW2XEzpvtmMtDHEcHx48FEA_I1p5gUQR80nPPTfDfPPAcAul7XSfQhWwemedvDLQ-FnO563Vnz3Q4PM82cXfwHK84";

        // Validation du token
        if (!notificationService.isValidTokenFormat(FCM_TOKEN)) {
            console.error("❌ Format de token invalide!");
            return;
        }

        console.log("⚠️  ATTENTION: Ce token est probablement expiré ou invalide.");
        console.log("💡 Pour tester, obtenez un nouveau token depuis votre app mobile.\n");

        // 1. Envoyer une notification
        const result = await notificationService.sendNotification(
            FCM_TOKEN,
            {
                title: "🔥 Promo Speciale!",
                body: "Nouvelle offre disponible pour tous les membres."
            },
            {
                type: "promo",
                screen: "Offers",
                id: "12345"
            }
        );

        if (!result.success) {
            console.log("\n⚠️  La notification n'a pas pu être envoyée.");
            console.log("Erreur:", result.error.message);
            console.log("Suggestion:", result.error.suggestion);
            console.log("\n🔄 Continuer avec les autres tests...\n");
        }

        console.log("\n" + "=".repeat(70) + "\n");

        // 2. Récupérer toutes les notifications
        await notificationService.getAllNotifications("12345");

        console.log("\n" + "=".repeat(70) + "\n");

        // 3. Mettre à jour une notification
        await notificationService.updateNotificationById("12345", {
            title: "✨ New Promo!",
            body: "Updated offer available now!",
            data: { type: "promo", screen: "Offers", id: "12345" }
        });

        await notificationService.getAllNotifications("12345");

        console.log("\n" + "=".repeat(70) + "\n");

        // 4. Supprimer une notification
        await notificationService.deleteNotificationById("12345");

        console.log("\n🎉 Demo completed!\n");

    })();
}
