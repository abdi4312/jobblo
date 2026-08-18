import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0EA' }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#0B0B0B' }}>Utforsk</Text>
            </View>
        </SafeAreaView>
    );
}
