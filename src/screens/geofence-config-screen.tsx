// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, MapPressEvent } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
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

// Raio mínimo recomendado — abaixo disso o ruído do GPS (mesmo com filtro) gera falsos alarmes
// TEMP: 5m só para testes — trocar para 10 antes da entrega/gravação final
const RAIO_MINIMO_SEGURO = 5;

export default function GeofenceScreen() {
  // Posição inicial padrão (Campinas/SP como fallback caso o GPS não responda)
  const [centro, setCentro] = useState<GeofenceCoordinate>({
    latitude: -22.936069,
    longitude: -47.088264,
  });
  const [raio, setRaio] = useState(RAIO_MINIMO_SEGURO);
  const [ipEsp, setIpEsp] = useState('IP_ESP'); // IP da sua rede
  const [carregando, setCarregando] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(true);

  const mapRef = useRef<MapView>(null);

  // Busca a localização do celular assim que a tela abre
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permissão Negada',
            'Não foi possível obter a localização do celular. Usando ponto padrão.'
          );
          setBuscandoGps(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const novaCoordenada = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setCentro(novaCoordenada);

        mapRef.current?.animateToRegion(
          {
            ...novaCoordenada,
            latitudeDelta: 0.003,
            longitudeDelta: 0.003,
          },
          1000
        );
      } catch (error) {
        console.error('Erro ao buscar localização do celular:', error);
      } finally {
        setBuscandoGps(false);
      }
    })();
  }, []);

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setCentro({ latitude, longitude });
  }

  async function handleSalvar() {
    if (!ipEsp) {
      Alert.alert('Atenção', 'Informe o IP do ESP32 impresso no Serial.');
      return;
    }

    if (raio < RAIO_MINIMO_SEGURO) {
      Alert.alert(
        'Raio muito pequeno',
        `Um raio menor que ${RAIO_MINIMO_SEGURO}m pode gerar alarmes falsos por imprecisão do GPS. Deseja salvar mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salvar mesmo assim', onPress: enviarAoDispositivo },
        ]
      );
      return;
    }

    enviarAoDispositivo();
  }

  async function enviarAoDispositivo() {
    setCarregando(true);

    try {
      await salvarAreaSegura(
        {
          latitude: centro.latitude,
          longitude: centro.longitude,
          raio: raio,
        },
        ipEsp
      );

      Alert.alert(
        'Perímetro Enviado!',
        `Configuração enviada ao ESP32 com sucesso!\n\nCentro: ${centro.latitude.toFixed(
          6
        )}, ${centro.longitude.toFixed(6)}\nRaio: ${raio}m`
      );
    } catch (error) {
      Alert.alert(
        'Falha na Comunicação',
        `Não foi possível enviar ao ESP32 no IP (${ipEsp}). Verifique se ambos estão na mesma rede Wi-Fi.`
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
          Toque no mapa para mudar o centro da área ou use sua posição atual
        </Text>

        <View style={styles.ipContainer}>
          <Text style={styles.labelIp}>IP do ESP32:</Text>
          <TextInput
            style={styles.inputIp}
            value={ipEsp}
            onChangeText={setIpEsp}
            placeholder="Ex: IP_ESP"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.mapa}
            initialRegion={{
              latitude: centro.latitude,
              longitude: centro.longitude,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
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

          {buscandoGps && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Obtendo sua localização...</Text>
            </View>
          )}
        </View>

        <View style={styles.controles}>
          <Text style={styles.labelRaio}>
            Raio: {raio}m (diâmetro: {raio * 2}m)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={RAIO_MINIMO_SEGURO}
            maximumValue={50}
            step={1}
            value={raio}
            onValueChange={setRaio}
            minimumTrackTintColor={Colors.primary}
          />
          <Text style={styles.avisoRaio}>
            Raio mínimo recomendado: {RAIO_MINIMO_SEGURO}m (imprecisão do GPS)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.botaoSalvar, carregando && styles.botaoDesabilitado]}
          onPress={handleSalvar}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotao}>Salvar no Dispositivo</Text>
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
    marginBottom: 8,
  },
  ipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  labelIp: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: 8,
  },
  inputIp: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: Colors.text,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapa: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  controles: {
    marginTop: 12,
  },
  labelRaio: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  avisoRaio: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  botaoSalvar: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
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