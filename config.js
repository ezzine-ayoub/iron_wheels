// config.js - Configuration centralisée du service de notifications

module.exports = {
    // Chemin vers le fichier de clé Firebase
    serviceAccountPath: "C:\\Users\\hp\\Desktop\\iron_wheels\\keyFirebase.json",
    
    // Collection Firestore pour stocker les notifications
    notificationsCollection: "notifications",
    
    // Configuration des notifications par défaut
    defaults: {
        // Données par défaut si non spécifiées
        notificationData: {
            type: "general",
            screen: "Home"
        }
    },
    
    // Tokens FCM de test (à remplacer par de vrais tokens)
    testTokens: {
        // Remplacer avec vos vrais tokens
        device1: "VOTRE_TOKEN_FCM_ICI",
        device2: "VOTRE_TOKEN_FCM_ICI"
    },
    
    // Options de retry pour les envois échoués
    retry: {
        maxAttempts: 3,
        delayMs: 1000
    },
    
    // Logs
    logging: {
        verbose: true,
        saveToFile: false
    }
};
