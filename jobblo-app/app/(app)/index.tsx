import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0EA' }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#0B0B0B', letterSpacing: -1 }}>
                    jobblo
                </Text>
                <Text style={{ marginTop: 8, fontSize: 15, color: '#63665F' }}>
                    Hjem-skjermen. Kommer snart.
                </Text>
            </View>
        </SafeAreaView>
    );
}
