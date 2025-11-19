// examples.js - Exemples d'utilisation du NotificationService

const NotificationService = require('./send-notification');
const config = require('./config');

/**
 * Exemple 1: Envoyer une notification simple
 */
async function example1_SimpleNotification() {
    console.log("📌 Exemple 1: Notification Simple\n");
    
    const service = new NotificationService(config.serviceAccountPath);
    service.initialize();
    
    const token = config.testTokens.device1;
    
    const result = await service.sendNotification(
        token,
        {
            title: "🎉 Bienvenue!",
            body: "Merci d'avoir installé notre application."
        },
        {
            type: "welcome",
            screen: "Home",
            id: "welcome-001"
        }
    );
    
    if (result.success) {
        console.log("✅ Notification envoyée avec succès!");
        console.log("Message ID:", result.messageId);
    } else {
        console.log("❌ Échec:", result.error.message);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Exemple 2: Envoyer à plusieurs appareils
 */
async function example2_MulticastNotification() {
    console.log("📌 Exemple 2: Notification Multicast\n");
    
    const service = new NotificationService(config.serviceAccountPath);
    service.initialize();
    
    const tokens = [
        config.testTokens.device1,
        config.testTokens.device2
    ];
    
    const result = await service.sendMulticastNotification(
        tokens,
        {
            title: "🔥 Nouvelle Promo!",
            body: "50% de réduction sur tous les produits!"
        },
        {
            type: "promo",
            screen: "Offers",
            id: "promo-001"
        }
    );
    
    console.log(`✅ ${result.successCount} notifications envoyées`);
    console.log(`❌ ${result.failureCount} échecs`);
    
    console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Exemple 3: Gérer les notifications dans Firestore
 */
async function example3_FirestoreOperations() {
    console.log("📌 Exemple 3: Opérations Firestore\n");
    
    const service = new NotificationService(config.serviceAccountPath);
    service.initialize();
    
    // 1. Récupérer toutes les notifications
    console.log("1️⃣ Récupération de toutes les notifications...");
    const allNotifications = await service.getAllNotifications();
    console.log(`Trouvé: ${allNotifications.length} notification(s)\n`);
    
    // 2. Récupérer par ID
    console.log("2️⃣ Récupération par ID...");
    const filtered = await service.getAllNotifications("promo-001");
    console.log(`Trouvé: ${filtered.length} notification(s) avec ID 'promo-001'\n`);
    
    // 3. Mettre à jour
    console.log("3️⃣ Mise à jour d'une notification...");
    const updated = await service.updateNotificationById("promo-001", {
        title: "🎁 Promo Mise à Jour!",
        body: "Maintenant 60% de réduction!"
    });
    console.log(`Mis à jour: ${updated} notification(s)\n`);
    
    // 4. Supprimer
    console.log("4️⃣ Suppression d'une notification...");
    const deleted = await service.deleteNotificationById("promo-001");
    console.log(`Supprimé: ${deleted} notification(s)\n`);
    
    console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Exemple 4: Notification avec retry
 */
async function example4_NotificationWithRetry() {
    console.log("📌 Exemple 4: Notification avec Retry\n");
    
    const service = new NotificationService(config.serviceAccountPath);
    service.initialize();
    
    const token = config.testTokens.device1;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Tentative ${attempt}/${maxRetries}...`);
        
        const result = await service.sendNotification(
            token,
            {
                title: "📢 Message Important",
                body: "Ceci est un message critique."
            },
            {
                type: "important",
                screen: "Inbox",
                id: "msg-001"
            }
        );
        
        if (result.success) {
            console.log("✅ Succès!");
            break;
        } else {
            console.log(`❌ Échec: ${result.error.message}`);
            
            if (attempt < maxRetries) {
                console.log("⏳ Attente avant nouvelle tentative...\n");
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log("❌ Toutes les tentatives ont échoué.");
            }
        }
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Exemple 5: Notification programmée (conceptuel)
 */
async function example5_ScheduledNotification() {
    console.log("📌 Exemple 5: Notification Programmée\n");
    
    const service = new NotificationService(config.serviceAccountPath);
    service.initialize();
    
    // Planifier pour dans 5 secondes
    const delayMs = 5000;
    console.log(`⏰ Notification programmée dans ${delayMs/1000} secondes...`);
    
    setTimeout(async () => {
        const result = await service.sendNotification(
            config.testTokens.device1,
            {
                title: "⏰ Rappel!",
                body: "Vous avez une tâche à compléter."
            },
            {
                type: "reminder",
                screen: "Tasks",
                id: "reminder-001"
            }
        );
        
        if (result.success) {
            console.log("✅ Notification programmée envoyée!");
        }
    }, delayMs);
    
    console.log("⏳ En attente...\n");
    // Attendre pour voir le résultat
    await new Promise(resolve => setTimeout(resolve, delayMs + 1000));
    
    console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Exemple 6: Validation et gestion d'erreurs
 */
async function example6_ErrorHandling() {
    console.log("📌 Exemple 6: Gestion des Erreurs\n");
    
    const service = new NotificationService(config.serviceAccountPath);
    service.initialize();
    
    // Test avec un token invalide
    const invalidToken = "INVALID_TOKEN";
    
    console.log("1️⃣ Test avec token invalide...");
    if (!service.isValidTokenFormat(invalidToken)) {
        console.log("❌ Format de token invalide détecté!\n");
    }
    
    // Test avec un token valide mais probablement expiré
    console.log("2️⃣ Test avec token valide mais expiré...");
    const expiredToken = "eXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    
    const result = await service.sendNotification(
        expiredToken,
        { title: "Test", body: "Test message" },
        { type: "test", id: "test-001" }
    );
    
    if (!result.success) {
        console.log("❌ Erreur capturée:");
        console.log("  Code:", result.error.code);
        console.log("  Message:", result.error.message);
        console.log("  Suggestion:", result.error.suggestion);
    }
    
    console.log("\n" + "=".repeat(70) + "\n");
}

// Exécuter tous les exemples
async function runAllExamples() {
    console.log("\n🚀 Démarrage des exemples...\n");
    console.log("=".repeat(70) + "\n");
    
    try {
        // Décommenter les exemples que vous voulez tester
        
        // await example1_SimpleNotification();
        // await example2_MulticastNotification();
        await example3_FirestoreOperations();
        // await example4_NotificationWithRetry();
        // await example5_ScheduledNotification();
        // await example6_ErrorHandling();
        
        console.log("🎉 Tous les exemples sont terminés!\n");
        
    } catch (error) {
        console.error("❌ Erreur lors de l'exécution des exemples:", error);
    }
}

// Exécuter si le fichier est lancé directement
if (require.main === module) {
    runAllExamples();
}

// Export pour utilisation dans d'autres fichiers
module.exports = {
    example1_SimpleNotification,
    example2_MulticastNotification,
    example3_FirestoreOperations,
    example4_NotificationWithRetry,
    example5_ScheduledNotification,
    example6_ErrorHandling
};
