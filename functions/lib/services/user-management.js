"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFCMToken = exports.createUserMapping = exports.getUserMapping = void 0;
const admin = require("firebase-admin");
/**
 * Get user identity mapping between old and new systems
 */
async function getUserMapping(identifier, db) {
    const { oldUserId, newUserId, email } = identifier;
    if (!oldUserId && !newUserId && !email) {
        throw new Error('Must provide oldUserId, newUserId, or email');
    }
    // Check if mapping exists
    let mappingDoc = null;
    if (oldUserId) {
        mappingDoc = await db.collection('user_mappings').doc(oldUserId).get();
    }
    else if (newUserId) {
        const mappingQuery = await db.collection('user_mappings').where('newUserId', '==', newUserId).limit(1).get();
        mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
    }
    else if (email) {
        const mappingQuery = await db.collection('user_mappings').where('email', '==', email).limit(1).get();
        mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
    }
    if (mappingDoc && mappingDoc.exists) {
        const data = mappingDoc.data();
        return {
            found: true,
            mapping: {
                oldUserId: (data === null || data === void 0 ? void 0 : data.oldUserId) || mappingDoc.id,
                newUserId: data === null || data === void 0 ? void 0 : data.newUserId,
                email: data === null || data === void 0 ? void 0 : data.email,
                name: data === null || data === void 0 ? void 0 : data.name,
                createdAt: data === null || data === void 0 ? void 0 : data.createdAt,
                lastUpdated: data === null || data === void 0 ? void 0 : data.lastUpdated
            }
        };
    }
    else {
        return {
            found: false,
            message: 'No mapping found'
        };
    }
}
exports.getUserMapping = getUserMapping;
/**
 * Create or update user identity mapping
 */
async function createUserMapping(mapping, db) {
    const { oldUserId, newUserId, email, name } = mapping;
    if (!oldUserId || !newUserId) {
        throw new Error('Missing required parameters: oldUserId and newUserId');
    }
    // Create or update mapping
    const mappingData = {
        oldUserId,
        newUserId,
        email: email || undefined,
        name: name || undefined,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    const mappingRef = db.collection('user_mappings').doc(oldUserId);
    const existingMapping = await mappingRef.get();
    if (existingMapping.exists) {
        await mappingRef.update(mappingData);
    }
    else {
        await mappingRef.set(Object.assign(Object.assign({}, mappingData), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    }
    return {
        success: true,
        message: 'User mapping created/updated successfully',
        mapping: {
            oldUserId,
            newUserId,
            email,
            name
        }
    };
}
exports.createUserMapping = createUserMapping;
/**
 * Sync FCM token from old Firebase project to new project
 */
async function syncFCMToken(userId, fcmToken, db) {
    if (!userId || !fcmToken) {
        throw new Error('Missing required parameters: userId and fcmToken');
    }
    // Store the FCM token in the new project for quick access
    await db.collection('fcm_tokens').doc(userId).set({
        token: fcmToken,
        userId,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return {
        success: true,
        message: 'FCM token synced successfully',
        userId
    };
}
exports.syncFCMToken = syncFCMToken;
//# sourceMappingURL=user-management.js.map