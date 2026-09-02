import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeHero } from '../../src/components/landing/HomeHero';
import { TrustBar } from '../../src/components/landing/TrustBar';
import { Categories } from '../../src/components/landing/Categories';
import { SafePayExplainer } from '../../src/components/landing/SafePayExplainer';
import { HowItWorks } from '../../src/components/landing/HowItWorks';
import { Jobs } from '../../src/components/landing/Jobs';
import { CTABand } from '../../src/components/landing/CTABand';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0EA' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <HomeHero />
          <TrustBar />
          <Categories />
          <SafePayExplainer />
          <HowItWorks />
          <Jobs />
          <CTABand />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
