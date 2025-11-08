// Reusable component to display errors
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ErrorMessageProps {
    message: string;
    onDismiss?: () => void;
    type?: 'error' | 'warning' | 'info';
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
    message, 
    onDismiss,
    type = 'error' 
}) => {
    if (!message) return null;

    const getBackgroundColor = () => {
        switch (type) {
            case 'error':
                return 'rgba(220, 38, 38, 0.95)'; // Red
            case 'warning':
                return 'rgba(245, 158, 11, 0.95)'; // Orange
            case 'info':
                return 'rgba(59, 130, 246, 0.95)'; // Blue
            default:
                return 'rgba(220, 38, 38, 0.95)';
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'error':
                return '#DC2626';
            case 'warning':
                return '#F59E0B';
            case 'info':
                return '#3B82F6';
            default:
                return '#DC2626';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            case 'info':
                return 'ℹ️';
            default:
                return '❌';
        }
    };

    return (
        <View 
            style={[
                styles.container,
                { 
                    backgroundColor: getBackgroundColor(),
                    borderLeftColor: getBorderColor(),
                    shadowColor: getBorderColor(),
                }
            ]}
        >
            <View style={styles.content}>
                <Text style={styles.icon}>{getIcon()}</Text>
                <Text style={styles.message}>{message}</Text>
            </View>
            
            {onDismiss && (
                <TouchableOpacity 
                    style={styles.dismissButton}
                    onPress={onDismiss}
                >
                    <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        fontSize: 18,
        marginRight: 10,
    },
    message: {
        flex: 1,
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    dismissButton: {
        padding: 4,
        marginLeft: 8,
    },
    dismissText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default ErrorMessage;
