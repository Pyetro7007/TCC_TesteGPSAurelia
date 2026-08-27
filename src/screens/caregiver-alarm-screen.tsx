import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

const Colors = {
  safe: '#2E7D32',
  danger: '#C62828',
  background: '#F5F5F5',
  text: '#1A1A1A',
  cardBg: '#FFFFFF',
};

interface GeofenceCoordinate {
  latitude: number;
  longitude: number;
}

// Dados mockados — em produção viriam do backend/dispositivo embarcado via HTTP/WebSocket
const CENTRO_MOCK: GeofenceCoordinate = {
  latitude: -22.936069,
  longitude: -47.088264,
};
const RAIO_MOCK = 10; // metros

export default function CaregiverAlarmScreen() {
  const [posicaoIdoso, setPosicaoIdoso] = useState<GeofenceCoordinate>(CENTRO_MOCK);
  const [estaFora, setEstaFora] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simula alarme: afasta a posição mockada do centro além do raio
  function simularSaida() {
    setPosicaoIdoso({
      latitude: CENTRO_MOCK.latitude + 0.0005, // ~55m de deslocamento
      longitude: CENTRO_MOCK.longitude,
    });
    setEstaFora(true);
    setUltimaAtualizacao(new Date());
  }

  function simularRetorno() {
    setPosicaoIdoso(CENTRO_MOCK);
    setEstaFora(false);
    setUltimaAtualizacao(new Date());
  }

  // Enquanto "fora", simula reenvio de alarme a cada 1 min (mockado a cada 10s pra facilitar teste em vídeo)
  useEffect(() => {
    if (estaFora) {
      intervalRef.current = setInterval(() => {
        setUltimaAtualizacao(new Date());
      }, 10000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [estaFora]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.cardStatus,
          { backgroundColor: estaFora ? Colors.danger : Colors.safe },
        ]}
      >
        <Text style={styles.statusTexto}>
          {estaFora ? '⚠ FORA DA ÁREA SEGURA' : '✓ Dentro da área segura'}
        </Text>
        <Text style={styles.statusHora}>
          Última atualização: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
        </Text>
      </View>

      <MapView
        style={styles.mapa}
        initialRegion={{
          latitude: CENTRO_MOCK.latitude,
          longitude: CENTRO_MOCK.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
      >
        <Circle
          center={CENTRO_MOCK}
          radius={RAIO_MOCK}
          fillColor="rgba(46, 125, 50, 0.15)"
          strokeColor={Colors.safe}
          strokeWidth={2}
        />
        <Marker
          coordinate={posicaoIdoso}
          title="Localização do idoso"
          pinColor={estaFora ? Colors.danger : Colors.safe}
        />
      </MapView>

      {/* Controles de simulação — remover quando integrar com o dispositivo real */}
      <View style={styles.controlesSimulacao}>
        <Text style={styles.labelSimulacao}>Simulação (teste sem hardware)</Text>
        <View style={styles.linhaBotoes}>
          <TouchableOpacity
            style={[styles.botaoSimulacao, { backgroundColor: Colors.danger }]}
            onPress={simularSaida}
          >
            <Text style={styles.textoBotao}>Simular saída</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botaoSimulacao, { backgroundColor: Colors.safe }]}
            onPress={simularRetorno}
          >
            <Text style={styles.textoBotao}>Simular retorno</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  cardStatus: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statusTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusHora: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 4,
    opacity: 0.9,
  },
  mapa: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  controlesSimulacao: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  labelSimulacao: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  linhaBotoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  botaoSimulacao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  textoBotao: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});