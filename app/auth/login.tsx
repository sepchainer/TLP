import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
// useRouter wird hier nicht mehr zwingend benötigt, da das _layout steuert
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [weight, setWeight] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignIn = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // Keime manuelle Navigation nötig! 
            // Das _layout merkt die neue Session und leitet um.
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (!username || !weight) {
            Alert.alert('Missing fields', 'Please provide a username and weight.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;

            if (data?.user) {
                const w = parseFloat(weight) || null;
                const { error: upsertError } = await supabase
                    .from('profiles')
                    .upsert({ id: data.user.id, username, current_weight: w });
                
                if (upsertError) throw upsertError;
            } else {
                Alert.alert('Check your email', 'Please confirm your account via the link sent to your email.');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = () => {
        if (mode === 'signin') handleSignIn(); else handleSignUp();
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
        >
            <Text style={styles.title}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>

            <TextInput 
                placeholder="Email" 
                value={email} 
                onChangeText={setEmail} 
                style={styles.input} 
                keyboardType="email-address" 
                autoCapitalize="none" 
            />
            <TextInput 
                placeholder="Password" 
                value={password} 
                onChangeText={setPassword} 
                style={styles.input} 
                secureTextEntry 
            />

            {mode === 'signup' && (
                <>
                    <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />
                    <TextInput placeholder="Weight (kg)" value={weight} onChangeText={setWeight} style={styles.input} keyboardType="numeric" />
                </>
            )}

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 12 }} />
            ) : (
                <Button title={mode === 'signin' ? 'Sign In' : 'Sign Up'} onPress={onSubmit} />
            )}

            <View style={styles.switchRow}>
                <Text>{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}</Text>
                <Button 
                    title={mode === 'signin' ? 'Create' : 'Sign In'} 
                    onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} 
                />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 24, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 12 },
    switchRow: { marginTop: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
});