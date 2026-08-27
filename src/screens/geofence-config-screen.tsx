import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import MapView, { Circle, Marker, MapPressEvent } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { salvarAreaSegura } from '../services/api';

const Colors = {
  primary: '#2E7D32',
  danger: '#C62828',
  background: '#F5F5F5',
  text: '#1A1A1A',
  circleFill: 'rgba(46, 125, 50, 0.15)',
  circleStroke: '#2E7D32',
};

interface GeofenceCoordinate {
  latitude: number;
  longitude: number;
}

export default function GeofenceScreen() {
  const [centro, setCentro] = useState<GeofenceCoordinate>({
    latitude: -22.936069,
    longitude: -47.088264,
  });
  const [raio, setRaio] = useState(10);
  const [carregando, setCarregando] = useState(false);

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setCentro({ latitude, longitude });
  }

  async function handleSalvar() {
    setCarregando(true);

    try {
      await salvarAreaSegura({
        latitude: centro.latitude,
        longitude: centro.longitude,
        raio: raio,
      });

      Alert.alert(
        'Perímetro salvo',
        `Área salva com sucesso no servidor!\n\nCentro: ${centro.latitude.toFixed(6)}, ${centro.longitude.toFixed(6)}\nRaio: ${raio}m`
      );
    } catch (error) {
      Alert.alert(
        'Erro ao salvar',
        'Não foi possível conectar à API. Verifique sua conexão.'
      );
      console.error(error);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <Text style={styles.titulo}>Definir área segura</Text>
        <Text style={styles.subtitulo}>
          Toque no mapa para marcar o centro da área e ajuste o raio abaixo
        </Text>

        <MapView
          style={styles.mapa}
          initialRegion={{
            latitude: centro.latitude,
            longitude: centro.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          onPress={handleMapPress}
        >
          <Marker coordinate={centro} title="Centro da área segura" />
          <Circle
            center={centro}
            radius={raio}
            fillColor={Colors.circleFill}
            strokeColor={Colors.circleStroke}
            strokeWidth={2}
          />
        </MapView>

        <View style={styles.controles}>
          <Text style={styles.labelRaio}>
            Raio: {raio}m (diâmetro: {raio * 2}m)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={10}
            maximumValue={50}
            step={1}
            value={raio}
            onValueChange={setRaio}
            minimumTrackTintColor={Colors.primary}
          />
          {raio < 10 && (
            <Text style={styles.aviso}>
              ⚠ Raios menores que 10m podem gerar alarmes falsos por imprecisão do GPS
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.botaoSalvar, carregando && styles.botaoDesabilitado]}
          onPress={handleSalvar}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotao}>Salvar área segura</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitulo: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  mapa: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  controles: {
    marginTop: 16,
  },
  labelRaio: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  aviso: {
    fontSize: 13,
    color: Colors.danger,
    marginTop: 4,
  },
  botaoSalvar: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  textoBotao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});